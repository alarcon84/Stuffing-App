# Packing Kernel Contract

## Authority
The packing kernel (`packGridCore`) is the sole authority for generating placement coordinates.

No other module may compute, infer, adjust, reorder, or mutate X/Y/Z placement positions.

---

## Coordinate System

- Origin: (0,0,0) = back-left-bottom of the container
- X axis: Length (left → right)
- Y axis: Height (bottom → top)
- Z axis: Width (back → front)

All coordinates represent **center points** of placed units.

---

## Fill Order

Deterministic fill order is strictly:

X (Length) → Z (Width) → Y (Height)

This order is guaranteed and must not be altered.

---

## Determinism

Given identical inputs, the kernel must always produce:
- Identical item count
- Identical coordinates
- Identical ordering

Any deviation is a bug.

---

## Enforcement

- All grid placement geometry must originate from `packGridCore`
- Dispatcher code may only map kernel output to domain types
- Visualizers must project solver coordinates directly

Any pull request violating this contract must be rejected.

---

## Mixed-Material Determinism (Phase 7)

### Rule 7.1 — Temporal Determinism (UNCHANGED)
Material processing order is strictly the input order (M1 → M2 → ...).
This is **never** altered by Full Mix. No material may reorder, replace, or re-pack earlier materials.

### Rule 7.2 — Spatial Freedom (Full Mix Only)
In Full Mix mode, a material may place boxes into:
- volumes created by previous materials
- volumes adjacent to other materials
- volumes on top of other materials

**Constraint:** Material processing order remains strictly sequential.

### Rule 7.3 — Kernel Integrity (UNCHANGED)
`packGridCore`:
- sees one GridVolume at a time
- knows nothing about materials
- knows nothing about mixing

Mixing logic exists **only** at the dispatcher level (`packingAlgorithm.ts`), which passes available GridVolumes (including those created by previous placements) to the kernel.
