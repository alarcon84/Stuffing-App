/**
 * ⚠️ KERNEL WARNING
 * This function is a locked physics kernel.
 * Do not modify without rerunning the full 10-test verification suite.
 */
import type { Dimensions } from './types';

export interface GridVolume {
    origin: { x: number; y: number; z: number };
    bounds: { length: number; width: number; height: number };
}

export interface GridPlacement {
    position: [number, number, number];
    dimensions: Dimensions;
}

/**
 * Core Grid Packing Engine
 * 
 * Satisfies constraints:
 * - Single material, Single container, Single orientation
 * - No mutations, No heuristics
 * // Canonical Fill Order:
 * // X: left -> right (container width)
 * // Y: back -> front (container length)
 * // Z: bottom -> top (floor -> roof)
 * //
 * // The entire floor (X,Y) MUST be filled before Z increments.
 */
export function packGridCore(
    volume: GridVolume,
    unit: Dimensions
): GridPlacement[] {
    // 1. Validate Inputs
    if (
        unit.length <= 0 || unit.width <= 0 || unit.height <= 0 ||
        volume.bounds.length <= 0 || volume.bounds.width <= 0 || volume.bounds.height <= 0
    ) {
        return [];
    }

    // 2. Calculate Counts (Floor Division)
    // X = Width, Y = Length, Z = Height
    const countX = Math.floor(volume.bounds.width / unit.width);   // left -> right
    const countY = Math.floor(volume.bounds.length / unit.length); // back -> front
    const countZ = Math.floor(volume.bounds.height / unit.height); // bottom -> top

    if (countX === 0 || countY === 0 || countZ === 0) {
        return [];
    }

    const placements: GridPlacement[] = [];

    // 3. Iterate Loops based on Wall-First Fill Order (Vertical Priority)
    // Y (Length) is outer -> Z (Height) -> X (Width) is inner
    // This fills the vertical "wall" (X,Z) before moving forward (Y)

    for (let y = 0; y < countY; y++) {       // back -> front
        for (let z = 0; z < countZ; z++) {     // floor -> roof
            for (let x = 0; x < countX; x++) {   // left -> right

                // Calculate Center Position (AXIS-CORRECT)
                const posX = volume.origin.x + (x * unit.width) + (unit.width / 2);
                const posY = volume.origin.y + (y * unit.length) + (unit.length / 2);
                const posZ = volume.origin.z + (z * unit.height) + (unit.height / 2);

                placements.push({
                    position: [posX, posY, posZ],
                    dimensions: { ...unit }
                });
            }
        }
    }

    return placements;
}
