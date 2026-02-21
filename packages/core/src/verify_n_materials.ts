import { packSequential } from './sequentialPass';
import { Container, Material, Box, Pallet } from './types';

// Mock Data
const container: Container = {
    name: '40ft Standard',
    type: '40',
    dimensions: { length: 12000, width: 2350, height: 2390 }
};

const createMaterial = (id: number, qty: number, length: number): Material => ({
    id,
    active: true,
    quantity: qty,
    layerConfig: '',
    box: {
        id: `box${id}`,
        dimensions: { length, width: 1000, height: 1000 },
        color: '#fff',
        allowedRotations: { x: false, y: false, z: false } // Fixed orientation
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 }
});

// Scenario: 
// M1: 4000mm (Fits in C1)
// M2: 4000mm (Fits in C1, appended) -> C1 Used: 8000
// M3: 5000mm (Overflows C1 -> Goes to C2) -> C1 Closed. C2 Used: 5000.
// M4: 4000mm (Starts at C2 -> Fits in C2) -> C2 Used: 9000.
// M5: 4000mm (Starts at C2 -> Overflows -> Goes to C3) -> C2 Closed. C3 Used: 4000.

const materials = [
    createMaterial(1, 1, 4000),
    createMaterial(2, 1, 4000),
    createMaterial(3, 1, 5000),
    createMaterial(4, 1, 4000),
    createMaterial(5, 1, 4000)
];

console.log('--- Starting N-Material Monotonic Sequential Verification ---');

const result = packSequential(container, materials, { length: 0, width: 0, height: 0 }, false);

console.log(`Total Containers: ${result.totalContainers}`);
console.log(`Total Items: ${result.totalItems}`);

result.loads.forEach(load => {
    console.log(`\nContainer ${load.id}:`);
    const sortedItems = load.items.sort((a, b) => a.position[0] - b.position[0]);
    sortedItems.forEach(item => {
        const startX = item.position[0] - item.dimensions.length / 2;
        const endX = item.position[0] + item.dimensions.length / 2;
        console.log(`  - Mat ${item.materialId}: X=${startX.toFixed(0)} to ${endX.toFixed(0)} (Len: ${item.dimensions.length})`);
    });
});

let pass = true;

// Check Container Count
if (result.totalContainers !== 3) {
    console.error(`FAIL: Expected 3 containers, got ${result.totalContainers}`);
    pass = false;
}

// Check C1 Content
const c1 = result.loads.find(l => l.id === 1);
if (c1) {
    const m1 = c1.items.find(i => i.materialId === 1);
    const m2 = c1.items.find(i => i.materialId === 2);
    const m4 = c1.items.find(i => i.materialId === 4); // Should NOT be here

    if (m1 && m2 && !m4) {
        console.log('PASS: C1 contains M1, M2. No backfill of M4.');
    } else {
        console.error('FAIL: C1 content incorrect.');
        console.log(`M1:${!!m1} M2:${!!m2} M4(Unwanted):${!!m4}`);
        pass = false;
    }
}

// Check C2 Content
const c2 = result.loads.find(l => l.id === 2);
if (c2) {
    const m3 = c2.items.find(i => i.materialId === 3);
    const m4 = c2.items.find(i => i.materialId === 4);

    if (m3 && m4) {
        console.log('PASS: C2 contains M3, M4.');
    } else {
        console.error('FAIL: C2 content incorrect.');
        console.log(`M3:${!!m3} M4:${!!m4}`);
        pass = false;
    }
}

// Check C3 Content
const c3 = result.loads.find(l => l.id === 3);
if (c3) {
    const m5 = c3.items.find(i => i.materialId === 5);
    if (m5) {
        console.log('PASS: C3 contains M5.');
    } else {
        console.error('FAIL: C3 content incorrect.');
        pass = false;
    }
}

if (pass) {
    console.log('\n✅ VERIFICATION SUCCESSFUL: Algorithm enforces monotonic sequential packing.');
} else {
    console.log('\n❌ VERIFICATION FAILED');
}
