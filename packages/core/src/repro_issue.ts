import { calculatePacking } from './packingAlgorithm';
import { Container, Material } from './types';

const runRepro = () => {
    const container: Container = {
        name: '53ft Trailer',
        dimensions: { length: 16000, width: 2540, height: 2700 },
        type: '53'
    };

    const materials: Material[] = [
        {
            id: 1,
            box: {
                id: 'box1',
                dimensions: { length: 600, width: 600, height: 600 },
                allowedRotations: { x: true, y: true, z: true },
                weightKg: 10,
                color: '#0000FF'
            },
            quantity: 425,
            layerConfig: '',
            active: true,
            pallet: { usePallet: false, dimensions: { length: 1200, width: 1000, height: 150 }, maxLoadHeight: 1600, stackPallets: false },
            maxSt: false
        },
        {
            id: 2,
            box: {
                id: 'box2',
                dimensions: { length: 1600, width: 175, height: 750 },
                allowedRotations: { x: true, y: true, z: true },
                weightKg: 15,
                color: '#FF0000'
            },
            quantity: 425,
            layerConfig: '',
            active: true,
            pallet: { usePallet: false, dimensions: { length: 1200, width: 1000, height: 150 }, maxLoadHeight: 1600, stackPallets: false },
            maxSt: false
        }
    ];

    console.log('--- Running Repro: 2 Materials Fragmentation ---');
    const result = calculatePacking(container, materials, true); // isCombined = true

    console.log(`Total Items: ${result.totalItems}`);
    console.log(`Total Containers: ${result.totalContainers}`);

    result.loads.forEach(load => {
        console.log(`Load ${load.id}: ${load.itemCount} items, ${load.utilization.toFixed(2)}% Util, Type: ${load.type}`);
        const mat1Count = load.items.filter(i => i.materialId === 1).reduce((sum, i) => sum + (i.itemCount || 1), 0);
        const mat2Count = load.items.filter(i => i.materialId === 2).reduce((sum, i) => sum + (i.itemCount || 1), 0);
        console.log(`   Mat 1: ${mat1Count}`);
        console.log(`   Mat 2: ${mat2Count}`);
    });
};

runRepro();
