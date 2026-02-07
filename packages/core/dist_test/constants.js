"use strict";
/**
 * Constants for the 3D bin packing algorithm
 * Extracted from packingAlgorithm.ts to reduce magic numbers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUND_SHELF_TOLERANCE_MM = exports.MAX_PALLET_STACK_HEIGHT = exports.DEFAULT_MARGIN_MM = exports.PALLET_POSITION_TOLERANCE_MM = exports.LAYER_GROUPING_TOLERANCE_MM = exports.MIN_USABLE_STRIP_WIDTH_MM = exports.PALLET_BASE_HEIGHT_MM = void 0;
/** Height of the pallet base in millimeters */
exports.PALLET_BASE_HEIGHT_MM = 150;
/** Minimum usable width for a side strip in millimeters */
exports.MIN_USABLE_STRIP_WIDTH_MM = 100;
/** Tolerance for grouping items into layers (for shelf detection) in millimeters */
exports.LAYER_GROUPING_TOLERANCE_MM = 10;
/** Tolerance for pallet position comparison in millimeters */
exports.PALLET_POSITION_TOLERANCE_MM = 50;
/** Default margin from container walls in millimeters */
exports.DEFAULT_MARGIN_MM = 20;
/** Maximum number of pallets that can be stacked vertically */
exports.MAX_PALLET_STACK_HEIGHT = 2;
/** Ground shelf detection tolerance in millimeters */
exports.GROUND_SHELF_TOLERANCE_MM = 10;
