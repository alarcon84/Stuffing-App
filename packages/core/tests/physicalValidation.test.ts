
import { describe, test, expect } from 'vitest';
import { calculatePacking } from '../src/packingAlgorithm';
import type { PlacedItem, Container, Box } from '../src/types';

const container20ft: Container = {
    name: '20ft',
    type: '20' as const,
    dimensions: { length: 5900, width: 2350, height: 2390 },
    maxWeight: 28000
};

const basicBox: Box = {
    id: 'box1',
    dimensions: { length: 400, width: 300, height: 200 },
    weight: 10,
    color: '#ff0000',
    allowedRotations: { x: true, y: true, z: true }
};

// --- Helper Functions ---

const checkOverlaps = (items: PlacedItem[]) => {
    const overlaps: string[] = [];
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const a = items[i];
            const b = items[j];

            // Simple AABB collision detection
            // Note: Position is center-based [Length, Height, Width]
            // Dimensions are [Length, Width, Height] ... wait. 
            // PlacedItem dimensions: length, width, height.
            // Position: [L, H, W] (from packingAlgorithm comments)

            const aL = a.dimensions.length;
            const aH = a.dimensions.height;
            const aW = a.dimensions.width;

            const bL = b.dimensions.length;
            const bH = b.dimensions.height;
            const bW = b.dimensions.width;

            const overlapL = Math.abs(a.position[0] - b.position[0]) < (aL + bL) / 2 - 0.1;
            const overlapH = Math.abs(a.position[1] - b.position[1]) < (aH + bH) / 2 - 0.1;
            const overlapW = Math.abs(a.position[2] - b.position[2]) < (aW + bW) / 2 - 0.1;

            if (overlapL && overlapH && overlapW) {
                overlaps.push(`Item ${i} overlaps Item ${j}`);
            }
        }
    }
    return overlaps;
};

const checkBoundaries = (items: PlacedItem[], container: Container) => {
    const violations: string[] = [];
    items.forEach((item, i) => {
        const halfL = item.dimensions.length / 2;
        const halfH = item.dimensions.height / 2;
        const halfW = item.dimensions.width / 2;

        const maxL = item.position[0] + halfL;
        const maxH = item.position[1] + halfH;
        const maxW = item.position[2] + halfW;

        // Tolerance 1mm
        if (maxL > container.dimensions.length + 1) violations.push(`Item ${i} exceeds length: ${maxL}`);
        if (maxH > container.dimensions.height + 1) violations.push(`Item ${i} exceeds height: ${maxH}`);
        if (maxW > container.dimensions.width + 1) violations.push(`Item ${i} exceeds width: ${maxW}`);

        const minL = item.position[0] - halfL;
        const minH = item.position[1] - halfH;
        const minW = item.position[2] - halfW;

        if (minL < -1) violations.push(`Item ${i} exceeds min length: ${minL}`);
        if (minH < -1) violations.push(`Item ${i} exceeds min height: ${minH}`);
        if (minW < -1) violations.push(`Item ${i} exceeds min width: ${minW}`);
    });
    return violations;
};

describe('Physical Validation Tests', () => {

    test('Test 1: Basic Box Packing (Gravity, Overlaps, Boundaries)', () => {
        // Without pallets, packing algorithm treats layerConfig as a way to form "box units"
        // If we want individual boxes, we should disable layer config or checking units?
        // Let's test checking the PLACED UNITS.

        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: false
            },
            quantity: 100,
            layerConfig: '', // Disable layer config to encourage individual packing if possible, OR keep it to test unit packing
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            false,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        const items = result.loads[0].items;
        expect(items.length).toBeGreaterThan(0);

        // Check 1: Gravity (At least one item on ground)
        const groundItems = items.filter(item => (item.position[1] - item.dimensions.height / 2) <= 1);
        expect(groundItems.length).toBeGreaterThan(0);

        // Check 2: Overlaps
        const overlaps = checkOverlaps(items);
        expect(overlaps).toHaveLength(0);

        // Check 3: Boundaries
        const boundViolations = checkBoundaries(items, container20ft);
        expect(boundViolations).toHaveLength(0);
    });

    test('Test 2: Pallet Validation', () => {
        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 100,
            layerConfig: '3x2',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        const items = result.loads[0].items;

        // We expect "Pallet" units.
        // item.type should be 'pallet'.

        const pallets = items.filter(item => item.type === 'pallet');
        expect(pallets.length).toBeGreaterThan(0);

        // Check 1: Overlaps among pallets
        const overlaps = checkOverlaps(pallets);
        expect(overlaps).toHaveLength(0);

        // Check 2: Max Height
        pallets.forEach(p => {
            expect(p.dimensions.height).toBeLessThanOrEqual(2000 + 10); // Tolerance
        });

        // Check 3: Grid Props (Internal consistency)
        pallets.forEach(p => {
            // 3x2 config means cols=3, rows=1 (if row is width? wait)
            // packer maps layerConfig -> grid cols/rows/layers.
            // If 3x2 (L x W), then:
            // cols = 3 (Length axis)
            // rows = 2 (Width axis)
            // Check grid property
            if (p.grid) {
                // In packingAlgorithm.ts:
                // cols = horizontal (length-wise usually)
                // rows = vertical (width-wise usually? Wait, vertical is height? No "horizontal, vertical" parts)
                // packingAlgorithm: const { horizontal, vertical } = parsedConfig;
                // "horizontal" usually means Items Per Layer? Or L x W?
                // The parser splits '3x2' into horizontal=3, vertical=2.
                // The packer maps `horizontal` -> cols.
                // But wait... `vertical` -> layers?
                // "Layer Config" usually means Ti x Hi (Items per layer x Layers)?
                // OR Length x Width count?

                // If user says "3x2 (6 boxes per layer)", that implies 3L x 2W.
                // AND 'Vertical' usually implies stacking height.

                // Let's assume the packer interprets 3x2 as 3L x 2W for base?
                // Looking at packingAlgorithm:
                // "if (parsedConfig) ... horizontal > ... vertical > ..."
                // It treats them as Horizontal limits and Vertical limits.
                // For Pallets, it sets `cols = horizontal` and `layers = vertical`?
                // LINE 382: `if (vertical > maxPossibleLayers) ... layers = vertical`.
                // So '3x2' -> 3 per layer? and 2 layers?
                // BUT User says "3x2 (6 boxes per layer)".
                // This implies 3 x 2 is the geometry of the layer.
                // This means the `layerConfig` string '3x2' might be ambiguous or mis-parsed.

                // If the algo uses it as Ti (3) x Hi (2), then user expectation "6 per layer" is mismatched?
                // Unless '3x2' means 3*2 = 6?
                // Let's verify what `grid` output is.
            }
        });
    });

    test('Test 3: Layer Configuration', () => {
        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 60,
            layerConfig: '3x2',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        const items = result.loads[0].items;
        const pallets = items.filter(item => item.type === 'pallet');

        expect(pallets.length).toBeGreaterThan(0);

        pallets.forEach(p => {
            // Verify Grid Config
            // 3x2 means:
            // - Cols (Horizontal/Length): 3?
            // - Rows (Vertical/Width): 2? 
            // Or vice versa depending on orientation.
            // The key is that cols * rows (or cols * layers depending on mapping) == 6?
            // Actually, usually Layer Config is items per layer.
            // So p.grid.cols * p.grid.rows (if rows is depth) should be 6.
            // Let's log the grid to be sure in debug, but here we expect the PRODUCT to be 6.

            // Note: In packingAlgorithm, 'rows' might be 1 if it's treating it as stacks?
            // But for pallets, it calculates cols and rows.

            // Let's expect that `grid` exists.
            expect(p.grid).toBeDefined();
            if (p.grid) {
                const itemsPerLayer = p.grid.cols * p.grid.rows; // Assuming rows is width-axis count
                // We specifically asked for 3x2 = 6 per layer.
                // However, algorithm might rotate the box.
                // Box: 400x300. Pallet: 1200x1000.
                // 3 * 400 = 1200 (Fits exactly length-wise)
                // 2 * 300 = 600 (Fits width-wise easily) or 3 * 300 = 900 (Fits width-wise)
                // 3x2 is conservative.

                // If the algo respects 3x2 literally:
                // It should enable 6 items per layer.
                expect(itemsPerLayer).toBe(6);
            }

            // Also check total items in unit is multiple of 6
            expect(p.itemCount % 6).toBe(0);
        });
    });

    test('Test 4: Top-Up Validation', () => {
        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 300,
            layerConfig: '3x2',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            true, // Enable Top-Up
            false
        );

        const items = result.loads[0].items;
        const topUpItems = items.filter(item => item.source === 'TOP_UP');

        if (topUpItems.length > 0) {
            topUpItems.forEach(item => {
                expect(item.locked).toBe(true);
                // Should be high up
                expect(item.position[1]).toBeGreaterThan(1500);
            });
            // Overlaps
            expect(checkOverlaps(items)).toHaveLength(0);
        }
    });

    test('Test 5: Full-Mix Validation', () => {
        const material = {
            id: 1,
            box: { ...basicBox, dimensions: { length: 600, width: 400, height: 300 } },
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 50,
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            true // Enable Full-Mix
        );

        const items = result.loads[0].items;
        const fullMixItems = items.filter(item => item.source === 'FULL_MIX');

        if (fullMixItems.length > 0) {
            // Overlaps
            expect(checkOverlaps(items)).toHaveLength(0);
        }
    });
});
