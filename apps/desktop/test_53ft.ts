
import { calculatePacking } from './src/utils/packingAlgorithm';
import type { Box, Container } from './src/types';

const container53: Container = {
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

const box: Box = {
    id: 'test-box',
    color: '#cc8855',
    dimensions: { length: 1600, width: 175, height: 800 },
    allowedRotations: { x: false, y: true, z: false }
};

console.log("Testing 53ft Container Packing...");
const result = calculatePacking(
    box,
    container53,
    { dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0, usePallet: false },
    100000,
    ''
);

if (result.loads.length > 0) {
    console.log(`Success! Packed ${result.loads[0].itemCount} items in 53ft container.`);
} else {
    console.error("Failed to pack items.");
}
