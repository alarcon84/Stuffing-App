
import { calculatePacking } from './packingAlgorithm';
import { Container, Material, Dimensions } from './types';
import { deepClone } from './utils';

// Helper to create simple test materials
const createMaterial = (id: number, dims: Dimensions, qty: number): Material => ({
    id,
    quantity: qty,
    box: {
        id: `b${id}`,
        // name removed
        dimensions: dims,
        allowedRotations: { x: true, y: true, z: true },
        // weight removed? Types says weightKg.
        weightKg: 1,
        color: '#ff0000'
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 },
    layerConfig: '',
    active: true,
    // priority removed? Not on Material interface in types.ts (unless added recently).
    // Let's assume priority is not there.
});

const CONTAINER_20: Container = {
    // id removed
    name: '20ft',
    dimensions: { length: 5898, width: 2352, height: 2393 },
    type: '20'
};

const runTest = (name: string, fn: () => void) => {
    try {
        console.log(`Running ${name}...`);
        fn();
        console.log(`  ✅ PASS`);
    } catch (e: any) {
        console.log(`  ❌ FAIL: ${e.message}`);
        console.error(e);
        process.exit(1);
    }
};

/**
 * TEST SUITE: Single Material Guard (Phase 7.7)
 * Ensures simpler "Fast Path" is taken and no floating items occur.
 */

runTest('Single Material: Floor Adherence Check', () => {
    // 1. Setup: Small box, Standard 20ft container
    const mat = createMaterial(1, { length: 400, width: 300, height: 200 }, 50);
    const margins = { length: 0, width: 0, height: 0 }; // Zero margins for easier math

    // 2. Execute
    const result = calculatePacking(CONTAINER_20, [mat], false, margins);

    // 3. Assertions
    if (result.loads.length === 0) throw new Error('No loads generated');
    const items = result.loads[0].items;

    console.log(`Packed ${items.length} items.`);

    // Check all item Y positions
    let minY = Infinity;
    items.forEach((item, idx) => {
        // Center Y
        const y = item.position[1];
        const halfHeight = item.dimensions.height / 2;
        const bottom = y - halfHeight;

        if (bottom < -0.1) throw new Error(`Item ${idx} is below floor! Bottom=${bottom}`);
        if (bottom < minY) minY = bottom;
    });

    console.log(`Minimum Bottom Y: ${minY}`);

    // The lowest item should be EXACTLY at 0 (since margins are 0)
    if (Math.abs(minY) > 0.1) {
        throw new Error(`Levitating Items Detected! Expected min bottom Y=0, got ${minY}`);
    }
});

runTest('Single Material: Axis Law Check (Fast Path)', () => {
    // Verify that the Fast Path respects the Axis Law (X=Length, Y=Height, Z=Width)
    // We'll use a 1x1x1 container and 1x1x1 box to verify coordinates simply?
    // Or just check that dimensions match selection.

    const mat = createMaterial(1, { length: 100, width: 50, height: 10 }, 1);
    // Allow only Fixed orientation
    mat.box.allowedRotations = { x: false, y: false, z: false };
    const margins = { length: 10, width: 20, height: 30 };

    const result = calculatePacking(CONTAINER_20, [mat], false, margins);

    const item = result.loads[0].items[0];

    // Expected Position:
    // X (Length) = MarginL + HalfLength = 10 + 50 = 60
    // Y (Height) = MarginH + HalfHeight = 30 + 5 = 35
    // Z (Width) = MarginW + HalfWidth = 20 + 25 = 45

    const [x, y, z] = item.position;

    console.log(`Position: [${x}, ${y}, ${z}]`);

    if (Math.abs(x - 60) > 0.1) throw new Error(`X Axis Violation. Expected 60, got ${x}`);
    if (Math.abs(y - 35) > 0.1) throw new Error(`Y Axis Violation. Expected 35, got ${y}`);
    if (Math.abs(z - 45) > 0.1) throw new Error(`Z Axis Violation. Expected 45, got ${z}`);
});

