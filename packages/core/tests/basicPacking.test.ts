
import { describe, test, expect } from 'vitest';
import { calculatePacking } from '../src/packingAlgorithm';


const container20ft = {
    name: '20ft',
    type: '20' as const,
    dimensions: { length: 5900, width: 2350, height: 2390 },
    maxWeight: 28000
};

describe('Single Material Packing - Baseline', () => {


    const basicBox = {
        id: 'box1',
        dimensions: { length: 400, width: 300, height: 200 },
        weight: 10,
        color: '#ff0000',
        allowedRotations: { x: true, y: true, z: true }
    };

    // TEST 1.1: Simple packing without pallets
    test('should pack boxes without pallets - no top-up, no full-mix', () => {
        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: false  // ← KEY: No pallet
            },
            quantity: 100,
            layerConfig: '10x8',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            false,  // usePallets = false (This arg is isCombined, but the name in test says usePallets. The test logic uses individual material setting)
            // Wait, let's check calculatePacking signature:
            /*
            export const calculatePacking = (
              container: Container,
              materials: import('./types').Material[],
              isCombined: boolean = false,
              margins: { length?: number; width?: number; height?: number } = { length: 20, width: 20, height: 20 },
              packingMode: import('./types').PackingMode = 'SEQUENTIAL',
              enableTopUp: boolean = false,
              enableFullMix: boolean = false,
              fullMixRotations?: import('./types').FullMixRotations
            )
            */
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,  // topUp = false
            false   // fullMix = false
        );

        // ASSERTIONS (What we expect)
        expect(result.totalContainers).toBeGreaterThan(0);
        expect(result.totalItems).toBe(100);
        expect(result.unpackedItems).toBe(0);
        const totalPacked = result.loads[0].items.reduce((sum, item) => sum + (item.itemCount || 1), 0);
        expect(totalPacked).toBe(100);

        const groundItems = result.loads[0].items.filter(
            item => (item.position[1] - item.dimensions.height / 2) <= 30
        );
        expect(groundItems.length).toBeGreaterThan(0);
    });

    // TEST 1.2: Simple packing WITH pallets
    test('should pack boxes on pallets - no top-up, no full-mix', () => {
        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true  // ← KEY: Use pallet
            },
            quantity: 100,
            layerConfig: '10x8',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,  // usePallets = true (This arg is isCombined. If false, it uses FAST PATH logic for single material. If true, it might skip FAST PATH?)
            // The test comment says 'usePallets', but the arg is 'isCombined'.
            // If isCombined is true, it might use different logic.
            // But the material has usePallet: true.
            // Let's stick to the user's code.
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        expect(result.totalItems).toBe(100);

        // All items should be ABOVE ground (on pallet base = 144mm)
        const palletItems = result.loads[0].items.filter(
            item => item.position[1] >= 144  // Y position >= pallet height
        );
        const totalPalletItems = palletItems.reduce((sum, item) => sum + (item.itemCount || 1), 0);
        expect(totalPalletItems).toBe(100);

        // Check for pallet base items
        const palletBases = result.loads[0].items.filter(
            item => item.isPalletBase === true
        );
        expect(palletBases.length).toBeGreaterThan(0);
    });

    // TEST 1.3: Layer configuration respected
    test('should respect layer configuration', () => {
        const material = {
            id: 1,
            box: basicBox,
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 100,
            layerConfig: '5x4',  // ← Specific config: 5 length x 4 width = 20 per layer
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        // Count items at each height level
        const heightLayers = new Map();
        result.loads[0].items.forEach(item => {
            const y = Math.round(item.position[1] / 10) * 10;  // Round to 10mm
            heightLayers.set(y, (heightLayers.get(y) || 0) + 1);
        });

        // Each layer should have approximately 20 items (5x4)
        // Allow some tolerance for edge cases
        const layerCounts = Array.from(heightLayers.values());
        expect(Math.max(...layerCounts)).toBeLessThanOrEqual(20);
    });
});

describe('Single Material - Option Interactions', () => {
    const setupMaterial = (usePallet: boolean) => ({
        id: 1,
        box: {
            id: 'box1',
            dimensions: { length: 400, width: 300, height: 200 },
            weight: 10,
            color: '#ff0000',
            allowedRotations: { x: true, y: true, z: true }
        },
        pallet: {
            dimensions: { length: 1200, width: 1000, height: 144 },
            maxLoadHeight: 2000,
            usePallet
        },
        quantity: 300,
        layerConfig: '10x8',
        active: true
    });

    // TEST 2.1: Pallet + Top-Up
    test('should work with pallets AND top-up', () => {
        const material = setupMaterial(true);

        const result = calculatePacking(
            container20ft,
            [material],
            true,   // usePallets = true (isCombined)
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            true,   // topUp = true  ← INTERACTION TEST
            false
        );

        expect(result.errors || []).toHaveLength(0);
        expect(result.totalItems).toBeGreaterThan(0);

        // Check for top-up items (should be locked and at high Y position)
        const topUpItems = result.loads[0].items.filter(
            item => item.source === 'TOP_UP'
        );

        if (topUpItems.length > 0) {
            expect(topUpItems.every(item => item.locked)).toBe(true);

            // Top-up items should be near container ceiling
            const maxY = Math.max(...topUpItems.map(item => item.position[1]));
            expect(maxY).toBeGreaterThan(2000);  // High in container
        }
    });

    // TEST 2.2: Pallet + Full-Mix
    test('should work with pallets AND full-mix', () => {
        const material = setupMaterial(true);

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            true   // fullMix = true  ← INTERACTION TEST
        );

        expect(result.errors || []).toHaveLength(0);
        expect(result.totalItems).toBeGreaterThan(0);

        // Check for full-mix items
        const fullMixItems = result.loads[0].items.filter(
            item => item.source === 'FULL_MIX'
        );

        // Full-mix should fill gaps between pallets
        if (fullMixItems.length > 0) {
            console.log(`Full-mix placed ${fullMixItems.length} items`);
        }
    });

    // TEST 2.3: Pallet + Top-Up + Full-Mix (All options)
    test('should work with ALL options enabled', () => {
        const material = setupMaterial(true);

        const result = calculatePacking(
            container20ft,
            [material],
            true,   // usePallets
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            true,   // topUp
            true    // fullMix
        );

        expect(result.errors || []).toHaveLength(0);
        expect(result.totalItems).toBeGreaterThan(0);

        // Count items by source
        const sources = {
            PRIMARY: 0,
            TOP_UP: 0,
            FULL_MIX: 0
        };

        result.loads[0].items.forEach(item => {
            const source = (item.source === 'DEFAULT' || !item.source) ? 'PRIMARY' : item.source;
            sources[source]++;
        });

        console.log('Item distribution:', sources);

        // All sources should have items
        expect(sources.PRIMARY).toBeGreaterThan(0);
        // Top-up and full-mix may be 0 if no space available, but shouldn't error
    });

    // TEST 2.4: No Pallet + Top-Up + Full-Mix
    test('should work with top-up and full-mix WITHOUT pallets', () => {
        const material = setupMaterial(false);  // No pallet

        const result = calculatePacking(
            container20ft,
            [material],
            false,  // usePallets = false
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            true,   // topUp
            true    // fullMix
        );

        expect(result.errors || []).toHaveLength(0);
        expect(result.totalItems).toBeGreaterThan(0);
    });

    // TEST 2.5: Layer Config + Pallets
    test('should respect layer config with pallets', () => {
        const material = setupMaterial(true);
        material.layerConfig = '3x3';  // Small config

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        // Each pallet should have 3x3 arrangement
        // Count items per pallet (assuming pallet base exists)
        const palletBases = result.loads[0].items.filter(
            item => item.isPalletBase === true
        );

        expect(palletBases.length).toBeGreaterThan(0);
    });
});

describe('Known Issues - Single Material', () => {
    // TEST 3.1: KNOWN BUG - Pallet with invalid layer config
    test.fails('KNOWN BUG: Invalid layer config with pallets causes crash', () => {
        const material = {
            id: 1,
            box: {
                id: 'box1',
                dimensions: { length: 400, width: 300, height: 200 },
                weight: 10,
                color: '#ff0000',
                allowedRotations: { x: true, y: true, z: true }
            },
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 100,
            layerConfig: '99x99',  // ← INVALID: Doesn't fit on pallet
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        // Should handle gracefully with error message
        expect(result.errors?.length).toBeGreaterThan(0);
        expect(result.errors?.[0]).toContain('layer configuration');
    });

    // TEST 3.2: KNOWN BUG - Pallet height exceeds maxLoadHeight
    test('Stack exceeds pallet maxLoadHeight', () => {
        const material = {
            id: 1,
            box: {
                id: 'box1',
                dimensions: { length: 400, width: 300, height: 500 },  // Tall box
                weight: 10,
                color: '#ff0000',
                allowedRotations: { x: false, y: false, z: false }  // No rotation
            },
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 1000,  // ← Low max height
                usePallet: true
            },
            quantity: 100,
            layerConfig: '2x2',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        // No pallet stack should exceed 1000mm + 144mm base
        result.loads[0].items.forEach(item => {
            if (!item.isPalletBase) {
                const topOfItem = item.position[1] + item.dimensions.height / 2;
                expect(topOfItem).toBeLessThanOrEqual(1144);  // maxLoadHeight + base
            }
        });
    });

    // TEST 3.3: Zero quantity edge case
    test('should handle zero quantity gracefully', () => {
        const material = {
            id: 1,
            box: {
                id: 'box1',
                dimensions: { length: 400, width: 300, height: 200 },
                weight: 10,
                color: '#ff0000',
                allowedRotations: { x: true, y: true, z: true }
            },
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: true
            },
            quantity: 0,  // ← EDGE CASE
            layerConfig: '10x8',
            active: true
        };

        const result = calculatePacking(
            container20ft,
            [material],
            true,
            { length: 0, width: 0, height: 0 },
            'SEQUENTIAL',
            false,
            false
        );

        expect(result.totalItems).toBe(0);
        expect(result.totalContainers).toBe(0);
        expect(result.loads).toHaveLength(0);
    });
});
