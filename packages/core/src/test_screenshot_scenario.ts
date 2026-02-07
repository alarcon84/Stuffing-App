import { calculatePacking } from './packingAlgorithm';
import type { Container, Material } from './types';

const container: Container = {
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

// YOUR EXACT SCREENSHOT SCENARIO: M1 and M2 with IDENTICAL dimensions
const materials: Material[] = [
    {
        id: 1,
        active: true,
        quantity: 425,
        layerConfig: '',
        box: {
            id: 'box-1',
            materialId: 1,
            dimensions: { length: 1600, width: 175, height: 750 },
            color: '#3b82f6', // Blue
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
        quantity: 425,
        layerConfig: '',
        box: {
            id: 'box-2',
            materialId: 2,
            dimensions: { length: 1600, width: 175, height: 750 }, // IDENTICAL to M1
            color: '#ef4444', // Red
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

console.log('=== TEST: M1-M2 Full Mix Fix (Screenshot Scenario) ===\n');
console.log('M1: 1600×175×750 mm, Qty: 425, Horizontal');
console.log('M2: 1600×175×750 mm, Qty: 425, Horizontal (IDENTICAL)\n');

// Test with Full Mix ON (AFTER FIX)
console.log('🧪 Test: Combined Packing + Full Mix ON (POST-FIX)\n');
const result = calculatePacking(
    container,
    materials,
    true,  // isCombined
    { length: 20, width: 20, height: 20 },
    true   // enableFullMix
);

console.log('📊 RESULTS:');
console.log(`Total Containers: ${result.totalContainers}`);
console.log(`Total Items Packed: ${result.totalItems} / 850`);
console.log(`Unpacked Items: ${result.unpackedItems}\n`);

console.log('📦 CONTAINER BREAKDOWN:\n');

let verticalStackingDetected = false;

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

    // Check for VERTICAL stacking (M2 on top of M1)
    const m1Items = load.items.filter(i => i.materialId === 1);
    const m2Items = load.items.filter(i => i.materialId === 2);

    if (m1Items.length > 0 && m2Items.length > 0) {
        // Check if any M2 items have Y position above ground level (> 100mm)
        const elevatedM2 = m2Items.filter(item => {
            const bottomY = item.position[1] - item.dimensions.height / 2;
            return bottomY > 100; // Not on ground
        });

        if (elevatedM2.length > 0) {
            console.log(`  ✅ VERTICAL STACKING: ${elevatedM2.length} M2 items on top of M1`);
            verticalStackingDetected = true;
        } else {
            console.log(`  ⚠️  SIDE-BY-SIDE: M1 and M2 on same floor level`);
        }
    }
    console.log('');
});

console.log('=== FIX VALIDATION ===');
if (verticalStackingDetected) {
    console.log('✅ SUCCESS! M2 is stacking ON TOP of M1');
    console.log('   Full Mix now prioritizes vertical stacking as intended.');
} else {
    console.log('❌ ISSUE PERSISTS: M2 still avoiding vertical stacking');
    console.log('   May need additional investigation.');
}
