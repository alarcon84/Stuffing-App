# Stuffing Calculator UI

This package contains shared React components and hooks used by both the Desktop and Mobile applications.

## Components

### `InputPanel`
A form component for entering box dimensions, pallet settings, and selecting containers.
-   **Props**: `Material`, `Container`, `onChange` callbacks.
-   **Features**: Validation, Unit conversion (mm/in/cm).

### `Visualizer`
The 3D view of the packed container using `react-three-fiber`.
-   **Props**: `ContainerLoad`, `ContainerDimensions`, `CameraSettings`.
-   **Features**:
    -   Orbit controls.
    -   Layer-by-layer visibility toggle.
    -   Hover tooltips for box details.

### `ResultStats`
Displays packing metrics:
-   Total Items packed vs unpacked.
-   Volume utilization %.
-   Container count.

## Usage

Import components directly:

```tsx
import { InputPanel, Visualizer } from '@stuffing-calc/ui';

function App() {
  return (
    <div className="flex">
      <InputPanel ... />
      <div className="flex-1">
         <Visualizer ... />
      </div>
    </div>
  );
}
```
