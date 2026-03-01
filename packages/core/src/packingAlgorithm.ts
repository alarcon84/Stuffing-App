import type { Container, PackingResult, ContainerLoad } from './types';
import { deepClone, calculateStats } from './utils';
import { runPostProcessingPipeline } from './postProcessingPipeline';
import { debugLogger } from './debugLogger';
import { packSequential } from './sequentialPass';
import { packSmartStack } from './smartStackMode';
import type { VirtualContainer } from './virtualContainer';

console.log("Stuffing Calculator v0.1.8");

// ---------------------------------------------------------------------------
// KILL SWITCH
// Set ENABLE_STAGE_DRIVEN = true to activate the new stage-driven pipeline.
// When false, the old code path runs unchanged (safe fallback).
// ---------------------------------------------------------------------------
const ENABLE_STAGE_DRIVEN = true;

// Helper to map packGridCore position (Width, Length, Height) to PlacedItem (Length, Height, Width)
// Kept for consistency if needed by local helpers, though most logic is now delegated.
export const kernelToPlacedPosition = (p: [number, number, number]): [number, number, number] => {
    return [p[1], p[2], p[0]]; // [Length, Height, Width] from [Width, Length, Height]
};

// --------------------------------------------------------------------------
// STAGE-DRIVEN DRIVER
// --------------------------------------------------------------------------

/**
 * packStageDriven — Processes materials strictly one at a time: M1 → M2 → M3.
 *
 * After each material stage:
 *  1. Base-pack the material (sequential, starting from current container state).
 *  2. Immediately run TopUp + FullMix for THIS material only.
 *  3. Commit the resulting loads as the starting point for the next material.
 *  4. Use a FRESH VC queue for each stage so no stale geometry bleeds through.
 *
 * In SEQUENTIAL mode:  M2 is confined to its own Y-region (yRangeFilter).
 * In SMART_STACK mode: M2 is offered ALL prior VCs (can fill M1 gaps).
 */
function packStageDriven(
    container: Container,
    activeMaterials: import('./types').Material[],
    margins: { length?: number; width?: number; height?: number },
    isCombined: boolean,
    packingMode: import('./types').PackingMode,
    enableTopUp: boolean,
    enableFullMix: boolean,
    fullMixRotations?: import('./types').FullMixRotations,
    initialQuantities?: Map<number, number>
): PackingResult {
    let currentLoads: ContainerLoad[] = [];
    const collectedVCs: VirtualContainer[] = [];

    for (let mIdx = 0; mIdx < activeMaterials.length; mIdx++) {
        const mat = activeMaterials[mIdx];

        // ── 1. BASE PACK (this material only, appended to existing containers) ──
        const baseResult = packSequential(
            container,
            [mat],
            margins,
            isCombined,
            currentLoads   // Pass current state so material appends after earlier ones
        );
        currentLoads = baseResult.loads;

        // ── 2. POST-PROCESS (TopUp + FullMix) for THIS material only ──
        if (enableTopUp || enableFullMix) {
            // Always pass a FRESH queue per stage — kills stale VC bleed
            const stageVCQueue: VirtualContainer[] = [];
            const originalQty = initialQuantities?.get(mat.id) ?? mat.quantity;
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
                mIdx,               // materialIndex — drives yRangeFilter in Sequential
                stageVCQueue        // globalVCQueue
            );

            currentLoads = pipelineResult.loads;
            if (pipelineResult.virtualContainers) {
                collectedVCs.push(...pipelineResult.virtualContainers);
            }
        }
    }

    // ── 3. Compute totals from final loads ──
    const totalItems = currentLoads.reduce((s, l) => s + l.itemCount, 0);
    const totalVolume = currentLoads.reduce((s, l) =>
        s + l.items.reduce((v, i) => v + i.dimensions.length * i.dimensions.width * i.dimensions.height, 0), 0
    );

    return {
        loads: currentLoads,
        totalItems,
        totalContainers: currentLoads.length,
        unpackedItems: 0, // Recalculated at the end of calculatePacking
        containerDimensions: container.dimensions,
        actualUsedVolume: totalVolume,
        virtualContainers: collectedVCs,
        errors: []
    };
}

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
    if (ENABLE_STAGE_DRIVEN && (packingMode === 'SEQUENTIAL' || packingMode === 'SMART_STACK')) {
        // NEW: Stage-driven driver — per-material base-pack + post-process
        // Handles both SEQUENTIAL (Y-region isolated) and SMART_STACK (gap-filling allowed)
        result = packStageDriven(
            container,
            activeMaterials,
            margins,
            isCombined,
            packingMode,
            enableTopUp,
            enableFullMix,
            fullMixRotations,
            initialQuantities
        );
    } else {
        // LEGACY fallback — preserved exactly as before
        switch (packingMode) {
            case 'SMART_STACK': {
                const allowVerticalStacking = enableTopUp || enableFullMix;
                result = packSmartStack(container, activeMaterials, margins, isCombined, allowVerticalStacking);
                break;
            }

            case 'TETRIS':
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
                result = packSequential(container, activeMaterials, margins, isCombined);
                break;
        }

        // Legacy post-processing (runs after ALL materials are base-packed)
        if (enableTopUp || enableFullMix) {
            let currentLoads = result.loads;
            let collectedVCs: VirtualContainer[] = result.virtualContainers ? [...result.virtualContainers] : [];
            const globalVCQueue: VirtualContainer[] = [];

            for (let mIdx = 0; mIdx < activeMaterials.length; mIdx++) {
                const mat = activeMaterials[mIdx];
                const originalQty = initialQuantities.get(mat.id) ?? mat.quantity;
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
                    mIdx,
                    globalVCQueue       // globalVCQueue - isStageDriven defaults false here (non-stage-driven path)
                );

                currentLoads = pipelineResult.loads;
                if (pipelineResult.virtualContainers) {
                    collectedVCs.push(...pipelineResult.virtualContainers);
                }
            }

            result.loads = currentLoads;
            result.virtualContainers = collectedVCs;
        }
    }

    // 3. Optional TETRIS fallback (neither path handles it yet)
    if (packingMode === 'TETRIS' && ENABLE_STAGE_DRIVEN) {
        result = {
            loads: [],
            totalItems: 0,
            totalContainers: 0,
            unpackedItems: activeMaterials.reduce((s, m) => s + m.quantity, 0),
            containerDimensions: container.dimensions,
            errors: ['TETRIS mode not yet implemented']
        };
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
        mode: packingMode,
        stageDriven: ENABLE_STAGE_DRIVEN
    });

    return statsResult;
};
