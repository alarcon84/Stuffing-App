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
    id: string; // Unique identifier for the UI to group results
}

export interface PassResult {
    placements: PlacedItem[];
    remainingQuantity: number;
    virtualContainers?: VirtualContainer[];
}

/**
 * Find vertical space above a load (for TOP_UP pass)
 * Returns virtual containers representing top surfaces
 */
/**
 * Find vertical space above a load (for TOP_UP & SMART_STACK passes)
 * Returns virtual containers representing top surfaces using Skyline algorithm
 */
export function findTopSurfaces(
    load: ContainerLoad,
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number },
    yRangeFilter?: { min: number; max: number }
): VirtualContainer[] {
    const marginL = margins.length ?? 20;
    const marginW = margins.width ?? 20;
    const marginH = margins.height ?? 20;

    const virtualContainers: VirtualContainer[] = [];

    // If empty, the whole container (above margins) is technically a "top surface" relative to floor?
    // No, if empty, SmartStack usually relies on sequential pack.
    // But if we want to be robust, an empty load has 1 massive top surface from floor.
    if (load.items.length === 0) {
        // For Smart Stack, if a container is empty, we might want to return the whole space?
        // But usually packSequential handles empty.
        // Let's stick to "above items" logic. If no items, no top surfaces to stack ON.
        return virtualContainers;
    }

    // --- Skyline Analysis ---
    // Divide length into segments to find uneven tops
    const SEGMENT_SIZE = 50; // mm
    const totalLength = containerDims.length - marginL;
    const numSegments = Math.ceil(totalLength / SEGMENT_SIZE);

    // Initialize skyline with 0 (floor relative to load items?)
    // Actually, we want to find space ABOVE items.
    // If a segment has NO items, the "top" is floor (marginH).
    // If it has items, "top" is the max Y of items in that segment.
    const skyline = new Array(numSegments).fill(marginH);

    load.items.forEach(item => {
        const itemTopY = item.position[1] + item.dimensions.height / 2;
        const itemStart = item.position[0] - item.dimensions.length / 2;
        const itemEnd = item.position[0] + item.dimensions.length / 2;

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
            // Tolerance for "same height"
            if (Math.abs(skyline[i] - currentRegion.height) < 10) {
                currentRegion.endSeg = i;
            } else {
                regions.push(currentRegion);
                currentRegion = { startSeg: i, endSeg: i, height: skyline[i] };
            }
        }
        regions.push(currentRegion);
    }

    // Convert regions to Virtual Containers
    for (const region of regions) {
        const availableHeight = (containerDims.height - marginH) - region.height;

        // Filter out unusable spaces
        if (availableHeight < 50) continue; // Minimum useful height

        const regionStart = marginL + (region.startSeg * SEGMENT_SIZE);
        const regionEnd = marginL + ((region.endSeg + 1) * SEGMENT_SIZE);
        const regionLength = regionEnd - regionStart;

        if (regionLength < 50) continue; // Minimum useful length

        const vc: VirtualContainer = {
            origin: {
                x: regionStart,
                y: region.height,
                z: marginW
            },
            length: regionLength,
            width: containerDims.width - marginW * 2,
            height: availableHeight,
            realContainerId: load.id,
            id: `vc_skyline_${Math.round(regionStart)}_${Math.round(region.height)}`
        };

        // Y-range filter: skip VCs below this material's Y-floor
        if (yRangeFilter && vc.origin.y < yRangeFilter.min) {
            continue;
        }

        virtualContainers.push(vc);
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
    excludeTop: boolean = false,
    yRangeFilter?: { min: number; max: number }
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
            realContainerId: load.id,
            id: `vc_full_empty_${load.id}`
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
            realContainerId: load.id,
            id: `vc_front_${Math.round(maxX)}`
        });
    }

    // 2. Top space (vertical) - Only if NOT excluded
    // Constrain to footprint of items that actually reach maxY to prevent floating
    if (!excludeTop) {
        const topHeight = (containerDims.height - marginH) - maxY;
        if (topHeight > 1) {
            // Find "safe" extent — only where items reach maxY
            let safeTopX = 0;
            let safeTopZ = 0;
            const tolerance = 50;

            load.items.forEach(item => {
                const itemTopY = item.position[1] + item.dimensions.height / 2;
                if (itemTopY >= maxY - tolerance) {
                    const rx = item.position[0] + item.dimensions.length / 2;
                    const rz = item.position[2] + item.dimensions.width / 2;
                    if (rx > safeTopX) safeTopX = rx;
                    if (rz > safeTopZ) safeTopZ = rz;
                }
            });

            if (safeTopX <= marginL) safeTopX = maxX;
            if (safeTopZ <= marginW) safeTopZ = maxZ;

            const safeLength = safeTopX - marginL;
            const safeWidth = safeTopZ - marginW;

            if (safeLength > 1 && safeWidth > 1) {
                virtualContainers.push({
                    origin: { x: marginL, y: maxY, z: marginW },
                    length: safeLength,
                    width: safeWidth,
                    height: topHeight,
                    realContainerId: load.id,
                    id: `vc_top_${Math.round(maxY)}`
                });
            }
        }
    }

    // 3. Side space (along width) - only if load doesn't use full width
    // Constrain length to occupied extent to prevent floating boxes
    const sideWidth = (containerDims.width - marginW) - maxZ;
    if (sideWidth > 1) {
        const occupiedLengthForSide = maxX - marginL;
        if (occupiedLengthForSide > 1) {
            virtualContainers.push({
                origin: { x: marginL, y: marginH, z: maxZ },
                length: occupiedLengthForSide,
                width: sideWidth,
                height: containerDims.height - marginH * 2,
                realContainerId: load.id,
                id: `vc_side_${Math.round(maxZ)}`
            });
        }
    }

    // Y-range filter: remove VCs whose origin.y is below this material's Y-floor
    if (yRangeFilter) {
        return virtualContainers.filter(vc => vc.origin.y >= yRangeFilter!.min);
    }

    return virtualContainers;
}

/**
 * PHASE 2 - Guillotine Cuts
 * When a placement occurs inside a VirtualContainer, these functions
 * split the remaining free space into up to 3 new sub-VirtualContainers.
 */

export function createFrontVC(originalVC: VirtualContainer, placedLength: number, _placedWidth: number, _placedHeight: number): VirtualContainer | null {
    const frontLength = originalVC.length - placedLength;
    if (frontLength > 1) {
        return {
            origin: { x: originalVC.origin.x + placedLength, y: originalVC.origin.y, z: originalVC.origin.z },
            length: frontLength,
            width: originalVC.width,
            height: originalVC.height,
            realContainerId: originalVC.realContainerId,
            id: `vc_front_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        };
    }
    return null;
}

export function createSideVC(originalVC: VirtualContainer, placedLength: number, placedWidth: number, _placedHeight: number): VirtualContainer | null {
    const sideWidth = originalVC.width - placedWidth;
    if (sideWidth > 1) {
        return {
            // Note: Side VC is adjacent to the placed block along the width axis.
            // Constrain length to placedLength to avoid overlapping with FrontVC space.
            origin: { x: originalVC.origin.x, y: originalVC.origin.y, z: originalVC.origin.z + placedWidth },
            length: placedLength,
            width: sideWidth,
            height: originalVC.height,
            realContainerId: originalVC.realContainerId,
            id: `vc_side_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        };
    }
    return null;
}

export function createTopVC(originalVC: VirtualContainer, placedLength: number, placedWidth: number, placedHeight: number): VirtualContainer | null {
    const topHeight = originalVC.height - placedHeight;
    // Constrain length and width to the placed block to prevent overlapping SideVC and FrontVC
    if (topHeight > 1) {
        return {
            origin: { x: originalVC.origin.x, y: originalVC.origin.y + placedHeight, z: originalVC.origin.z },
            length: placedLength,
            width: placedWidth,
            height: topHeight,
            realContainerId: originalVC.realContainerId,
            id: `vc_top_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        };
    }
    return null;
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

/**
 * Continuation VC Injection — called between material passes in packingAlgorithm.ts.
 *
 * After Material X finishes its FullMix pipeline run, the globalVCQueue contains
 * only fragmented guillotine sub-VCs from within X's occupied region.  There is no
 * structured "front continuation plane" at X's leading edge, so Material X+1 sees
 * junk geometry and fills opportunistically (causing floating, non-layered results).
 *
 * This function fixes that by:
 *   1. Finding the rightmost X extent of all items in each load.
 *   2. Synthesising a full-height / full-width VC starting at that X coordinate.
 *   3. PREPENDING it to globalVCQueue so it is evaluated with priority over
 *      residual guillotine fragments (which are left intact as secondary targets).
 *
 * Result: Mx+1 sees the same clean starting plane that M1 sees at Default packing,
 * restoring geometric continuity and solid-layer behaviour.
 */
export function injectContinuationVCs(
    loads: ContainerLoad[],
    containerDims: Dimensions,
    margins: { length?: number; width?: number; height?: number },
    globalVCQueue: VirtualContainer[]
): void {
    const marginL = margins.length ?? 20;
    const marginW = margins.width ?? 20;
    const marginH = margins.height ?? 20;

    for (const load of loads) {
        if (load.items.length === 0) continue;

        // Find the rightmost X edge across ALL items in this load
        let maxX = 0;
        for (const item of load.items) {
            const right = item.position[0] + item.dimensions.length / 2;
            if (right > maxX) maxX = right;
        }

        const remainingLength = (containerDims.length - marginL) - maxX;
        if (remainingLength <= 1) continue; // No usable space ahead

        const vcId = `vc_continuation_${load.id}_${Math.round(maxX)}`;

        // Deduplicate: remove stale copy if it exists
        const staleIdx = globalVCQueue.findIndex(v => v.id === vcId);
        if (staleIdx !== -1) globalVCQueue.splice(staleIdx, 1);

        const vc: VirtualContainer = {
            origin: { x: maxX, y: marginH, z: marginW },
            length: remainingLength,
            width: containerDims.width - marginW * 2,
            height: containerDims.height - marginH * 2,
            realContainerId: load.id,
            id: vcId
        };

        // Prepend for priority — continuation plane evaluated before residual fragments
        globalVCQueue.unshift(vc);

        console.log(`[CONTINUATION] Load ${load.id}: injected plane at X=${Math.round(maxX)}, ` +
            `remaining=${Math.round(remainingLength)}mm (${vc.length}×${vc.width}×${vc.height}mm)`);
    }
}
