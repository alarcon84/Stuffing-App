
import type { Container, Box, Dimensions } from './types';
import { packGridCore, type GridVolume } from './packGridCore';

interface OrientationCandidate {
    dimensions: Dimensions;
    count: number;
    unusedVolume: number;
}

/**
 * Selects the best orientation for a box in a container strictly based on
 * the number of items that can be packed.
 * 
 * Rules:
 * 1. Highest count wins.
 * 2. Tie -> Lowest unused volume wins.
 * 3. Tie -> First orientation wins (stable).
 */
export function selectBestOrientation(
    container: Container,
    box: Box,
    allowedOrientations: Dimensions[],
    preference: 'default' | 'rotated' = 'default'
): { selectedDimensions: Dimensions, optimization: { recommendedPreference: 'default' | 'rotated', countDiff: number } | null } {
    if (allowedOrientations.length === 0) {
        return {
            selectedDimensions: box.dimensions,
            optimization: null
        };
    }

    let bestCandidate: OrientationCandidate | null = null;
    let fallbackCandidate: OrientationCandidate | null = null;

    // Track candidates by orientation type for optimization checks
    let defaultOrientation: OrientationCandidate | null = null; // Length >= Width
    let rotatedOrientation: OrientationCandidate | null = null; // Width > Length

    const containerVolume = container.dimensions.length * container.dimensions.width * container.dimensions.height;

    // Define the full container volume for the kernel
    const volume: GridVolume = {
        origin: { x: 0, y: 0, z: 0 },
        bounds: {
            length: container.dimensions.length,
            width: container.dimensions.width,
            height: container.dimensions.height
        }
    };

    for (const dims of allowedOrientations) {
        // Call kernel to get placements
        const placements = packGridCore(volume, dims);
        const count = placements.length;

        const boxVol = dims.length * dims.width * dims.height;
        const totalPackedVol = count * boxVol;
        const unusedVolume = containerVolume - totalPackedVol;

        const candidate: OrientationCandidate = {
            dimensions: dims,
            count,
            unusedVolume
        };

        // Classify candidate
        // Default: Face walls (Length >= Width)
        // Rotated: Becomes "depth" (Width > Length)
        if (dims.length >= dims.width) {
            if (!defaultOrientation || count > defaultOrientation.count || (count === defaultOrientation.count && unusedVolume < defaultOrientation.unusedVolume)) {
                defaultOrientation = candidate;
            }
        } else {
            if (!rotatedOrientation || count > rotatedOrientation.count || (count === rotatedOrientation.count && unusedVolume < rotatedOrientation.unusedVolume)) {
                rotatedOrientation = candidate;
            }
        }

        // Keep track of absolute best for fallback
        if (!fallbackCandidate) {
            fallbackCandidate = candidate;
        } else if (candidate.count > fallbackCandidate.count) {
            fallbackCandidate = candidate;
        } else if (candidate.count === fallbackCandidate.count && candidate.unusedVolume < fallbackCandidate.unusedVolume) {
            fallbackCandidate = candidate;
        }
    }

    // Selection Logic based on Preference
    const pref = preference || 'default';

    if (pref === 'default') {
        bestCandidate = defaultOrientation;
    } else {
        bestCandidate = rotatedOrientation;
    }

    // If preferred orientation is impossible (not allowed or doesn't fit), fallback to the other
    if (!bestCandidate) {
        bestCandidate = pref === 'default' ? rotatedOrientation : defaultOrientation;
    }

    // If still nothing (e.g. neither fit), fallback to absolute best or input
    if (!bestCandidate) {
        return {
            selectedDimensions: fallbackCandidate ? fallbackCandidate.dimensions : allowedOrientations[0],
            optimization: null
        };
    }

    // Optimization Check
    // If we selected 'default' but 'rotated' has MORE items, suggest it.
    // If we selected 'rotated' but 'default' has MORE items, suggest it.
    let optimization: { recommendedPreference: 'default' | 'rotated', countDiff: number } | null = null;

    if (pref === 'default' && rotatedOrientation && bestCandidate && rotatedOrientation.count > bestCandidate.count) {
        optimization = { recommendedPreference: 'rotated', countDiff: rotatedOrientation.count - bestCandidate.count };
    } else if (pref === 'rotated' && defaultOrientation && bestCandidate && defaultOrientation.count > bestCandidate.count) {
        optimization = { recommendedPreference: 'default', countDiff: defaultOrientation.count - bestCandidate.count };
    }

    return {
        selectedDimensions: bestCandidate.dimensions,
        optimization
    };
}
