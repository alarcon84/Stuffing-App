import type { Material, ContainerLoad, Dimensions, PlacedItem } from '../types';
import { packGridCore, type GridVolume } from '../packGridCore';
import { mapToRealCoordinates, type PassResult, type VirtualContainer } from '../virtualContainer';
import { hasPhysicalSupport } from '../utils';
import { selectBestOrientation } from '../orientationSelector';

/**
 * TOP_UP PASS
 * 
 * Purpose: Fill vertical empty space above existing loads using FLAT orientation only.
 * 
 * Activation: Only runs if the container is COMPLETELY FILLED by default packing.
 * 
 * Logic:
 * 1. Find all top surfaces (main load + each pallet top)
 * 2. For each surface, create virtual container
 * 3. Pack boxes in FLAT orientation into virtual space
 * 4. Map back to real coordinates
 * 
 * Constraints:
 * - Flat orientation ONLY (z-axis rotation, height = original width)
 * - No stacking logic
 * - No side mixing
 */

/**
 * Run the TOP_UP pass on a single container load
 * STRICT LOCKING IMPLEMENTATION
 */
export function runTopUpPass(
    material: Material,
    load: ContainerLoad,
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number },
    remainingQuantity: number,
    totalPackedSoFar: number,
    yRangeFilter?: { min: number; max: number }  // NEW: Y-region isolation for Sequential mode
): PassResult {
    if (remainingQuantity <= 0) {
        return { placements: [], remainingQuantity: 0 };
    }

    // NOTE: We no longer block SEQUENTIAL mode mixing here.
    // If TopUpPass is called, the user has explicitly enabled "Fill Vertical Space",
    // which implies they want to fill gaps even if materials mix vertically.
    // The pass is already gated by enableTopUp in postProcessingPipeline.ts.

    const marginL = margins.length ?? 20;
    const marginW = margins.width ?? 20;
    const marginH = margins.height ?? 20;

    // Safety Check: Ensure load and container are valid
    if (!load || !load.items || load.items.length === 0) {
        return { placements: [], remainingQuantity: 0 };
    }

    // --- Skyline Analysis Algorithm ---
    // Instead of a single global maxY, we analyze the container profile along the length axis.
    // 1. Divide length into small segments (e.g. 50mm)
    // 2. Find max height in each segment
    // 3. Group consecutive segments into regions of similar height
    // 4. Create a virtual container for each region

    // Define the segment size (resolution)
    const SEGMENT_SIZE = 50;
    const totalLength = containerDims.length - marginL; // Usable length
    const numSegments = Math.ceil(totalLength / SEGMENT_SIZE);

    // Array to store max height for each segment
    // Initialize with marginH (floor level)
    const skyline = new Array(numSegments).fill(marginH);

    // Populate skyline
    load.items.forEach(item => {
        const itemTopY = item.position[1] + item.dimensions.height / 2;
        const itemStart = item.position[0] - item.dimensions.length / 2;
        const itemEnd = item.position[0] + item.dimensions.length / 2;

        // Map item range to segments
        const startSeg = Math.max(0, Math.floor((itemStart - marginL) / SEGMENT_SIZE));
        const endSeg = Math.min(numSegments - 1, Math.floor((itemEnd - marginL) / SEGMENT_SIZE));

        for (let i = startSeg; i <= endSeg; i++) {
            if (itemTopY > skyline[i]) {
                skyline[i] = itemTopY;
            }
        }
    });

    // Group segments into regions
    interface SkylineRegion {
        startSeg: number;
        endSeg: number;
        height: number;
    }

    const regions: SkylineRegion[] = [];
    if (numSegments > 0) {
        let currentRegion: SkylineRegion = { startSeg: 0, endSeg: 0, height: skyline[0] };

        for (let i = 1; i < numSegments; i++) {
            // Check if height matches (with small tolerance)
            if (Math.abs(skyline[i] - currentRegion.height) < 10) {
                currentRegion.endSeg = i;
            } else {
                regions.push(currentRegion);
                currentRegion = { startSeg: i, endSeg: i, height: skyline[i] };
            }
        }
        regions.push(currentRegion);
    }

    // Process each region
    const allPlacements: PlacedItem[] = [];
    const usedVirtualContainers: VirtualContainer[] = [];
    let currentRemaining = remainingQuantity;
    let currentTotalPacked = totalPackedSoFar;

    // Calculate the flat height - this is the height when the box is laid flat
    // When flat, we use the SMALLEST dimension as height
    const boxDims = material.box.dimensions;
    const flatHeight = Math.min(boxDims.length, boxDims.width, boxDims.height);

    for (const region of regions) {
        if (currentRemaining <= 0) break;

        // Check global quota
        const globalRemaining = material.quantity - currentTotalPacked;
        if (globalRemaining <= 0) break;

        // Y-range filter: skip regions whose surface (bottom of the top-space) is below
        // this material's own Y-floor. This prevents TopUp from filling vertical voids
        // that sit inside an earlier material's Y-band in Sequential mode.
        if (yRangeFilter && region.height < yRangeFilter.min) {
            continue;
        }

        // Effective remaining for this region is bounded by both local need and global quota
        const effectiveRegionLimit = Math.min(currentRemaining, globalRemaining);


        const regionStart = marginL + (region.startSeg * SEGMENT_SIZE);
        // Ensure end covers the full segment width
        const regionEnd = marginL + ((region.endSeg + 1) * SEGMENT_SIZE);
        const regionLength = regionEnd - regionStart;

        // Calculate Top Free Height for this region
        const topFreeHeight = (containerDims.height - marginH) - region.height;

        // Skip if too short
        if (topFreeHeight <= flatHeight) {
            continue;
        }
        if (regionLength <= 0) {
            continue;
        }

        // CRITICAL CONSTRAINT: Top-Up must only pack ABOVE existing loads.
        // It should NOT pack on the empty floor (leave that for other modes or Full Mix).
        // If the region height is at floor level (marginH), skip it.
        if (region.height <= marginH + 1) { // +1mm tolerance
            continue;
        }



        // Effective width
        const regionWidth = containerDims.width - marginW * 2;

        const virtualContainer: VirtualContainer = {
            origin: {
                x: regionStart, // Length axis
                y: region.height, // Height axis
                z: marginW // Width axis
            },
            length: regionLength,
            width: regionWidth,
            height: topFreeHeight,
            realContainerId: load.id,
            id: `vc_topup_${Math.round(regionStart)}_${Math.round(region.height)}`
        };

        const result = packIntoVirtualContainerFlat(
            material,
            virtualContainer,
            effectiveRegionLimit
        );

        // ALWAYS export the virtual container, so the UI can draw the empty top space
        usedVirtualContainers.push(virtualContainer);

        if (result.placements.length > 0) {
            // Map back and Apply Locking
            const validPlacements: PlacedItem[] = [];

            // We need to check support for each item.
            // Since items are usually packed bottom-up in the virtual container,
            // we should check them in order.
            // Also, we need to temporarily add them to the load to check support for subsequent items?
            // Or just check against the base load?
            // TopUp items can stack on each other.

            // Let's create a temp load that includes the base load items
            const tempLoad = { ...load, items: [...load.items] };

            for (const p of result.placements) {
                const mapped = mapToRealCoordinates(p, virtualContainer);
                const item: PlacedItem = {
                    ...mapped,
                    locked: true,
                    source: 'TOP_UP' as const,
                    isFlatTopOff: true,
                    vcId: virtualContainer.id
                };

                // Check support
                if (hasPhysicalSupport(item, tempLoad, marginH)) {
                    validPlacements.push(item);
                    tempLoad.items.push(item); // Add to temp load so it can support others
                }
            }

            allPlacements.push(...validPlacements);
            // Recalculate packed quantity based on valid placements
            // Each placement is 1 item in this context (box)
            const placedCount = validPlacements.length;
            currentRemaining -= placedCount;
            currentTotalPacked += placedCount;

            console.log(`[TOP_UP] Region Y=${region.height.toFixed(0)}, L=${regionLength.toFixed(0)}: Placed ${placedCount} (Valid/Supported)`);
        }
    }

    return {
        placements: allPlacements,
        remainingQuantity: currentRemaining,
        virtualContainers: usedVirtualContainers
    };
}

/**
 * Pack into a virtual container using FLAT orientation only
 */
function packIntoVirtualContainerFlat(
    material: Material,
    virtualContainer: VirtualContainer,
    quantity: number
): { placements: PlacedItem[]; packedQuantity: number } {
    const box = material.box;

    // Force FLAT orientation: height becomes original width
    // This means we rotate the box so it lies flat
    // Normal: L, W, H
    // Flat 1: L=L, W=H, H=W (Rotated X)
    // Flat 2: L=H, W=L, H=W (Rotated X + Y)
    // We want H_placed to be SMALL (box.width or box.height?)
    // User says "Flat-orientation only".
    // Usually means laying largest face down.
    // If Box is 40x30x20.
    // Flat means height is 20. (L=40, W=30) or (L=30, W=40).

    // Let's assume 'flat' means aligning the smallest dimension to vertical (Y).
    const dims = [box.dimensions.length, box.dimensions.width, box.dimensions.height];
    const sorted = [...dims].sort((a, b) => a - b);
    const minDim = sorted[0]; // This will be Height

    // We want permutations where Height == minDim.
    const flatPermutations: Dimensions[] = [
        { length: box.dimensions.length, width: box.dimensions.height, height: box.dimensions.width },
        { length: box.dimensions.height, width: box.dimensions.length, height: box.dimensions.width },
        { length: box.dimensions.length, width: box.dimensions.width, height: box.dimensions.height } // Original
    ].filter(d => Math.abs(d.height - minDim) < 0.1);

    if (flatPermutations.length === 0) {
        // Fallback to strict width-as-height if logic fails
        flatPermutations.push({ length: box.dimensions.length, width: box.dimensions.height, height: box.dimensions.width });
    }

    // Select best flat orientation for the virtual container
    const virtualContainerProxy = {
        name: 'Virtual Top Space',
        type: 'custom' as const,
        dimensions: {
            length: virtualContainer.length,
            width: virtualContainer.width,
            height: virtualContainer.height
        }
    };

    const selectionResult = selectBestOrientation(virtualContainerProxy, box, flatPermutations);
    const bestDims = selectionResult.selectedDimensions;

    // Calculate how many fit
    const cols = Math.floor(virtualContainer.length / bestDims.length);
    const rows = Math.floor(virtualContainer.width / bestDims.width);
    const layers = Math.floor(virtualContainer.height / bestDims.height);

    const fitsInSpace = cols * rows * layers;
    const actualQuantity = Math.min(quantity, fitsInSpace);

    if (actualQuantity <= 0) {
        return { placements: [], packedQuantity: 0 };
    }

    // Use packGridCore to place boxes in virtual container
    const volume: GridVolume = {
        origin: { x: 0, y: 0, z: 0 },
        bounds: {
            length: virtualContainer.length,
            width: virtualContainer.width,
            height: virtualContainer.height
        }
    };

    const unitDimensions = bestDims;
    const gridPlacements = packGridCore(volume, unitDimensions);

    // Convert grid positions to PlacedItems
    const placements: PlacedItem[] = gridPlacements.slice(0, actualQuantity).map((placement) => ({
        // Note: packGridCore returns GridPlacement with position [Width, Length, Height]
        // We need to remap to [Length, Height, Width] for PlacedItem
        // X=Length, Y=Height, Z=Width
        position: [placement.position[1], placement.position[2], placement.position[0]] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        dimensions: unitDimensions,
        type: 'box' as const,
        itemCount: 1,
        materialId: material.id
    }));

    return {
        placements,
        packedQuantity: Math.min(actualQuantity, gridPlacements.length)
    };
}
