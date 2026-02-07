# Stuffing Calculator Logic & Formulas

This document explains the core logic used in the stuffing calculator to determine how boxes and pallets are packed into containers. The logic is implemented in `packages/core/src/packingAlgorithm.ts`.

## 1. Overview

 The calculator uses a **heuristic packing algorithm** that:
1.  **Determines the "Unit"**: Decides whether to pack individual boxes or loaded pallets based on user input.
2.  **Optimizes Orientation**: Iterates through all allowed box rotations (X, Y, Z) to find the one that maximizes the number of items packed.
3.  **Calculates Grid**: Computes how many units fit along the length, width, and height of the container.
4.  **Distributes Units**: Fills containers sequentially with the calculated grid of units.
5.  **Multi-Material Optimization**: When packing two materials, it simulates both orders (Mat 1 then Mat 2, vs. Mat 2 then Mat 1) and picks the best result.

## 2. Unit Determination

The "Unit" is the smallest object placed into the container. It can be a single **Box** or a **Loaded Pallet**.

### A. Pallet Logic
If "Use Pallet" is enabled, the unit is a loaded pallet.

**Formulas:**
*   **Items Per Layer (Automatic)**:
    $$Cols = \lfloor \frac{Pallet_{Length}}{Box_{Length}} \rfloor$$
    $$Rows = \lfloor \frac{Pallet_{Width}}{Box_{Width}} \rfloor$$
    $$Items_{Layer} = Cols \times Rows$$

*   **Number of Layers (Automatic)**:
    $$AvailableHeight = MaxLoadHeight - PalletBaseHeight (150mm)$$
    $$Layers = \lfloor \frac{AvailableHeight}{Box_{Height}} \rfloor$$

*   **User Override (Layer Config)**:
    If a configuration like "6x2" is provided:
    *   **Items Per Layer** = 6 (Validated against physical max)
    *   **Layers** = 2 (Validated against max height)

*   **Total Items Per Pallet**:
    $$Items_{Pallet} = Items_{Layer} \times Layers$$

*   **Unit Dimensions**:
    *   Length: $Pallet_{Length}$
    *   Width: $Pallet_{Width}$
    *   Height: $PalletBaseHeight + (Layers \times Box_{Height})$

### B. Box Logic
If "Use Pallet" is disabled, the unit is the box itself (or a stack of boxes if a layer config is used).

*   **Unit Dimensions**: $Box_{Length}, Box_{Width}, Box_{Height}$ (based on current rotation).

## 3. Container Grid Calculation

The algorithm calculates how many units fit into the container.

**Formulas:**
*   **Count Length ($N_L$)**:
    $$N_L = \lfloor \frac{Container_{Length}}{Unit_{Length}} \rfloor$$

*   **Count Width ($N_W$)**:
    $$N_W = \lfloor \frac{Container_{Width}}{Unit_{Width}} \rfloor$$

*   **Count Height ($N_H$)**:
    $$N_H = \lfloor \frac{Container_{Height}}{Unit_{Height}} \rfloor$$

*   **Pallet Stacking**:
    If units are pallets and "Stack Pallets" is enabled:
    $$N_H = \min(N_H, 2)$$ (Max 2 high)
    Otherwise $N_H = 1$.

*   **Max Units Per Container**:
    $$MaxUnits = N_L \times N_W \times N_H$$

## 4. Packing & Distribution

The algorithm fills containers one by one.

1.  **Total Units Needed**: $\lceil \frac{TotalQuantity}{Items_{Unit}} \rceil$
2.  **Filling Loop**:
    *   Fill the first container with up to $MaxUnits$.
    *   If units remain, create a new container and repeat.
    *   **Utilization**:
        $$Utilization \% = \frac{Units_{Packed} \times Unit_{Volume}}{Container_{Volume}} \times 100$$

## 5. Multi-Material Logic

When packing two materials (e.g., Box A and Box B), the calculator runs two scenarios:

*   **Scenario A**: Pack all of Box A, then pack Box B into the *remaining space* of the last container (if possible) and then into new containers.
*   **Scenario B**: Pack all of Box B, then pack Box A into the *remaining space* of the last container and then into new containers.

**Comparison Criteria**:
The algorithm selects the scenario that results in:
1.  **Fewer Total Containers** (Primary Goal)
2.  **More Total Items Packed** (Secondary Goal, if quantities are limited)
3.  **Fewer Total Units** (Tie-breaker)

## 6. Rotation Optimization

For each material, the algorithm tests all allowed rotations (e.g., standing up, lying flat).
*   It runs the entire grid calculation for *each* rotation.
*   It selects the rotation that results in the **highest number of items packed** in the simulation.
