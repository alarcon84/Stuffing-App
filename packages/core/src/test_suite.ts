
import { calculatePacking } from './packingAlgorithm';
import { Container, Material, Box, Pallet } from './types';

const container53: Container = {
    name: '53ft Trailer',
    dimensions: { length: 16000, width: 2540, height: 2700 },
    type: '53'
};

const defaultPallet: Pallet = {
    dimensions: { length: 1600, width: 1050, height: 150 }, // Height is usually ignored if not used, but good to have
    maxLoadHeight: 2650,
    usePallet: false,
    stackPallets: false
};

const createMaterial = (id: number, boxDims: [number, number, number], qty: number, config: string = '', pallet: Partial<Pallet> = {}, allowedRotations: { x: boolean, y: boolean, z: boolean } = { x: true, y: true, z: true }): Material => {
    return {
        id,
        box: {
            id: `box-${id}`,
            dimensions: { length: boxDims[0], width: boxDims[1], height: boxDims[2] },
            color: '#ffffff',
            allowedRotations
        },
        pallet: { ...defaultPallet, ...pallet },
        quantity: qty,
        layerConfig: config,
        active: true,
        maxSt: false // Disabled for all tests as requested
    };
};

const runTest = (name: string, materials: Material[], expected: string) => {
    console.log(`\n## ${name}`);
    console.log(`**Expected**: ${expected}`);

    try {
        const result = calculatePacking(container53, materials, true); // Enable isCombined for mixing

        console.log(`**Actual Results**:`);
        console.log(`- Total Items: ${result.totalItems}`);
        console.log(`- Total Containers: ${result.totalContainers}`);
        console.log(`- Total Pallets: ${result.totalPallets ?? 0}`);
        console.log(`- Total Lots: ${result.totalLots ?? 0}`);

        if (result.loads.length > 0) {
            console.log(`- Utilization: ${result.loads[0].utilization.toFixed(2)}% (Load 1)`);
            console.log(`- Container Breakdown:`);
            result.loads.forEach(l => {
                console.log(`  - Load ${l.id}: ${l.itemCount} items, ${l.type}`);
            });
        } else {
            console.log(`- Utilization: 0%`);
        }

        if (result.errors && result.errors.length > 0) {
            console.log(`- Errors: ${result.errors.join(', ')}`);
        }

    } catch (e) {
        console.log(`**ERROR**: ${e}`);
    }
    console.log('---');
};

console.log('# Test Suite Report\n');

// 1. Basic no-config, no-pallet, full fill
runTest(
    '1. Basic no-config, no-pallet, full fill',
    [createMaterial(1, [800, 175, 400], 1000, '', { usePallet: false })],
    '1 container, ~1680 items capacity, >80% utilization'
);

// 2. Layer config, no-pallet
runTest(
    '2. Layer config, no-pallet',
    [createMaterial(1, [1600, 175, 800], 100, '6x2', { usePallet: false })],
    '1 container, 100 items, 0 Pallets, 0 Lots'
);

// 3. Pallet mode, auto config
runTest(
    '3. Pallet mode, auto config',
    [createMaterial(1, [800, 175, 400], 500, '', { usePallet: true, dimensions: { length: 1600, width: 1050, height: 150 }, maxLoadHeight: 2650 })],
    'Correct pallets count, items per pallet ~48'
);

// 4. Pallet mode with config + double stacking
runTest(
    '4. Pallet mode with config + double stacking',
    [createMaterial(1, [1600, 175, 800], 100, '6x2', { usePallet: true, stackPallets: true, dimensions: { length: 1600, width: 1050, height: 150 }, maxLoadHeight: 2650 })],
    '~9 pallets, some double-stacked'
);

// 5. Multi-material mixing (single container)
runTest(
    '5. Multi-material mixing (single container)',
    [
        createMaterial(1, [1600, 175, 800], 300, '6x2', { usePallet: false }),
        createMaterial(2, [800, 120, 600], 100, '5x1', { usePallet: false })
    ],
    'Mixed in 1 container'
);

// 6. Multi-material separate containers
runTest(
    '6. Multi-material separate containers',
    [
        createMaterial(1, [2200, 1300, 200], 300, '4x2', { usePallet: false }),
        createMaterial(2, [800, 175, 400], 500, '10x3', { usePallet: false })
    ],
    'Multiple containers'
);

// 7. Partial container
runTest(
    '7. Partial container',
    [createMaterial(1, [1600, 175, 800], 37, '6x2', { usePallet: false })],
    '1 container, 3 full pallets (36) + 1 partial (1)'
);

// 8. Zero quantity
runTest(
    '8. Zero quantity',
    [createMaterial(1, [800, 175, 400], 0, '', { usePallet: false })],
    '0 items, 0 containers'
);

// 9. Box too big for container
runTest(
    '9. Box too big for container',
    [createMaterial(1, [20000, 3000, 3000], 10, '', { usePallet: false })],
    '0 items, warning'
);

// 10. Rotation change test
// Test 10a: Horizontal (y: true only)
runTest(
    '10a. Rotation: Horizontal',
    [createMaterial(1, [1600, 175, 800], 100, '6x2', { usePallet: false }, { x: false, y: true, z: false })],
    'Specific count based on Horizontal'
);

// Test 10b: Vertical (x: true only)
runTest(
    '10b. Rotation: Vertical',
    [createMaterial(1, [1600, 175, 800], 100, '6x2', { usePallet: false }, { x: true, y: false, z: false })],
    'Specific count based on Vertical'
);

// Test 10c: Flat (z: true only)
runTest(
    '10c. Rotation: Flat',
    [createMaterial(1, [1600, 175, 800], 100, '6x2', { usePallet: false }, { x: false, y: false, z: true })],
    'Specific count based on Flat'
);
// 11. Reproduction: 4 Materials Mixed
runTest(
    '11. Reproduction: 4 Materials Mixed',
    [
        createMaterial(1, [1600, 175, 800], 425, '6x2', { usePallet: false }),
        createMaterial(2, [800, 175, 400], 425, '', { usePallet: false }), // Guessing dims
        createMaterial(3, [1200, 200, 600], 425, '', { usePallet: false }), // Guessing dims
        createMaterial(4, [1000, 150, 500], 425, '', { usePallet: false })  // Guessing dims
    ],
    'Consolidated containers, high utilization'
);
