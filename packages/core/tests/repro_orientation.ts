
import { calculatePacking } from '../src/packingAlgorithm';
import type { Material, Container } from '../src/types';

// Container: 53ft
const container: Container = {
    name: '53ft',
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
};

// Material 1: 
// Box: 1000 x 500 x 500
// Default (Face Wall): L=1000, W=500 -> 16000/1000 = 16 rows, 2540/500 = 5 cols. 16*5 = 80 per layer.
// Rotated: L=500, W=1000 -> 16000/500 = 32 rows, 2540/1000 = 2 cols. 32*2 = 64 per layer.
// Default is BETTER.

// Material 2:
// Box: 500 x 600 x 500
// Default (Face Wall): L=600, W=500 (since L>=W rule, but wait, L=500, W=600 in raw dims?)
// If Box Dims are L=500, W=600.
// Default logic: orient so Length >= Width.
// So it will try to orient as 600x500 or 500x600?
// "face walls" means Length dimension of the placed item runs parallel to container length? 
// No, packing logic usually packs along X (Width) then Y (Length) or vice versa.
// My logic in `orientationSelector`:
// `defaultOrientation`: Find permutation where L >= W.
// `rotatedOrientation`: Find permutation where W > L.

const mat1: Material = {
    id: 1,
    active: true,
    quantity: 100,
    layerConfig: '',
    box: {
        id: 'b1',
        materialId: 1,
        dimensions: { length: 1000, width: 500, height: 500 },
        color: 'red',
        allowedRotations: { x: false, y: true, z: false }
    },
    pallet: { usePallet: false, dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0, stackPallets: false },
    orientationPreference: 'default'
};

// Testing Optimization Recommendation
// Case where Default is WORSE than Rotated.
// Container Width: 2540.
// Box: 1300 x 800.
// Default (L>=W): 1300 x 800.
// Rows along Width (2540): 2540 / 800 = 3.
// Rows along Length (16000): 16000 / 1300 = 12.
// Total per layer: 3 * 12 = 36.

// Rotated (W>L): 800 x 1300.
// Rows along Width (2540): 2540 / 1300 = 1.
// Rows along Length (16000): 16000 / 800 = 20.
// Total per layer: 1 * 20 = 20. 
// (Here Default is better).

// Case where Rotated is BETTER.
// Container: W=1000.
// Box: 600 x 400.
// Default (600x400): 1000/400 = 2. Area used: 2*400*600 = 480000.
// Rotated (400x600): 1000/600 = 1. Area used: 1*600*400 = 240000.
// (Default still better).

// Let's force a gap issue.
// Container W = 1000.
// Box: 550 x 450.
// Default (550x450): 1000/450 = 2. (2 * 450 = 900). Fit!
// Rotated (450x550): 1000/550 = 1. (1 * 550 = 550).
// Default (2 items) > Rotated (1 item).

// Is there a case where Rotated is better?
// Container W = 1000.
// Box: 300 x 1000.
// Note: Dimensions are always L, W, H.
// Allowed rotations y=true means we can swap L and W.
// Box dims: L=1000, W=300.
// Default (Face Wall, L>=W): 1000x300.
// W_cont / W_box = 1000 / 300 = 3.
// Rotated (W>L): 300x1000.
// W_cont / L_box = 1000 / 1000 = 1.
// Default: 3 items per row. Rotated: 1 item per row.

// Let's look for a case where "Face Walls" (Long side parallel to Wall) implies:
// "Face Walls" usually means the *Length* of the box is parallel to the *Length* of the container?
// Or *Width* of box parallel to *Width* of container?
// "Default: Length >= Width" means the box is oriented such that its Dimension along X (or Y?) is longer.
// In `packGridCore`, we pack along Width first?
// `packGridCore` fills rows along Width.
// So if we have Box 1000x300.
// If 1000 is along Length (axis Y) and 300 along Width (axis X).
// Then we fit 1000/300 = 3 items along Width? No, Container Width is fixed.
// Container W=2540.
// Box 1000(L) x 300(W).
// If placed as 1000x300 (L x W): It consumes 300mm of Container Width. We fit floor(2540/300) = 8 cols.
// If placed as 300x1000 (L x W): It consumes 1000mm of Container Width. We fit floor(2540/1000) = 2 cols.
// 8 cols vs 2 cols.
// But length consumption differs.
// 8 cols consume 1000mm length. Total: 8 items per 1000mm length. Density: 8/1000 = 0.008.
// 2 cols consume 300mm length. Total: 2 items per 300mm length. Density: 2/300 = 0.0066.
// So 1000x300 is better.

// Try Box: 550 x 550.
// Try Box: 2000 x 2000...

// Let's just verify that the preference setting CHANGE the output dimensions.
const mat2 = { ...mat1, id: 2, box: { ...mat1.box, id: 'b2', materialId: 2, dimensions: { length: 800, width: 400, height: 400 }, color: 'blue' } };
// Default: 800x400.
// Rotated: 400x800.

console.log("--- TEST 1: Default Preference (Length >= Width) ---");
const res1 = calculatePacking(container, [mat2]);
const item1 = res1.loads[0]?.items[0];
console.log(`Dimensions: ${item1?.dimensions.length} x ${item1?.dimensions.width}`);
console.log(`Optimization Available: ${JSON.stringify(res1.optimizationsAvailable)}`);

console.log("\n--- TEST 2: Rotated Preference (Width > Length) ---");
const mat2Rot = { ...mat2, orientationPreference: 'rotated' as const };
const res2 = calculatePacking(container, [mat2Rot]);
const item2 = res2.loads[0]?.items[0];
console.log(`Dimensions: ${item2?.dimensions.length} x ${item2?.dimensions.width}`);
console.log(`Optimization Available: ${JSON.stringify(res2.optimizationsAvailable)}`);

// Use a case where optimization IS available.
// Mat3: 380x300 in Container W=1000.
// Default (380x300): 1000/300 = 3. 3 per 380mm. Density 3/380 = 0.00789.
// Rotated (300x380): 1000/380 = 2. 2 per 300mm. Density 2/300 = 0.00666.
// Default Better.

// Mat4: 330x300 in Container W=1000.
// Default (330x300): 1000/300 = 3. 3 per 330. Dens = 0.00909.
// Rotated (300x330): 1000/330 = 3. 3 per 300. Dens = 0.01.
// Rotated Better!
console.log("\n--- TEST 3: Optimization Detection ---");
const mat4 = {
    ...mat1,
    id: 4,
    box: { ...mat1.box, id: 'b4', materialId: 4, dimensions: { length: 330, width: 300, height: 300 }, color: 'green' },
    orientationPreference: 'default' as const
};
// Use a narrower container to force the issue
const smallContainer = { ...container, dimensions: { ...container.dimensions, width: 1000 } };
const res3 = calculatePacking(smallContainer, [mat4]);
console.log(`Default Result Items: ${res3.totalItems}`);
console.log(`Optimization Available: ${JSON.stringify(res3.optimizationsAvailable)}`);

if (res3.optimizationsAvailable && res3.optimizationsAvailable.length > 0) {
    console.log("SUCCESS: Optimization detected!");
} else {
    console.log("FAIL: Optimization NOT detected (or default was actually better?)");
}
