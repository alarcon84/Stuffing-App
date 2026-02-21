import { packSmartStack } from './smartStackMode';
import { Container, Material, Box, Pallet } from './types';

// Mock Data
const container: Container = {
    name: '40ft Standard',
    type: '40',
    dimensions: { length: 12000, width: 2350, height: 2390 }
};

const createMaterial = (id: number, qty: number, length: number, height: number): Material => ({
    id,
    active: true,
    quantity: qty,
    layerConfig: '',
    box: {
        id: `box${id}`,
        dimensions: { length, width: 1000, height },
        color: '#fff',
        allowedRotations: { x: false, y: false, z: false }
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 }
});

// Scenario:
// M1: 6000mm length, full height. Fills first half of C1.
// M2: 6000mm length, but short height (1000mm). 
// Expectation:
// M2 should NOT stack on M1 (M1 is full height).
// M2 should fill the remaining 6000mm of C1 horizontally.
// Result should be 1 Container, full.

const materials = [
    createMaterial(1, 1, 6000, 2390), // Full height, half length
    createMaterial(2, 1, 6000, 1000)  // Fits in remaining length
];

console.log('--- Starting Smart Stack Overflow Verification ---');

const result = packSmartStack(container, materials, { length: 0, width: 0, height: 0 }, false);

console.log(`Total Containers: ${result.totalContainers}`);
console.log(`Total Items: ${result.totalItems}`);

result.loads.forEach(load => {
    console.log(`\nContainer ${load.id}:`);
    load.items.forEach(item => {
        const startX = item.position[0] - item.dimensions.length / 2;
        const endX = item.position[0] + item.dimensions.length / 2;
        console.log(`  - Mat ${item.materialId}: X=${startX.toFixed(0)} to ${endX.toFixed(0)}, Y=${item.position[1].toFixed(0)}`);
    });
});

if (result.totalContainers === 1) {
    console.log('\n✅ PASS: Smart Stack overflow filled existing container.');
} else {
    console.log(`\n❌ FAIL: Smart Stack created ${result.totalContainers} containers (Expected 1).`);
}
