
import { calculatePacking } from './src/utils/packingAlgorithm';
import type { Box, Container, Pallet } from './src/types';

const userBox: Box = {
    id: 'user-box',
    dimensions: { length: 1400, width: 300, height: 800 },
    color: '#3b82f6',
    allowedRotations: { x: true, y: true, z: true }
};

const userContainer: Container = {
    name: "20' Standard",
    type: '20',
    dimensions: { length: 5898, width: 2352, height: 2393 }
};

const userPallet: Pallet = {
    dimensions: { length: 1200, width: 1000, height: 150 },
    maxLoadHeight: 1500,
    usePallet: false
};

console.log('Reproducing User Issue...');
const result = calculatePacking(userBox, userContainer, userPallet, 101);

console.log('Total Containers:', result.totalContainers);
console.log('Total Items:', result.totalItems);
console.log('Unpacked Items:', result.unpackedItems);
console.log('Loads:', JSON.stringify(result.loads, null, 2));

if (result.totalContainers === 0) {
    console.error('FAIL: Algorithm returned 0 containers for valid input.');
} else {
    console.log('PASS: Algorithm returned containers.');
}
