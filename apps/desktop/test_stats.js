
const calculateStats = (res) => {
    let totalPallets = 0;
    let totalLots = 0;

    res.loads.forEach(load => {
        const uniqueStacks = new Set();
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

// Mock data
const mockLoad = {
    items: [
        { position: [100, 100, 100], type: 'pallet' },
        { position: [100, 300, 100], type: 'pallet' }, // Stacked on top
        { position: [500, 100, 100], type: 'pallet' },
        { position: [900, 100, 100], type: 'box' } // Should count as lot but not pallet
    ]
};

const result = {
    loads: [mockLoad]
};

const stats = calculateStats(result);
console.log('Stats:', stats);
