export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

/**
 * PHASE 8: Explicit Packing Modes
 * - SEQUENTIAL: Materials packed in strict order, no stacking between materials
 * - SMART_STACK: Dimension-aware vertical continuation when compatible
 * - TETRIS: Greedy box-level filling, ignores material boundaries
 */
export type PackingMode = 'SEQUENTIAL' | 'SMART_STACK' | 'TETRIS';

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

export interface FullMixRotations {
  x: boolean; // Vertical
  y: boolean; // Horizontal
  z: boolean; // Flat
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
  packingMode?: string; // Optional: Mode used to pack this item (e.g., 'SMART_STACK')
  isFlatTopOff?: boolean; // If true, this item was added as a flat top-off
  grid?: {
    cols: number; // Number of items along width (Z)
    rows: number; // Number of items along length (X)
    layers: number; // Number of items along height (Y)
  };
  locked?: boolean; // If true, this item cannot be moved by subsequent passes
  source?: 'DEFAULT' | 'TOP_UP' | 'FULL_MIX'; // Traceability for debugging
  isPalletBase?: boolean; // If true, this item represents the base of a pallet
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
}
