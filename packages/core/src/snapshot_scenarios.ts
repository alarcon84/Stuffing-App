import { Container, Material } from './types';

// Shared Helper Functions (Originally from capture_snapshots.ts)
export const createMaterials = (boxDims: number[], qty: number, maxSt: boolean = false): Material[] => {
    return [{
        id: 1,
        name: 'Test Material',
        quantity: qty,
        box: {
            id: 'b1',
            name: 'Box 1',
            dimensions: { length: boxDims[0], width: boxDims[1], height: boxDims[2] },
            allowedRotations: { x: false, y: false, z: false }, // Fixed orientation
            weight: 1,
            color: '#ff0000'
        },
        pallet: {
            usePallet: false,
            dimensions: { length: 1200, width: 1000, height: 150 },
            maxLoadHeight: 1000,
            stackPallets: false
        },
        layerConfig: '',
        maxSt: maxSt,
        active: true,
        priority: 1
    }];
};

export const DEFAULT_CONTAINER: Container = {
    id: 'c1',
    name: '20ft',
    dimensions: { length: 5898, width: 2352, height: 2393 },
    maxWeight: 28000
};

export const HC_CONTAINER: Container = {
    id: 'c2',
    name: '40ftHC',
    dimensions: { length: 12032, width: 2352, height: 2698 },
    maxWeight: 28000
};

export const WIDE_CONTAINER: Container = {
    id: 'c3',
    name: 'Wide',
    dimensions: { length: 16000, width: 2500, height: 2700 },
    maxWeight: 30000
};

export interface Scenario {
    name: string;
    container: Container;
    materials: Material[];
}

export const SNAPSHOT_SCENARIOS: Scenario[] = [
    {
        name: 'grid_basic_single',
        container: DEFAULT_CONTAINER,
        materials: createMaterials([1000, 1000, 1000], 1)
    },
    {
        name: 'grid_tight_fit',
        container: DEFAULT_CONTAINER,
        materials: createMaterials([585, 231, 235], 1000)
    },
    {
        name: 'grid_non_even',
        container: DEFAULT_CONTAINER,
        materials: createMaterials([400, 400, 400], 500)
    },
    {
        name: 'grid_tall_container',
        container: HC_CONTAINER,
        materials: createMaterials([500, 500, 800], 200)
    },
    {
        name: 'grid_wide_container',
        container: WIDE_CONTAINER,
        materials: createMaterials([1000, 1200, 1000], 100)
    },
    {
        name: 'grid_max_st',
        container: DEFAULT_CONTAINER,
        materials: (() => {
            const m = createMaterials([300, 300, 1000], 500, true);
            m[0].box.allowedRotations = { x: true, y: true, z: true };
            return m;
        })()
    },
    {
        name: 'grid_multi_load',
        container: DEFAULT_CONTAINER,
        materials: createMaterials([1000, 1000, 1000], 50)
    },
    {
        name: 'grid_pallet_stacked',
        container: DEFAULT_CONTAINER,
        materials: (() => {
            const m = createMaterials([400, 300, 200], 100);
            m[0].pallet.usePallet = true;
            m[0].pallet.stackPallets = true;
            m[0].pallet.dimensions = { length: 1200, width: 1000, height: 150 };
            m[0].pallet.maxLoadHeight = 1150;
            return m;
        })()
    },
    {
        name: 'grid_mixed_determinism',
        container: DEFAULT_CONTAINER,
        materials: (() => {
            const m = createMaterials([1000, 1000, 1000], 2);
            m.push(...createMaterials([500, 500, 500], 5));
            m.push(...createMaterials([250, 250, 250], 10));
            // Ensure distinct IDs
            m[1] = { ...m[1], id: 2, name: 'Mat 2', box: { ...m[1].box, id: 'b2' } };
            m[2] = { ...m[2], id: 3, name: 'Mat 3', box: { ...m[2].box, id: 'b3' } };
            return m;
        })()
    }
];
