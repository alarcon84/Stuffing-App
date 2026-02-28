import { calculatePacking } from './src/packingAlgorithm';
import type { Container, Material } from './src/types';

const container: Container = {
    name: "53ft",
    type: "53",
    dimensions: { length: 15955, width: 2560, height: 2820 }
};

const margins = { length: 20, width: 20, height: 20 };

const createMat = (id: number): Material => ({
    id,
    active: true,
    quantity: 100,
    layerConfig: "",
    box: {
        id: `box-${id}`,
        materialId: id,
        dimensions: { length: 1600, width: 175, height: 800 },
        color: "#fcd34d",
        allowedRotations: { x: false, y: true, z: false }
    },
    orientationPreference: "default",
    pallet: {
        dimensions: { length: 1600, width: 1050, height: 150 },
        maxLoadHeight: 2650,
        usePallet: false,
        stackPallets: false
    }
});

const materials = [createMat(1), createMat(2), createMat(3), createMat(4)];

const result = calculatePacking(
    container,
    materials,
    false, // isCombined
    margins,
    'SMART_STACK',
    false, // topUp
    true, // fullMix
    { x: true, y: true, z: true }
);

console.log(`Total Items: ${result.totalItems}`);
console.log(`Total Containers: ${result.totalContainers}`);
console.log(`Virtual Containers Exported: ${result.virtualContainers?.length || 0}`);
if (result.virtualContainers?.length) {
    // Group by source (topup vs fullmix/side/front)
    const types = result.virtualContainers.map(v => v.id.split('_')[0] || v.id.split('-')[0]);
    const counts = types.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
    console.log(`VC Types:`, counts);
}
