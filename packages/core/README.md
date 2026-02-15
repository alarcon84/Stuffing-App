# Packing Core

This package contains the pure TypeScript stuffing engine for the Stuffing Calculator. It is responsible for all coordinate generation, orientation selection, and packing logic.

## Architecture

The core is designed around a strict separation of concerns:

1.  **Kernel (`packGridCore`)**: A deterministic, geometry-only solver. It takes a `GridVolume` and `Dimensions` and returns a list of valid coordinates. It knows nothing about materials, orders, or mixing rules.
2.  **Dispatcher (`packingAlgorithm`)**: The high-level logic that manages materials, orders, and Packing Modes. It calls the Kernel to place items.

### Coordinate Systems

> [!IMPORTANT]
> The Kernel and the Dispatcher use different coordinate systems.

-   **Kernel Space (Internal)**: `[Width (X), Length (Y), Height (Z)]`
-   **Placed Space (External)**: `[Length (X), Height (Y), Width (Z)]`

All coordinates returned by the Kernel are remapped by the Dispatcher before being returned to the UI.

## Packing Modes

### 1. Sequential (Base Mode)

Ref: `packSequential`

-   **Logic**: Strict First-In-First-Out (FIFO). Materials are packed exactly in the order provided.
-   **Separation**: Each material is packed into its own conceptual "loads" or containers.
-   **No Mixing**: Material B will never be placed in a void left by Material A in the same container unless "Combined" is explicitly enabled (which just treats them as a sequence in one container).

### 2. Smart Stack

Ref: `packSmartStack`

Designed to maximize vertical space utilization for identical or compatible items.

**The 3-Step Priority Loop:**
For each material, the algorithm attempts to place items in this strict order:

1.  **Vertical Stack**: Can this item fit *on top* of the previous layer?
    -   *Condition*: Dimensions must be compatible (Item Length <= Layer Length, Item Width <= Layer Width).
    -   *Goal*: Build columns to the ceiling.
2.  **Floor Fill**: If it can't stack, can it fit on the *floor* of the current container?
    -   *Goal*: Use remaining floor space.
3.  **New Container**: If neither fits, open a new container.

**Key Concept: `lastLayerFootprint`**
The algorithm tracks the top surface of the last placed layer. If the next item is smaller or equal in footprint, it is allowed to stack.

### 3. Full Mix

Ref: `packingAlgorithm.ts` (Integrated logic)

The most advanced mode, allowing high-density packing of heterogeneous loads.

-   **Spatial Freedom**: Unlike Sequential mode, Full Mix scans *all* available voids in the container.
-   **Surface Detection**: The engine identifies "Shelves" dynamically:
    -   **Ground Horizontal**: Empty floor space.
    -   **Peak**: The top surface of an existing stack.
    -   **Gap**: The space between two stacks.
    -   **Side Strip**: The narrow capability gap along the wall (Z-axis).
-   **Temporal Determinism**: Materials are still processed in order (A -> B -> C), but Material C can fill a hole left by Material A.

## Kernel Contract

The `packGridCore` obeys a strict contract to ensure determinism:
-   **Input**: `GridVolume`, `ItemDimensions`
-   **Output**: `Coordinate[]`
-   **Invariant**: Given the same inputs, it *always* returns the same coordinates in the same order.

See `KERNEL_CONTRACT.md` for more.
