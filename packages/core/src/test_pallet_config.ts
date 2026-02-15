import { calculatePacking } from './packingAlgorithm';
import type { Container, Material } from './types';

console.log('=== TEST: Pallet Configuration with LayerConfig ===\n');

const container: Container = {
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

const testMaterial: Material = {
    id: 1,
    box: {
        id: 'box1',
        dimensions: { length: 600, width: 400, height: 300 },
        color: '#3b82f6',
        allowedRotations: { x: false, y: true, z: false }
    },
    pallet: {
        dimensions: { length: 1200, width: 1000, height: 150 },
        maxLoadHeight: 1800,
        usePallet: true,
        stackPallets: false
    },
    quantity: 100,
    layerConfig: '6x2', // User wants 6 cols × 2 rows
    active: true
};

console.log('Box Dimensions:', testMaterial.box.dimensions);
console.log('Pallet Dimensions:', testMaterial.pallet.dimensions);
console.log('Layer Config:', testMaterial.layerConfig);
console.log('Expected: 6 cols × 2 rows per layer\n');

const result = calculatePacking(
    container,
    [testMaterial],
    false,
    { length: 20, width: 20, height: 20 },
    'SEQUENTIAL'
);

console.log('📊 RESULTS:');
console.log('Total Containers:', result.totalContainers);
console.log('Total Items Packed:', result.totalItems);
console.log('Unpacked Items:', result.unpackedItems);

if (result.loads.length > 0) {
    const firstLoad = result.loads[0];
    console.log('\n📦 FIRST LOAD DETAILS:');
    console.log('Items in load:', firstLoad.items.length);

    if (firstLoad.items.length > 0) {
        const firstItem = firstLoad.items[0];
        console.log('First item type:', firstItem.type);
        console.log('Items per unit:', firstItem.itemCount);
        console.log('Grid:', firstItem.grid);

        // Calculate expected
        const expectedPerPallet = 6 * 2 * Math.floor((1800 - 150) / 300); // cols × rows × layers
        console.log('\n🧮 VERIFICATION:');
        console.log('Expected items per pallet (6×2×layers):', expectedPerPallet);
        console.log('Actual items per pallet:', firstItem.itemCount);

        if (firstItem.itemCount === expectedPerPallet) {
            console.log('✅ PASS: LayerConfig is being respected!');
        } else {
            console.log('❌ FAIL: LayerConfig is NOT being respected!');
            console.log('   Expected 6×2 configuration but got different result');
        }
    }
}

if (result.errors && result.errors.length > 0) {
    console.log('\n⚠️ ERRORS:', result.errors);
}
