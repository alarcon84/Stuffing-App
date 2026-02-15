
import type { Container, ContainerLoad, Material } from './types';
import { runTopUpPass } from './passes/topUpPass';
import { runFullMixPass } from './passes/fullMixPass';

/**
 * Run the Post-Processing Pipeline (TOP_UP -> FULL_MIX)
 * 
 * STRICT IMPLEMENTATION (User Mental Model):
 * 1. Default Stuffing is Authoritative.
 * 2. If Partial -> STOP.
 * 3. Top-Up (Locked, Flat).
 * 4. Full-Mix (Unlocked, Any Orientation, Remaining Space).
 */

export interface PipelineResult {
    loads: ContainerLoad[];
    totalItemsAdded: number;
    addedVolume: number;
}

export function runPostProcessingPipeline(
    initialLoads: ContainerLoad[],
    material: Material,
    container: Container,
    margins: { length?: number; width?: number; height?: number },
    enableTopUp: boolean,
    enableFullMix: boolean,
    fullMixRotations?: import('./types').FullMixRotations
): PipelineResult {
    const result: PipelineResult = {
        loads: [],
        totalItemsAdded: 0,
        addedVolume: 0
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


    let totalPackedSoFar = 0;

    for (let i = 0; i < initialLoads.length; i++) {
        const load = initialLoads[i];
        // Clone load to avoid mutating original
        let updatedLoad = { ...load };

        // Ensure items array exists
        if (!updatedLoad.items) {
            updatedLoad.items = [];
        }

        // --- COMPACTION LOGIC ---
        // Calculate how many items are allowed in this load based on global quota
        // If previous loads "stole" items via Top-Up/Full-Mix, we must reduce this load's base count.
        const quotaRemaining = material.quantity - totalPackedSoFar;

        // Trim the load if it exceeds the remaining quota
        updatedLoad = trimLoad(updatedLoad, material.id, quotaRemaining);

        // If the load became empty due to trimming (fully stolen by previous loads), skip it?
        // We should skip adding it to results if it's truly empty and has no other items.
        // But for now, let's process it (it might have other materials in a mixed scenario, 
        // though here we assume single-material pipeline focus).
        // If strictly single material and empty, we might skip.
        // But let's proceed to allow "Top Up" even on an empty container (if we had infinite quota, but we don't).

        // Calculate count strictly for THIS load (after trim)
        let currentLoadPackedCount = countPackedInLoad(updatedLoad, material.id);
        let topSpaceOccupied = false;
        let itemsAddedInThisLoad = 0;
        let volumeAddedInThisLoad = 0;

        // --- PASS A: TOP_UP (Locked) ---
        if (enableTopUp) {
            const packedBeforeTopUp = totalPackedSoFar + currentLoadPackedCount;
            const remainingForTopUp = material.quantity - packedBeforeTopUp;

            if (remainingForTopUp > 0) {
                const topUpResult = runTopUpPass(
                    material,
                    updatedLoad,
                    container.dimensions,
                    margins,
                    remainingForTopUp,
                    packedBeforeTopUp
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
                }
            }
        }

        // --- PASS B: FULL_MIX (Independent) ---
        if (enableFullMix) {
            const packedBeforeFullMix = totalPackedSoFar + currentLoadPackedCount;
            const remainingForFullMix = material.quantity - packedBeforeFullMix;

            if (remainingForFullMix > 0) {
                const fullMixResult = runFullMixPass(
                    material,
                    updatedLoad,
                    container.dimensions,
                    margins,
                    remainingForFullMix,
                    packedBeforeFullMix,
                    topSpaceOccupied,
                    fullMixRotations
                );

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
            }
        }

        // Recalculate Utilization
        const loadVol = updatedLoad.items.reduce((s, i) => s + (i.dimensions.length * i.dimensions.width * i.dimensions.height), 0);
        const contVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
        updatedLoad.utilization = (loadVol / contVol) * 100;

        // Update Type
        updatedLoad.type = (currentLoadPackedCount + totalPackedSoFar >= material.quantity) ? 'full' : 'partial';

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
 * Removes items from the end of the list.
 */
function trimLoad(load: ContainerLoad, materialId: number, maxItems: number): ContainerLoad {
    if (maxItems < 0) maxItems = 0;

    const currentCount = countPackedInLoad(load, materialId);
    if (currentCount <= maxItems) return load; // No trim needed

    let itemsToRemove = currentCount - maxItems;
    const newItems = [...load.items];

    // Iterate backwards to remove items
    for (let i = newItems.length - 1; i >= 0; i--) {
        if (itemsToRemove <= 0) break;

        const item = newItems[i];
        if (item.materialId !== materialId) continue;

        const itemQty = item.itemCount || 1;

        if (itemQty <= itemsToRemove) {
            // Remove entire item entry
            newItems.splice(i, 1);
            itemsToRemove -= itemQty;
        } else {
            // Reduce item count
            // We need to clone the item to modify it safely
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
