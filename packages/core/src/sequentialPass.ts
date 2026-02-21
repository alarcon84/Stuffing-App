import type { Container, PackingResult, ContainerLoad, Dimensions, PlacedItem } from './types';
import { packGridCore, type GridVolume } from './packGridCore';
import {
    PALLET_BASE_HEIGHT_MM,
    DEFAULT_MARGIN_MM,
    MAX_PALLET_STACK_HEIGHT
} from './constants';
import { deepClone, parseLayerConfig } from './utils';
import { selectBestOrientation } from './orientationSelector';

/**
 * Axis Mapping Helper
 * packGridCore: [Width, Length, Height]
 * PlacedItem:   [Length, Height, Width]
 */
function kernelToPlacedPosition(p: [number, number, number]): [number, number, number] {
    return [p[1], p[2], p[0]];
}

// Helper: Check if a potential item overlaps with any existing items in the load
function checkCollision(
    itemPos: [number, number, number],
    itemDims: Dimensions,
    existingItems: PlacedItem[]
): boolean {
    const iL = itemPos[0] - itemDims.length / 2;
    const iR = itemPos[0] + itemDims.length / 2;
    const iB = itemPos[1] - itemDims.height / 2;
    const iT = itemPos[1] + itemDims.height / 2;
    const iBk = itemPos[2] - itemDims.width / 2;
    const iF = itemPos[2] + itemDims.width / 2;

    // Tolerance to avoid floating point errors
    const tol = 1;

    for (const ex of existingItems) {
        const eL = ex.position[0] - ex.dimensions.length / 2;
        const eR = ex.position[0] + ex.dimensions.length / 2;
        const eB = ex.position[1] - ex.dimensions.height / 2;
        const eT = ex.position[1] + ex.dimensions.height / 2;
        const eBk = ex.position[2] - ex.dimensions.width / 2;
        const eF = ex.position[2] + ex.dimensions.width / 2;

        // Check for overlap on all 3 axes
        const overlapX = (iL < eR - tol) && (iR > eL + tol);
        const overlapY = (iB < eT - tol) && (iT > eB + tol);
        const overlapZ = (iBk < eF - tol) && (iF > eBk + tol);

        if (overlapX && overlapY && overlapZ) {
            return true;
        }
    }
    return false;
}

/**
 * Mode 1: SEQUENTIAL (Container Sharing, No Mixing)
 * Materials share containers but occupy separate length sections.
 * M2 starts after M1's rightmost extent. No cross-material mixing.
 */
export function packSequential(
    cont: Container,
    mats: import('./types').Material[],
    marg: { length?: number; width?: number; height?: number },
    _combined: boolean,
    initialLoads: ContainerLoad[] = [] // Optional existing loads to append to/extend
): PackingResult {
    const marginL = marg.length ?? DEFAULT_MARGIN_MM;
    const marginW = marg.width ?? DEFAULT_MARGIN_MM;
    const marginH = marg.height ?? DEFAULT_MARGIN_MM;

    // Container state: initialize from optional initialLoads
    // We must deep clone to avoid mutating the source array passed in
    const allLoads: ContainerLoad[] = initialLoads.map(l => deepClone(l));

    let totalItemsPlaced = 0;
    let totalUnpacked = 0;
    const allErrors: string[] = [];
    const optimizations: import('./types').OptimizationResult[] = [];
    let totalVolume = 0;

    // Track used length per container
    const containerUsedLength: number[] = allLoads.map(load => {
        if (load.items.length === 0) return 0;
        return Math.max(...load.items.map(i => i.position[0] + i.dimensions.length / 2));
    });

    // SEQUENTIAL: Try to pack into existing containers first (sharing allowed)
    // Materials are packed linearly. We track the last container used to ensure monotonic progression.
    // If extending existing loads, we start from the last one.
    let globalLastContainerIdx = Math.max(0, allLoads.length - 1);

    for (const mat of mats) {
        // Determine best orientation for this material
        const box = deepClone(mat.box);
        const allPermutations: Dimensions[] = [
            { length: box.dimensions.length, width: box.dimensions.width, height: box.dimensions.height },
            { length: box.dimensions.length, width: box.dimensions.height, height: box.dimensions.width },
            { length: box.dimensions.width, width: box.dimensions.length, height: box.dimensions.height },
            { length: box.dimensions.width, width: box.dimensions.height, height: box.dimensions.length },
            { length: box.dimensions.height, width: box.dimensions.length, height: box.dimensions.width },
            { length: box.dimensions.height, width: box.dimensions.width, height: box.dimensions.length }
        ];
        const allowedOrientations: Dimensions[] = [];
        if (box.allowedRotations.y) { allowedOrientations.push(allPermutations[0]); allowedOrientations.push(allPermutations[2]); }
        if (box.allowedRotations.x) { allowedOrientations.push(allPermutations[3]); allowedOrientations.push(allPermutations[5]); }
        if (box.allowedRotations.z) { allowedOrientations.push(allPermutations[1]); allowedOrientations.push(allPermutations[4]); }
        if (allowedOrientations.length === 0) allowedOrientations.push(allPermutations[0]);

        // Select best orientation
        let selectionTarget: Container;
        if (mat.pallet.usePallet) {
            selectionTarget = {
                name: 'Pallet Proxy', type: 'custom',
                dimensions: { length: mat.pallet.dimensions.length, width: mat.pallet.dimensions.width, height: mat.pallet.maxLoadHeight }
            };
        } else {
            selectionTarget = {
                ...cont,
                dimensions: {
                    length: cont.dimensions.length - marginL * 2,
                    width: cont.dimensions.width - marginW * 2,
                    height: cont.dimensions.height - marginH * 2
                }
            };
        }
        const selectionResult = selectBestOrientation(selectionTarget, box, allowedOrientations, mat.orientationPreference);
        const bestDims = selectionResult.selectedDimensions;

        // Optimization check
        // Optimization check
        if (selectionResult.optimization) {
            optimizations.push({
                materialId: mat.id,
                originalCount: 0, // We don't have exact counts here easily without dry-run, but checking diff
                optimizedCount: 0,
                recommendedPreference: selectionResult.optimization.recommendedPreference
            });
            // Note: The countDiff in selectionResult tells us how many MORE items could fit.
            // We can store that or just the existence of optimization.
            // The type definition expects `originalCount` and `optimizedCount`.
            // Let's refine Update 1 to use placeholders or update the type if needed.
            // Actually, let's just store the recommendation.
            // Updated type in Step 33 has: originalCount, optimizedCount.
            // We can assume selectionResult.optimization.countDiff is the gain.
            // But we don't know the base count easily here (it's inside selectBestOrientation).
            // Let's just pass 0 for now as the UI mainly needs the boolean flag and preference.
        }

        // Determine unit dimensions (pallet or box)
        let unitDimensions: Dimensions;
        let itemsPerUnit = 1;
        let unitType: 'box' | 'pallet' = 'box';
        let layoutCols = 1, layoutRows = 1;

        if (mat.pallet.usePallet) {
            unitType = 'pallet';
            const pDims = mat.pallet.dimensions;
            const maxAlongLength = Math.floor(pDims.length / bestDims.length);
            const maxAlongWidth = Math.floor(pDims.width / bestDims.width);
            let cols: number, rows: number;
            const parsed = parseLayerConfig(mat.layerConfig);

            if (parsed && parsed.horizontal > 0 && parsed.vertical > 0) {
                cols = Math.min(maxAlongLength, parsed.horizontal);
                rows = Math.min(maxAlongWidth, Math.ceil(parsed.horizontal / Math.max(cols, 1)));
                if (cols * rows > parsed.horizontal) rows = Math.floor(parsed.horizontal / Math.max(cols, 1));
            } else {
                cols = maxAlongLength;
                rows = maxAlongWidth;
            }

            const availH = mat.pallet.maxLoadHeight - PALLET_BASE_HEIGHT_MM;
            let layers = Math.floor(availH / bestDims.height);
            if (parsed && parsed.vertical > 0 && parsed.vertical <= layers) layers = parsed.vertical;

            if (cols > 0 && rows > 0 && layers > 0) {
                itemsPerUnit = cols * rows * layers;
                layoutCols = cols;
                layoutRows = rows;
                unitDimensions = { length: pDims.length, width: pDims.width, height: PALLET_BASE_HEIGHT_MM + (layers * bestDims.height) };
            } else {
                totalUnpacked += mat.quantity;
                allErrors.push(`Material ${mat.id}: Invalid pallet configuration.`);
                continue;
            }
        } else {
            const parsed = parseLayerConfig(mat.layerConfig);
            if (parsed) {
                const maxH = Math.floor((cont.dimensions.width - marginW * 2) / bestDims.width);
                const maxV = Math.floor((cont.dimensions.height - marginH * 2) / bestDims.height);
                const finalH = Math.min(parsed.horizontal, maxH);
                const finalV = Math.min(parsed.vertical, maxV);
                if (finalH > 0 && finalV > 0) {
                    unitDimensions = { length: bestDims.length, width: bestDims.width * finalH, height: bestDims.height * finalV };
                    itemsPerUnit = finalH * finalV;
                    layoutCols = finalH;
                    layoutRows = 1;
                } else {
                    unitDimensions = bestDims;
                }
            } else {
                unitDimensions = bestDims;
            }
        }

        // Calculate effective height
        let effH = cont.dimensions.height - marginH * 2;
        if (unitType === 'pallet') {
            if (mat.pallet.stackPallets) effH = Math.min(effH, MAX_PALLET_STACK_HEIGHT * unitDimensions.height);
            else effH = unitDimensions.height;
        } else if (mat.layerConfig && mat.layerConfig.toLowerCase().includes('x')) {
            effH = unitDimensions.height;
        }

        let remainingQty = mat.quantity;

        // Start search from the last globally used container to ensure monotonic sequential packing
        const startSearchIndex = globalLastContainerIdx;
        let lastPlacedLoadIdx = globalLastContainerIdx;

        // Try to fit into existing containers first
        for (let loadIdx = startSearchIndex; loadIdx < allLoads.length && remainingQty > 0; loadIdx++) {
            const usedLen = containerUsedLength[loadIdx] || 0; // Ensure logic handles new array entries
            const availableLen = cont.dimensions.length - marginL - usedLen;

            if (availableLen < unitDimensions.length) continue; // Not enough space vertically/horizontally? Mainly Length here.

            // Pack into remaining space of this container
            const volume: GridVolume = {
                // packGridCore kernel: x=Width, y=Length, z=Height
                origin: { x: marginW, y: usedLen, z: marginH },
                bounds: { length: availableLen, height: effH, width: cont.dimensions.width - marginW * 2 }
            };

            const gridPlacements = packGridCore(volume, unitDimensions);
            if (gridPlacements.length === 0) continue;

            const itemsToPlace = Math.min(gridPlacements.length * itemsPerUnit, remainingQty);
            const unitsToPlace = Math.ceil(itemsToPlace / itemsPerUnit);
            const slicedPlacements = gridPlacements.slice(0, unitsToPlace);

            let itemsPlaced = 0;
            for (const p of slicedPlacements) {
                const itemsInThisUnit = Math.min(itemsPerUnit, remainingQty - itemsPlaced);
                const pos = kernelToPlacedPosition(p.position);

                // COLLISION CHECK
                if (checkCollision(pos, unitDimensions, allLoads[loadIdx].items)) {
                    // console.warn(`Collision detected in container ${allLoads[loadIdx].id}, skipping placement.`);
                    continue;
                }

                allLoads[loadIdx].items.push({
                    position: pos,
                    rotation: [0, 0, 0],
                    dimensions: p.dimensions,
                    type: unitType,
                    itemCount: itemsInThisUnit,
                    materialId: mat.id,
                    grid: {
                        cols: unitType === 'pallet' ? layoutCols : (itemsPerUnit > 1 ? Math.floor(unitDimensions.width / bestDims.width) : 1),
                        rows: unitType === 'pallet' ? layoutRows : 1,
                        layers: unitType === 'pallet' ? Math.floor((unitDimensions.height - PALLET_BASE_HEIGHT_MM) / bestDims.height) : (itemsPerUnit > 1 ? Math.floor(unitDimensions.height / bestDims.height) : 1)
                    },
                    isPalletBase: unitType === 'pallet'
                });
                itemsPlaced += itemsInThisUnit;
            }

            remainingQty -= itemsPlaced;
            totalItemsPlaced += itemsPlaced;
            totalVolume += itemsPlaced * (bestDims.length * bestDims.width * bestDims.height);

            // Track successful placement
            if (itemsPlaced > 0) {
                lastPlacedLoadIdx = loadIdx;
            }

            // Update used length
            const newMaxLen = Math.max(...allLoads[loadIdx].items.map(
                item => item.position[0] + item.dimensions.length / 2
            ));
            containerUsedLength[loadIdx] = newMaxLen;

            // Update load metadata
            allLoads[loadIdx].itemCount = allLoads[loadIdx].items.reduce((s, i) => s + (i.itemCount || 1), 0);
            const loadVol = allLoads[loadIdx].items.reduce((s, i) => s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);
            const contVol = cont.dimensions.length * cont.dimensions.width * cont.dimensions.height;
            allLoads[loadIdx].utilization = (loadVol / contVol) * 100;
        }

        // Overflow: create new containers for remaining quantity
        while (remainingQty > 0) {
            const volume: GridVolume = {
                origin: { x: marginW, y: marginL, z: marginH },
                bounds: { length: cont.dimensions.length - marginL * 2, height: effH, width: cont.dimensions.width - marginW * 2 }
            };

            const gridPlacements = packGridCore(volume, unitDimensions);
            if (gridPlacements.length === 0) {
                totalUnpacked += remainingQty;
                allErrors.push(`Material ${mat.id}: cannot fit in container.`);
                break;
            }

            const itemsToPlace = Math.min(gridPlacements.length * itemsPerUnit, remainingQty);
            const unitsToPlace = Math.ceil(itemsToPlace / itemsPerUnit);
            const slicedPlacements = gridPlacements.slice(0, unitsToPlace);

            const placements: PlacedItem[] = [];
            let itemsPlaced = 0;
            for (const p of slicedPlacements) {
                const itemsInThisUnit = Math.min(itemsPerUnit, remainingQty - itemsPlaced);

                // New container, check against *itself* (placements so far)
                const pos = kernelToPlacedPosition(p.position);
                if (checkCollision(pos, unitDimensions, placements)) {
                    continue;
                }

                placements.push({
                    position: pos,
                    rotation: [0, 0, 0],
                    dimensions: p.dimensions,
                    type: unitType,
                    itemCount: itemsInThisUnit,
                    materialId: mat.id,
                    grid: {
                        cols: unitType === 'pallet' ? layoutCols : (itemsPerUnit > 1 ? Math.floor(unitDimensions.width / bestDims.width) : 1),
                        rows: unitType === 'pallet' ? layoutRows : 1,
                        layers: unitType === 'pallet' ? Math.floor((unitDimensions.height - PALLET_BASE_HEIGHT_MM) / bestDims.height) : (itemsPerUnit > 1 ? Math.floor(unitDimensions.height / bestDims.height) : 1)
                    },
                    isPalletBase: unitType === 'pallet'
                });
                itemsPlaced += itemsInThisUnit;
            }

            remainingQty -= itemsPlaced;
            totalItemsPlaced += itemsPlaced;
            totalVolume += itemsPlaced * (bestDims.length * bestDims.width * bestDims.height);

            const loadVol = placements.reduce((s, i) => s + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0);
            const contVol = cont.dimensions.length * cont.dimensions.width * cont.dimensions.height;

            allLoads.push({
                id: allLoads.length + 1,
                items: placements,
                itemCount: itemsPlaced,
                utilization: (loadVol / contVol) * 100,
                type: remainingQty <= 0 ? 'full' : 'partial'
            });

            // Track used length for this new container
            const maxLen = Math.max(...placements.map(item => item.position[0] + item.dimensions.length / 2));
            containerUsedLength.push(maxLen);

            // Track placement
            lastPlacedLoadIdx = allLoads.length - 1;

            if (allLoads.length > 1000) {
                allErrors.push('Infinite loop in SEQUENTIAL packing.');
                break;
            }
        }

        // Update global pointer so next material starts from where we left off
        if (lastPlacedLoadIdx !== -1) {
            globalLastContainerIdx = lastPlacedLoadIdx;
        }

        totalUnpacked += remainingQty > 0 ? remainingQty : 0;
    }

    return {
        loads: allLoads,
        totalItems: totalItemsPlaced,
        totalContainers: allLoads.length,
        unpackedItems: totalUnpacked,
        containerDimensions: cont.dimensions,
        actualUsedVolume: totalVolume,
        ...(allErrors.length > 0 ? { errors: allErrors } : {}),
        optimizationsAvailable: optimizations
    };
}
