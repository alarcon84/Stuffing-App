import { packGridCore, type GridVolume } from './packGridCore';
import type { Dimensions } from './types';

// Utility for pretty printing coordinates
const fmt = (p: number[]) => `(${p[0]}, ${p[1]}, ${p[2]})`;

// Helper to run a test
const runTest = (name: string, fn: () => void) => {
    try {
        console.log(`\n=== ${name} ===`);
        fn();
        console.log(`✅ PASS`);
    } catch (e: any) {
        console.error(`❌ FAIL: ${e.message}`);
        process.exit(1);
    }
};

// Check equality of points with tolerance? No, integer logic so exact match expected.
const assertEqual = (actual: any, expected: any, msg: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${msg}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
};

const assert = (condition: boolean, msg: string) => {
    if (!condition) throw new Error(msg);
};


// Main Execution
const main = () => {

    // TEST 1 — Trivial Single Fit
    // Container: 10 × 10 × 10
    // Unit: 10 × 10 × 10
    // Expected: Count 1, Pos (5, 5, 5)
    runTest('TEST 1 — Trivial Single Fit', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 10, width: 10, height: 10 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        assert(results.length === 1, `Expected count 1, got ${results.length}`);
        // Map Core to Legacy: X=Y, Y=Z, Z=X
        // Core Pos: [width_pos, length_pos, height_pos] -> [X, Y, Z]
        // But packingAlgorithm maps:
        // position: [p.position[1], p.position[2], p.position[0]],
        // i.e. [Length, Height, Width]

        const p = results[0].position;
        // p[0] is Width dist (Core X)
        // p[1] is Length dist (Core Y)
        // p[2] is Height dist (Core Z)

        const legacyPos = [p[1], p[2], p[0]]; // L, H, W
        assertEqual(legacyPos, [5, 5, 5], 'Position mismatch');
    });

    // TEST 2 — Linear X Fill
    // Container: 100 × 10 × 10 (L=100, H=10, W=10)
    // Unit: 10 × 10 × 10
    // Expected: Count 10. First (5, 5, 5), Last (95, 5, 5). Order strictly increasing X.
    runTest('TEST 2 — Linear X Fill', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 100, width: 10, height: 10 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        assert(results.length === 10, `Expected count 10, got ${results.length}`);

        // First
        const p1 = results[0].position;
        const l1 = [p1[1], p1[2], p1[0]];
        assertEqual(l1, [5, 5, 5], 'First position mismatch');

        // Last
        const pLast = results[9].position;
        const lLast = [pLast[1], pLast[2], pLast[0]];
        assertEqual(lLast, [95, 5, 5], 'Last position mismatch');

        // Check Order
        let lastX = -1;
        results.forEach((r, i) => {
            const lx = r.position[1]; // Legacy X is Core Y
            if (i > 0) {
                assert(lx > lastX, `Order not strictly increasing X at index ${i}. Prev ${lastX}, Curr ${lx}`);
            }
            lastX = lx;
        });
    });

    // TEST 3 — Floor Fill (X → Z)
    // Container: 100 × 10 × 50 (L=100, H=10, W=50) -> inferred from expected result Z=45
    // Unit: 10 × 10 × 10
    // Expected: Count 50. Last item (95, 5, 45).
    runTest('TEST 3 — Floor Fill (X → Z)', () => {
        // Container L=100, W=50, H=10
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 100, width: 50, height: 10 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        assert(results.length === 50, `Expected count 50, got ${results.length}`);

        // Last Item
        const pLast = results[49].position;
        const lLast = [pLast[1], pLast[2], pLast[0]]; // L, H, W
        assertEqual(lLast, [95, 5, 45], 'Last item position mismatch');

        // Check Order: Fill X left -> right (outer). Z back -> front (inner).
        const p0 = results[0].position; // 5, 5, 5
        const p1 = results[1].position; // Expected 5, 5, 15?
        const l0 = [p0[1], p0[2], p0[0]];
        const l1 = [p1[1], p1[2], p1[0]];

        // If Z is fastest varying index (Inner loop is Width):
        // results[0]: (5, 5, 5)
        // results[1]: (5, 5, 15)
        // results[4]: (5, 5, 45)
        // results[5]: (15, 5, 5)

        // So for the first chunk, X should be constant, Z should increase.
        assert(l1[2] > l0[2], `Expected Z (Width) to increase first. Got ${fmt(l0)} -> ${fmt(l1)}`);
        assert(l1[0] === l0[0], `Expected L (X) to stay same. Got ${fmt(l0)} -> ${fmt(l1)}`);
    });

    // TEST 4 — Vertical Stack
    // Container: 100 × 30 × 10 (L=100, H=30, W=10)
    // Unit: 10 × 10 × 10
    // Expected: Count 30. Layer 1 Y=5, Layer 2 Y=15, Layer 3 Y=25.
    runTest('TEST 4 — Vertical Stack', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 100, width: 10, height: 30 } // Note: Height is 30
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        assert(results.length === 30, `Expected count 30, got ${results.length}`);

        // Check vertical layers exists
        // Layer 1: Y=5 (Core Z=5)
        const layer1 = results.some(r => r.position[2] === 5); // Core Z
        const layer2 = results.some(r => r.position[2] === 15);
        const layer3 = results.some(r => r.position[2] === 25);

        assert(layer1, 'Layer 1 (Y=5) not found');
        assert(layer2, 'Layer 2 (Y=15) not found');
        assert(layer3, 'Layer 3 (Y=25) not found');
    });

    // TEST 5 — Full 3D Grid
    // Container: 100 × 30 × 50 (L=100, H=30, W=50)
    // Unit: 10 × 10 × 10
    // Expected: X=10, Y=3, Z=5. Total 150. Last item: (95, 25, 45).
    runTest('TEST 5 — Full 3D Grid', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 100, width: 50, height: 30 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        assert(results.length === 150, `Expected 150 items, got ${results.length}`);

        const pLast = results[149].position;
        const lLast = [pLast[1], pLast[2], pLast[0]];
        assertEqual(lLast, [95, 25, 45], 'Last item position mismatch');
    });

    // TEST 6 — Non-Even Division
    // Container: 95 × 30 × 50 (L=95, H=30, W=50)
    // Unit: 10 × 10 × 10
    // Expected: X=9, Y=3, Z=5. Total 135. No overflow.
    runTest('TEST 6 — Non-Even Division', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 95, width: 50, height: 30 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        const countX = Math.floor(95 / 10); // 9
        const countY = Math.floor(30 / 10); // 3
        const countZ = Math.floor(50 / 10); // 5
        const expectedTotal = countX * countY * countZ; // 135

        assert(results.length === expectedTotal, `Expected count ${expectedTotal}, got ${results.length}`);

        // Check for overflow
        results.forEach(r => {
            const lx = r.position[1];
            const ly = r.position[2]; // Height
            const lz = r.position[0]; // Width

            // Max X should be 90 (center 85). Wait...
            // If dims 95. Capacity 9.
            // Items at 5, 15, ..., 85.
            // Edge of last item is 85+5 = 90. Within 95.
            // Coordinates are centers.
            const halfL = 5;
            const halfH = 5;
            const halfW = 5;

            assert(lx + halfL <= 95, `Overflow L: ${lx}`);
            assert(ly + halfH <= 30, `Overflow H: ${ly}`);
            assert(lz + halfW <= 50, `Overflow W: ${lz}`);
        });
    });

    // TEST 7 — Asymmetric Box
    // Container: 120 × 40 × 60 (L=120, H=40, W=60)
    // Unit: 20 × 10 × 15 (L=20, H=10, W=15 ? check user text)
    // User: Unit: 20 x 10 x 15. Expected X=6, Y=4, Z=4. Total 96.
    // L=120/20=6. H=40/10=4. W=60/15=4.
    runTest('TEST 7 — Asymmetric Box', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 120, width: 60, height: 40 }
        };
        const unit: Dimensions = { length: 20, width: 15, height: 10 }; // L, W, H
        const results = packGridCore(volume, unit);

        assert(results.length === 96, `Expected count 96, got ${results.length}`);

        // Verify Check axes
        // CountX (Length) should be 6
        // CountY (Height) should be 4
        // CountZ (Width) should be 4

        // Find max L, H, W indices
        // Since we know the grid logic, we can check the last item position
        const pLast = results[results.length - 1].position;
        const lLast = [pLast[1], pLast[2], pLast[0]];

        // Expected Last L: (6-1)*20 + 10 = 100 + 10 = 110.
        // Expected Last H: (4-1)*10 + 5 = 30 + 5 = 35.
        // Expected Last W: (4-1)*15 + 7.5 = 45 + 7.5 = 52.5.

        assertEqual(lLast, [110, 35, 52.5], 'Asymmetric Last Item Mismatch');
    });

    // TEST 8 — Origin Offset
    // Origin: (10, 0, 5) -> Legacy (L=10, H=0, W=5) -> Core (Y=10, Z=0, X=5)
    // Container: 100 × 20 × 30 (L=100, H=20, W=30). Note H=20 is weird in "100x20x30", usually W=20 H=30?
    // User: "Container: 100 x 20 x 30".
    // User Expected: First (15, 5, 10). Last (105, 15, 30).
    // First: (L=15, H=5, W=10).
    // If Origin L=10. First L = 10 + 5 = 15. Correct.
    // Origin H=0. First H = 0 + 5 = 5. Correct.
    // Origin W=5. First W = 5 + 5 = 10. Correct.
    // Last: (105, 15, 30).
    // Last L: 105. Relative L = 95. (10 + 95). Count 10 (100/10). Correct. -> Length 100 OK.
    // Last H: 15. Relative H = 15. (0 + 15). Count 2 (20/10). Correct. -> Height 20 OK.
    // Last W: 30. Relative W = 25. (5 + 25). Count 3 (30/10). Correct. -> Width 30 OK.
    // So H=20, W=30.
    // Dimensions: L=100, H=20, W=30.
    runTest('TEST 8 — Origin Offset', () => {
        const volume: GridVolume = {
            // Core Origin: X=W=5, Y=L=10, Z=H=0
            origin: { x: 5, y: 10, z: 0 },
            bounds: { length: 100, width: 30, height: 20 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        // First
        const p1 = results[0].position;
        const l1 = [p1[1], p1[2], p1[0]];
        assertEqual(l1, [15, 5, 10], 'First Pos Mismatch');

        // Last
        const pLast = results[results.length - 1].position;
        const lLast = [pLast[1], pLast[2], pLast[0]];
        assertEqual(lLast, [105, 15, 30], 'Last Pos Mismatch');
    });

    // TEST 9 — Zero Fit Guard
    // Container: 9 × 10 × 10 (L=9, W=10, H=10)
    // Unit: 10 × 10 × 10
    // Expected: Result []
    runTest('TEST 9 — Zero Fit Guard', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 9, width: 10, height: 10 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };
        const results = packGridCore(volume, unit);

        assert(results.length === 0, `Expected empty, got ${results.length}`);
    });

    // TEST 10 — Determinism Check
    // Run TEST 5 twice. Expected: Same count, order, coords.
    runTest('TEST 10 — Determinism Check', () => {
        const volume: GridVolume = {
            origin: { x: 0, y: 0, z: 0 },
            bounds: { length: 100, width: 50, height: 30 }
        };
        const unit: Dimensions = { length: 10, width: 10, height: 10 };

        const run1 = packGridCore(volume, unit);
        const run2 = packGridCore(volume, unit);

        assertEqual(run1, run2, 'Determinism Check Failed');
    });

    console.log('\n✅ ALL TESTS PASSED');
};

main();
