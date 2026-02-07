export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface Box {
  id: string;
  materialId?: number; // 1 or 2
  dimensions: Dimensions;
  color: string;
  weightKg?: number; // Optional weight in kg
  allowedRotations: {
    x: boolean; // Roll
    y: boolean; // Yaw
    z: boolean; // Pitch
  };
}

export interface Container {
  name: string;
  dimensions: Dimensions;
  type: '20' | '40' | '40HC' | '53' | 'custom';
}

export interface Pallet {
  dimensions: Dimensions;
  maxLoadHeight: number;
  weightKg?: number; // Optional weight in kg
  usePallet: boolean;
  stackPallets?: boolean; // Stack additional pallet on top (max 2 pallets high)
}

export interface PlacedItem {
  position: [number, number, number]; // Center position [x, y, z]
  rotation: [number, number, number]; // Rotation in radians [x, y, z]
  dimensions: Dimensions; // Dimensions of the placed item (could be a box or a pallet)
  type: 'box' | 'pallet';
  itemCount?: number; // Number of actual items in this placed unit (for partial units)
  materialId?: number; // 1 or 2
  isFlatTopOff?: boolean; // If true, this item was added as a flat top-off
  grid?: {
    cols: number; // Number of items along width (Z)
    rows: number; // Number of items along length (X)
    layers: number; // Number of items along height (Y)
  };
}

export interface ContainerLoad {
  id: number;
  items: PlacedItem[];
  utilization: number;
  itemCount: number;
  type: 'full' | 'partial';
}

export interface PackingResult {
  totalItems: number;
  totalContainers: number;
  totalLots?: number; // Total number of unique pallet stacks (lots)
  totalPallets?: number; // Total number of individual pallets
  loads: ContainerLoad[];
  containerDimensions: Dimensions;
  unpackedItems: number;
  packedBoxDimensions?: Dimensions; // The dimensions of the box as packed (rotated)
  errors?: string[]; // Any validation errors or warnings
  actualUsedVolume?: number; // Actual volume of placed items (not including wasted space)
}

export interface Material {
  id: number;
  box: Box;
  pallet: Pallet;
  quantity: number;
  layerConfig: string;
  active: boolean;
  maxSt?: boolean; // Maximize Stacking (Flat Top-Off)
}
