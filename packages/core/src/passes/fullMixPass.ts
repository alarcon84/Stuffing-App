
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

import { packGridCore, type GridVolume } from '../packGridCore';
import { findRemainingSpaces, findTopSurfaces, mapToRealCoordinates, createFrontVC, createSideVC, createTopVC, type VirtualContainer } from '../virtualContainer';
import { hasPhysicalSupport } from '../utils';

import type { Dimensions, ContainerLoad, PlacedItem, Material } from '../types';

export interface FullMixResult {
    placements: PlacedItem[];
    placedCount: number;
    consumedVolume: number;
    remainingQuantity: number;
    virtualContainers?: VirtualContainer[];
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
    strictMaterialIsolation?: boolean,
    globalVCQueue: VirtualContainer[] = []
): FullMixResult {
    const result: FullMixResult = {
        placements: [],
        placedCount: 0,
        consumedVolume: 0,
        remainingQuantity: remainingQuantity,
        virtualContainers: []
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

    // Strict Isolation: Compute the minimum X boundary of THIS material
    let minX = Infinity;
    if (strictMaterialIsolation) {
        const myItems = load.items.filter(i => i.materialId === material.id);
        if (myItems.length === 0) {
            // Material hasn't packed anything in this container yet!
            // Its boundary should be the absolute highest X coordinate of ALL items packed by previous materials!
            let prevMaxX = 0;
            for (const item of load.items) {
                const ix = item.position[0] + item.dimensions.length / 2;
                if (ix > prevMaxX) prevMaxX = ix;
            }
            minX = prevMaxX;
        } else {
            for (const item of myItems) {
                const ix1 = item.position[0] - item.dimensions.length / 2;
                if (ix1 < minX) minX = ix1;
            }
        }
    }

    // GREEDY SINGLE-BEST-SPACE LOOP
    while (effectiveRemaining > 0 && iterations < MAX_ITERATIONS) {
        iterations++;

        // Pre-check: if current load is already near the volume ceiling, stop
        const currentLoadVol = load.items.reduce((s, i) =>
            s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);
        if (currentLoadVol >= containerVolume * VOLUME_CEILING) {
            break; // Already at ceiling
        }

        // 1. Recompute ALL virtual containers from CURRENT load state IF QUEUE IS EMPTY FOR THIS LOAD
        let virtualContainers = globalVCQueue.filter(vc => vc.realContainerId === load.id);

        if (virtualContainers.length === 0) {
            // yRangeFilter has been removed from these calls as strictMaterialIsolation handles it at the VC selection level
            const vcsBasic = findRemainingSpaces(load, containerDims, margins, excludeTop);

            let vcsSkyline: VirtualContainer[] = [];
            if (!excludeTop) {
                vcsSkyline = findTopSurfaces(load, containerDims, margins);
            }

            globalVCQueue.push(...vcsBasic, ...vcsSkyline);
            virtualContainers = globalVCQueue.filter(vc => vc.realContainerId === load.id);
        }

        if (virtualContainers.length === 0) {
            break; // No more space
        }

        // 2. Find the SINGLE BEST (VC, orientation) pair across ALL VCs
        //
        // STAGE-DRIVEN FIX: selectedMaterial is ALWAYS the current pass material.
        // The old findBestMaterialForSpace() branch (SMART_STACK cross-material selection)
        // is disabled. Smart behavior (filling prior VCs) is achieved by the stage
        // driver passing accumulated currentLoads as initialLoads — not by picking a
        // different material inside this pass.
        let bestValidPlacements: PlacedItem[] = [];
        let bestOrientation: Dimensions | null = null;
        let bestVC: VirtualContainer | null = null;
        const selectedMaterial: Material = material; // Always current material

        const allExistingItems = [...load.items];

        for (const vc of virtualContainers) {
            for (const orient of orientations) {
                if (orient.length > vc.length || orient.width > vc.width || orient.height > vc.height) {
                    continue;
                }

                const volume: GridVolume = {
                    origin: { x: 0, y: 0, z: 0 },
                    bounds: { length: vc.length, width: vc.width, height: vc.height }
                };

                const placements = packGridCore(volume, orient);

                if (placements.length === 0) continue;

                // Test these placements physically to ensure they actually fit and aren't floating
                const validPlacedNow: PlacedItem[] = [];
                const tempLoad: ContainerLoad = { ...load, items: [...allExistingItems] };

                for (let k = 0; k < placements.length; k++) {
                    if (validPlacedNow.length >= effectiveRemaining) break;

                    const p = placements[k];
                    const placedPos = kernelToPlacedPosition(p.position);

                    const virtualPlacement: PlacedItem = {
                        position: [placedPos[0], placedPos[1], placedPos[2]],
                        rotation: [0, 0, 0],
                        dimensions: orient,
                        type: 'box',
                        itemCount: 1,
                        materialId: selectedMaterial.id,
                        locked: false,
                        source: 'FULL_MIX',
                        vcId: vc.id
                    };

                    const realItem = mapToRealCoordinates(virtualPlacement, vc);

                    // VALIDATE: Strict Material Isolation check
                    if (strictMaterialIsolation) {
                        const itemMinX = realItem.position[0] - realItem.dimensions.length / 2;
                        // Tolerance of 10mm to avoid floating point strictness throwing out valid sequence edge items
                        if (itemMinX < minX - 10) {
                            continue;
                        }
                    }

                    // VALIDATE: Physical support check
                    if (!hasPhysicalSupport(realItem, tempLoad, margins.height ?? 20)) {
                        continue;
                    }

                    // VALIDATE: 3D overlap check (AABB collision)
                    if (doesOverlap3D(realItem, [...allExistingItems, ...validPlacedNow])) {
                        continue;
                    }

                    // VALIDATE: Volume ceiling check per-item
                    const itemVol = realItem.dimensions.length * realItem.dimensions.width * realItem.dimensions.height;
                    const projectedVol = currentLoadVol +
                        validPlacedNow.reduce((s, pi) => s + pi.dimensions.length * pi.dimensions.width * pi.dimensions.height, 0) + itemVol;
                    if (projectedVol > containerVolume * VOLUME_CEILING) {
                        break; // Stop placing this orientation — would exceed ceiling
                    }

                    validPlacedNow.push(realItem);
                    tempLoad.items.push(realItem);
                }

                if (validPlacedNow.length > bestValidPlacements.length) {
                    bestValidPlacements = validPlacedNow;
                    bestOrientation = orient;
                    bestVC = vc;
                }
            }
        }

        // 3. Place items from the single BEST VALID (VC, orientation)
        if (bestValidPlacements.length === 0 || !bestOrientation || !bestVC) {
            break; // No viable placement found in any VC
        }

        const placedNow = bestValidPlacements;

        if (placedNow.length === 0) {
            break; // No progress — all items failed validation
        }

        // 4. Commit placements and IMMEDIATELY update load
        console.log(`[FULL-MIX PLACEMENT] VC: ${bestVC?.id}, Dims: ${bestOrientation?.length}x${bestOrientation?.width}x${bestOrientation?.height}, Count: ${placedNow.length}`);

        result.placements.push(...placedNow);
        result.placedCount += placedNow.length;
        result.consumedVolume += placedNow.length *
            (bestOrientation!.length * bestOrientation!.width * bestOrientation!.height);

        // Collect the VC that was used
        if (bestVC && result.virtualContainers) {
            // Check if we already have this exact VC ID to avoid duplicates
            if (!result.virtualContainers.some(vc => vc.id === bestVC.id)) {
                result.virtualContainers.push(bestVC);
            }

            // PHASE 2 - Guillotine Cuts: Consume the VC and append new free space
            const vcIndex = globalVCQueue.findIndex(v => v.id === bestVC!.id);
            if (vcIndex !== -1) {
                globalVCQueue.splice(vcIndex, 1);
            }

            // Calculate bounding box of placed items
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            for (const p of placedNow) {
                const rx = p.position[0] - p.dimensions.length / 2;
                const ry = p.position[1] - p.dimensions.height / 2;
                const rz = p.position[2] - p.dimensions.width / 2;
                const rX = p.position[0] + p.dimensions.length / 2;
                const rY = p.position[1] + p.dimensions.height / 2;
                const rZ = p.position[2] + p.dimensions.width / 2;
                if (rx < minX) minX = rx;
                if (ry < minY) minY = ry;
                if (rz < minZ) minZ = rz;
                if (rX > maxX) maxX = rX;
                if (rY > maxY) maxY = rY;
                if (rZ > maxZ) maxZ = rZ;
            }
            const blockLength = maxX - minX;
            const blockHeight = maxY - minY;
            const blockWidth = maxZ - minZ;

            const frontVC = createFrontVC(bestVC, blockLength, blockWidth, blockHeight);
            const sideVC = createSideVC(bestVC, blockLength, blockWidth, blockHeight);
            const topVC = createTopVC(bestVC, blockLength, blockWidth, blockHeight);

            if (frontVC) globalVCQueue.push(frontVC);
            if (sideVC) globalVCQueue.push(sideVC);
            if (topVC) {
                globalVCQueue.push(topVC);
            }
        }

        // 5. Update state for NEXT iteration
        effectiveRemaining -= placedNow.length;

        // Update load for the NEXT iteration (though space is now in globalVCQueue, we still need load for bounding checks)
        load = {
            ...load,
            items: [...load.items, ...placedNow]
        };
    }

    // SAFETY GUARD — verify total volume doesn't exceed container (hard ceiling)
    // In the while loop, `load.items` is updated to include `placedNow` at the end of every iteration.
    // Thus `load.items` already contains all items from `result.placements`.
    // We compute the true total volume by summing solely over `load.items`.
    let totalVolume = load.items.reduce((s, i) =>
        s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);

    if (totalVolume > containerVolume * VOLUME_CEILING) {
        console.warn(`[FULL-MIX] SAFETY TRIM: Volume ${totalVolume.toFixed(0)} exceeds ${(VOLUME_CEILING * 100).toFixed(1)}% ceiling by ${((totalVolume / containerVolume * 100) - (VOLUME_CEILING * 100)).toFixed(1)}%`);

        // Trim excess from the end
        while (result.placements.length > 0 && totalVolume > containerVolume * VOLUME_CEILING) {
            const removed = result.placements.pop()!;
            result.placedCount--;
            const itemVol = removed.dimensions.length * removed.dimensions.width * removed.dimensions.height;
            result.consumedVolume -= itemVol;
            totalVolume -= itemVol; // Adjust total volume correctly for next iteration
            effectiveRemaining++;

            // Also keep load.items synchronized with trim if needed for external logic 
            // (though load is a local object here, it keeps totalVolume mathematically sound)
            load.items.pop();
        }
    }

    result.remainingQuantity = effectiveRemaining;

    // Export the remaining VCs so the UI can render the partial spaces
    if (globalVCQueue.length > 0) {
        // Filter to only those belonging to this load
        const finalVCs = globalVCQueue.filter(vc => vc.realContainerId === load.id);
        result.virtualContainers = finalVCs;
    }

    const finalPassVol = result.placements.reduce((s, p) =>
        s + p.dimensions.length * p.dimensions.width * p.dimensions.height, 0);
    console.log(`[FULL-MIX] Mat${material.id} placed ${result.placedCount} items in ${iterations} iters. ` +
        `Volume: ${finalPassVol.toFixed(0)}/${containerVolume.toFixed(0)} ` +
        `(${((totalVolume) / containerVolume * 100).toFixed(1)}% total)` +
        (strictMaterialIsolation ? ` [Strict Isolated minX=${minX.toFixed(0)}]` : ''));

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
