import { calculatePacking } from './packingAlgorithm';
import { Container, Material, Dimensions } from './types';

const createMaterial = (id: number, dims: Dimensions, qty: number): Material => ({
    id,
    quantity: qty,
    box: {
        id: `b${id}`,
        dimensions: dims,
        allowedRotations: { x: false, y: false, z: false },
        weightKg: 1,
        color: id === 1 ? '#ff0000' : '#00ff00'
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

// Test 1 scenario
const mat1 = createMaterial(1, { length: 1600, width: 175, height: 800 }, 5);
const mat2 = createMaterial(2, { length: 1600, width: 175, height: 750 }, 3);

console.log('\n=== DEBUG Test 1 Scenario ===');
console.log(`M1: ${mat1.box.dimensions.length}×${mat1.box.dimensions.width}×${mat1.box.dimensions.height}, qty=${mat1.quantity}`);
console.log(`M2: ${mat2.box.dimensions.length}×${mat2.box.dimensions.width}×${mat2.box.dimensions.height}, qty=${mat2.quantity}`);
console.log(`\nM2 should stack on M1? length:${mat2.box.dimensions.length <= mat1.box.dimensions.length}, width:${mat2.box.dimensions.width <= mat1.box.dimensions.width}\n`);

const result = calculatePacking(
    CONTAINER_20,
    [mat1, mat2],
    false,
    { length: 0, width: 0, height: 0 },
    false,
    'SMART_STACK'
);

console.log(`Total containers: ${result.loads.length}`);
console.log(`Total items placed: ${result.totalItems}`);

result.loads.forEach((load, idx) => {
    console.log(`\nContainer ${idx + 1}:`);
    console.log(`  Items: ${load.items.length}, ItemCount: ${load.itemCount}`);

    const m1Items = load.items.filter(i => i.materialId === 1);
    const m2Items = load.items.filter(i => i.materialId === 2);

    console.log(`  M1 items: ${m1Items.length}`);
    m1Items.slice(0, 2).forEach((item, i) => {
        console.log(`    M1[${i}]: pos=[${item.position.join(',')}], dims=${item.dimensions.length}×${item.dimensions.width}×${item.dimensions.height}`);
    });

    console.log(`  M2 items: ${m2Items.length}`);
    m2Items.slice(0, 2).forEach((item, i) => {
        console.log(`    M2[${i}]: pos=[${item.position.join(',')}], dims=${item.dimensions.length}×${item.dimensions.width}×${item.dimensions.height}`);
    });

    if (m1Items.length > 0 && m2Items.length > 0) {
        const m1AvgY = m1Items.reduce((sum, i) => sum + i.position[1], 0) / m1Items.length;
        const m2AvgY = m2Items.reduce((sum, i) => sum + i.position[1], 0) / m2Items.length;
        console.log(`\n  M1 avg Y: ${m1AvgY.toFixed(1)}, M2 avg Y: ${m2AvgY.toFixed(1)}`);
        console.log(`  M2 above M1? ${m2AvgY > m1AvgY ? 'YES ✓' : 'NO ✗'}`);
    }
});
