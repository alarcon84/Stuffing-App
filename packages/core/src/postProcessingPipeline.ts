
import type { Container, ContainerLoad, Material } from './types';
import { runTopUpPass } from './passes/topUpPass';
import { runFullMixPass } from './passes/fullMixPass';

/**
 * Post-Processing Pipeline — Strict Sequential Multi-Material Flow
 *
 * RULES (KERNEL_CONTRACT + Sequential Mode):
 *   1. Material processing order is strictly M1 → M2 → M3. Never altered.
 *   2. In Sequential mode, later materials (materialIndex > 0) are spatially
 *      confined to their own Y-region via `yRangeFilter`. They only receive
 *      Virtual Containers whose origin.y ≥ their base-pack Y-floor, so they
 *      can NEVER steal vertical gaps that belong to earlier materials.
 *   3. TopUp skip is MATERIAL-SPECIFIC: only skip if THIS material already
 *      has TopUp items in the load (not any material’s TopUp items).
 *   4. trimLoad NEVER removes items from other materials.
 *   5. packGridCore remains the sole coordinate source.
 *   6. Determinism: same inputs = identical output.
 *
 * PIPELINE ORDER PER LOAD:
 *   A. TOP_UP  (locked flat layer on top, Y-region filtered in Sequential mode)
 *   B. FULL_MIX (unlocked, any orientation, remaining voids, Y-region filtered)
 *
 * MATERIAL Y-REGION ISOLATION (Sequential mode only):
 *   For materialIndex > 0, we compute [myYMin, myYMax] from the base-packed items
 *   of this material in each load, then pass it as `yRangeFilter` to both passes.
 *   This makes findRemainingSpaces / findTopSurfaces only return VCs starting at or
 *   above the material’s own packing floor, enforcing strict visual layers.
 */

export interface PipelineResult {
    loads: ContainerLoad[];
    totalItemsAdded: number;
    addedVolume: number;
    virtualContainers?: import('./virtualContainer').VirtualContainer[];
}

/** Y-region filter: only VCs whose origin.y is within [min, max) are eligible */
export interface YRangeFilter {
    min: number;
    max: number;
}

/**
 * Returns the lowest item-bottom Y for a specific material in the load.
 * If no items exist for this material, returns 0.
 */
function findMinYOfMaterial(load: ContainerLoad, materialId: number): number {
    let minY = Infinity;
    for (const item of load.items) {
        if (item.materialId !== materialId) continue;
        if (item.source && item.source !== 'DEFAULT') continue; // only base-packed items
        const bottom = item.position[1] - item.dimensions.height / 2;
        if (bottom < minY) minY = bottom;
    }
    return minY === Infinity ? 0 : minY;
}

/**
 * Returns the highest item-top Y for a specific material in the load.
 * If no items exist for this material, returns 0.
 */
function findMaxYOfMaterial(load: ContainerLoad, materialId: number): number {
    let maxY = 0;
    for (const item of load.items) {
        if (item.materialId !== materialId) continue;
        if (item.source && item.source !== 'DEFAULT') continue; // only base-packed items
        const top = item.position[1] + item.dimensions.height / 2;
        if (top > maxY) maxY = top;
    }
    return maxY;
}

export function runPostProcessingPipeline(
    initialLoads: ContainerLoad[],
    material: Material,
    container: Container,
    margins: { length?: number; width?: number; height?: number },
    enableTopUp: boolean,
    enableFullMix: boolean,
    packingMode: import('./types').PackingMode,
    fullMixRotations?: import('./types').FullMixRotations,
    materialIndex: number = 0,
    globalVCQueue: import('./virtualContainer').VirtualContainer[] = [],
    isStageDriven: boolean = false
): PipelineResult {
    console.log(`\n[PIPELINE START] Material ${material.id} (idx=${materialIndex}), Loads=${initialLoads.length}, TopUp=${enableTopUp}, FullMix=${enableFullMix}`);

    const result: PipelineResult = {
        loads: [],
        totalItemsAdded: 0,
        addedVolume: 0,
        virtualContainers: []
    };

    // If no passes enabled, return original loads
    if (!enableTopUp && !enableFullMix) {
        result.loads = initialLoads;
        return result;
    }

    if (!initialLoads || initialLoads.length === 0) {
        console.warn(`[PIPELINE] No initial loads provided.`);
        return result;
    }

    const isSequential = packingMode === 'SEQUENTIAL';

    // --- REMAINING QUOTA TRACKING ---
    // Always start at 0 and let the per-load loop accumulate `currentLoadPackedCount`
    // into totalPackedSoFar. This correctly models:
    //   remaining = material.quantity - (all items seen so far across loads)
    //
    // BUG FIX (v0.1.8 stage-driven): we previously initialized totalPackedSoFar to
    // packedGlobalAtStart in stage-driven mode, which meant that when the first load
    // contributed its items via `currentLoadPackedCount`, those items were counted
    // TWICE (once in the init value, once via accumulation). Result: remaining was
    // always negative, so TopUp and FullMix never placed a single item.
    //
    // The per-load accumulation at the bottom of the loop is sufficient.
    let totalPackedSoFar = 0;

    for (let i = 0; i < initialLoads.length; i++) {
        const load = initialLoads[i];
        // Clone load to avoid mutating original
        let updatedLoad = { ...load };

        // Ensure items array exists
        if (!updatedLoad.items) {
            updatedLoad.items = [];
        }

        // --- COMPACTION LOGIC (legacy only) ---
        // In stage-driven mode this is skipped: each stage's material is already
        // scoped correctly by the driver; trimming here would remove valid items.
        if (!isStageDriven) {
            const quotaRemaining = material.quantity - totalPackedSoFar;
            updatedLoad = trimLoad(updatedLoad, material.id, quotaRemaining);
        }

        // Calculate count strictly for THIS load (after trim)
        let currentLoadPackedCount = countPackedInLoad(updatedLoad, material.id);

        // --- Y-REGION ISOLATION (Sequential mode, later materials) ---
        // Compute the spatial Y-range that belongs to this material in this load.
        // Pass this range to both passes so VCs outside the band are filtered out.
        let yFilter: YRangeFilter | undefined;
        if (isSequential && materialIndex > 0 && currentLoadPackedCount > 0) {
            const myYMin = findMinYOfMaterial(updatedLoad, material.id);
            const myYMax = findMaxYOfMaterial(updatedLoad, material.id) || container.dimensions.height;
            yFilter = { min: myYMin, max: myYMax };
        }
        let topSpaceOccupied = false;
        let itemsAddedInThisLoad = 0;
        let volumeAddedInThisLoad = 0;

        // --- PASS A: TOP_UP (Locked) ---
        if (enableTopUp) {
            // Material-specific skip: only skip if THIS material already has TopUp items
            const existingTopUpItems = updatedLoad.items.filter(
                i => i.source === 'TOP_UP' && i.materialId === material.id
            );
            if (existingTopUpItems.length > 0) {
                console.log(`[PIPELINE] C${i + 1}: Skipping TopUp for Mat${material.id} — ${existingTopUpItems.length} TOP_UP items already exist`);
            } else {

                const packedBeforeTopUp = totalPackedSoFar + currentLoadPackedCount;
                const remainingForTopUp = material.quantity - packedBeforeTopUp;

                if (remainingForTopUp > 0) {
                    const topUpResult = runTopUpPass(
                        material,
                        updatedLoad,
                        container.dimensions,
                        margins,
                        remainingForTopUp,
                        packedBeforeTopUp,
                        yFilter
                    );

                    if (topUpResult.placements.length > 0) {
                        topSpaceOccupied = true;
                        const placedCount = topUpResult.placements.reduce((sum, p) => sum + (p.itemCount || 1), 0);
                        const placedVolume = topUpResult.placements.reduce((sum, p) => sum + (p.dimensions.length * p.dimensions.width * p.dimensions.height), 0);

                        // Update Load
                        updatedLoad = {
                            ...updatedLoad,
                            items: [...updatedLoad.items, ...topUpResult.placements],
                            itemCount: updatedLoad.itemCount + placedCount
                        };

                        // Update Local Stats
                        itemsAddedInThisLoad += placedCount;
                        volumeAddedInThisLoad += placedVolume;
                        currentLoadPackedCount += placedCount; // Important for next pass

                        if (topUpResult.virtualContainers) {
                            result.virtualContainers!.push(...topUpResult.virtualContainers);
                        }
                    }
                }
            }
        }

        // --- PASS B: FULL_MIX (Independent) ---
        if (enableFullMix) {
            const packedBeforeFullMix = totalPackedSoFar + currentLoadPackedCount;
            const remainingForFullMix = material.quantity - packedBeforeFullMix;

            console.log(`[PIPELINE] C${i + 1}: FullMix check - remaining=${remainingForFullMix}, packedSoFar=${packedBeforeFullMix}, topSpaceOccupied=${topSpaceOccupied}`);

            if (remainingForFullMix > 0) {
                const fullMixResult = runFullMixPass(
                    material,
                    updatedLoad,
                    container.dimensions,
                    margins,
                    remainingForFullMix,
                    packedBeforeFullMix,
                    topSpaceOccupied,
                    fullMixRotations,
                    materialIndex,
                    isSequential && materialIndex > 0,  // strictMaterialIsolation
                    globalVCQueue
                );

                console.log("Material:", material.id, "Visible VC count:", globalVCQueue.length);

                if (fullMixResult.placements.length > 0) {
                    const placedCount = fullMixResult.placedCount;
                    const placedVolume = fullMixResult.consumedVolume;

                    // Update Load
                    updatedLoad = {
                        ...updatedLoad,
                        items: [...updatedLoad.items, ...fullMixResult.placements],
                        itemCount: updatedLoad.itemCount + placedCount
                    };

                    // Update Local Stats
                    itemsAddedInThisLoad += placedCount;
                    volumeAddedInThisLoad += placedVolume;
                    currentLoadPackedCount += placedCount;
                }

                // ALWAYS export VCs even if no items were placed
                if (fullMixResult.virtualContainers) {
                    result.virtualContainers!.push(...fullMixResult.virtualContainers);
                }
            }
        }

        // Recalculate Utilization
        const loadVol = updatedLoad.items.reduce((s, i) => s + (i.dimensions.length * i.dimensions.width * i.dimensions.height), 0);
        const contVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
        updatedLoad.utilization = (loadVol / contVol) * 100;

        // Update Type
        updatedLoad.type = (currentLoadPackedCount + totalPackedSoFar >= material.quantity) ? 'full' : 'partial';

        // [ORDER] log for later materials in Sequential mode
        if (yFilter) {
            console.log(`[ORDER] Material ${material.id} placed only in its Y-region [${yFilter.min.toFixed(0)}–${yFilter.max.toFixed(0)}] in C${i + 1}`);
        }

        // Update Global Stats
        result.totalItemsAdded += itemsAddedInThisLoad;
        result.addedVolume += volumeAddedInThisLoad;
        totalPackedSoFar += currentLoadPackedCount;

        // Only add load if it has items
        if (updatedLoad.items.length > 0) {
            result.loads.push(updatedLoad);
        }
    }

    return result;
}

/**
 * Helper: Count items of a specific material in a single load
 */
function countPackedInLoad(load: ContainerLoad, materialId: number): number {
    if (!load.items) return 0;
    return load.items
        .filter(i => i.materialId === materialId)
        .reduce((sum, i) => sum + (i.itemCount || 1), 0);
}

/**
 * Helper: Trim a load to a maximum number of items for a specific material.
 * Removes items from the end of the list. NEVER touches other materials' items.
 */
function trimLoad(load: ContainerLoad, materialId: number, maxItems: number): ContainerLoad {
    if (maxItems < 0) maxItems = 0;

    const currentCount = countPackedInLoad(load, materialId);
    if (currentCount <= maxItems) return load; // No trim needed

    let itemsToRemove = currentCount - maxItems;
    const newItems = [...load.items];

    // Iterate backwards to remove items (only of THIS material)
    for (let i = newItems.length - 1; i >= 0; i--) {
        if (itemsToRemove <= 0) break;

        const item = newItems[i];
        if (item.materialId !== materialId) continue; // PROTECT other materials

        const itemQty = item.itemCount || 1;

        if (itemQty <= itemsToRemove) {
            // Remove entire item entry
            newItems.splice(i, 1);
            itemsToRemove -= itemQty;
        } else {
            // Reduce item count
            newItems[i] = {
                ...item,
                itemCount: itemQty - itemsToRemove
            };
            itemsToRemove = 0;
        }
    }

    // Recalculate load.itemCount based on new items
    const newItemCount = newItems.reduce((sum, i) => sum + (i.itemCount || 1), 0);

    return {
        ...load,
        items: newItems,
        itemCount: newItemCount
    };
}
