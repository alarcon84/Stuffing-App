
/**
 * FULL_MIX PASS — Greedy Single-Best-Space Loop
 *
 * FIX (v0.1.6+): Multi-material sequential order restoration via Y-region isolation.
 *   - Added `yRangeFilter` parameter: when in Sequential mode for later materials,
 *     only Virtual Containers whose origin.y >= yRangeFilter.min are eligible.
 *     This prevents Mat2/Mat3 from stealing Y-region gaps that belong to Mat1.
 *   - Removed the old materialIndex 50% conservative cap (was an incomplete workaround).
 *   - VOLUME_CEILING is 0.98 in Sequential mode (breathing room), 0.995 otherwise.
 *   - MAX_ITERATIONS = 20 for all materials (no longer artificially throttled).
 *
 * FIX (v0.1.4): Rewrote from multi-VC sequential loop to greedy single-best loop.
 *   ROOT CAUSE: VCs were computed once per while-iteration, inner for-loop placed into
 *   multiple VCs without refreshing free-space → stale overlaps → volume > 100%.
 *
 * ALGORITHM:
 *   1. Recompute ALL virtual containers (basic + skyline) from CURRENT load every cycle.
 *   2. For each VC × orientation, find the single best (VC, orientation) pair.
 *   3. Place ONLY those items, validating each with hasPhysicalSupport AND doesOverlap3D.
 *   4. Immediately update the load object.
 *   5. If nothing was placed → break.
 *
 * KERNEL_CONTRACT: packGridCore remains the sole source of coordinates. It sees one
 * GridVolume at a time and knows nothing about materials or mixing.
 */

import { packGridCore, type GridVolume, type GridPlacement } from '../packGridCore';
import { findRemainingSpaces, findTopSurfaces, mapToRealCoordinates, type VirtualContainer } from '../virtualContainer';
import { hasPhysicalSupport } from '../utils';

import type { Dimensions, ContainerLoad, PlacedItem, Material } from '../types';

export interface FullMixResult {
    placements: PlacedItem[];
    placedCount: number;
    consumedVolume: number;
    remainingQuantity: number;
}

/**
 * Check if a candidate item overlaps any existing item in 3D (AABB collision).
 * Returns true if there IS an overlap (i.e., placement is invalid).
 */
function doesOverlap3D(candidate: PlacedItem, existingItems: PlacedItem[]): boolean {
    const cL = candidate.dimensions.length;
    const cH = candidate.dimensions.height;
    const cW = candidate.dimensions.width;

    for (const other of existingItems) {
        const oL = other.dimensions.length;
        const oH = other.dimensions.height;
        const oW = other.dimensions.width;

        // AABB overlap: all three axes must overlap simultaneously
        // Using 0.5mm tolerance to avoid floating-point false positives
        const overlapX = Math.abs(candidate.position[0] - other.position[0]) < (cL + oL) / 2 - 0.5;
        const overlapY = Math.abs(candidate.position[1] - other.position[1]) < (cH + oH) / 2 - 0.5;
        const overlapZ = Math.abs(candidate.position[2] - other.position[2]) < (cW + oW) / 2 - 0.5;

        if (overlapX && overlapY && overlapZ) {
            return true; // Collision detected
        }
    }
    return false;
}

export function runFullMixPass(
    material: Material,
    load: ContainerLoad,
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number },
    remainingQuantity: number,
    totalPackedSoFar: number,
    excludeTop: boolean = false,
    fullMixRotations?: import('../types').FullMixRotations,
    materialIndex: number = 0,
    yRangeFilter?: { min: number; max: number }
): FullMixResult {
    const result: FullMixResult = {
        placements: [],
        placedCount: 0,
        consumedVolume: 0,
        remainingQuantity: remainingQuantity
    };

    if (!load || !load.items || !containerDims) {
        console.warn(`[FULL-MIX] Invalid load or container dimensions.`);
        return result;
    }

    if (remainingQuantity <= 0) {
        return result;
    }

    // Check quota against global total
    const globalRemaining = material.quantity - totalPackedSoFar;
    let effectiveRemaining = Math.min(remainingQuantity, globalRemaining);

    if (effectiveRemaining <= 0) {
        return { ...result, remainingQuantity };
    }

    const boxDims = material.box.dimensions;
    const allowed = fullMixRotations || { x: true, y: true, z: true };
    const orientations = generateOrientations(boxDims, allowed);

    // Container volume for safety guard
    const containerVolume = containerDims.length * containerDims.width * containerDims.height;

    // Safety ceiling: 98% for Sequential mode (breathing room), 99.5% otherwise
    const isSequentialLater = materialIndex > 0;
    const VOLUME_CEILING = isSequentialLater ? 0.98 : 0.995;

    const MAX_ITERATIONS = 20;

    let iterations = 0;

    // GREEDY SINGLE-BEST-SPACE LOOP
    while (effectiveRemaining > 0 && iterations < MAX_ITERATIONS) {
        iterations++;

        // Pre-check: if current load is already near the volume ceiling, stop
        const currentLoadVol = load.items.reduce((s, i) =>
            s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);
        if (currentLoadVol >= containerVolume * VOLUME_CEILING) {
            break; // Already at ceiling
        }

        // 1. Recompute ALL virtual containers from CURRENT load state
        const vcsBasic = findRemainingSpaces(load, containerDims, margins, excludeTop, yRangeFilter);

        let vcsSkyline: VirtualContainer[] = [];
        if (!excludeTop) {
            vcsSkyline = findTopSurfaces(load, containerDims, margins, yRangeFilter);
        }

        const virtualContainers = [...vcsBasic, ...vcsSkyline];

        if (virtualContainers.length === 0) {
            break; // No more space
        }

        // 2. Find the SINGLE BEST (VC, orientation) pair across ALL VCs
        let bestPlacements: GridPlacement[] = [];
        let bestOrientation: Dimensions | null = null;
        let bestVC: VirtualContainer | null = null;

        for (const vc of virtualContainers) {
            for (const orient of orientations) {
                // Quick check: does orientation fit at all?
                if (orient.length > vc.length || orient.width > vc.width || orient.height > vc.height) {
                    continue;
                }

                const volume: GridVolume = {
                    origin: { x: 0, y: 0, z: 0 },
                    bounds: {
                        length: vc.length,
                        width: vc.width,
                        height: vc.height
                    }
                };

                const placements = packGridCore(volume, orient);

                let usable = Math.min(placements.length, effectiveRemaining);

                if (usable > bestPlacements.length) {
                    bestPlacements = placements.slice(0, usable);
                    bestOrientation = orient;
                    bestVC = vc;
                }
            }
        }

        // 3. Place items from the single best (VC, orientation)
        if (bestPlacements.length === 0 || !bestOrientation || !bestVC) {
            break; // No viable placement found
        }

        const toTake = Math.min(bestPlacements.length, effectiveRemaining);
        const placedNow: PlacedItem[] = [];

        // All items currently in the load (base + previously placed in this pass)
        const allExistingItems = [...load.items];

        for (let k = 0; k < toTake; k++) {
            const p = bestPlacements[k];
            const placedPos = kernelToPlacedPosition(p.position);

            const virtualPlacement: PlacedItem = {
                position: [placedPos[0], placedPos[1], placedPos[2]],
                rotation: [0, 0, 0],
                dimensions: bestOrientation!,
                type: 'box',
                itemCount: 1,
                materialId: material.id,
                locked: false,
                source: 'FULL_MIX'
            };

            const realItem = mapToRealCoordinates(virtualPlacement, bestVC!);

            // VALIDATE: Physical support check
            const tempLoad: ContainerLoad = {
                ...load,
                items: [...allExistingItems, ...placedNow]
            };

            if (!hasPhysicalSupport(realItem, tempLoad, margins.height ?? 20)) {
                continue; // Skip unsupported items
            }

            // VALIDATE: 3D overlap check (AABB collision)
            if (doesOverlap3D(realItem, [...allExistingItems, ...placedNow])) {
                continue; // Skip overlapping items
            }

            // VALIDATE: Volume ceiling check per-item
            const itemVol = realItem.dimensions.length * realItem.dimensions.width * realItem.dimensions.height;
            const projectedVol = currentLoadVol + result.consumedVolume +
                placedNow.reduce((s, pi) => s + pi.dimensions.length * pi.dimensions.width * pi.dimensions.height, 0) + itemVol;
            if (projectedVol > containerVolume * VOLUME_CEILING) {
                break; // Stop placing — would exceed ceiling
            }

            placedNow.push(realItem);
        }

        if (placedNow.length === 0) {
            break; // No progress — all items failed validation
        }

        // 4. Commit placements and IMMEDIATELY update load
        result.placements.push(...placedNow);
        result.placedCount += placedNow.length;
        result.consumedVolume += placedNow.length *
            (bestOrientation!.length * bestOrientation!.width * bestOrientation!.height);
        effectiveRemaining -= placedNow.length;

        // Update load for the NEXT iteration (fresh VC computation will see these items)
        load = {
            ...load,
            items: [...load.items, ...placedNow]
        };
    }

    // SAFETY GUARD — verify total volume doesn't exceed container (hard ceiling)
    const baseVolume = load.items.reduce((s, i) =>
        s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);

    const passVolume = result.placements.reduce((s, p) =>
        s + p.dimensions.length * p.dimensions.width * p.dimensions.height, 0);

    const totalVolume = baseVolume + passVolume;

    if (totalVolume > containerVolume * VOLUME_CEILING) {
        console.warn(`[FULL-MIX] SAFETY TRIM: Volume ${totalVolume.toFixed(0)} exceeds ${(VOLUME_CEILING * 100).toFixed(1)}% ceiling by ${(totalVolume / containerVolume * 100 - VOLUME_CEILING * 100).toFixed(1)}%`);

        // Trim excess from the end
        while (result.placements.length > 0 &&
            baseVolume + result.placements.reduce((s, p) => s + p.dimensions.length * p.dimensions.width * p.dimensions.height, 0) > containerVolume * VOLUME_CEILING) {
            const removed = result.placements.pop()!;
            result.placedCount--;
            result.consumedVolume -= removed.dimensions.length * removed.dimensions.width * removed.dimensions.height;
            effectiveRemaining++;
        }
    }

    result.remainingQuantity = effectiveRemaining;

    const finalPassVol = result.placements.reduce((s, p) =>
        s + p.dimensions.length * p.dimensions.width * p.dimensions.height, 0);
    console.log(`[FULL-MIX] Mat${material.id} placed ${result.placedCount} items in ${iterations} iters. ` +
        `Volume: ${finalPassVol.toFixed(0)}/${containerVolume.toFixed(0)} ` +
        `(${((baseVolume + finalPassVol) / containerVolume * 100).toFixed(1)}% total)` +
        (yRangeFilter ? ` [Y-range: ${yRangeFilter.min.toFixed(0)}–${yRangeFilter.max.toFixed(0)}]` : ''));

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

    return orientations;
}

function kernelToPlacedPosition(p: [number, number, number]): [number, number, number] {
    return [p[1], p[2], p[0]]; // [Length, Height, Width] from [Width, Length, Height]
}
