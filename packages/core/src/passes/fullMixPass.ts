
import { packGridCore, type GridVolume, type GridPlacement } from '../packGridCore';
import { findRemainingSpaces, mapToRealCoordinates } from '../virtualContainer';
import type { Dimensions, ContainerLoad, PlacedItem, Material } from '../types';

export interface FullMixResult {
    placements: PlacedItem[];
    placedCount: number;
    consumedVolume: number;
    remainingQuantity: number;
}

export function runFullMixPass(
    material: Material,
    load: ContainerLoad,
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number },
    remainingQuantity: number,
    totalPackedSoFar: number,
    excludeTop: boolean = false,
    fullMixRotations?: import('../types').FullMixRotations
): FullMixResult {
    const result: FullMixResult = {
        placements: [],
        placedCount: 0,
        consumedVolume: 0,
        remainingQuantity: remainingQuantity
    };

    console.log(`[FULL-MIX] Starting with remainingQty=${remainingQuantity}`);
    if (fullMixRotations) {
        console.log(`[FULL-MIX] Custom Rotations:`, fullMixRotations);
    } else {
        console.log(`[FULL-MIX] Default Rotations: ALL`);
    }

    if (!load || !load.items || !containerDims) {
        console.warn(`[FULL-MIX] Invalid load or container dimensions.`);
        return result;
    }

    if (remainingQuantity <= 0) {
        console.log(`[FULL-MIX] No remaining quantity, stopping`);
        return result;
    }

    // Check quota against global total
    const globalRemaining = material.quantity - totalPackedSoFar;
    const effectiveRemaining = Math.min(remainingQuantity, globalRemaining);

    if (effectiveRemaining <= 0) {
        console.log(`[FULL-MIX] Global quota reached (Total: ${totalPackedSoFar}, Max: ${material.quantity}). Skipping.`);
        return { ...result, remainingQuantity };
    }

    // Find all remaining spaces
    const virtualContainers = findRemainingSpaces(load, containerDims, margins, excludeTop);
    console.log('[FULL-MIX] Virtual containers found:', virtualContainers.length);

    if (virtualContainers.length === 0) {
        return result;
    }

    const boxDims = material.box.dimensions;
    let remaining = effectiveRemaining;

    // Try each virtual container
    for (let i = 0; i < virtualContainers.length; i++) {
        if (remaining <= 0) {
            console.log(`[FULL-MIX] remainingQty=0, break`);
            break;
        }

        const vc = virtualContainers[i];

        // Use user-provided rotations if available, otherwise default to ALL
        const allowed = fullMixRotations || { x: true, y: true, z: true };
        const orientations = generateOrientations(boxDims, allowed);

        let bestPlacements: GridPlacement[] = [];
        let bestOrientation: Dimensions | null = null;

        for (const orient of orientations) {
            // Check if orientation fits even one item (Early exit)
            if (orient.length > vc.length || orient.width > vc.width || orient.height > vc.height) {
                continue;
            }

            // Create volume for packGridCore
            // Note: VC uses standard coords.
            // packGridCore volume origin is relative to the VC origin (0,0,0) inside the VC context.
            const volume: GridVolume = {
                origin: { x: 0, y: 0, z: 0 },
                bounds: {
                    length: vc.length,
                    width: vc.width,
                    height: vc.height
                }
            };

            const placements = packGridCore(volume, orient);

            if (placements.length > bestPlacements.length) {
                bestPlacements = placements; // These are GridPlacement[]
                bestOrientation = orient;
            }
        }

        if (bestPlacements.length > 0 && bestOrientation) {
            // Take only what we need
            const toTake = Math.min(bestPlacements.length, remaining);
            const placedNow: PlacedItem[] = [];

            console.log(`[FULL-MIX] VC#${i} placing ${toTake}`);

            for (let k = 0; k < toTake; k++) {
                const p = bestPlacements[k];
                // packGridCore returns [Width, Length, Height]. We map to [Length, Height, Width]
                // But wait, kernelToPlacedPosition does [p[1], p[2], p[0]].
                // Let's verify kernelToPlacedPosition usage matches packGridCore output.
                const placedPos = kernelToPlacedPosition(p.position);

                // Map to Real Coordinates (VC Origin + Placed Pos)
                const virtualPlacement: PlacedItem = {
                    position: placedPos,
                    rotation: [0, 0, 0],
                    dimensions: bestOrientation!,
                    type: 'box',
                    itemCount: 1,
                    materialId: material.id,
                    locked: false,
                    source: 'FULL_MIX'
                };

                placedNow.push(mapToRealCoordinates(virtualPlacement, vc));

                result.consumedVolume += bestOrientation!.length * bestOrientation!.width * bestOrientation!.height;
            }

            result.placements.push(...placedNow);
            result.placedCount += toTake;
            remaining -= toTake;
            console.log(`[FULL-MIX] remainingQty=${remaining}`);
        } else {
            console.log(`[FULL-MIX] VC#${i} - No fit found (Dims: ${vc.length}x${vc.width}x${vc.height})`);
        }
    }

    result.remainingQuantity = remaining;

    return result;
}

function generateOrientations(dims: Dimensions, allowed: { x: boolean; y: boolean; z: boolean }): Dimensions[] {
    const { length: L, width: W, height: H } = dims;
    const orientations: Dimensions[] = [];

    // Generate based on allowed rotations
    // y (Horizontal): Height = H
    if (allowed.y || (!allowed.x && !allowed.y && !allowed.z)) {
        orientations.push({ length: L, width: W, height: H });
        orientations.push({ length: W, width: L, height: H });
    }
    // x (Vertical): Height = L
    if (allowed.x) {
        orientations.push({ length: W, width: H, height: L });
        orientations.push({ length: H, width: W, height: L });
    }
    // z (Flat): Height = W
    if (allowed.z) {
        orientations.push({ length: L, width: H, height: W });
        orientations.push({ length: H, width: L, height: W });
    }

    if (orientations.length === 0) {
        orientations.push({ length: L, width: W, height: H });
    }

    // Filter duplicates?
    return orientations;
}

function kernelToPlacedPosition(p: [number, number, number]): [number, number, number] {
    return [p[1], p[2], p[0]]; // [Length, Height, Width] from [Width, Length, Height]
}
