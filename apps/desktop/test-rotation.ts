import { calculatePacking } from './src/utils/packingAlgorithm';
import type { Box, Container, Pallet } from './src/types';

const runTest = () => {
    console.log('Running Rotation Constraint Tests...');

    const container: Container = {
        name: "Test Container",
        type: '20',
        dimensions: { length: 1000, width: 500, height: 500 }
    };

    const pallet: Pallet = {
        dimensions: { length: 1000, width: 1000, height: 150 },
        maxLoadHeight: 1000,
        usePallet: false
    };

    const testBox: Box = {
        id: 'test',
        dimensions: { length: 400, width: 200, height: 200 },
        color: 'red',
        allowedRotations: { x: true, y: false, z: false } // Only Vertical
    };

    // Test 1: Only Vertical Allowed (Should use L as height)
    // Box: 400(L) x 200(W) x 200(H)
    // Vertical -> 400 is vertical.
    // Container: 1000 x 500 x 500
    // Box becomes: 200 x 200 x 400
    // L: 1000/200 = 5
    // W: 500/200 = 2
    // H: 500/400 = 1
    // Total = 10

    console.log('Test 1: Only Vertical Allowed (L vertical)');
    const result1 = calculatePacking(testBox, container, pallet, 100);
    console.log(`Packed: ${result1.loads[0]?.itemCount || 0} (Expected 10)`);

    // Test 2: Only Horizontal Allowed (Should use H as height - Standard)
    // Box: 400(L) x 200(W) x 200(H)
    // Horizontal -> 200 is vertical.
    // Box becomes: 400 x 200 x 200
    // L: 1000/400 = 2
    // W: 500/200 = 2
    // H: 500/200 = 2
    // Total = 8

    console.log('Test 2: Only Horizontal Allowed (H vertical)');
    const testBox2 = { ...testBox, allowedRotations: { x: false, y: true, z: false } };
    const result2 = calculatePacking(testBox2, container, pallet, 100);
    console.log(`Packed: ${result2.loads[0]?.itemCount || 0} (Expected 8)`);

    // Test 3: Only Flat Allowed (Should use W as height)
    // Box: 400(L) x 200(W) x 200(H)
    // Flat -> 200 is vertical (Wait, W is 200, H is 200. Let's change dims)

    const testBox3 = {
        ...testBox,
        dimensions: { length: 400, width: 300, height: 200 },
        allowedRotations: { x: false, y: false, z: true }
    };
    // Flat -> 300 is vertical.
    // Box becomes: 400 x 200 x 300
    // L: 1000/400 = 2
    // W: 500/200 = 2
    // H: 500/300 = 1
    // Total = 4

    console.log('Test 3: Only Flat Allowed (W vertical)');
    const result3 = calculatePacking(testBox3, container, pallet, 100);
    console.log(`Packed: ${result3.loads[0]?.itemCount || 0} (Expected 4)`);

    if (result1.loads[0]?.itemCount === 10 && result2.loads[0]?.itemCount === 8 && result3.loads[0]?.itemCount === 4) {
        console.log('SUCCESS: Rotation mappings correct.');
    } else {
        console.error('FAILURE: Rotation mappings incorrect.');
    }
};

runTest();
