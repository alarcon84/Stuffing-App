import { runPostProcessingPipeline } from './postProcessingPipeline';
import { Container, Material, ContainerLoad } from './types';

// Mock Data
const container: Container = {
    name: '40ft Standard',
    type: '40',
    dimensions: { length: 12000, width: 2350, height: 2390 }
};

// Material 1: Big boxes that form a stack, leaving a small gap at the top.
// Box Height: 2000mm. Container Height: 2390mm. Gap: 390mm.
const mat1: Material = {
    id: 1,
    active: true,
    quantity: 1, // Already packed
    layerConfig: '',
    box: { id: 'box1', dimensions: { length: 1000, width: 1000, height: 2000 }, color: 'blue', allowedRotations: { x: true, y: true, z: true } },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 }
};

// Material 2: Flat TVs.
// Dims: 1000 x 1000 x 200.
// Should fit in the 390mm gap if stacked flat (Height=200).
const mat2: Material = {
    id: 2,
    active: true,
    quantity: 5, // Try to pack 5
    layerConfig: '',
    box: { id: 'box2', dimensions: { length: 1000, width: 1000, height: 200 }, color: 'red', allowedRotations: { x: true, y: true, z: true } },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0 }
};

// Create an initial load with Mat 1 placed (UNEVEN)
const initialLoad: ContainerLoad = {
    id: 1,
    type: 'partial', // Added type
    items: [
        // 1. Tall Stack (Blocks Global MaxY)
        {
            position: [3000, 1175, 1175], // Center X=3000, Z=1175. Length 6000. Width 2350.
            // Tops out at 2350mm (near ceiling).
            dimensions: { length: 6000, height: 2350, width: 2350 },
            materialId: 1,
            type: 'box',
            itemCount: 1,
            rotation: [0, 0, 0]
        },
        // 2. Short Stack (Target Gap)
        {
            position: [9000, 1000, 1175], // Center X=9000, Z=1175. Length 6000. Width 2350.
            // Tops out at 2000mm.
            // Gap above: 2390 - 2000 = 390mm.
            dimensions: { length: 6000, height: 2000, width: 2350 },
            materialId: 1,
            type: 'box',
            itemCount: 1,
            rotation: [0, 0, 0]
        }
    ],
    utilization: 95,
    itemCount: 2
};

console.log('--- Starting Maximize Space Gap Repro ---');

// Run Pipeline with Maximize Space (Full Mix)
const result = runPostProcessingPipeline(
    [initialLoad],
    mat2,
    container,
    { length: 0, width: 0, height: 0 }, // Zero margins for simplest test
    true, // enableTopUp
    true, // enableFullMix
    'SEQUENTIAL'
);

console.log(`\nItems Added: ${result.totalItemsAdded}`);
result.loads[0].items.forEach(i => {
    if (i.materialId === 2) {
        console.log(`Placed Mat 2 at Y=${i.position[1]} (Dims: ${i.dimensions.length}x${i.dimensions.height}x${i.dimensions.width})`);
    }
});

if (result.totalItemsAdded > 0) {
    console.log('✅ PASS: Gap filled.');
} else {
    console.log('❌ FAIL: Gap NOT filled.');
}
