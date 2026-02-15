import type { Container, Box, Dimensions } from './types';
import { packGridCore, type GridVolume } from './packGridCore';

export interface OrientationCandidate {
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
    allowedOrientations: Dimensions[]
): Dimensions {
    if (allowedOrientations.length === 0) {
        // Fallback to original dimensions if no candidates provided
        return {
            length: box.dimensions.length,
            width: box.dimensions.width,
            height: box.dimensions.height
        };
    }

    let bestCandidate: OrientationCandidate | null = null;
    const containerVolume = container.dimensions.length * container.dimensions.width * container.dimensions.height;

    // Define the full container volume for the kernel
    // Origin is 0,0,0 because we are just counting theoretical capacity
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

        if (!bestCandidate) {
            bestCandidate = candidate;
            continue;
        }

        // Rule 1: Highest count wins
        if (candidate.count > bestCandidate.count) {
            bestCandidate = candidate;
            continue;
        }

        // Rule 2: Tie -> Lowest unused volume wins
        if (candidate.count === bestCandidate.count) {
            if (candidate.unusedVolume < bestCandidate.unusedVolume) {
                bestCandidate = candidate;
            }
            // Rule 3: Tie -> Keep existing (stable)
        }
    }

    return bestCandidate!.dimensions;
}
