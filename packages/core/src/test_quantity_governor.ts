import { calculatePacking } from './packingAlgorithm';
import { Container, Material, Dimensions } from './types';

// Helper to create simple test materials
const createMaterial = (id: number, dims: Dimensions, qty: number): Material => ({
    id,
    quantity: qty,
    box: {
        id: `b${id}`,
        dimensions: dims,
        allowedRotations: { x: false, y: false, z: false }, // Fixed orientation
        weightKg: 1,
        color: '#ff0000'
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
 * Phase 7.10 — MANDATORY REGRESSION TEST
 * Scenario: Quantity = capacity + 1
 * Verifies strict quantity enforcement and truthful load metadata
 */

runTest('Quantity Enforcement: capacity + 1', () => {
    // Setup: Calculate exact capacity for this box size
    const boxDims = { length: 1000, width: 1000, height: 1000 };
    const margins = { length: 0, width: 0, height: 0 };

    // Container dimensions: 5898 x 2352 x 2393
    // Capacity calculation (no margins):
    const lengthFit = Math.floor(5898 / 1000); // 5
    const widthFit = Math.floor(2352 / 1000);  // 2
    const heightFit = Math.floor(2393 / 1000); // 2
    const capacity = lengthFit * widthFit * heightFit; // 5 * 2 * 2 = 20

    const quantity = capacity + 1; // 21 items
    const mat = createMaterial(1, boxDims, quantity);

    // Execute
    const result = calculatePacking(CONTAINER_20, [mat], false, margins);

    console.log(`  Capacity: ${capacity}`);
    console.log(`  Quantity: ${quantity}`);
    console.log(`  Containers: ${result.loads.length}`);

    // ASSERTIONS

    // 1. Must have exactly 2 containers
    if (result.loads.length !== 2) {
        throw new Error(`Expected 2 containers, got ${result.loads.length}`);
    }

    // 2. Container 1: capacity items, FULL
    const load1 = result.loads[0];
    if (load1.items.length !== capacity) {
        throw new Error(`Container 1: Expected ${capacity} placements, got ${load1.items.length}`);
    }
    if (load1.type !== 'full') {
        throw new Error(`Container 1: Expected 'full', got '${load1.type}'`);
    }
    if (load1.itemCount !== capacity) {
        throw new Error(`Container 1: Expected itemCount=${capacity}, got ${load1.itemCount}`);
    }

    // 3. Container 2: 1 item, NOT full
    const load2 = result.loads[1];
    if (load2.items.length !== 1) {
        throw new Error(`Container 2: Expected 1 placement, got ${load2.items.length}`);
    }
    if (load2.type !== 'partial') {
        throw new Error(`Container 2: Expected 'partial', got '${load2.type}'`);
    }
    if (load2.itemCount !== 1) {
        throw new Error(`Container 2: Expected itemCount=1, got ${load2.itemCount}`);
    }

    // 4. Geometry count === total quantity
    const totalPlacements = result.loads.reduce((sum, load) => sum + load.items.length, 0);
    if (totalPlacements !== quantity) {
        throw new Error(`Total placements ${totalPlacements} !== quantity ${quantity}`);
    }

    // 5. Total itemCount === quantity
    const totalItems = result.loads.reduce((sum, load) => sum + load.itemCount, 0);
    if (totalItems !== quantity) {
        throw new Error(`Total itemCount ${totalItems} !== quantity ${quantity}`);
    }

    // 6. No duplicate placements WITHIN each container
    for (let loadIdx = 0; loadIdx < result.loads.length; loadIdx++) {
        const load = result.loads[loadIdx];
        const positions = new Set<string>();
        for (const item of load.items) {
            const key = `${item.position[0]}_${item.position[1]}_${item.position[2]}`;
            if (positions.has(key)) {
                throw new Error(`Container ${loadIdx + 1}: Duplicate placement at ${key}`);
            }
            positions.add(key);
        }
    }

    console.log(`  Container 1: ${load1.items.length} items (${load1.type})`);
    console.log(`  Container 2: ${load2.items.length} items (${load2.type})`);
});

runTest('Quantity Enforcement: exact capacity', () => {
    // Test that exact capacity fills one container and marks it as full
    const boxDims = { length: 1000, width: 1000, height: 1000 };
    const margins = { length: 0, width: 0, height: 0 };

    const lengthFit = Math.floor(5898 / 1000); // 5
    const widthFit = Math.floor(2352 / 1000);  // 2
    const heightFit = Math.floor(2393 / 1000); // 2
    const capacity = lengthFit * widthFit * heightFit; // 20

    const mat = createMaterial(1, boxDims, capacity);
    const result = calculatePacking(CONTAINER_20, [mat], false, margins);

    if (result.loads.length !== 1) {
        throw new Error(`Expected 1 container, got ${result.loads.length}`);
    }

    const load = result.loads[0];
    if (load.type !== 'full') {
        throw new Error(`Expected 'full', got '${load.type}'`);
    }

    if (load.items.length !== capacity) {
        throw new Error(`Expected ${capacity} items, got ${load.items.length}`);
    }

    console.log(`  Capacity: ${capacity}, Items: ${load.items.length}, Status: ${load.type}`);
});

console.log('\n✅ ALL QUANTITY ENFORCEMENT TESTS PASSED\n');
