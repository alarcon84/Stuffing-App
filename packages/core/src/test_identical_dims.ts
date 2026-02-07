import { calculatePacking } from './packingAlgorithm';
import type { Container, Material } from './types';

const container: Container = {
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

// THREE MATERIALS - IDENTICAL DIMENSIONS
const materials: Material[] = [
    {
        id: 1,
        active: true,
        quantity: 50,
        layerConfig: '',
        box: {
            id: 'box-1',
            materialId: 1,
            dimensions: { length: 1200, width: 600, height: 400 },
            color: '#3b82f6',
            allowedRotations: { x: false, y: true, z: false }
        },
        pallet: {
            dimensions: { length: 1200, width: 1000, height: 150 },
            maxLoadHeight: 2650,
            usePallet: false,
            stackPallets: false
        },
        maxSt: false
    },
    {
        id: 2,
        active: true,
        quantity: 50,
        layerConfig: '',
        box: {
            id: 'box-2',
            materialId: 2,
            dimensions: { length: 1200, width: 600, height: 400 }, // IDENTICAL
            color: '#ef4444',
            allowedRotations: { x: false, y: true, z: false }
        },
        pallet: {
            dimensions: { length: 1200, width: 1000, height: 150 },
            maxLoadHeight: 2650,
            usePallet: false,
            stackPallets: false
        },
        maxSt: false
    },
    {
        id: 3,
        active: true,
        quantity: 50,
        layerConfig: '',
        box: {
            id: 'box-3',
            materialId: 3,
            dimensions: { length: 1200, width: 600, height: 400 }, // IDENTICAL
            color: '#10b981',
            allowedRotations: { x: false, y: true, z: false }
        },
        pallet: {
            dimensions: { length: 1200, width: 1000, height: 150 },
            maxLoadHeight: 2650,
            usePallet: false,
            stackPallets: false
        },
        maxSt: false
    }
];

console.log('=== TEST: Full Mix with IDENTICAL Dimensions ===\n');
console.log('Box Dimensions (ALL MATERIALS): 1200 × 600 × 400 mm');
console.log('Quantity (ALL MATERIALS): 50 items each\n');

// Test with Full Mix ON
console.log('🧪 Running: Combined Packing + Full Mix ON\n');
const result = calculatePacking(
    container,
    materials,
    true,  // isCombined
    { length: 20, width: 20, height: 20 },
    true   // enableFullMix
);

console.log('📊 RESULTS:');
console.log(`Total Containers: ${result.totalContainers}`);
console.log(`Total Items Packed: ${result.totalItems}`);
console.log(`Unpacked Items: ${result.unpackedItems}\n`);

console.log('📦 CONTAINER BREAKDOWN:\n');
result.loads.forEach((load, idx) => {
    console.log(`Container ${idx + 1} (${load.type}):`);
    console.log(`  Utilization: ${load.utilization.toFixed(1)}%`);
    console.log(`  Total Items: ${load.itemCount}`);

    const matCounts = new Map<number, number>();
    load.items.forEach(item => {
        const mid = item.materialId || 0;
        matCounts.set(mid, (matCounts.get(mid) || 0) + (item.itemCount || 1));
    });

    console.log('  Material Distribution:');
    matCounts.forEach((count, matId) => {
        console.log(`    M${matId}: ${count} items`);
    });

    const uniqueMats = Array.from(matCounts.keys());
    if (uniqueMats.length > 1) {
        console.log(`  ✅ MIXED: ${uniqueMats.length} different materials`);
    } else {
        console.log(`  ⚠️  SEGREGATED: Only M${uniqueMats[0]}`);
    }
    console.log('');
});

console.log('=== ANALYSIS ===');
const mixedContainers = result.loads.filter(load => {
    const mats = new Set(load.items.map(i => i.materialId));
    return mats.size > 1;
}).length;

const segregatedContainers = result.loads.length - mixedContainers;

console.log(`Mixed Containers: ${mixedContainers}`);
console.log(`Segregated Containers: ${segregatedContainers}`);

if (segregatedContainers > 0) {
    console.log('\n❌ INCONSISTENT BEHAVIOR DETECTED!');
    console.log('With identical dimensions and Full Mix ON, all materials should mix uniformly.');
    console.log('If M1-only or M2-only containers exist, there is a logic difference.');
} else {
    console.log('\n✅ CONSISTENT BEHAVIOR!');
    console.log('All containers show material mixing as expected.');
}
