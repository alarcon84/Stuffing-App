
import { calculatePacking } from './packingAlgorithm';
import { Box, Container, Pallet, Material } from './types';

const runScenario = (enableMix: boolean) => {
    console.log(`\n\n=== Running Scenario: Enable Full Mix = ${enableMix} ===`);

    const container: Container = {
        name: '40ft Standard',
        dimensions: { length: 12030, width: 2350, height: 2390 },
        type: '40'
    };

    const matA_Box: Box = {
        id: 'MatA',
        materialId: 1,
        dimensions: { length: 1300, width: 1000, height: 1200 },
        allowedRotations: { x: false, y: true, z: false },
        color: '#ff0000',
        weightKg: 500
    };

    const matB_Box: Box = {
        id: 'MatB',
        materialId: 2,
        dimensions: { length: 600, width: 500, height: 500 },
        allowedRotations: { x: true, y: true, z: true },
        color: '#00ff00',
        weightKg: 50
    };

    const emptyPallet: Pallet = {
        usePallet: false,
        dimensions: { length: 0, width: 0, height: 0 },
        maxLoadHeight: 0,
        stackPallets: false
    };

    const materials: Material[] = [
        {
            id: 1,
            box: matA_Box,
            pallet: emptyPallet,
            quantity: 18,
            layerConfig: '',
            active: true
        },
        {
            id: 2,
            box: matB_Box,
            pallet: emptyPallet,
            quantity: 10,
            layerConfig: '',
            active: true
        }
    ];


    const result = calculatePacking(
        container,
        materials,
        true, // isCombined
        undefined, // margins default
        enableMix // enableFullMix
    );

    console.log(`Total Containers: ${result.totalContainers}`);

    result.loads.forEach((load, idx) => {
        const countA = load.items.filter(i => i.materialId === 1).reduce((s, i) => s + (i.itemCount || 1), 0);
        const countB = load.items.filter(i => i.materialId === 2).reduce((s, i) => s + (i.itemCount || 1), 0);

        console.log(`Container ${idx + 1}: Mat A: ${countA}, Mat B: ${countB}`);

        const itemsB = load.items.filter(i => i.materialId === 2);
        let stackedOnA = 0;
        let stackedOnB = 0;
        let floating = 0;

        itemsB.forEach(b => {
            const bBottom = b.position[1] - b.dimensions.height / 2;
            // Check if it's high enough to be on A (A height 1000 + margin 20 = 1020)
            // Tolerance 10mm
            if (bBottom > 100) {
                // Find item below
                const centerB_X = b.position[0];
                const centerB_Z = b.position[2];

                const itemBelow = load.items.find(other => {
                    // Must be below
                    const otherTop = other.position[1] + other.dimensions.height / 2;
                    if (Math.abs(otherTop - bBottom) > 10) return false;

                    // Must overlap horizontally
                    const otherLeft = other.position[0] - other.dimensions.length / 2;
                    const otherRight = other.position[0] + other.dimensions.length / 2;
                    const otherBack = other.position[2] - other.dimensions.width / 2;
                    const otherFront = other.position[2] + other.dimensions.width / 2;

                    return (centerB_X >= otherLeft && centerB_X <= otherRight &&
                        centerB_Z >= otherBack && centerB_Z <= otherFront);
                });

                if (itemBelow) {
                    if (itemBelow.materialId === 1) {
                        stackedOnA++;
                    } else if (itemBelow.materialId === 2) {
                        stackedOnB++;
                    }
                } else {
                    floating++;
                }
            }
        });

        if (stackedOnA > 0) {
            console.log(`  -> MIXING DETECTED: ${stackedOnA} items of B are stacked on A.`);
        } else {
            console.log(`  -> No mixing on A. (Stacked on B: ${stackedOnB}, Floating: ${floating})`);
            // Debug positions
            load.items.filter(i => i.materialId === 2).slice(0, 3).forEach((item, k) => {
                console.log(`     Mat B #${k}: Pos [${item.position.join(', ')}], Dims [${item.dimensions.length}, ${item.dimensions.height}, ${item.dimensions.width}]`);
            });
        }
    });
};

runScenario(false);
runScenario(true);
