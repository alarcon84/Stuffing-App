
import { calculatePacking } from './packingAlgorithm';
import { Container, Material, Dimensions } from './types';
import { deepClone } from './utils';
import fs from 'fs';
import path from 'path';

// Helper to create simple test materials
const createMaterial = (id: number, dims: Dimensions, qty: number): Material => ({
    id,
    name: `Material ${id}`,
    quantity: qty,
    box: {
        id: `b${id}`,
        name: `Box ${id}`,
        dimensions: dims,
        allowedRotations: { x: false, y: false, z: false }, // Fixed orientation for strict testing
        weight: 1,
        color: '#ff0000'
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 },
    layerConfig: '',
    active: true,
    priority: 1
});

const CONTAINER: Container = {
    id: 'c1',
    name: '20ft',
    dimensions: { length: 6000, width: 2400, height: 2400 },
    type: '20'
};

const runTest = (name: string, fn: () => void) => {
    try {
        console.log(`Running ${name}...`);
        fn();
        console.log(`  ✅ PASS`);
    } catch (e: any) {
        console.log(`  ❌ FAIL: ${e.message}`);
        process.exit(1);
    }
};

const assertEqual = (a: any, b: any, msg: string) => {
    const strA = JSON.stringify(a);
    const strB = JSON.stringify(b);
    if (strA !== strB) {
        throw new Error(`${msg}\nExpected: ${strB}\nActual:   ${strA}`);
    }
};

const assertNotEqual = (a: any, b: any, msg: string) => {
    const strA = JSON.stringify(a);
    const strB = JSON.stringify(b);
    if (strA === strB) {
        throw new Error(`${msg}\nExpected output to differ, but it was identical.`);
    }
};

/**
 * TEST SUITE: Mixed-Material Determinism
 */

// 1. REPEATED RUNS
// Verify that running the exact same input multiple times yields the exact same JSON output.
runTest('Repeated Runs (Idempotency)', () => {
    const matA = createMaterial(1, { length: 1000, width: 1000, height: 1000 }, 5);
    const matB = createMaterial(2, { length: 500, width: 500, height: 500 }, 10);
    const mats = [matA, matB];

    const run1 = calculatePacking(CONTAINER, mats);
    const run2 = calculatePacking(CONTAINER, mats);
    const run3 = calculatePacking(CONTAINER, mats);

    assertEqual(run1, run2, 'Run 1 and Run 2 should be identical');
    assertEqual(run2, run3, 'Run 2 and Run 3 should be identical');
});

// 2. ORDER SENSITIVITY
// Verify that packing [A, B] produces a DIFFERENT result than [B, A].
// This proves that the algorithm respects input order and doesn't auto-sort.
runTest('Order Sensitivity ([A, B] != [B, A])', () => {
    // Mat A is huge, Mat B is tiny.
    // [A, B]: A fills first, B fills gaps.
    // [B, A]: B fills first (scattered?), A fills remainder.
    const matA = createMaterial(1, { length: 2000, width: 2200, height: 2000 }, 1);
    const matB = createMaterial(2, { length: 500, width: 500, height: 500 }, 20);

    const resAB = calculatePacking(CONTAINER, [matA, matB]);
    const resBA = calculatePacking(CONTAINER, [matB, matA]);

    // Just checking total util or item positions should differ
    const posAB = resAB.loads[0]?.items.map(i => i.position);
    const posBA = resBA.loads[0]?.items.map(i => i.position);

    assertNotEqual(posAB, posBA, 'Order [A, B] should produce different layout than [B, A]');
});

// 3. PREFIX STABILITY (The "Frozen History" Law)
// Verify that adding a new material C to [A, B] does NOT change the positions of A or B.
// This proves that previous materials are immutable obstacles.
runTest('Prefix Stability (Appending C preserves A & B)', () => {
    const matA = createMaterial(1, { length: 1000, width: 1000, height: 1000 }, 2);
    const matB = createMaterial(2, { length: 800, width: 800, height: 800 }, 2);
    const matC = createMaterial(3, { length: 500, width: 500, height: 500 }, 5);

    // Run 1: Just A & B
    const runAB = calculatePacking(CONTAINER, [matA, matB]);

    // Run 2: A, B, and C
    const runABC = calculatePacking(CONTAINER, [matA, matB, matC]);

    // Verify A & B passed unchanged
    const itemsAB = runAB.loads[0].items.filter(i => i.materialId === 1 || i.materialId === 2);
    const itemsABC_subset = runABC.loads[0].items.filter(i => i.materialId === 1 || i.materialId === 2);

    assertEqual(itemsAB.length, itemsABC_subset.length, 'Should have same number of A&B items');

    // Sort by position to ensure strict comparison matches
    const sorter = (a: any, b: any) => (a.position[0] - b.position[0]) || (a.position[1] - b.position[1]) || (a.position[2] - b.position[2]);
    itemsAB.sort(sorter);
    itemsABC_subset.sort(sorter);

    assertEqual(itemsAB, itemsABC_subset, 'Positions of A and B must remain exactly identical after adding C');
});

console.log('\n✅ ALL DETERMINISM TESTS PASSED');
