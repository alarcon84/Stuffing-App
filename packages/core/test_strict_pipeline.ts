
import { calculatePacking } from './src/packingAlgorithm';
import { Container, Material, PackingResult } from './src/types';

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
    quantity: 1000, // Enough to fill 20ft (~33m3). 400x300x200 = 0.024m3. 1000 * 0.024 = 24m3.
    layerConfig: '6x4', // Arbitrary
    active: true
};

const margins = { length: 0, width: 0, height: 0 };

function runTest(name: string, topUp: boolean, fullMix: boolean, overrideQty?: number) {
    console.log(`\n--- TEST: ${name} ---`);
    console.log(`Config: TopUp=${topUp}, FullMix=${fullMix}, Qty=${overrideQty ?? box.quantity}`);

    // Deep clone to avoid mutation between tests
    const mat = JSON.parse(JSON.stringify(box));
    mat.quantity = overrideQty ?? box.quantity;

    try {
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
            console.log(`Load #${load.id} Count: ${load.itemCount}`);

            // Count by Source
            const sources: Record<string, number> = {};
            let lockedCount = 0;

            load.items.forEach(item => {
                const src = item.source || 'DEFAULT';
                sources[src] = (sources[src] || 0) + 1;
                if (item.locked) lockedCount++;
            });

            console.log(`Sources:`, JSON.stringify(sources));
            console.log(`Locked Items: ${lockedCount}`);

            if (sources['TOP_UP']) {
                const item = load.items.find(i => i.source === 'TOP_UP');
                console.log(`Top Up Sample Dim:`, item?.dimensions);
            }
        });
    } catch (e) {
        console.error("Error running test:", e);
    }
}

// Test A: Top Up Only
runTest('A: Top Up Only', true, false);

// Test B: Full Mix Only
runTest('B: Full Mix Only', false, true);

// Test C: Both
runTest('C: Top Up + Full Mix', true, true);

// Test D: Partial (Low Quantity)
runTest('D: Partial Container (Qty 5)', true, true, 5); // Very low qty
