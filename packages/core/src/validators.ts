/**
 * Input validation for 3D bin packing algorithm
 */

import type { Box, Container, Pallet, Dimensions } from './types';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate that dimensions are positive numbers
 */
export const validateDimensions = (dims: Dimensions, name: string): string[] => {
    const errors: string[] = [];

    if (!dims) {
        errors.push(`${name}: dimensions object is missing`);
        return errors;
    }

    if (dims.length <= 0) errors.push(`${name}: length must be positive`);
    if (dims.width <= 0) errors.push(`${name}: width must be positive`);
    if (dims.height <= 0) errors.push(`${name}: height must be positive`);

    return errors;
};

/**
 * Validate a box configuration
 */
export const validateBox = (box: Box): ValidationResult => {
    const errors = validateDimensions(box.dimensions, 'Box');
    return { valid: errors.length === 0, errors };
};

/**
 * Validate a container configuration
 */
export const validateContainer = (container: Container): ValidationResult => {
    const errors = validateDimensions(container.dimensions, 'Container');
    return { valid: errors.length === 0, errors };
};

/**
 * Validate a pallet configuration
 */
export const validatePallet = (pallet: Pallet): ValidationResult => {
    const errors: string[] = [];

    if (pallet.usePallet) {
        errors.push(...validateDimensions(pallet.dimensions, 'Pallet'));

        if (pallet.maxLoadHeight <= 0) {
            errors.push('Pallet: maxLoadHeight must be positive');
        }
    }

    return { valid: errors.length === 0, errors };
};

/**
 * Validate all packing inputs together
 */
export const validatePackingInputs = (
    box: Box,
    container: Container,
    pallet: Pallet,
    quantity: number
): ValidationResult => {
    const errors: string[] = [];

    const boxValidation = validateBox(box);
    const containerValidation = validateContainer(container);
    const palletValidation = validatePallet(pallet);

    errors.push(...boxValidation.errors);
    errors.push(...containerValidation.errors);
    errors.push(...palletValidation.errors);

    if (quantity <= 0) {
        errors.push('Quantity must be positive');
    }

    return { valid: errors.length === 0, errors };
};

/**
 * Check if a unit fits inside container with margins
 */
export const validateFitsInContainer = (
    unitDims: Dimensions,
    containerDims: Dimensions,
    margins: { length: number; width: number; height: number }
): boolean => {
    const availableL = containerDims.length - margins.length * 2;
    const availableW = containerDims.width - margins.width * 2;
    const availableH = containerDims.height - margins.height * 2;

    return (
        unitDims.length <= availableL &&
        unitDims.width <= availableW &&
        unitDims.height <= availableH
    );
};
