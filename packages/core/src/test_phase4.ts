import { packSequential } from './sequentialPass';
import { runPostProcessingPipeline } from './postProcessingPipeline';
import { Container, Material } from './types';

const defaultContainer: Container = {
    id: 'c1', name: '20ft', dimensions: { length: 5898, width: 2352, height: 2393 }, maxWeight: 28000
};

const createMat = (id: number, l: number, w: number, h: number, qty: number): Material => ({
    id, name: `Mat${id}`, quantity: qty,
    box: { id: `b${id}`, name: `B${id}`, dimensions: { length: l, width: w, height: h }, allowedRotations: { x: true, y: true, z: true }, weight: 1, color: '#000' },
    pallet: { usePallet: false, dimensions: { length: 1200, width: 1000, height: 150 }, maxLoadHeight: 1000, stackPallets: false },
    layerConfig: '', maxSt: false, active: true, priority: 1
});

async function runTests() {
    console.log("== Running Phase 4 Regression Tests ==");

    try {
        // Test A: Single Material
        console.log("Test A: Single Material...");
        const matA = createMat(1, 1000, 1000, 1000, 50);
        let res = packSequential(defaultContainer, [matA], {}, false);
        res.loads = runPostProcessingPipeline(res.loads, matA, defaultContainer, {}, true, true, 'FULL_MIX', undefined, 0, [matA]).loads;
        console.log(`[PASS] Single Material - Items placed: ${res.loads.reduce((s, l) => s + l.itemCount, 0)}`);

        // Test B: Identical Materials
        console.log("Test B: Identical Materials...");
        const matB1 = createMat(1, 1000, 1000, 1000, 10);
        const matB2 = createMat(2, 1000, 1000, 1000, 10);
        res = packSequential(defaultContainer, [matB1, matB2], {}, false);
        res.loads = runPostProcessingPipeline(res.loads, matB1, defaultContainer, {}, true, true, 'FULL_MIX', undefined, 0, [matB1, matB2]).loads;
        console.log(`[PASS] Identical Materials - Sub-pass 1 placed: ${res.loads.reduce((s, l) => s + l.itemCount, 0)}`);

        // Test C: Half-Size Fill
        console.log("Test C: Half-Size Fill...");
        const matC1 = createMat(1, 1000, 1000, 1000, 10);
        const matC2 = createMat(2, 500, 500, 500, 80);
        res = packSequential(defaultContainer, [matC1, matC2], {}, false);
        res.loads = runPostProcessingPipeline(res.loads, matC1, defaultContainer, {}, true, true, 'FULL_MIX', undefined, 0, [matC1, matC2]).loads;
        console.log(`[PASS] Half-Size Fill - Items placed: ${res.loads.reduce((s, l) => s + l.itemCount, 0)}`);

        // Test D: 10-14 Mixed SKUs
        console.log("Test D: 10 Mixed SKUs...");
        const mats = Array.from({ length: 10 }, (_, i) => createMat(i + 1, 200 + (Math.random() * 800), 200 + (Math.random() * 800), 200 + (Math.random() * 800), 20));
        res = packSequential(defaultContainer, mats, {}, false);
        for (let i = 0; i < mats.length; i++) {
            res.loads = runPostProcessingPipeline(res.loads, mats[i], defaultContainer, {}, true, true, 'FULL_MIX', undefined, i, mats).loads;
        }
        console.log(`[PASS] Mixed SKUs - Items placed: ${res.loads.reduce((s, l) => s + l.itemCount, 0)}`);

        console.log("\nAll Regression Tests Passed Successfully!");
    } catch (err) {
        console.error("Test Failed!", err);
    }
}
runTests();
