
import { calculatePacking } from '../src/packingAlgorithm';
import type { Material, Container } from '../src/types';

// Container: 53ft
const container: Container = {
    name: '53ft',
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

// Material 1: 1600 x 175 x 800
// Default Orientation: L=1600, W=175, H=800
const mat1: Material = {
    id: 1,
    active: true,
    quantity: 425, // Should fill 1 container and spill over slightly
    layerConfig: '',
    box: {
        id: 'b1',
        materialId: 1,
        dimensions: { length: 1600, width: 175, height: 800 },
        color: 'blue',
        allowedRotations: { x: false, y: true, z: false }
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0, stackPallets: false },
    orientationPreference: 'default'
};

console.log("--- TEST: Top Up Feature ---");
// Enable Top Up
const res = calculatePacking(
    container,
    [mat1],
    false,
    { length: 20, width: 20, height: 20 }, // Margins
    'SEQUENTIAL',
    true, // enableTopUp
    false // enableFullMix
);

console.log(`Total Items: ${res.totalItems}`);
console.log(`Total Containers: ${res.totalContainers}`);
console.log(`Load 1 Item Count: ${res.loads[0]?.itemCount}`);
console.log(`Load 2 Item Count: ${res.loads[1]?.itemCount}`);

// Expected:
// Load 1 should have MORE than base packing if TopUp worked.
// Base packing approx:
// 16000/1600 = 10 rows.
// 2540/175 = 14 cols.
// 10 * 14 = 140 per layer.
// 2700/800 = 3 layers.
// Total base capacity = 140 * 3 = 420.
// Remaining for TopUp = 425 - 420 = 5. (Wait, previous calculation said 416 packed? maybe margins reduce capacity)
// With margins 20/20/20:
// L=15960. 15960/1600 = 9.975 -> 9 rows. (Ah!)
// W=2500. 2500/175 = 14.28 -> 14 cols.
// 9 * 14 = 126 per layer.
// H=2660. 2660/800 = 3.32 -> 3 layers.
// Total capacity = 126 * 3 = 378 items.
// 425 - 378 = 47 spillover.

// Why did user get 416 items in Load 1?
// User has defaults margins 20mm.
// Maybe I used wrong dimensions?
// 53' dims: 16000, 2540, 2700.
// Material: 1600, 175, 800.
// My manual calc: 9*14*3 = 378.
// User screenshot: 416 items.
// 416 / 3 = 138.66. Not divisible by 3 layers.
// Maybe user has different margins or container dims?
// Screenshot says "53' Trailer".
// User code `App.tsx`:
// { name: "53' Trailer", type: '53', dimensions: { length: 16000, width: 2540, height: 2700 } },
// Margins: 20/20/20.

// Maybe packing is ROTATED?
// If Rotated: 175 x 1600.
// L=175. 15960/175 = 91.
// W=1600. 2500/1600 = 1.
// 91 * 1 = 91 per layer.
// 91 * 3 = 273. Much fewer.

// Maybe Default (Face Walls) means something else?
// `selectBestOrientation`
// Code says:
// Default: Length >= Width.
// My manual calc used 1600 x 175. 1600 >= 175. Correct.
// 9 rows of 1600 = 14400mm. used len.
// 14 cols of 175 = 2450mm. used width.

// Where does 416 come from?
// 416 / 126 = 3.3 layers.
// So 3 full layers (378) + 38 items in 4th layer?
// 4th layer is "Top Up" or just base packing?
// Height: 800 * 4 = 3200 > 2700. Can't fit 4th layer normally.

// Wait, optimization?
// If `selectBestOrientation` picked standard, it yielded 378.
// Maybe there's a better one?
// 1600 x 800 x 175 (tipped).
// L=1600. 9 rows.
// W=800. 3 cols.
// 9*3 = 27 per layer.
// H=175. 2660/175 = 15 layers.
// 27 * 15 = 405 items.
// 405 is close to 416.

// Maybe 800 x 175 x 1600 (tipped end).
// L=800. 19 rows.
// W=175. 14 cols.
// 19*14 = 266 per layer.
// H=1600. 1 layer.
// Total 266.

// Maybe User has different dims?
// Screenshot: 1600 x 175 x 800.
// Material Active.
// Packing Mode Sequential.

// Let's run the script and see what we get with default behavior.
