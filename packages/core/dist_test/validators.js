"use strict";
/**
 * Input validation for 3D bin packing algorithm
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFitsInContainer = exports.validatePackingInputs = exports.validatePallet = exports.validateContainer = exports.validateBox = exports.validateDimensions = void 0;
/**
 * Validate that dimensions are positive numbers
 */
const validateDimensions = (dims, name) => {
    const errors = [];
    if (!dims) {
        errors.push(`${name}: dimensions object is missing`);
        return errors;
    }
    if (dims.length <= 0)
        errors.push(`${name}: length must be positive`);
    if (dims.width <= 0)
        errors.push(`${name}: width must be positive`);
    if (dims.height <= 0)
        errors.push(`${name}: height must be positive`);
    return errors;
};
exports.validateDimensions = validateDimensions;
/**
 * Validate a box configuration
 */
const validateBox = (box) => {
    const errors = (0, exports.validateDimensions)(box.dimensions, 'Box');
    return { valid: errors.length === 0, errors };
};
exports.validateBox = validateBox;
/**
 * Validate a container configuration
 */
const validateContainer = (container) => {
    const errors = (0, exports.validateDimensions)(container.dimensions, 'Container');
    return { valid: errors.length === 0, errors };
};
exports.validateContainer = validateContainer;
/**
 * Validate a pallet configuration
 */
const validatePallet = (pallet) => {
    const errors = [];
    if (pallet.usePallet) {
        errors.push(...(0, exports.validateDimensions)(pallet.dimensions, 'Pallet'));
        if (pallet.maxLoadHeight <= 0) {
            errors.push('Pallet: maxLoadHeight must be positive');
        }
    }
    return { valid: errors.length === 0, errors };
};
exports.validatePallet = validatePallet;
/**
 * Validate all packing inputs together
 */
const validatePackingInputs = (box, container, pallet, quantity) => {
    const errors = [];
    const boxValidation = (0, exports.validateBox)(box);
    const containerValidation = (0, exports.validateContainer)(container);
    const palletValidation = (0, exports.validatePallet)(pallet);
    errors.push(...boxValidation.errors);
    errors.push(...containerValidation.errors);
    errors.push(...palletValidation.errors);
    if (quantity <= 0) {
        errors.push('Quantity must be positive');
    }
    return { valid: errors.length === 0, errors };
};
exports.validatePackingInputs = validatePackingInputs;
/**
 * Check if a unit fits inside container with margins
 */
const validateFitsInContainer = (unitDims, containerDims, margins) => {
    const availableL = containerDims.length - margins.length * 2;
    const availableW = containerDims.width - margins.width * 2;
    const availableH = containerDims.height - margins.height * 2;
    return (unitDims.length <= availableL &&
        unitDims.width <= availableW &&
        unitDims.height <= availableH);
};
exports.validateFitsInContainer = validateFitsInContainer;
