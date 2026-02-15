# Stuffing Calculator

A 3D container stuffing calculator built with React, Vite, and Three.js. This application helps optimize the packing of boxes into standard shipping containers with advanced packing algorithms.

## Features

-   **Box Dimensions**: Input custom box dimensions (Length, Width, Height) and define allowed rotations.
-   **Palletization**: Option to stack boxes on pallets before loading, including custom pallet dimensions and max load heights.
-   **Container Selection**: Choose from standard container sizes:
    -   20' Standard
    -   40' Standard
    -   40' High Cube
    -   53' Trailer
    -   Custom
-   **Advanced Packing Modes**:
    -   **Sequential**: Strict input order packing.
    -   **Smart Stack**: Prioritizes vertical stacking to maximize container height usage before using floor space.
    -   **Full Mix**: Allows filling voids created by previous items for maximum density (complex loads).
-   **Visualization**: Interactive 3D view of the packed container with rotation, zoom, and layer-by-layer inspection.
-   **Stats**: Real-time calculation of total items, volume utilization, and container count.
-   **Export**: Generate PDF reports and Excel manifest downloads.

## Tech Stack

This project is a Monorepo managed with **Turborepo**:

-   **Apps**:
    -   `apps/desktop`: Electron + React application (Main entry point)
    -   `apps/mobile`: Capacitor + React application (Android)
-   **Packages**:
    -   `packages/core`: The pure TypeScript packing engine (algorithms, types, constants).
    -   `packages/ui`: Shared React components and UI logic.

## Packing Algorithms

The core logic resides in `packages/core`. The calculator supports multiple strategies:

1.  **Sequential (Default)**:
    -   Strictly follows the order of materials in the input list.
    -   Calculates the best orientation for each box.
    -   Fills the container layer by layer or based on optimal fit.

2.  **Smart Stack**:
    -   **Vertical Priority**: Attempts to stack compatible items on top of existing layers to use vertical space first.
    -   **Floor Fill**: If vertical stacking isn't possible, it proceeds to fill the remaining floor space.
    -   **New Container**: Opens a new container only when both vertical and floor space are exhausted.

3.  **Full Mix**:
    -   **Spatial Freedom**: Allows new items to be placed in *any* available void, including gaps left by previous items or shelves created by size differences.
    -   **High Density**: Best for complex mixes of different box sizes.

For deep technical details on the packing kernel, see [`packages/core/README.md`](../../packages/core/README.md).

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

1.  Install dependencies from the root:
    ```bash
    npm install
    ```

### Development

To run the desktop application in development mode:

1.  Start the development server:
    ```bash
    npm run dev
    ```

### Build

To build the application for production:

1.  Build all packages and apps:
    ```bash
    npm run build
    ```
