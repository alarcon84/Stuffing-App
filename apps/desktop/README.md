# Stuffing Calculator

A simplified 3D container stuffing calculator built with React, Vite, and Three.js.

## Features

-   **Box Dimensions**: Input custom box dimensions (Length, Width, Height).
-   **Palletization**: Option to stack boxes on pallets before loading into the container.
-   **Container Selection**: Choose from standard container sizes (20', 40', 40' HC, 53').
-   **Visualization**: 3D interactive view of the packed container.
-   **Stats**: Real-time calculation of total items and volume utilization.

## Tech Stack

-   **React**: UI Framework
-   **Vite**: Build Tool
-   **Three.js / React Three Fiber**: 3D Visualization
-   **Tailwind CSS**: Styling

## Algorithm

The current packing algorithm uses a simplified "Homogeneous Layer Filling" approach:
1.  **Unit Definition**: Determines the packing unit (either a single box or a loaded pallet).
2.  **Grid Calculation**: Calculates how many units fit along each axis (Length, Width, Height) of the container.
3.  **Placement**: Generates 3D coordinates for each unit to fill the container grid.

*Note: This is a heuristic approach and assumes all items are the same size.*

## Getting Started

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run development server:
    ```bash
    npm run dev
    ```
3.  Build for production:
    ```bash
    npm run build
    ```
