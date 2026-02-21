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
        allowedRotations: { x: false, y: false, z: false } // Strict orientation
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 }
});

// Scenario:
// M1: 6000mm length, 1000mm height. (Leaves space above)
// M2: 6000mm length, 1300mm height. (Fits above M1)

const mats = [
    createMaterial(1, 1, 6000, 1000),
    createMaterial(2, 1, 6000, 1300)
];

console.log('--- Starting Smart Stack Gating Verification ---');

// Test 1: Gating OFF (allowVerticalStacking = false)
// Expectation: M2 does NOT stack on M1. Goes to next available space (Sequential).
// Since M1 takes 6000mm length. M2 (6000mm) fits in remaining 6000mm? No, container is 12000mm - margins.
// 12000 - 40 = 11960. 6000 + 6000 = 12000. So M2 won't fit in C1 horizontally.
// So M2 should go to C2.

console.log('\nTest 1: Vertical Stacking DISABLED (False)');
const res1 = packSmartStack(container, mats, { length: 20, width: 20, height: 20 }, false, false);
console.log(`Total Containers: ${res1.totalContainers}`);
res1.loads.forEach(l => {
    console.log(`Container ${l.id} Items: ${l.items.length}`);
    l.items.forEach(i => console.log(`  - Mat ${i.materialId} @ Y=${i.position[1].toFixed(0)}`));
});

if (res1.totalContainers === 2) {
    console.log('✅ PASS: Vertical Stacking Disabled -> Sequential behavior (2 Containers).');
} else {
    console.log(`❌ FAIL: Vertical Stacking Disabled -> Created ${res1.totalContainers} containers.`);
}

// Test 2: Gating ON (allowVerticalStacking = true)
// Expectation: M2 stacks ON TOP of M1 in C1.
console.log('\nTest 2: Vertical Stacking ENABLED (True)');
const res2 = packSmartStack(container, mats, { length: 20, width: 20, height: 20 }, false, true);
console.log(`Total Containers: ${res2.totalContainers}`);
res2.loads.forEach(l => {
    console.log(`Container ${l.id} Items: ${l.items.length}`);
    l.items.forEach(i => console.log(`  - Mat ${i.materialId} @ Y=${i.position[1].toFixed(0)}`));
});

if (res2.totalContainers === 1) {
    console.log('✅ PASS: Vertical Stacking Enabled -> Stacked M2 on M1 (1 Container).');
} else {
    console.log(`❌ FAIL: Vertical Stacking Enabled -> Created ${res2.totalContainers} containers.`);
}
