"use strict";
/**
 * Orientation generation for 3D bin packing algorithm
 * Handles box rotation permutations based on allowed rotations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllFlatOrientations = exports.getFlatOrientation = exports.generateOrientations = void 0;
/**
 * Generate all valid orientations for a box based on allowed rotations
 *
 * Rotation types:
 * - y (Horizontal): Original height stays as height
 * - x (Vertical): Original length becomes height
 * - z (Flat): Original width becomes height
 *
 * @param baseDims - Original box dimensions
 * @param allowedRotations - Which rotations are permitted
 * @returns Array of oriented box configurations
 */
const generateOrientations = (baseDims, allowedRotations) => {
    const { length: L, width: W, height: H } = baseDims;
    const orientations = [];
    // Count selected rotations - if none selected, allow all
    const rotationCount = (allowedRotations.x ? 1 : 0) +
        (allowedRotations.y ? 1 : 0) +
        (allowedRotations.z ? 1 : 0);
    const allowAll = rotationCount === 0;
    // y (Horizontal): Original height stays as height
    if (allowAll || allowedRotations.y) {
        orientations.push({ dims: { length: L, width: W, height: H }, rotationType: 'y' });
        orientations.push({ dims: { length: W, width: L, height: H }, rotationType: 'y' });
    }
    // x (Vertical): Original length becomes height
    if (allowAll || allowedRotations.x) {
        orientations.push({ dims: { length: W, width: H, height: L }, rotationType: 'x' });
        orientations.push({ dims: { length: H, width: W, height: L }, rotationType: 'x' });
    }
    // z (Flat): Original width becomes height
    if (allowAll || allowedRotations.z) {
        orientations.push({ dims: { length: L, width: H, height: W }, rotationType: 'z' });
        orientations.push({ dims: { length: H, width: L, height: W }, rotationType: 'z' });
    }
    // Fallback: at least one orientation
    if (orientations.length === 0) {
        orientations.push({ dims: { length: L, width: W, height: H }, rotationType: 'y' });
    }
    return orientations;
};
exports.generateOrientations = generateOrientations;
/**
 * Get the flat orientation (smallest dimension as height)
 * Used for MaxSt top-off packing
 *
 * @param baseDims - Original box dimensions
 * @returns Dimensions with smallest value as height
 */
const getFlatOrientation = (baseDims) => {
    const sorted = [baseDims.length, baseDims.width, baseDims.height].sort((a, b) => a - b);
    return {
        length: sorted[2], // longest
        width: sorted[1], // middle
        height: sorted[0] // shortest (flat)
    };
};
exports.getFlatOrientation = getFlatOrientation;
/**
 * Get all flat orientations (both L×W and W×L on floor)
 * Used for advanced top-off optimization
 *
 * @param baseDims - Original box dimensions
 * @returns Array of two flat configurations
 */
const getAllFlatOrientations = (baseDims) => {
    const sorted = [baseDims.length, baseDims.width, baseDims.height].sort((a, b) => a - b);
    const flatHeight = sorted[0]; // Smallest dimension
    return [
        // Option A: longest side along length
        { length: sorted[2], width: sorted[1], height: flatHeight },
        // Option B: middle side along length
        { length: sorted[1], width: sorted[2], height: flatHeight }
    ];
};
exports.getAllFlatOrientations = getAllFlatOrientations;
