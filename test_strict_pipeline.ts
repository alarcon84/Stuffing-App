
import { calculatePacking } from './packages/core/src/packingAlgorithm';
import { Container, Material, PackingResult } from './packages/core/src/types';

// Mock Data
const container20: Container = {
    name: '20ft Standard',
    type: '20',
    dimensions: { length: 5898, width: 2352, height: 2393 }
};

const box: Material = {
    id: 1,
    box: {
        id: 'box1',
        dimensions: { length: 400, width: 300, height: 200 }, // Small box
        color: '#ff0000',
        allowedRotations: { x: true, y: true, z: true }
    },
    pallet: {
        dimensions: { length: 1200, width: 1000, height: 144 },
        maxLoadHeight: 2000,
        usePallet: false
    },
    quantity: 1000, // Enough to fill
    layerConfig: '6x4', // Arbitrary
    active: true
};

const margins = { length: 0, width: 0, height: 0 };

function runTest(name: string, topUp: boolean, fullMix: boolean, overrideQty?: number) {
    console.log(`\n--- TEST: ${name} ---`);
    console.log(`Config: TopUp=${topUp}, FullMix=${fullMix}, Qty=${overrideQty ?? box.quantity}`);

    const mat = { ...box, quantity: overrideQty ?? box.quantity };

    const result = calculatePacking(
        container20,
        [mat],
        false,
        margins,
        'SEQUENTIAL',
        topUp,
        fullMix
    );

    console.log(`Total Containers: ${result.totalContainers}`);
    console.log(`Total Items: ${result.totalItems}`);

    result.loads.forEach(load => {
        console.log(`Load #${load.id} Utilization: ${load.utilization.toFixed(2)}%`);
        console.log(`Load #${load.id} Items: ${load.itemCount}`);

        // Count by Source
        const sources = load.items.reduce((acc, item) => {
            const src = item.source || 'DEFAULT';
            acc[src] = (acc[src] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        console.log(`Sources:`, sources);

        // Count Locked
        const locked = load.items.filter(i => i.locked).length;
        console.log(`Locked Items: ${locked}`);

        // Orientation Check for Top Up
        const topUpItems = load.items.filter(i => i.source === 'TOP_UP');
        if (topUpItems.length > 0) {
            console.log(`Top Up Items Dimensions:`, topUpItems[0].dimensions);
            // Should be Flat?
        }
    });
}

// Test A: Top Up Only
runTest('A: Top Up Only', true, false);

// Test B: Full Mix Only
runTest('B: Full Mix Only', false, true);

// Test C: Both
runTest('C: Top Up + Full Mix', true, true);

// Test D: Partial (Low Quantity)
runTest('D: Partial Container', true, true, 50); // only 50 boxes fit easily
