import type { Container, PackingResult, ContainerLoad, Dimensions } from './types';
import { packGridCore, type GridVolume } from './packGridCore';
// constant removed
import { deepClone } from './utils';
import { packSequential } from './sequentialPass';
import { findTopSurfaces, type VirtualContainer } from './virtualContainer';

/**
 * Helper to convert VirtualContainer to GridVolume for packGridCore
 */
function virtualContainerToGridVolume(vc: VirtualContainer): GridVolume {
    // VC: x=Length, y=Height, z=Width
    // Grid: x=Width, y=Length, z=Height
    return {
        origin: {
            x: vc.origin.z, // VC Width -> Grid Width
            y: vc.origin.x, // VC Length -> Grid Length
            z: vc.origin.y  // VC Height -> Grid Height
        },
        bounds: {
            length: vc.length,
            height: vc.height,
            width: vc.width
        }
    };
}

/**
 * Helper to map packGridCore position (Width, Length, Height) to PlacedItem (Length, Height, Width)
 */
function kernelToPlacedPosition(p: [number, number, number]): [number, number, number] {
    return [p[1], p[2], p[0]];
}

/**
 * Mode 2: SMART_STACK (Container Sharing + Vertical Stacking)
 * First material packs normally. Subsequent materials try to:
 *   1. Stack ON TOP of existing items (vertical stacking) in each container
 *   2. Overflow to new containers (sequential approach)
 */
export function packSmartStack(
    cont: Container,
    mats: import('./types').Material[],
    marg: { length?: number; width?: number; height?: number },
    _combined: boolean,
    allowVerticalStacking: boolean = false // Only stack vertically if True (TopUp/Max enabled)
): PackingResult {

    // Step 1: Pack the FIRST material using proper sequential logic (creates initial containers)
    if (mats.length === 0) return { loads: [], totalItems: 0, totalContainers: 0, unpackedItems: 0, errors: [], containerDimensions: cont.dimensions };

    const firstMat = mats[0];
    const baseResult = packSequential(cont, [firstMat], marg, _combined);

    // If only one material, we are done
    if (mats.length === 1) return baseResult;

    // Initialize state with first material's result
    const allLoads: ContainerLoad[] = baseResult.loads.map(l => ({
        ...l,
        items: [...l.items] // Shallow copy items array to avoid mutation issues
    }));

    let totalItemsPlaced = baseResult.totalItems;
    let totalUnpacked = baseResult.unpackedItems;
    const allErrors: string[] = baseResult.errors ? [...baseResult.errors] : [];
    const optimizations: import('./types').OptimizationResult[] = baseResult.optimizationsAvailable ? [...baseResult.optimizationsAvailable] : [];
    let totalVolume = baseResult.actualUsedVolume || 0;

    // Step 2: Process subsequent materials
    for (let matIdx = 1; matIdx < mats.length; matIdx++) {
        const mat = mats[matIdx];
        let remainingQty = mat.quantity;

        // Phase A: Try to stack VERTICALLY in existing containers
        // GUIDED BY: allowVerticalStacking flag
        if (allowVerticalStacking) {
            // We iterate through all existing loads to find space
            for (let loadIdx = 0; loadIdx < allLoads.length && remainingQty > 0; loadIdx++) {
                const load = allLoads[loadIdx];

                // 1. Detect Virtual Container (Space above existing load)
                const topSurfaces = findTopSurfaces(load, cont.dimensions, marg);

                for (const vc of topSurfaces) {
                    if (remainingQty <= 0) break;

                    const box = deepClone(mat.box);
                    const allPermutations: Dimensions[] = [
                        { length: box.dimensions.length, width: box.dimensions.width, height: box.dimensions.height }, // L, W, H
                        { length: box.dimensions.length, width: box.dimensions.height, height: box.dimensions.width }, // L, H, W
                        { length: box.dimensions.width, width: box.dimensions.length, height: box.dimensions.height }, // W, L, H
                        { length: box.dimensions.width, width: box.dimensions.height, height: box.dimensions.length }, // W, H, L
                        { length: box.dimensions.height, width: box.dimensions.length, height: box.dimensions.width }, // H, L, W
                        { length: box.dimensions.height, width: box.dimensions.width, height: box.dimensions.length }  // H, W, L
                    ];

                    // Filter permutations by allowed rotations
                    // Note regarding Permutation Index mapping to Axis Rotations:
                    // 0: Normal
                    // 1: Rot X (W <-> H)? No, L stays. width becomes height.
                    // Let's use logic:
                    // allowedRotations.y -> Rotate around vertical axis (floor spin). Swaps L & W.
                    // allowedRotations.x -> Rotate around side axis (tipping). Swaps W & H?
                    // allowedRotations.z -> Rotate around length axis (rolling). Swaps L & H?

                    // Simplified Check:
                    // If we use specific dimension as Height, is it allowed?
                    // Standard box has dim L, W, H.
                    // If we pack with H' = W (tipping on side), we need rotation allowed.

                    // Actually, let's just check the standard array indices if we trust the order:
                    // 0: L, W, H (Normal) - Always allowed
                    // 1: L, H, W (Rot X? H becomes W, W becomes H)
                    // 2: W, L, H (Rot Y? L becomes W, W becomes L)
                    // ...

                    // Correct approach:
                    // If Orient Height == Box Height -> Upright. Allowed.
                    // If Orient Height == Box Width -> Tipped on side. Needs X/Z rot?
                    // If Orient Height == Box Length -> Tipped on end. Needs X/Z rot?

                    const validPermutations = allPermutations.filter(p => {
                        // 1. Upright (H matches)
                        if (p.height === box.dimensions.height) return true; // Base orientation or Y-rotation

                        // 2. Tipped on side (H is Width)
                        if (p.height === box.dimensions.width) {
                            return box.allowedRotations.x || box.allowedRotations.z; // Needs tipping
                        }

                        // 3. Tipped on end (H is Length)
                        if (p.height === box.dimensions.length) {
                            return box.allowedRotations.x || box.allowedRotations.z; // Needs tipping
                        }
                        return false;
                    });

                    if (validPermutations.length === 0) validPermutations.push(allPermutations[0]); // Fallback

                    let bestFit: { count: number, dims: Dimensions, placements: any[] } | null = null;

                    // Try filtered orientations
                    for (const orient of validPermutations) {
                        // Pre-check dimensions against VC
                        if (orient.length > vc.length || orient.width > vc.width || orient.height > vc.height) continue;

                        // Pack using Grid Core
                        const gridVol = virtualContainerToGridVolume(vc);
                        const placements = packGridCore(gridVol, orient);

                        if (placements.length > (bestFit?.count || 0)) {
                            bestFit = {
                                count: placements.length,
                                dims: orient, // Use this orientation
                                placements
                            };
                        }
                    }

                    if (bestFit && bestFit.count > 0) {
                        // Place items!
                        const toPlace = Math.min(bestFit.count, remainingQty);
                        const placementsToUse = bestFit.placements.slice(0, toPlace);

                        for (const p of placementsToUse) {
                            allLoads[loadIdx].items.push({
                                position: kernelToPlacedPosition(p.position),
                                rotation: [0, 0, 0], // TODO: track rotation properly if needed
                                dimensions: bestFit.dims,
                                type: 'box',
                                itemCount: 1,
                                materialId: mat.id
                            });
                        }

                        remainingQty -= toPlace;
                        totalItemsPlaced += toPlace;
                        totalVolume += toPlace * (bestFit.dims.length * bestFit.dims.width * bestFit.dims.height);

                        // Update load stats
                        const loadVol = allLoads[loadIdx].items.reduce((s, i) => s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);
                        const contVol = cont.dimensions.length * cont.dimensions.width * cont.dimensions.height;
                        allLoads[loadIdx].utilization = (loadVol / contVol) * 100;
                        allLoads[loadIdx].itemCount += toPlace;
                    }
                }
            }
        }

        // Phase B: If items remain, pack them into NEW containers
        if (remainingQty > 0) {
            // Create a temporary material with remaining quantity
            const remainderMat = { ...mat, quantity: remainingQty };

            // Use packSequential to generate NEW containers OR fill existing ones
            // We pass the current 'allLoads' so it can try to fill the last container's remaining length
            const overflowResult = packSequential(cont, [remainderMat], marg, _combined, allLoads);

            // The overflowResult.loads contains the FULL set of loads (initial + new/modified)
            // So we can largely replace our current allLoads with it, BUT we need to be careful about object references.
            // Since packSequential clones initialLoads, we can just replace allLoads with the result.

            // However, we must ensure we don't lose any other state.
            // packSequential returns the complete state including the new items.

            // Update allLoads with the result from sequential pass
            // We iterate and update/replace
            allLoads.length = 0; // Clear array
            allLoads.push(...overflowResult.loads);

            totalItemsPlaced = overflowResult.totalItems; // Recalculate totals from the full result?
            // Wait, packSequential returns totals for the *input mats* + *initial loads*?
            // packSequential calculates totals based on what it placed *in that call*?
            // No, packSequential implementation mostly tracks what it places.
            // But if we pass initialLoads, does it count items already in there?
            // Looking at sequentialPass.ts:
            // "totalItemsPlaced = 0;" -> It tracks what it places in the loops.
            // It does NOT count items in initialLoads towards 'totalItemsPlaced' return value unless we change it.
            // Let's assume it returns delta.
            // But 'loads' returned is the full set.

            // Actually, verify_n_materials output showed "Total Items: 5".
            // If I passed initialLoads with 2 items, and added 3...
            // sequentialPass doesn't seem to recalculate totalItems of initialLoads.
            // It only increments totalItemsPlaced when it calls allLoads.push.

            // So 'overflowResult.totalItems' is the *newly packing* items count.
            // 'overflowResult.loads' is the *total* containers.

            // So:
            // allLoads = overflowResult.loads
            // totalItemsPlaced += overflowResult.totalItems

            // BUT wait, totalItemsPlaced in SmartStack is cumulative.
            // If I replace allLoads, I have the final state.
            // But I need to track `totalItemsPlaced` correctly.
            // `overflowResult.totalItems` is correct delta.

            totalItemsPlaced += overflowResult.totalItems;
            totalVolume += overflowResult.actualUsedVolume || 0;
            totalUnpacked += overflowResult.unpackedItems;
            if (overflowResult.errors) allErrors.push(...overflowResult.errors);
            if (overflowResult.optimizationsAvailable) optimizations.push(...overflowResult.optimizationsAvailable);
        }
    }

    return {
        loads: allLoads,
        totalItems: totalItemsPlaced,
        totalContainers: allLoads.length,
        unpackedItems: totalUnpacked,
        containerDimensions: cont.dimensions,
        actualUsedVolume: totalVolume,
        errors: allErrors,
        optimizationsAvailable: optimizations
    };
}
