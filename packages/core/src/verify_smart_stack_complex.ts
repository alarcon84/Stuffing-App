import { packSmartStack } from './smartStackMode';
import { Container, Material } from './types';

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

// Scenario: Complex Step
// M1: 6000mm length, but only 1000mm height. (Leaves 1390mm vertical space above first half)
// M2: 6000mm length, 1300mm height. 
// Expectation:
// M2 should stack ON TOP of M1 in the first 6000mm.
// Result: 1 Container, Utilization high.

const materials = [
    createMaterial(1, 1, 6000, 1000), // Low box
    createMaterial(2, 1, 6000, 1300)  // Fits above M1
];

console.log('--- Starting Smart Stack Complex Verification ---');

const result = packSmartStack(container, materials, { length: 0, width: 0, height: 0 }, false);

console.log(`Total Containers: ${result.totalContainers}`);
console.log(`Total Items: ${result.totalItems}`);

result.loads.forEach(load => {
    console.log(`\nContainer ${load.id}:`);
    load.items.forEach(item => {
        const startX = item.position[0] - item.dimensions.length / 2;
        const endX = item.position[0] + item.dimensions.length / 2;
        const bottomY = item.position[1] - item.dimensions.height / 2;
        console.log(`  - Mat ${item.materialId}: X=${startX.toFixed(0)} to ${endX.toFixed(0)}, Y_Bottom=${bottomY.toFixed(0)}`);
    });
});

const c1 = result.loads[0];
if (c1 && c1.items.length === 2) {
    const m1 = c1.items.find(i => i.materialId === 1);
    const m2 = c1.items.find(i => i.materialId === 2);

    if (m1 && m2) {
        // Check if M2 is above M1
        const m1Top = m1.position[1] + m1.dimensions.height / 2;
        const m2Bottom = m2.position[1] - m2.dimensions.height / 2;

        if (Math.abs(m2Bottom - m1Top) < 10 && Math.abs(m2.position[0] - m1.position[0]) < 10) {
            console.log('\n✅ PASS: M2 stacked correctly ON TOP of M1 (Skyline worked).');
        } else {
            console.log('\n❌ FAIL: M2 is not stacked on M1.');
            console.log(`M1 Top: ${m1Top}, M2 Bottom: ${m2Bottom}`);
        }
    }
} else {
    console.log('\n❌ FAIL: Expected 2 items in 1 container.');
}
