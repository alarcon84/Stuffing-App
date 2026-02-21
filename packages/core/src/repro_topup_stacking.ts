import { calculatePacking } from './packingAlgorithm';
import { Container, Material } from './types';

// Exact dimensions from user's screenshot
const container: Container = {
    name: '40ft Standard',
    type: '40',
    dimensions: { length: 12000, width: 2350, height: 2390 }
};

// Material: 1000 x 175 x 800 boxes (from screenshot)
const material: Material = {
    id: 1,
    active: true,
    quantity: 500, // From screenshot
    layerConfig: '',
    box: {
        id: 'box1',
        dimensions: { length: 1000, width: 175, height: 800 },
        color: 'blue',
        allowedRotations: { x: true, y: true, z: true }
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 }
};

console.log('--- TopUp Stacking Debug ---');
console.log(`Box: ${material.box.dimensions.length}×${material.box.dimensions.width}×${material.box.dimensions.height}`);
console.log(`Quantity: ${material.quantity}`);

const result = calculatePacking(
    container,
    [material],
    false, // isCombined
    { length: 20, width: 20, height: 20 }, // margins
    'SMART_STACK',
    true,  // enableTopUp
    true   // enableFullMix
);

console.log(`\nTotal Containers: ${result.loads.length}`);
result.loads.forEach((load, idx) => {
    const c1Items = load.items.filter(i => i.materialId === 1).length;
    console.log(`Container ${idx + 1}: ${c1Items} items (${load.utilization?.toFixed(1)}% util)`);

    // Find highest point in this container
    let maxY = 0;
    load.items.forEach(item => {
        const top = item.position[1] + item.dimensions.height / 2;
        if (top > maxY) maxY = top;
    });
    console.log(`  Max height used: ${maxY.toFixed(0)}mm / ${container.dimensions.height}mm`);
    console.log(`  Vertical gap: ${(container.dimensions.height - maxY).toFixed(0)}mm`);
});

// Check if items that went to C2 could fit in C1's vertical gap
if (result.loads.length > 1) {
    const c1MaxY = Math.max(...result.loads[0].items.map(i => i.position[1] + i.dimensions.height / 2));
    const gap = container.dimensions.height - c1MaxY - 20; // minus margin
    const flatHeight = Math.min(material.box.dimensions.length, material.box.dimensions.width, material.box.dimensions.height);

    console.log(`\n❌ ISSUE: Items went to C2`);
    console.log(`Gap in C1: ${gap.toFixed(0)}mm`);
    console.log(`Flat box height: ${flatHeight}mm`);
    console.log(`Could fit: ${gap > flatHeight ? '✅ YES' : '❌ NO'}`);
}
