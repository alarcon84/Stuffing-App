/**
 * Constants for the 3D bin packing algorithm
 * Extracted from packingAlgorithm.ts to reduce magic numbers
 */

/** Height of the pallet base in millimeters */
export const PALLET_BASE_HEIGHT_MM = 150;

/** Minimum usable width for a side strip in millimeters */
export const MIN_USABLE_STRIP_WIDTH_MM = 100;

/** Tolerance for grouping items into layers (for shelf detection) in millimeters */
export const LAYER_GROUPING_TOLERANCE_MM = 10;

/** Tolerance for pallet position comparison in millimeters */
export const PALLET_POSITION_TOLERANCE_MM = 50;

/** Default margin from container walls in millimeters */
export const DEFAULT_MARGIN_MM = 20;

/** Maximum number of pallets that can be stacked vertically */
export const MAX_PALLET_STACK_HEIGHT = 2;

/** Ground shelf detection tolerance in millimeters */
export const GROUND_SHELF_TOLERANCE_MM = 10;
