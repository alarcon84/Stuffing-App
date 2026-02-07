import { calculatePacking } from './packingAlgorithm';
import type { Container, Material } from './types';

// Enable detailed logging by temporarily adding console.log statements to packingAlgorithm.ts
// This test will show us EXACTLY what happens during M1→M2 vs M2→M3 transitions

const container: Container = {
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

// THREE IDENTICAL MATERIALS to eliminate geometry as a variable
const materials: Material[] = [
    {
        id: 1,
        active: true,
        quantity: 100, // Smaller quantity for clearer logs
        layerConfig: '',
        box: {
            id: 'box-1',
            materialId: 1,
            dimensions: { length: 1600, width: 175, height: 750 },
            color: '#3b82f6',
            allowedRotations: { x: false, y: true, z: false }
        },
        pallet: {
            dimensions: { length: 1600, width: 1050, height: 150 },
            maxLoadHeight: 2650,
            usePallet: false,
            stackPallets: false
        },
        maxSt: false
    },
    {
        id: 2,
        active: true,
        quantity: 100,
        layerConfig: '',
        box: {
            id: 'box-2',
            materialId: 2,
            dimensions: { length: 1600, width: 175, height: 750 }, // IDENTICAL
            color: '#ef4444',
            allowedRotations: { x: false, y: true, z: false }
        },
        pallet: {
            dimensions: { length: 1600, width: 1050, height: 150 },
            maxLoadHeight: 2650,
            usePallet: false,
            stackPallets: false
        },
        maxSt: false
    },
    {
        id: 3,
        active: true,
        quantity: 100,
        layerConfig: '',
        box: {
            id: 'box-3',
            materialId: 3,
            dimensions: { length: 1600, width: 175, height: 750 }, // IDENTICAL
            color: '#10b981',
            allowedRotations: { x: false, y: true, z: false }
        },
        pallet: {
            dimensions: { length: 1600, width: 1050, height: 150 },
            maxLoadHeight: 2650,
            usePallet: false,
            stackPallets: false
        },
        maxSt: false
    }
];

console.log('=== DIAGNOSTIC TEST: Trace M1→M2 vs M2→M3 Logic ===\n');
console.log('ALL MATERIALS IDENTICAL: 1600×175×750 mm\n');
console.log('⚠️  NOTE: You need to add console.log statements to packingAlgorithm.ts');
console.log('   at lines ~958-1000 to see shelf selection logic.\n');

const result = calculatePacking(
    container,
    materials,
    true,  // isCombined
    { length: 20, width: 20, height: 20 },
    true   // enableFullMix
);

console.log('\n=== SUMMARY ===');
console.log(`Total Containers: ${result.totalContainers}`);

result.loads.forEach((load, idx) => {
    console.log(`\nContainer ${idx + 1}:`);
    const matCounts = new Map<number, number>();
    load.items.forEach(item => {
        const mid = item.materialId || 0;
        matCounts.set(mid, (matCounts.get(mid) || 0) + (item.itemCount || 1));
    });

    matCounts.forEach((count, matId) => {
        console.log(`  M${matId}: ${count} items`);
    });
});

console.log('\n⚠️  To diagnose the issue, we need to add temporary logging to packingAlgorithm.ts');
console.log('   See: debug_logging_instructions.md');
