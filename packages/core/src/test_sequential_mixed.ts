import { calculatePacking } from './packingAlgorithm';
import { Container, Material, Dimensions } from './types';

// Helper to create test materials
const createMaterial = (id: number, dims: Dimensions, qty: number): Material => ({
    id,
    quantity: qty,
    box: {
        id: `b${id}`,
        dimensions: dims,
        allowedRotations: { x: false, y: false, z: false }, // Fixed orientation
        weightKg: 1,
        color: id === 1 ? '#ff0000' : '#00ff00'
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 },
    layerConfig: '',
    active: true
});

const CONTAINER_20: Container = {
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
 * PHASE 8 - STEP 3: Mode 1 Regression Tests
 * Verify SEQUENTIAL mode baseline behavior
 */

runTest('Mode 1 SEQUENTIAL: M2 never stacks on M1', () => {
    // Two materials with different dimensions
    const mat1 = createMaterial(1, { length: 1000, width: 1000, height: 1000 }, 10);
    const mat2 = createMaterial(2, { length: 800, width: 800, height: 800 }, 5);

    const result = calculatePacking(
        CONTAINER_20,
        [mat1, mat2],
        false,  // isCombined
        { length: 0, width: 0, height: 0 },  // margins
        false,  // enableFullMix
        'SEQUENTIAL'  // packingMode
    );

    console.log(`  Total containers: ${result.loads.length}`);
    console.log(`  Material 1 quantity: ${mat1.quantity}`);
    console.log(`  Material 2 quantity: ${mat2.quantity}`);

    // ASSERTION 1: Materials should be in separate container sets
    // Find all items for each material
    const mat1Items: any[] = [];
    const mat2Items: any[] = [];

    result.loads.forEach(load => {
        load.items.forEach(item => {
            if (item.materialId === 1) mat1Items.push(item);
            if (item.materialId === 2) mat2Items.push(item);
        });
    });

    if (mat1Items.length !== mat1.quantity) {
        throw new Error(`Material 1: Expected ${mat1.quantity} items, got ${mat1Items.length}`);
    }

    if (mat2Items.length !== mat2.quantity) {
        throw new Error(`Material 2: Expected ${mat2.quantity} items, got ${mat2Items.length}`);
    }

    // ASSERTION 2: M2 should NEVER be vertically above M1
    // Check all M2 items to ensure no M1 item is directly below
    for (const m2Item of mat2Items) {
        const m2Bottom = m2Item.position[1] - m2Item.dimensions.height / 2;

        for (const m1Item of mat1Items) {
            const m1Top = m1Item.position[1] + m1Item.dimensions.height / 2;
            const m1Left = m1Item.position[0] - m1Item.dimensions.length / 2;
            const m1Right = m1Item.position[0] + m1Item.dimensions.length / 2;
            const m1Back = m1Item.position[2] - m1Item.dimensions.width / 2;
            const m1Front = m1Item.position[2] + m1Item.dimensions.width / 2;

            const m2Left = m2Item.position[0] - m2Item.dimensions.length / 2;
            const m2Right = m2Item.position[0] + m2Item.dimensions.length / 2;
            const m2Back = m2Item.position[2] - m2Item.dimensions.width / 2;
            const m2Front = m2Item.position[2] + m2Item.dimensions.width / 2;

            // Check if M2 is directly above M1 (within tolerance)
            const verticallyAligned = Math.abs(m1Top - m2Bottom) < 50;

            // Check horizontal overlap
            const horizontalOverlap = (
                m2Right > m1Left && m2Left < m1Right &&
                m2Front > m1Back && m2Back < m1Front
            );

            if (verticallyAligned && horizontalOverlap) {
                throw new Error(`CROSS-MATERIAL STACKING DETECTED: M2 item at [${m2Item.position}] is stacked on M1 item at [${m1Item.position}]`);
            }
        }
    }

    console.log(`  ✓ No cross-material stacking detected`);
});

runTest('Mode 1 SEQUENTIAL: Deterministic Output', () => {
    const mat1 = createMaterial(1, { length: 1200, width: 1000, height: 800 }, 8);
    const mat2 = createMaterial(2, { length: 1000, width: 1000, height: 1000 }, 6);

    const run1 = calculatePacking(CONTAINER_20, [mat1, mat2], false, { length: 0, width: 0, height: 0 }, false, 'SEQUENTIAL');
    const run2 = calculatePacking(CONTAINER_20, [mat1, mat2], false, { length: 0, width: 0, height: 0 }, false, 'SEQUENTIAL');

    // Convert to JSON and compare
    const json1 = JSON.stringify(run1);
    const json2 = JSON.stringify(run2);

    if (json1 !== json2) {
        throw new Error(`Non-deterministic output detected! Results differ between runs.`);
    }

    console.log(`  ✓ Repeated runs produce identical output`);
});

runTest('Mode 1 SEQUENTIAL: Material Order Matters', () => {
    const mat1 = createMaterial(1, { length: 1000, width: 1000, height: 1000 }, 5);
    const mat2 = createMaterial(2, { length: 800, width: 800, height: 800 }, 5);

    const resultAB = calculatePacking(CONTAINER_20, [mat1, mat2], false, { length: 0, width: 0, height: 0 }, false, 'SEQUENTIAL');
    const resultBA = calculatePacking(CONTAINER_20, [mat2, mat1], false, { length: 0, width: 0, height: 0 }, false, 'SEQUENTIAL');

    // Results SHOULD differ (different order = different packing)
    const jsonAB = JSON.stringify(resultAB);
    const jsonBA = JSON.stringify(resultBA);

    if (jsonAB === jsonBA) {
        throw new Error(`Material order did NOT affect output (it should!)`);
    }

    console.log(`  ✓ Material order affects packing as expected`);
});

console.log('\n✅ ALL SEQUENTIAL MODE TESTS PASSED\n');
