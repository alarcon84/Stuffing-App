import fs from 'fs';

const data = JSON.parse(fs.readFileSync('apps/desktop/Session Debug/debug_2026-02-28T23-06-15-790Z.json', 'utf-8'));

data.result.loads.forEach((load, i) => {
    console.log(`\n--- Container ${i + 1} ---`);

    const byMat = {};
    load.items.forEach(item => {
        if (!byMat[item.materialId]) byMat[item.materialId] = [];
        byMat[item.materialId].push(item);
    });

    for (const [matId, items] of Object.entries(byMat)) {
        const xs = items.map(i => i.position[0]);
        const ys = items.map(i => i.position[1]);
        const zs = items.map(i => i.position[2]);

        console.log(`Mat ${matId}: ${items.length} items`);
        console.log(`  X (Length) range: ${Math.min(...xs)} to ${Math.max(...xs)}`);
        console.log(`  Y (Height) range: ${Math.min(...ys)} to ${Math.max(...ys)}`);
        console.log(`  Z (Width) range:  ${Math.min(...zs)} to ${Math.max(...zs)}`);

        // Check bounds
        const maxL = Math.max(...items.map(i => i.position[0] + i.dimensions.length / 2));
        console.log(`  Max Length Reached: ${maxL}`);
    }
});
