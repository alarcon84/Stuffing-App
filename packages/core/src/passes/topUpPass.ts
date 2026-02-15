import type { Material, ContainerLoad, Dimensions, PlacedItem } from '../types';
import { packGridCore, type GridVolume } from '../packGridCore';
import { mapToRealCoordinates, type PassResult, type VirtualContainer } from '../virtualContainer';
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
    totalPackedSoFar: number
): PassResult {
    if (remainingQuantity <= 0) {
        return { placements: [], remainingQuantity: 0 };
    }

    const marginL = margins.length ?? 20;
    const marginW = margins.width ?? 20;
    const marginH = margins.height ?? 20;

    // Safety Check: Ensure load and container are valid
    if (!load || !load.items) {
        return { placements: [], remainingQuantity: 0 };
    }

    // 1. Calculate highest placed Y (Top of the current load)
    let highestPlacedY = marginH;

    if (load.items.length > 0) {
        // Find maximum Y extent of any item
        const maxY = Math.max(...load.items.map(i => i.position[1] + i.dimensions.height / 2));
        highestPlacedY = Math.max(highestPlacedY, maxY);
    }

    // 2. Calculate Top Free Height
    // containerDims.height - marginH (top margin) - highestPlacedY
    const topFreeHeight = (containerDims.height - marginH) - highestPlacedY;

    // 3. Strict Validation
    // "If remainingHeight < boxHeight return" (User Instruction)
    // User also said "Strict greater-than, never equal" for safety
    // For flat orientation, "boxHeight" means the box's smallest dimension (usually height or width depending on rotation)
    // But TopUp forces Flat Orientation (Height = original Width).
    // So we check against the Flat Height.
    const flatHeight = material.box.dimensions.width; // Rotated: H = W

    // Strict check: Must be STRICTLY greater to avoid zero-thickness or rounding issues
    if (topFreeHeight <= flatHeight) {
        // Log handled by pipeline caller
        return { placements: [], remainingQuantity };
    }

    // 4. Create ONE virtual container
    const virtualContainer: VirtualContainer = {
        origin: {
            x: marginL,
            y: highestPlacedY,
            z: marginW
        },
        length: containerDims.length - marginL * 2,
        width: containerDims.width - marginW * 2,
        height: topFreeHeight,
        realContainerId: load.id
    };

    console.log(`[TOP-UP] Created virtual volume: origin=(${virtualContainer.origin.x}, ${virtualContainer.origin.y}, ${virtualContainer.origin.z}), size=(${virtualContainer.length}x${virtualContainer.height}x${virtualContainer.width})`);

    // Check quota against global total
    const globalRemaining = material.quantity - totalPackedSoFar;
    const effectiveRemaining = Math.min(remainingQuantity, globalRemaining);

    if (effectiveRemaining <= 0) {
        console.log(`[TOP-UP] Global quota reached (Total: ${totalPackedSoFar}, Max: ${material.quantity}). Skipping.`);
        return { placements: [], remainingQuantity };
    }

    // 5. Pack flat-orientation only
    // We use the helper function but ensure it marks items as LOCKED
    const result = packIntoVirtualContainerFlat(
        material,
        virtualContainer,
        effectiveRemaining
    );

    // 6. Map back and Apply Locking
    const newPlacements: PlacedItem[] = result.placements.map(p => {
        const mapped = mapToRealCoordinates(p, virtualContainer);
        return {
            ...mapped,
            locked: true,
            source: 'TOP_UP',
            isFlatTopOff: true
        };
    });

    return {
        placements: newPlacements,
        remainingQuantity: remainingQuantity - result.packedQuantity
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

    const bestDims = selectBestOrientation(virtualContainerProxy, box, flatPermutations);

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
