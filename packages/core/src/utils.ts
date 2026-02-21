/**
 * Utility functions for the 3D bin packing algorithm
 */

import type { Dimensions, PlacedItem, ContainerLoad, Material, PackingResult } from './types';

/**
 * Calculate volume of a dimensions object
 */
export const calculateVolume = (dims: Dimensions): number =>
    dims.length * dims.width * dims.height;

/**
 * Calculate utilization percentage of items in a container
 */
export const calculateUtilization = (
    items: PlacedItem[],
    containerDims: Dimensions
): number => {
    const usedVolume = items.reduce(
        (sum, item) => {
            const itemVolume = calculateVolume(item.dimensions);
            const count = item.itemCount || 1;
            return sum + itemVolume * count;
        },
        0
    );
    const containerVolume = calculateVolume(containerDims);
    return containerVolume > 0 ? (usedVolume / containerVolume) * 100 : 0;
};

/**
 * Calculate how many units fit in available space
 */
export const calculateGridFit = (
    available: Dimensions,
    unit: Dimensions
): { countL: number; countW: number; countH: number } => ({
    countL: Math.floor(available.length / unit.length),
    countW: Math.floor(available.width / unit.width),
    countH: Math.floor(available.height / unit.height)
});

/**
 * Calculate the bounding box of placed items
 */
export const calculateLoadBounds = (
    items: PlacedItem[],
    defaultMargin: number = 0
): { maxX: number; maxY: number; maxZ: number } => {
    if (items.length === 0) {
        return { maxX: defaultMargin, maxY: defaultMargin, maxZ: defaultMargin };
    }

    let maxX = 0, maxY = 0, maxZ = 0;

    items.forEach(item => {
        const right = item.position[0] + item.dimensions.length / 2;
        const top = item.position[1] + item.dimensions.height / 2;
        const front = item.position[2] + item.dimensions.width / 2;

        if (right > maxX) maxX = right;
        if (top > maxY) maxY = top;
        if (front > maxZ) maxZ = front;
    });

    return { maxX, maxY, maxZ };
};

/**
 * Deep clone an object (with structuredClone fallback)
 */
export const deepClone = <T>(obj: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Normalize layer config string (handle *, ×, and X variations)
 */
export const normalizeLayerConfig = (config: string | undefined): string => {
    if (!config) return '';
    return config.toLowerCase().replace(/[*×]/g, 'x').trim();
};

/**
 * Parse layer config string into horizontal and vertical counts
 */
export const parseLayerConfig = (
    config: string | undefined
): { horizontal: number; vertical: number } | null => {
    const normalized = normalizeLayerConfig(config);
    if (!normalized.includes('x')) return null;

    const parts = normalized.split('x');
    const horizontal = parseInt(parts[0], 10);
    const vertical = parseInt(parts[1], 10);

    if (isNaN(horizontal) || isNaN(vertical) || horizontal <= 0 || vertical <= 0) {
        return null;
    }

    return { horizontal, vertical };
};

/**
 * Calculate available space after applying margins and offsets
 */
export const getAvailableSpace = (
    containerDims: Dimensions,
    margins: { length: number; width: number; height: number },
    offsets: { x?: number; y?: number; z?: number } = {}
): Dimensions => ({
    length: containerDims.length - margins.length * 2 - (offsets.x || 0),
    width: containerDims.width - margins.width * 2 - (offsets.z || 0),
    height: containerDims.height - margins.height * 2 - (offsets.y || 0)
});

/**
 * Validates that a placed item has physical support beneath it
 */
export const hasPhysicalSupport = (
    item: PlacedItem,
    load: ContainerLoad,
    marginH: number
): boolean => {
    const itemBottom = item.position[1] - item.dimensions.height / 2;
    const itemLeft = item.position[0] - item.dimensions.length / 2;
    const itemRight = item.position[0] + item.dimensions.length / 2;
    const itemBack = item.position[2] - item.dimensions.width / 2;
    const itemFront = item.position[2] + item.dimensions.width / 2;

    // If on ground level, always supported
    if (Math.abs(itemBottom - marginH) < 10) {
        return true;
    }

    // Check if there's support beneath
    // Support must cover at least 80% of the item's footprint
    let supportedArea = 0;
    const itemFootprint = (itemRight - itemLeft) * (itemFront - itemBack);

    for (const other of load.items) {
        if (other === item) continue;

        const otherTop = other.position[1] + other.dimensions.height / 2;
        const otherLeft = other.position[0] - other.dimensions.length / 2;
        const otherRight = other.position[0] + other.dimensions.length / 2;
        const otherBack = other.position[2] - other.dimensions.width / 2;
        const otherFront = other.position[2] + other.dimensions.width / 2;

        // Check if this item is directly below (within tolerance)
        if (Math.abs(otherTop - itemBottom) > 10) continue;

        // Calculate overlap area
        const overlapLeft = Math.max(itemLeft, otherLeft);
        const overlapRight = Math.min(itemRight, otherRight);
        const overlapBack = Math.max(itemBack, otherBack);
        const overlapFront = Math.min(itemFront, otherFront);

        if (overlapRight > overlapLeft && overlapFront > overlapBack) {
            const area = (overlapRight - overlapLeft) * (overlapFront - overlapBack);
            supportedArea += area;
        }
    }

    // Require at least 80% support coverage
    return supportedArea >= itemFootprint * 0.8;
};

/**
 * Calculate packing statistics (pallets, lots, etc.)
 */
export const calculateStats = (res: PackingResult, activeMaterials: Material[]): PackingResult => {
    let totalPallets = 0;
    let totalLots = 0;

    res.loads.forEach((load: ContainerLoad) => {
        const uniqueBasePositions = new Set<string>();
        load.items.forEach((item: PlacedItem) => {
            if (item.type === 'pallet') {
                totalPallets++;
            }
            const mat = activeMaterials.find((m: Material) => m.id === item.materialId);
            const hasStrictConfig = mat && mat.layerConfig && mat.layerConfig.trim();

            if (hasStrictConfig && item.type === 'pallet' && item.position?.length === 3) {
                const x = Math.round(item.position[0]);
                const z = Math.round(item.position[2]);

                // For lot counting, we just need uniqueness logic.
                // Assuming items packed by packSequential/Grid have consistent positions.

                const key = `${x}_${z}`;
                uniqueBasePositions.add(key);
            }
        });
        totalLots += uniqueBasePositions.size;
    });

    return { ...res, totalPallets, totalLots };
};
