"use strict";
/**
 * Utility functions for the 3D bin packing algorithm
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSpace = exports.parseLayerConfig = exports.normalizeLayerConfig = exports.deepClone = exports.calculateLoadBounds = exports.calculateGridFit = exports.calculateUtilization = exports.calculateVolume = void 0;
/**
 * Calculate volume of a dimensions object
 */
const calculateVolume = (dims) => dims.length * dims.width * dims.height;
exports.calculateVolume = calculateVolume;
/**
 * Calculate utilization percentage of items in a container
 */
const calculateUtilization = (items, containerDims) => {
    const usedVolume = items.reduce((sum, item) => {
        const itemVolume = (0, exports.calculateVolume)(item.dimensions);
        const count = item.itemCount || 1;
        return sum + itemVolume * count;
    }, 0);
    const containerVolume = (0, exports.calculateVolume)(containerDims);
    return containerVolume > 0 ? (usedVolume / containerVolume) * 100 : 0;
};
exports.calculateUtilization = calculateUtilization;
/**
 * Calculate how many units fit in available space
 */
const calculateGridFit = (available, unit) => ({
    countL: Math.floor(available.length / unit.length),
    countW: Math.floor(available.width / unit.width),
    countH: Math.floor(available.height / unit.height)
});
exports.calculateGridFit = calculateGridFit;
/**
 * Calculate the bounding box of placed items
 */
const calculateLoadBounds = (items, defaultMargin = 0) => {
    if (items.length === 0) {
        return { maxX: defaultMargin, maxY: defaultMargin, maxZ: defaultMargin };
    }
    let maxX = 0, maxY = 0, maxZ = 0;
    items.forEach(item => {
        const right = item.position[0] + item.dimensions.length / 2;
        const top = item.position[1] + item.dimensions.height / 2;
        const front = item.position[2] + item.dimensions.width / 2;
        if (right > maxX)
            maxX = right;
        if (top > maxY)
            maxY = top;
        if (front > maxZ)
            maxZ = front;
    });
    return { maxX, maxY, maxZ };
};
exports.calculateLoadBounds = calculateLoadBounds;
/**
 * Deep clone an object (with structuredClone fallback)
 */
const deepClone = (obj) => {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
};
exports.deepClone = deepClone;
/**
 * Normalize layer config string (handle *, ×, and X variations)
 */
const normalizeLayerConfig = (config) => {
    if (!config)
        return '';
    return config.toLowerCase().replace(/[*×]/g, 'x').trim();
};
exports.normalizeLayerConfig = normalizeLayerConfig;
/**
 * Parse layer config string into horizontal and vertical counts
 */
const parseLayerConfig = (config) => {
    const normalized = (0, exports.normalizeLayerConfig)(config);
    if (!normalized.includes('x'))
        return null;
    const parts = normalized.split('x');
    const horizontal = parseInt(parts[0], 10);
    const vertical = parseInt(parts[1], 10);
    if (isNaN(horizontal) || isNaN(vertical) || horizontal <= 0 || vertical <= 0) {
        return null;
    }
    return { horizontal, vertical };
};
exports.parseLayerConfig = parseLayerConfig;
/**
 * Calculate available space after applying margins and offsets
 */
const getAvailableSpace = (containerDims, margins, offsets = {}) => ({
    length: containerDims.length - margins.length * 2 - (offsets.x || 0),
    width: containerDims.width - margins.width * 2 - (offsets.z || 0),
    height: containerDims.height - margins.height * 2 - (offsets.y || 0)
});
exports.getAvailableSpace = getAvailableSpace;
