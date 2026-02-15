import type { Dimensions, ContainerLoad, PlacedItem } from './types';

/**
 * VIRTUAL CONTAINER ABSTRACTION
 * 
 * A Virtual Container represents unused space inside a real container.
 * Used ONLY for calculations during post-processing passes.
 * Never shown as real containers to the user.
 */

export interface VirtualContainer {
    origin: { x: number; y: number; z: number };
    length: number;
    width: number;
    height: number;
    realContainerId: number; // Track which real container this space belongs to
}

export interface PassResult {
    placements: PlacedItem[];
    remainingQuantity: number;
}

/**
 * Find vertical space above a load (for TOP_UP pass)
 * Returns virtual containers representing top surfaces
 */
export function findTopSurfaces(
    load: ContainerLoad,
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number }
): VirtualContainer[] {
    const marginL = margins.length ?? 20;
    const marginW = margins.width ?? 20;
    const marginH = margins.height ?? 20;

    const virtualContainers: VirtualContainer[] = [];

    if (load.items.length === 0) {
        return virtualContainers; // No top surfaces if empty
    }

    // Find the highest Y position (top of the load)
    let maxY = 0;
    load.items.forEach(item => {
        const topY = item.position[1] + item.dimensions.height / 2;
        if (topY > maxY) maxY = topY;
    });

    // Calculate available height above the load
    const availableHeight = (containerDims.height - marginH) - maxY;

    // Only create virtual container if there's meaningful space
    if (availableHeight > 1) { // Minimum 1mm
        virtualContainers.push({
            origin: {
                x: marginL,
                y: maxY,
                z: marginW
            },
            length: containerDims.length - marginL * 2,
            width: containerDims.width - marginW * 2,
            height: availableHeight,
            realContainerId: load.id
        });
    }

    return virtualContainers;
}

/**
 * Find remaining rectangular spaces (for FULL_MIX pass)
 * Detects front space, side spaces, and top space
 */
export function findRemainingSpaces(
    load: ContainerLoad,
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number },
    excludeTop: boolean = false
): VirtualContainer[] {
    const marginL = margins.length ?? 20;
    const marginW = margins.width ?? 20;
    const marginH = margins.height ?? 20;

    const virtualContainers: VirtualContainer[] = [];

    if (load.items.length === 0) {
        // Entire container is available
        virtualContainers.push({
            origin: { x: marginL, y: marginH, z: marginW },
            length: containerDims.length - marginL * 2,
            width: containerDims.width - marginW * 2,
            height: containerDims.height - marginH * 2,
            realContainerId: load.id
        });
        return virtualContainers;
    }

    // Find bounding box of current load
    let maxX = 0, maxY = 0, maxZ = 0;
    load.items.forEach(item => {
        const rightX = item.position[0] + item.dimensions.length / 2;
        const topY = item.position[1] + item.dimensions.height / 2;
        const frontZ = item.position[2] + item.dimensions.width / 2;

        if (rightX > maxX) maxX = rightX;
        if (topY > maxY) maxY = topY;
        if (frontZ > maxZ) maxZ = frontZ;
    });

    // 1. Front space (along length)
    const frontLength = (containerDims.length - marginL) - maxX;
    if (frontLength > 1) {
        virtualContainers.push({
            origin: { x: maxX, y: marginH, z: marginW },
            length: frontLength,
            width: containerDims.width - marginW * 2,
            height: containerDims.height - marginH * 2,
            realContainerId: load.id
        });
    }

    // 2. Top space (vertical) - Only if NOT excluded
    if (!excludeTop) {
        const topHeight = (containerDims.height - marginH) - maxY;
        if (topHeight > 1) {
            virtualContainers.push({
                origin: { x: marginL, y: maxY, z: marginW },
                length: containerDims.length - marginL * 2,
                width: containerDims.width - marginW * 2,
                height: topHeight,
                realContainerId: load.id
            });
        }
    }

    // 3. Side space (along width) - only if load doesn't use full width
    const sideWidth = (containerDims.width - marginW) - maxZ;
    if (sideWidth > 1) {
        virtualContainers.push({
            origin: { x: marginL, y: marginH, z: maxZ },
            length: containerDims.length - marginL * 2,
            width: sideWidth,
            height: containerDims.height - marginH * 2,
            realContainerId: load.id
        });
    }

    return virtualContainers;
}

/**
 * Map a placement from virtual container coordinates to real container coordinates
 */
export function mapToRealCoordinates(
    virtualPlacement: PlacedItem,
    virtualContainer: VirtualContainer
): PlacedItem {
    return {
        ...virtualPlacement,
        position: [
            virtualPlacement.position[0] + virtualContainer.origin.x,
            virtualPlacement.position[1] + virtualContainer.origin.y,
            virtualPlacement.position[2] + virtualContainer.origin.z
        ]
    };
}

/**
 * Check if a virtual container has enough space for at least one box
 */
export function hasMinimumSpace(
    virtualContainer: VirtualContainer,
    boxDims: Dimensions
): boolean {
    return (
        virtualContainer.length >= boxDims.length &&
        virtualContainer.width >= boxDims.width &&
        virtualContainer.height >= boxDims.height
    );
}
