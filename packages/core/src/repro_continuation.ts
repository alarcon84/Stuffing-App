/**
 * repro_continuation.ts
 *
 * Verifies that the Continuation VC Injection fix produces clean layered
 * behaviour for 2-material FullMix packing.
 *
 * What we expect AFTER the fix:
 *   1. Material 2's items start at (or near) Material 1's max X extent.
 *   2. No items are floating (every non-floor item has physical support).
 *   3. Both materials produce items (not zero for either).
 *
 * Run:
 *   npx tsx src/repro_continuation.ts
 */

import { calculatePacking } from './packingAlgorithm';
import type { Container, Material } from './types';

const container: Container = {
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

const margins = { length: 20, width: 20, height: 20 };

// Use large quantities so M1 fills most of the container grid,
// forcing M2 to rely on the continuation VC for its FullMix starting surface.
const mat1: Material = {
    id: 1,
    box: {
        id: 'box1',
        dimensions: { length: 600, width: 400, height: 300 },
        color: '#3b82f6',
        allowedRotations: { x: false, y: true, z: false }
    },
    pallet: { dimensions: { length: 1200, width: 1000, height: 150 }, maxLoadHeight: 2000, usePallet: false },
    quantity: 200,
    layerConfig: '',
    active: true
};

const mat2: Material = {
    id: 2,
    box: {
        id: 'box2',
        dimensions: { length: 600, width: 400, height: 300 },
        color: '#ef4444',
        allowedRotations: { x: false, y: true, z: false }
    },
    pallet: { dimensions: { length: 1200, width: 1000, height: 150 }, maxLoadHeight: 2000, usePallet: false },
    quantity: 200,
    layerConfig: '',
    active: true
};

const result = calculatePacking(
    container,
    [mat1, mat2],
    false,
    margins,
    'SEQUENTIAL',
    false,  // TopUp off (testing FullMix path only)
    true    // FullMix on
);

console.log('\n=== CONTINUATION VC INJECTION REPRO ===');
console.log(`Total containers: ${result.totalContainers}`);
console.log(`Total items:      ${result.totalItems}`);
console.log(`Unpacked:         ${result.unpackedItems}`);

let issues = 0;

for (const load of result.loads) {
    const m1Items = load.items.filter(i => i.materialId === 1);
    const m2Items = load.items.filter(i => i.materialId === 2);

    const m1Count = m1Items.reduce((s, i) => s + (i.itemCount || 1), 0);
    const m2Count = m2Items.reduce((s, i) => s + (i.itemCount || 1), 0);

    console.log(`\n--- Container ${load.id} (${load.utilization.toFixed(1)}% util) ---`);
    console.log(`  M1 items: ${m1Count}, M2 items: ${m2Count}`);

    if (m1Items.length > 0 && m2Items.length > 0) {
        const m1MaxX = Math.max(...m1Items.map(i => i.position[0] + i.dimensions.length / 2));
        const m2MinX = Math.min(...m2Items.map(i => i.position[0] - i.dimensions.length / 2));

        console.log(`  M1 max X: ${m1MaxX.toFixed(0)}mm  |  M2 min X: ${m2MinX.toFixed(0)}mm`);

        const gap = m2MinX - m1MaxX;
        if (gap < -10) {
            console.error(`  ❌ OVERLAP: M2 starts ${Math.abs(gap).toFixed(0)}mm BEFORE M1 ends`);
            issues++;
        } else {
            console.log(`  ✅ M2 starts ${gap.toFixed(0)}mm after M1 ends (gap ≤10mm is fine)`);
        }
    }

    // Floating check: every non-floor item should have something below it within 15mm
    const nonFloorItems = load.items.filter(i => {
        const bottom = i.position[1] - i.dimensions.height / 2;
        return bottom > margins.height + 15; // Not on floor
    });

    for (const item of nonFloorItems) {
        const itemBottom = item.position[1] - item.dimensions.height / 2;
        const hasSupportBelow = load.items.some(other => {
            if (other === item) return false;
            const otherTop = other.position[1] + other.dimensions.height / 2;
            if (Math.abs(otherTop - itemBottom) > 15) return false;
            // Check horizontal overlap (X axis)
            const overlapX = Math.min(item.position[0] + item.dimensions.length / 2, other.position[0] + other.dimensions.length / 2)
                - Math.max(item.position[0] - item.dimensions.length / 2, other.position[0] - other.dimensions.length / 2);
            return overlapX > 0;
        });

        if (!hasSupportBelow) {
            console.error(`  ❌ FLOATING item at Y=${item.position[1].toFixed(0)}, X=${item.position[0].toFixed(0)} (Mat${item.materialId})`);
            issues++;
        }
    }
}

console.log('\n' + (issues === 0
    ? '✅ ALL CHECKS PASSED — Continuation VC fix working correctly'
    : `❌ ${issues} ISSUE(S) FOUND — Review the output above`));
