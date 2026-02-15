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

console.log('--- DEBUG Test 6 ---');
const mat1 = createMaterial(1, { length: 1500, width: 1000, height: 1000 }, 3);
const mat2 = createMaterial(2, { length: 1500, width: 1000, height: 1000 }, 5);

const result = calculatePacking(
    CONTAINER_20,
    [mat1, mat2],
    false,
    { length: 0, width: 0, height: 0 },
    false,
    'SMART_STACK'
);

console.log(`Total loads: ${result.loads.length}`);
result.loads.forEach((load, i) => {
    console.log(`Container ${i + 1}:`);
    const m1 = load.items.filter(item => item.materialId === 1).length;
    const m2 = load.items.filter(item => item.materialId === 2).length;
    console.log(`  M1: ${m1}`);
    console.log(`  M2: ${m2}`);

    // Log items for M1 to see footprint
    if (m1 > 0) {
        console.log('  M1 Placements:');
        load.items.filter(item => item.materialId === 1).forEach(p => {
            console.log(`    [${p.position[0]}, ${p.position[1]}, ${p.position[2]}] L=${p.dimensions.length} W=${p.dimensions.width} H=${p.dimensions.height}`);
        });
    }
});
