
interface PlacedItem {
    position: [number, number, number];
    type: 'box' | 'pallet';
}

interface ContainerLoad {
    items: PlacedItem[];
}

interface PackingResult {
    loads: ContainerLoad[];
    totalPallets?: number;
    totalLots?: number;
}

const calculateStats = (res: PackingResult) => {
    let totalPallets = 0;
    let totalLots = 0;

    res.loads.forEach(load => {
        const uniqueStacks = new Set<string>();
        load.items.forEach(item => {
            if (item.type === 'pallet') {
                totalPallets++;
            }

            if (item.position && item.position.length === 3) {
                const x = Math.round(item.position[0]);
                const z = Math.round(item.position[2]);
                const key = `${x}_${z}`;
                uniqueStacks.add(key);
            }
        });
        totalLots += uniqueStacks.size;
    });

    return { ...res, totalPallets, totalLots };
};

// Mock data based on user scenario
const mockLoad: ContainerLoad = {
    items: [
        { position: [100, 100, 100], type: 'pallet' },
        { position: [100, 300, 100], type: 'pallet' }, // Stacked on top
        { position: [500, 100, 100], type: 'pallet' }
    ]
};

const result: PackingResult = {
    loads: [mockLoad]
};

const stats = calculateStats(result);
console.log('Stats:', stats);
