import type { Container, PackingResult } from './types';
import { deepClone, calculateStats } from './utils';
import { runPostProcessingPipeline } from './postProcessingPipeline';
import { debugLogger } from './debugLogger';
import { packSequential } from './sequentialPass';
import { packSmartStack } from './smartStackMode';

console.log("Stuffing Calculator v0.1.6-sequential-fix");

// Helper to map packGridCore position (Width, Length, Height) to PlacedItem (Length, Height, Width)
// Kept for consistency if needed by local helpers, though most logic is now delegated.
export const kernelToPlacedPosition = (p: [number, number, number]): [number, number, number] => {
    return [p[1], p[2], p[0]]; // [Length, Height, Width] from [Width, Length, Height]
};

// --------------------------------------------------------------------------
// MAIN ENTRY POINT
// --------------------------------------------------------------------------

/**
 * Calculates the packing of materials into a container.
 * Acts as a dispatcher to specific packing strategies (Sequential, Smart Stack, Tetris).
 */
export const calculatePacking = (
    container: Container,
    materials: import('./types').Material[],
    isCombined: boolean = false,
    margins: { length?: number; width?: number; height?: number } = { length: 20, width: 20, height: 20 },
    packingMode: import('./types').PackingMode = 'SEQUENTIAL',
    enableTopUp: boolean = false,
    enableFullMix: boolean = false,
    fullMixRotations?: import('./types').FullMixRotations
): PackingResult => {
    // 1. Prepare Active Materials
    const activeMaterials = deepClone(materials.filter((m: import('./types').Material) => m.active && m.quantity > 0));

    // Capture initial quantities before packing mutates them (crucial for pipeline)
    const initialQuantities = new Map<number, number>();
    activeMaterials.forEach((m: import('./types').Material) => initialQuantities.set(m.id, m.quantity));

    if (activeMaterials.length === 0) {
        return {
            totalItems: 0,
            totalContainers: 0,
            loads: [],
            containerDimensions: container.dimensions,
            unpackedItems: 0,
            errors: []
        };
    }

    let result: PackingResult;

    // 2. Dispatch to Packing Strategy
    // For single material (non-combined), we use Sequential logic (it handles single mat perfectly)
    // This replaces the old "Fast Path" with a unified code path.

    // Explicit Mode Routing
    switch (packingMode) {
        case 'SMART_STACK':
            // Vertical stacking only allowed if Fill (TopUp) or Maximize (FullMix) is enabled
            const allowVerticalStacking = enableTopUp || enableFullMix;
            result = packSmartStack(container, activeMaterials, margins, isCombined, allowVerticalStacking);
            break;

        case 'TETRIS':
            // TODO: Implement Tetris
            result = {
                loads: [],
                totalItems: 0,
                totalContainers: 0,
                unpackedItems: activeMaterials.reduce((s, m) => s + m.quantity, 0),
                containerDimensions: container.dimensions,
                errors: ['TETRIS mode not yet implemented']
            };
            break;

        case 'SEQUENTIAL':
        default:
            // Default to Sequential (No mixing, container sharing allowed but partitioned)
            result = packSequential(container, activeMaterials, margins, isCombined);
            break;
    }

    // 3. Apply Post-Processing Pipeline (Top-Up / Full-Mix)
    if (enableTopUp || enableFullMix) {
        // pipeline needs a "primary material" context, but really it just needs to know what to pack.
        // It iterates through ALL materials to find unpacked items and try to squeeze them in.

        // We run the pipeline for EACH material that has remaining items?
        // Or the pipeline handles all?
        // runPostProcessingPipeline implementation takes `material` as input.
        // So we must call it for each material.

        let currentLoads = result.loads;

        for (let mIdx = 0; mIdx < activeMaterials.length; mIdx++) {
            const mat = activeMaterials[mIdx];
            const originalQty = initialQuantities.get(mat.id) ?? mat.quantity;
            // We pass the MATERIAL object. Pipeline checks `remainingQuantity`.
            // Pipeline calculates remaining itself based on loads.
            // So we just pass the material with its ORIGINAL quantity (Total Desired).

            const pipelineMat = { ...mat, quantity: originalQty };

            const pipelineResult = runPostProcessingPipeline(
                currentLoads,
                pipelineMat,
                container,
                margins,
                enableTopUp,
                enableFullMix,
                packingMode,
                fullMixRotations,
                mIdx  // materialIndex — controls sequential guard + conservative mode
            );

            currentLoads = pipelineResult.loads;
        }

        // --- ORDER VALIDATION (Sequential mode) ---
        if (packingMode === 'SEQUENTIAL' && activeMaterials.length > 1) {
            const contVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
            for (const load of currentLoads) {
                const volByMat = new Map<number, number>();
                load.items.forEach(item => {
                    const mid = item.materialId || 1;
                    const vol = item.dimensions.length * item.dimensions.width * item.dimensions.height;
                    volByMat.set(mid, (volByMat.get(mid) || 0) + vol);
                });

                // Check if any later material dominates a container that an earlier material barely fills
                const matIds = Array.from(volByMat.keys()).sort((a, b) => a - b);
                if (matIds.length > 1) {
                    const primaryMat = matIds[0];
                    const primaryPct = ((volByMat.get(primaryMat) || 0) / contVol) * 100;
                    for (const laterId of matIds.slice(1)) {
                        const laterPct = ((volByMat.get(laterId) || 0) / contVol) * 100;
                        if (primaryPct < 50 && laterPct > primaryPct) {
                            console.warn(`[ORDER-WARN] Load ${load.id}: Mat${laterId} (${laterPct.toFixed(1)}%) dominates over Mat${primaryMat} (${primaryPct.toFixed(1)}%)`);
                        }
                    }
                }
            }
        }

        // Update result with pipeline modifications
        result.loads = currentLoads;
    }

    // 4. Final Statistics Calculation
    // Re-compute totals from the final state of loads to ensure consistency.
    const finalTotalItems = result.loads.reduce((s, l) => s + l.itemCount, 0);
    const finalVolume = result.loads.reduce((s, l) =>
        s + l.items.reduce((v, i) => v + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0), 0
    );
    const totalOriginalQty = activeMaterials.reduce((s, m) => s + (initialQuantities.get(m.id) ?? m.quantity), 0);
    const finalUnpacked = Math.max(0, totalOriginalQty - finalTotalItems);

    const finalResult: PackingResult = {
        ...result,
        totalItems: finalTotalItems,
        totalContainers: result.loads.length,
        unpackedItems: finalUnpacked,
        actualUsedVolume: finalVolume
    };

    const statsResult = calculateStats(finalResult, activeMaterials);

    debugLogger.log('PACKING', 'Calculation complete', {
        totalItems: statsResult.totalItems,
        totalContainers: statsResult.totalContainers,
        mode: packingMode
    });

    return statsResult;
};
