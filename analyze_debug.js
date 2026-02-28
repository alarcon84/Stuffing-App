import fs from 'fs';

const data = JSON.parse(fs.readFileSync('apps/desktop/Session Debug/debug_2026-02-28T23-06-15-790Z.json', 'utf-8'));

console.log(`Debug File Loaded.`);
console.log(`Packing Mode: ${data.settings.packingMode}`);
console.log(`Materials: ${data.materials.length}`);
console.log(`Loads generated: ${data.result.loads?.length}`);

if (data.result.virtualContainers) {
    console.log(`Generated VCs Total: ${data.result.virtualContainers.length}`);
    const vcsByMat = {};
    for (const vc of data.result.virtualContainers) {
        const matId = vc.id.split('-')[1]; // usually format is VC-matId-contId-type
        vcsByMat[matId] = (vcsByMat[matId] || 0) + 1;
    }
    console.log(`VCs by Material ID string match:`, vcsByMat);
} else {
    console.log(`Generated VCs: NONE FOUND IN RESULT`);
}

const itemsByMat = {};
let totalItems = 0;
data.result.loads.forEach((load, i) => {
    console.log(`Container ${i + 1}: ${load.items.length} items`);
    load.items.forEach(item => {
        totalItems++;
        itemsByMat[item.materialId] = (itemsByMat[item.materialId] || 0) + 1;
    });
});
console.log(`Items per Material:`, itemsByMat);
console.log(`Total placed items: ${totalItems}`);

// Let's check where M1, M2, M3, M4 are located
data.materials.forEach(m => {
    const m1Items = data.result.loads.flatMap(l => l.items).filter(i => i.materialId === m.id);
    const zPositions = [...new Set(m1Items.map(i => i.position[2]))].sort((a, b) => a - b);
    const minZ = Math.min(...zPositions);
    const maxZ = Math.max(...zPositions);
    console.log(`Mat ${m.id} - Count: ${m1Items.length}. Z range: ${minZ} to ${maxZ}`);
});
