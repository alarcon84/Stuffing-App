"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePacking = void 0;
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const findAvailableShelves = (load, containerDims, margins) => {
    var _a, _b, _c;
    const marginL = (_a = margins.length) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_MARGIN_MM;
    const marginH = (_b = margins.height) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_MARGIN_MM;
    const marginW = (_c = margins.width) !== null && _c !== void 0 ? _c : constants_1.DEFAULT_MARGIN_MM;
    // Flatten items into a simplified 2D profile (X vs MaxY)
    const sortedItems = [...load.items].sort((a, b) => a.position[0] - b.position[0]);
    // If empty, whole floor is available
    if (sortedItems.length === 0) {
        return [{
                startX: marginL,
                endX: containerDims.length - marginL,
                y: marginH,
                width: containerDims.width - marginW * 2,
                type: 'ground_horizontal'
            }];
    }
    // Detect Global Max X (Rightmost edge of the load)
    let absoluteMaxX = 0;
    // Group items by their approximate top Y (tolerance 5mm) to find vertical shelves
    // Store a LIST of supported segments for each height, to handle gaps
    const layers = new Map();
    sortedItems.forEach(item => {
        const top = item.position[1] + item.dimensions.height / 2;
        const right = item.position[0] + item.dimensions.length / 2;
        if (right > absoluteMaxX)
            absoluteMaxX = right;
        // Round to nearest 10mm to group effectively
        const roundedTop = Math.round(top / constants_1.LAYER_GROUPING_TOLERANCE_MM) * constants_1.LAYER_GROUPING_TOLERANCE_MM;
        const itemMinX = item.position[0] - item.dimensions.length / 2;
        const itemMaxX = item.position[0] + item.dimensions.length / 2;
        const itemMinZ = item.position[2] - item.dimensions.width / 2;
        const itemMaxZ = item.position[2] + item.dimensions.width / 2;
        if (!layers.has(roundedTop)) {
            layers.set(roundedTop, [{ minX: itemMinX, maxX: itemMaxX, minZ: itemMinZ, maxZ: itemMaxZ }]);
        }
        else {
            const segments = layers.get(roundedTop);
            let merged = false;
            // Try to merge with existing segments if they overlap or touch
            for (const segment of segments) {
                // Check for overlap/touch in X and Z
                const xOverlap = (itemMinX <= segment.maxX + 1) && (itemMaxX >= segment.minX - 1);
                const zOverlap = (itemMinZ <= segment.maxZ + 1) && (itemMaxZ >= segment.minZ - 1);
                if (xOverlap && zOverlap) {
                    segment.minX = Math.min(segment.minX, itemMinX);
                    segment.maxX = Math.max(segment.maxX, itemMaxX);
                    segment.minZ = Math.min(segment.minZ, itemMinZ);
                    segment.maxZ = Math.max(segment.maxZ, itemMaxZ);
                    merged = true;
                    break;
                }
            }
            if (!merged) {
                segments.push({ minX: itemMinX, maxX: itemMaxX, minZ: itemMinZ, maxZ: itemMaxZ });
            }
        }
    });
    const shelves = [];
    // 1. Horizontal Ground Shelf (The space AFTER the last item)
    if (absoluteMaxX < containerDims.length - marginL - constants_1.GROUND_SHELF_TOLERANCE_MM) {
        shelves.push({
            startX: absoluteMaxX,
            endX: containerDims.length - marginL,
            y: marginH, // Start at ground (plus margin)
            width: containerDims.width - marginW * 2,
            type: 'ground_horizontal'
        });
    }
    // 2. Vertical Shelves (Peak & Gaps)
    const sortedLayers = Array.from(layers.entries()).sort((a, b) => b[0] - a[0]); // Descending Height
    // 3. Side Strip Detection (Z-axis gap)
    // Find the maximum Z used by any item in the load
    let maxZ = 0;
    load.items.forEach(item => {
        const front = item.position[2] + item.dimensions.width / 2;
        if (front > maxZ)
            maxZ = front;
    });
    if (load.items.length === 0)
        maxZ = marginW;
    const remainingWidth = containerDims.width - marginW - maxZ;
    const minUsableWidth = constants_1.MIN_USABLE_STRIP_WIDTH_MM;
    if (remainingWidth > minUsableWidth) {
        shelves.push({
            startX: marginL,
            endX: containerDims.length - marginL,
            y: marginH,
            z: maxZ, // Start after the existing load
            width: remainingWidth,
            type: 'side_strip'
        });
    }
    if (sortedLayers.length > 0) {
        // Process highest layer (Peak)
        const [peakY, peakSegments] = sortedLayers[0];
        for (const segment of peakSegments) {
            shelves.push({
                startX: marginL, // Or segment.minX? Sticking to marginL for now as stacks usually start there
                endX: segment.maxX,
                y: peakY,
                z: segment.minZ,
                width: segment.maxZ - segment.minZ,
                type: 'peak'
            });
        }
        // Process second highest layer (Gap)
        if (sortedLayers.length > 1) {
            const [lowerY, lowerSegments] = sortedLayers[1];
            // For each lower segment, check if it extends beyond ANY peak segment
            for (const lowerSeg of lowerSegments) {
                // Find if this lower segment is "covered" by any peak segment
                // Simplified: Just check if it extends further in X than the peak segments in roughly same Z range
                // Find matching peak segments (overlapping in Z)
                const coveringPeaks = peakSegments.filter(p => (p.minZ <= lowerSeg.maxZ) && (p.maxZ >= lowerSeg.minZ));
                if (coveringPeaks.length === 0) {
                    // Not covered at all -> Full gap shelf
                    shelves.push({
                        startX: marginL,
                        endX: lowerSeg.maxX,
                        y: lowerY,
                        z: lowerSeg.minZ,
                        width: lowerSeg.maxZ - lowerSeg.minZ,
                        type: 'gap'
                    });
                }
                else {
                    // Partially covered? 
                    // For simplicity, if it extends significantly further in X, create a gap shelf starting from max peak X
                    const maxPeakX = Math.max(...coveringPeaks.map(p => p.maxX));
                    if (maxPeakX < lowerSeg.maxX) {
                        shelves.push({
                            startX: maxPeakX,
                            endX: lowerSeg.maxX,
                            y: lowerY,
                            z: lowerSeg.minZ,
                            width: lowerSeg.maxZ - lowerSeg.minZ,
                            type: 'gap'
                        });
                    }
                }
            }
        }
    }
    return shelves;
};
// Helper to pack a single material into a container (or remaining space)
const packMaterial = (boxInput, container, pallet, quantity, layerConfig, materialId, startOffset = 0, // Offset in Length (x-axis)
existingLoad = null, // If appending to an existing load
margins = { length: 20, width: 20, height: 20 }, maxSt = false, baseY = 0, // Starting Y position (for stacking on top of other materials)
baseZ = 0, // Starting Z position (for side strips)
allowNewContainers = true // Whether to create new containers if overflow
) => {
    var _a, _b, _c;
    // 1. Enforce State Immutability (Deep Clone)
    const box = (0, utils_1.deepClone)(boxInput);
    // 1. Validate inputs
    if (box.dimensions.length <= 0 || box.dimensions.width <= 0 || box.dimensions.height <= 0 ||
        container.dimensions.length <= 0 || container.dimensions.width <= 0 || container.dimensions.height <= 0 ||
        (pallet.usePallet && (pallet.dimensions.length <= 0 || pallet.dimensions.width <= 0 || pallet.maxLoadHeight <= 0))) {
        return {
            loads: [],
            totalItems: 0,
            totalContainers: 0,
            unpackedItems: quantity,
            errors: []
        };
    }
    const marginL = (_a = margins.length) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_MARGIN_MM;
    const marginW = (_b = margins.width) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_MARGIN_MM;
    const marginH = (_c = margins.height) !== null && _c !== void 0 ? _c : constants_1.DEFAULT_MARGIN_MM;
    const contW = container.dimensions.width - marginW * 2 - baseZ;
    const contH = container.dimensions.height - marginH * 2 - baseY;
    const effectiveContainerLength = (container.dimensions.length - marginL * 2) - startOffset;
    if (effectiveContainerLength <= 0) {
        return {
            loads: [],
            totalItems: 0,
            totalContainers: 0,
            unpackedItems: quantity,
            errors: []
        };
    }
    // 2. Determine the unit to pack (Box or Loaded Pallet)
    let bestResult = null;
    let maxItemsPacked = -1;
    let bestUsedVolume = -1;
    const errors = [];
    const orientations = [];
    // Generate all 6 permutations
    const allPermutations = [
        { length: box.dimensions.length, width: box.dimensions.width, height: box.dimensions.height },
        { length: box.dimensions.length, width: box.dimensions.height, height: box.dimensions.width },
        { length: box.dimensions.width, width: box.dimensions.length, height: box.dimensions.height },
        { length: box.dimensions.width, width: box.dimensions.height, height: box.dimensions.length },
        { length: box.dimensions.height, width: box.dimensions.length, height: box.dimensions.width },
        { length: box.dimensions.height, width: box.dimensions.width, height: box.dimensions.length }
    ];
    // Count how many rotations are selected
    const rotationCount = (box.allowedRotations.x ? 1 : 0) + (box.allowedRotations.y ? 1 : 0) + (box.allowedRotations.z ? 1 : 0);
    const allowAll = rotationCount === 0;
    // Add permutations based on selected rotations (or all if none selected)
    // y (Horizontal): Height = Original Height (indices 0, 2)
    if (allowAll || box.allowedRotations.y) {
        orientations.push({ dims: allPermutations[0], type: 'y' });
        orientations.push({ dims: allPermutations[2], type: 'y' });
    }
    // x (Vertical): Height = Original Length (indices 3, 5)
    if (allowAll || box.allowedRotations.x) {
        orientations.push({ dims: allPermutations[3], type: 'x' });
        orientations.push({ dims: allPermutations[5], type: 'x' });
    }
    // z (Flat): Height = Original Width (indices 1, 4)
    if (allowAll || box.allowedRotations.z) {
        orientations.push({ dims: allPermutations[1], type: 'z' });
        orientations.push({ dims: allPermutations[4], type: 'z' });
    }
    if (orientations.length === 0) {
        orientations.push({ dims: { length: box.dimensions.length, width: box.dimensions.width, height: box.dimensions.height }, type: 'y' });
    }
    // RESTORED ORIGINAL ORIENTATION LOGIC
    for (const orientation of orientations) {
        const currentBoxDims = orientation.dims;
        let unitDimensions;
        let unitType;
        let itemsPerUnit = 1;
        if (pallet.usePallet) {
            unitType = 'pallet';
            let cols;
            let rows;
            let layers;
            const parsedConfig = (0, utils_1.parseLayerConfig)(layerConfig);
            if (parsedConfig) {
                const { horizontal, vertical } = parsedConfig;
                // FIX: Validate items per layer
                const maxPhysicalItemsPerLayer = Math.floor(pallet.dimensions.length / currentBoxDims.length) * Math.floor(pallet.dimensions.width / currentBoxDims.width);
                if (horizontal > maxPhysicalItemsPerLayer) {
                    errors.push(`Mat ${materialId}: Layer config items (${horizontal}) exceeds physical limit (${maxPhysicalItemsPerLayer}). Clamped.`);
                    cols = maxPhysicalItemsPerLayer;
                }
                else {
                    cols = horizontal;
                }
                rows = 1;
                // FIX: Validate vertical layers
                const palletBaseHeight = constants_1.PALLET_BASE_HEIGHT_MM;
                const availableHeight = pallet.maxLoadHeight - palletBaseHeight;
                const maxPossibleLayers = Math.floor(availableHeight / currentBoxDims.height);
                if (vertical > maxPossibleLayers) {
                    layers = maxPossibleLayers;
                }
                else {
                    layers = vertical;
                }
            }
            else {
                cols = Math.floor(pallet.dimensions.length / currentBoxDims.length);
                rows = Math.floor(pallet.dimensions.width / currentBoxDims.width);
                const palletBaseHeight = constants_1.PALLET_BASE_HEIGHT_MM;
                const availableHeight = pallet.maxLoadHeight - palletBaseHeight;
                layers = Math.floor(availableHeight / currentBoxDims.height);
            }
            const palletBaseHeight = constants_1.PALLET_BASE_HEIGHT_MM;
            const actualUnitHeight = palletBaseHeight + (layers * currentBoxDims.height);
            const effectiveUnitHeight = actualUnitHeight;
            if (cols > 0 && rows > 0 && layers > 0) {
                itemsPerUnit = cols * rows * layers; // Single pallet items
                unitDimensions = {
                    length: pallet.dimensions.length,
                    width: pallet.dimensions.width,
                    height: effectiveUnitHeight
                };
            }
            else {
                continue;
            }
        }
        else {
            unitType = 'box';
            const parsedConfig = (0, utils_1.parseLayerConfig)(layerConfig);
            if (parsedConfig) {
                const { horizontal, vertical } = parsedConfig;
                // Calculate max possible items in this orientation
                const maxHorizontal = Math.floor(contW / currentBoxDims.width);
                const maxVertical = Math.floor(contH / currentBoxDims.height);
                let finalHorizontal = horizontal;
                let finalVertical = vertical;
                let clamped = false;
                if (horizontal > maxHorizontal) {
                    finalHorizontal = maxHorizontal;
                    clamped = true;
                }
                if (vertical > maxVertical) {
                    finalVertical = maxVertical;
                    clamped = true;
                }
                if (clamped) {
                    errors.push(`Mat ${materialId}: Layer config ${horizontal}x${vertical} exceeds container. Clamped to ${finalHorizontal}x${finalVertical}.`);
                }
                // Ensure at least 1x1 if possible, otherwise 0
                finalHorizontal = Math.max(1, finalHorizontal);
                finalVertical = Math.max(1, finalVertical);
                const stackWidth = finalHorizontal * currentBoxDims.width;
                const stackHeight = finalVertical * currentBoxDims.height;
                unitDimensions = { length: currentBoxDims.length, width: stackWidth, height: stackHeight };
                itemsPerUnit = finalHorizontal * finalVertical;
            }
            else {
                unitDimensions = currentBoxDims;
                itemsPerUnit = 1;
            }
        }
        // 3. Calculate grid
        const contL = effectiveContainerLength;
        const unitL = unitDimensions.length;
        const unitW = unitDimensions.width;
        const unitH = unitDimensions.height;
        if (unitL > contL || unitW > contW || unitH > contH)
            continue;
        const countL = Math.floor(contL / unitL);
        const countW = Math.floor(contW / unitW);
        let countH = Math.floor(contH / unitH);
        // FIX: Pallet Stacking Logic
        if (pallet.usePallet) {
            if (pallet.stackPallets) {
                countH = Math.min(countH, constants_1.MAX_PALLET_STACK_HEIGHT); // allow double stacking
            }
            else {
                countH = 1;
            }
        }
        if (!layerConfig && pallet.usePallet && pallet.stackPallets) {
            countH = Math.min(countH, constants_1.MAX_PALLET_STACK_HEIGHT);
        }
        // FIX: If strict layer config is used for non-pallet, do not stack units vertically
        if (!pallet.usePallet && layerConfig && layerConfig.toLowerCase().includes('x')) {
            countH = 1;
        }
        const maxUnitsPerContainer = countL * countW * countH;
        if (maxUnitsPerContainer === 0)
            continue;
        // 4. Distribute units
        const totalUnitsNeeded = Math.ceil(quantity / itemsPerUnit);
        const loads = [];
        let remainingUnits = totalUnitsNeeded;
        let remainingItemsTotal = quantity;
        let loadId = existingLoad ? existingLoad.id : 1;
        let totalItemsInScenario = 0;
        let totalActualUsedVolume = 0;
        // Handle Existing Load
        if (existingLoad) {
            const unitsInThisLoad = Math.min(remainingUnits, maxUnitsPerContainer);
            const placements = [];
            let unitsPlaced = 0;
            for (let x = 0; x < countL; x++) { // Back-to-front (length)
                for (let y = 0; y < countH; y++) { // Stack up (height)
                    for (let z = 0; z < countW; z++) { // Fill across width
                        if (unitsPlaced >= unitsInThisLoad)
                            break;
                        placements.push({
                            position: [
                                (x * unitL + unitL / 2) + startOffset + marginL,
                                y * unitH + unitH / 2 + marginH + baseY,
                                z * unitW + unitW / 2 + marginW + baseZ
                            ],
                            rotation: [0, 0, 0],
                            dimensions: unitDimensions,
                            type: unitType,
                            itemCount: Math.min(itemsPerUnit, remainingItemsTotal),
                            materialId: materialId
                        });
                        remainingItemsTotal -= Math.min(itemsPerUnit, remainingItemsTotal);
                        unitsPlaced++;
                        remainingUnits--;
                    }
                    if (unitsPlaced >= unitsInThisLoad) {
                        break;
                    }
                }
                if (unitsPlaced >= unitsInThisLoad)
                    break;
            }
            const itemsInThisLoad = placements.reduce((sum, item) => sum + (item.itemCount || 0), 0);
            const totalItemsInLoad = existingLoad.itemCount + itemsInThisLoad;
            // Recalculate utilization
            // Recalculate utilization
            const currentLoadVol = [...existingLoad.items, ...placements].reduce((sum, item) => sum + (item.dimensions.length * item.dimensions.width * item.dimensions.height), 0);
            const containerVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
            const newUtilization = (currentLoadVol / containerVol) * 100;
            const updatedLoad = Object.assign(Object.assign({}, existingLoad), { items: [...existingLoad.items, ...placements], itemCount: totalItemsInLoad, utilization: newUtilization });
            loads.push(updatedLoad);
            totalItemsInScenario += itemsInThisLoad;
            const boxVolume = box.dimensions.length * box.dimensions.width * box.dimensions.height;
            totalActualUsedVolume += itemsInThisLoad * boxVolume;
            loadId++;
        }
        // Handle New Containers
        while (allowNewContainers && remainingUnits > 0) {
            const fullContL = container.dimensions.length - marginL * 2; // Fix: Subtract margins
            const fullContW = container.dimensions.width - marginW * 2;
            const fullContH = container.dimensions.height - marginH * 2;
            const fullCountL = Math.floor(fullContL / unitL);
            const fullCountW = Math.floor(fullContW / unitW);
            let fullCountH = Math.floor(fullContH / unitH);
            // Apply stacking logic to fullCountH
            if (pallet.usePallet) {
                if (pallet.stackPallets) {
                    fullCountH = Math.min(fullCountH, 2);
                }
                else {
                    fullCountH = 1;
                }
            }
            if (!layerConfig && pallet.usePallet && pallet.stackPallets) {
                fullCountH = Math.min(fullCountH, 2);
            }
            if (!pallet.usePallet && layerConfig && layerConfig.toLowerCase().includes('x')) {
                fullCountH = 1;
            }
            const fullMaxUnits = fullCountL * fullCountW * fullCountH;
            const unitsInThisLoad = Math.min(remainingUnits, fullMaxUnits);
            const isFull = unitsInThisLoad === fullMaxUnits;
            const placements = [];
            let unitsPlaced = 0;
            for (let x = 0; x < fullCountL; x++) { // Back-to-front (length)
                for (let y = 0; y < fullCountH; y++) { // Stack up (height)
                    for (let z = 0; z < fullCountW; z++) { // Fill across width
                        if (unitsPlaced >= unitsInThisLoad)
                            break;
                        placements.push({
                            position: [
                                x * unitL + unitL / 2 + marginL,
                                y * unitH + unitH / 2 + marginH, // Fixed: Force 0 baseY for new containers
                                z * unitW + unitW / 2 + marginW
                            ],
                            rotation: [0, 0, 0],
                            dimensions: unitDimensions,
                            type: unitType,
                            itemCount: Math.min(itemsPerUnit, remainingItemsTotal),
                            materialId: materialId,
                            grid: {
                                cols: unitType === 'box' && layerConfig && layerConfig.includes('x') ? (itemsPerUnit > 1 ? Math.floor(unitDimensions.width / currentBoxDims.width) : 1) : (unitType === 'pallet' ? Math.floor(unitDimensions.width / currentBoxDims.width) : 1),
                                rows: unitType === 'pallet' ? Math.floor(unitDimensions.length / currentBoxDims.length) : 1,
                                layers: unitType === 'box' && layerConfig && layerConfig.includes('x') ? (itemsPerUnit > 1 ? Math.floor(unitDimensions.height / currentBoxDims.height) : 1) : (unitType === 'pallet' ? Math.floor((unitDimensions.height - constants_1.PALLET_BASE_HEIGHT_MM) / currentBoxDims.height) : 1)
                            }
                        });
                        remainingItemsTotal -= Math.min(itemsPerUnit, remainingItemsTotal);
                        unitsPlaced++;
                        remainingUnits--;
                    }
                    if (unitsPlaced >= unitsInThisLoad)
                        break;
                }
                if (unitsPlaced >= unitsInThisLoad)
                    break;
            }
            const itemsInThisLoad = placements.reduce((sum, item) => sum + (item.itemCount || 0), 0);
            const actualLoadVolume = placements.reduce((sum, item) => sum + (item.dimensions.length * item.dimensions.width * item.dimensions.height), 0);
            const containerVolume = container.dimensions.length * container.dimensions.width * container.dimensions.height;
            const utilization = (actualLoadVolume / containerVolume) * 100;
            loads.push({
                id: loadId++,
                items: placements,
                utilization,
                itemCount: itemsInThisLoad,
                type: isFull ? 'full' : 'partial'
            });
            totalItemsInScenario += itemsInThisLoad;
            totalActualUsedVolume += actualLoadVolume;
        }
        if (totalItemsInScenario > maxItemsPacked ||
            (totalItemsInScenario === maxItemsPacked && totalActualUsedVolume > bestUsedVolume)) {
            maxItemsPacked = totalItemsInScenario;
            bestUsedVolume = totalActualUsedVolume;
            bestResult = {
                loads,
                totalItems: totalItemsInScenario,
                totalContainers: loads.length,
                unpackedItems: quantity - totalItemsInScenario,
                packedBoxDimensions: currentBoxDims,
                errors: errors.length > 0 ? errors : [],
                actualUsedVolume: totalActualUsedVolume
            };
        }
    }
    // 5. Post-Optimization MaxSt Consolidation Pass (Simplified)
    if (maxSt && bestResult && bestResult.loads.length > 0) {
        // Determine flat orientation (smallest height)
        const sorted = [box.dimensions.length, box.dimensions.width, box.dimensions.height].sort((a, b) => a - b);
        const flatDims = {
            length: sorted[1],
            width: sorted[2],
            height: sorted[0]
        };
        for (let i = 0; i < bestResult.loads.length; i++) {
            const load = bestResult.loads[i];
            // Find current max height in this load
            let maxY = 0;
            load.items.forEach(item => {
                const itemTop = item.position[1] + item.dimensions.height / 2;
                if (itemTop > maxY)
                    maxY = itemTop;
            });
            if (load.items.length === 0)
                maxY = marginH;
            const availableHeadroom = container.dimensions.height - marginH - maxY;
            if (availableHeadroom <= 0)
                continue;
            if (flatDims.height > availableHeadroom)
                continue;
            // Simple grid for top-off
            const availL = container.dimensions.length - marginL * 2;
            const availW = container.dimensions.width - marginW * 2;
            const countL = Math.floor(availL / flatDims.length);
            const countW = Math.floor(availW / flatDims.width);
            const countH = Math.floor(availableHeadroom / flatDims.height);
            const maxFlat = countL * countW * countH;
            if (maxFlat > 0) {
                // Determine how many items we can add
                // Source 1: Unpacked Items
                let itemsFromUnpacked = Math.min(bestResult.unpackedItems, maxFlat);
                let itemsFromOverflow = 0;
                // Source 2: Overflow from subsequent loads (Consolidation)
                // Only if we still have space after taking unpacked items and this is not the last load
                const isLastLoad = i === bestResult.loads.length - 1;
                if (itemsFromUnpacked < maxFlat && !isLastLoad) {
                    const remainingSpace = maxFlat - itemsFromUnpacked;
                    const lastLoad = bestResult.loads[bestResult.loads.length - 1];
                    const candidateItems = lastLoad.items.filter(item => item.materialId === materialId);
                    const candidateCount = candidateItems.reduce((sum, item) => sum + (item.itemCount || 1), 0);
                    itemsFromOverflow = Math.min(remainingSpace, candidateCount);
                }
                const totalToAdd = itemsFromUnpacked + itemsFromOverflow;
                let added = 0;
                if (totalToAdd > 0) {
                    for (let y = 0; y < countH; y++) {
                        for (let x = 0; x < countL; x++) {
                            for (let z = 0; z < countW; z++) {
                                if (added >= totalToAdd)
                                    break;
                                load.items.push({
                                    position: [
                                        marginL + x * flatDims.length + flatDims.length / 2,
                                        maxY + y * flatDims.height + flatDims.height / 2,
                                        marginW + z * flatDims.width + flatDims.width / 2
                                    ],
                                    rotation: [0, 0, 0],
                                    dimensions: flatDims,
                                    type: 'box',
                                    itemCount: 1,
                                    materialId: materialId,
                                    isFlatTopOff: true
                                });
                                added++;
                            }
                            if (added >= totalToAdd)
                                break;
                        }
                        if (added >= totalToAdd)
                            break;
                    }
                    // Update Accounting
                    if (itemsFromUnpacked > 0) {
                        const usedUnpacked = Math.min(added, itemsFromUnpacked);
                        bestResult.unpackedItems -= usedUnpacked;
                        bestResult.totalItems += usedUnpacked;
                        added -= usedUnpacked; // Remaining 'added' must be from overflow
                    }
                    if (added > 0) {
                        // Remove from last load
                        let removed = 0;
                        const lastLoad = bestResult.loads[bestResult.loads.length - 1];
                        for (let k = lastLoad.items.length - 1; k >= 0; k--) {
                            if (removed >= added)
                                break;
                            const item = lastLoad.items[k];
                            if (item.materialId === materialId) {
                                const count = item.itemCount || 1;
                                const toRemove = Math.min(count, added - removed);
                                if (toRemove === count) {
                                    lastLoad.items.splice(k, 1);
                                }
                                else {
                                    item.itemCount = count - toRemove;
                                }
                                removed += toRemove;
                            }
                        }
                        // Recalculate last load stats
                        lastLoad.itemCount = lastLoad.items.reduce((sum, item) => sum + (item.itemCount || 0), 0);
                        if (lastLoad.items.length === 0) {
                            bestResult.loads.pop();
                            bestResult.totalContainers--;
                        }
                        else {
                            const lastLoadVol = lastLoad.items.reduce((sum, item) => sum + (item.itemCount || 1) * (item.dimensions.length * item.dimensions.width * item.dimensions.height), 0);
                            const containerVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
                            lastLoad.utilization = (lastLoadVol / containerVol) * 100;
                        }
                    }
                    // Recalculate current load utilization
                    const currentLoadVol = load.items.reduce((sum, item) => sum + (item.itemCount || 1) * (item.dimensions.length * item.dimensions.width * item.dimensions.height), 0);
                    const containerVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
                    load.utilization = (currentLoadVol / containerVol) * 100;
                    load.itemCount = load.items.reduce((sum, item) => sum + (item.itemCount || 0), 0);
                    // Update global volume
                    const addedVolume = totalToAdd * flatDims.length * flatDims.width * flatDims.height;
                    bestResult.actualUsedVolume = (bestResult.actualUsedVolume || 0) + addedVolume;
                }
            }
        }
    }
    if (!bestResult || bestResult.totalItems === 0) {
        // Provide meaningful error when pallet mode is used but box doesn't fit
        const errorMessages = [];
        if (pallet.usePallet) {
            const boxDims = [box.dimensions.length, box.dimensions.width, box.dimensions.height];
            const minPalletDim = Math.min(pallet.dimensions.length, pallet.dimensions.width);
            const minBoxDim = Math.min(...boxDims);
            if (minBoxDim > minPalletDim) {
                errorMessages.push(`Mat ${materialId}: Box dimensions (${box.dimensions.length}x${box.dimensions.width}x${box.dimensions.height}) exceed pallet size (${pallet.dimensions.length}x${pallet.dimensions.width}) in all orientations.`);
            }
            else {
                errorMessages.push(`Mat ${materialId}: Box does not fit on pallet with current configuration.`);
            }
        }
        return {
            loads: [],
            totalItems: 0,
            totalContainers: 0,
            unpackedItems: quantity,
            errors: errorMessages
        };
    }
    return bestResult;
};
const calculatePacking = (container, materials, isCombined = false, margins = { length: 20, width: 20, height: 20 }) => {
    const activeMaterials = (0, utils_1.deepClone)(materials.filter((m) => m.active && m.quantity > 0));
    if (activeMaterials.length === 0) {
        return {
            totalItems: 0,
            totalContainers: 0,
            loads: [],
            containerDimensions: container.dimensions,
            unpackedItems: 0,
            errors: []
        };
    }
    const calculateStats = (res) => {
        let totalPallets = 0;
        let totalLots = 0;
        res.loads.forEach((load) => {
            const uniqueBasePositions = new Set();
            load.items.forEach((item) => {
                var _a;
                if (item.type === 'pallet') {
                    totalPallets++;
                }
                const mat = activeMaterials.find((m) => m.id === item.materialId);
                const hasStrictConfig = mat && mat.layerConfig && mat.layerConfig.trim();
                if (hasStrictConfig && item.type === 'pallet' && ((_a = item.position) === null || _a === void 0 ? void 0 : _a.length) === 3) {
                    const x = Math.round(item.position[0]);
                    const z = Math.round(item.position[2]);
                    const centerY = item.position[1];
                    const expectedBaseY = item.dimensions.height / 2;
                    const diff = Math.abs(centerY - expectedBaseY);
                    if (diff < constants_1.PALLET_POSITION_TOLERANCE_MM) {
                        const key = `${x}_${z}`;
                        uniqueBasePositions.add(key);
                    }
                }
            });
            totalLots += uniqueBasePositions.size;
        });
        return Object.assign(Object.assign({}, res), { totalPallets, totalLots });
    };
    const runSequence = (sequence) => {
        var _a, _b, _c;
        let loads = [];
        let totalItems = 0;
        let unpackedItems = 0;
        let errors = [];
        let totalActualUsedVolume = 0;
        let packedBoxDimensions;
        for (let i = 0; i < sequence.length; i++) {
            const mat = sequence[i];
            // Combined packing: try to fit into existing containers using shelf-based packing
            // Materials with layer config will use ground_horizontal shelves (floor space)
            // and follow their own stacking logic from there
            if (isCombined && loads.length > 0) {
                let packedInExisting = false;
                // Iterate through ALL existing loads to find space (Retrospective Packing)
                for (let loadIndex = 0; loadIndex < loads.length; loadIndex++) {
                    let currentLoad = loads[loadIndex];
                    // --- STRATEGY 1: SHELF PACKING ---
                    const shelves = findAvailableShelves(currentLoad, container.dimensions, margins);
                    // FIX 2: Sort Shelves Priority (Ground Horizontal > Side Strip > Gap > Peak)
                    shelves.sort((a, b) => {
                        const typePriority = { ground_horizontal: 0, side_strip: 0, gap: 1, peak: 2 };
                        const pA = typePriority[a.type];
                        const pB = typePriority[b.type];
                        if (pA !== pB)
                            return pA - pB;
                        // If same priority, prefer lower Y, then lower Z
                        if (a.y !== b.y)
                            return a.y - b.y;
                        return (a.z || 0) - (b.z || 0);
                    });
                    for (const shelf of shelves) {
                        const minDim = Math.min(mat.box.dimensions.length, mat.box.dimensions.width);
                        // For horizontal ground, we need enough length
                        if ((shelf.endX - shelf.startX) < minDim) {
                            continue;
                        }
                        // FIX: Clone box to prevent mutation bleed
                        const boxToPack = (0, utils_1.deepClone)(mat.box);
                        const res = packMaterial(boxToPack, container, mat.pallet, mat.quantity, mat.layerConfig, mat.id, shelf.startX, currentLoad, margins, mat.maxSt, shelf.y, shelf.z || 0, false // Do NOT create new containers here
                        );
                        if (res.loads.length > 0 && res.loads[0].items.length > currentLoad.items.length) {
                            // Update the specific load
                            loads[loadIndex] = res.loads[0];
                            // FIX: Update currentLoad reference
                            currentLoad = loads[loadIndex];
                            // If packMaterial created NEW loads (overflow), append them
                            if (res.loads.length > 1) {
                                loads = [...loads, ...res.loads.slice(1)];
                            }
                            totalItems += res.totalItems;
                            unpackedItems += res.unpackedItems;
                            totalActualUsedVolume += (res.actualUsedVolume || 0);
                            errors = [...errors, ...res.errors];
                            if (i === 0)
                                packedBoxDimensions = res.packedBoxDimensions;
                            packedInExisting = true;
                            // Update remaining quantity for next iteration/material
                            mat.quantity = res.unpackedItems;
                            // If we fully packed this material, break out of shelf loop and load loop
                            if (mat.quantity <= 0)
                                break;
                        }
                    }
                    if (mat.quantity <= 0)
                        break;
                }
                // --- STRATEGY 2: NEW CONTAINER (Fallback) ---
                if (mat.quantity > 0) {
                    // FIX: Clone box to prevent mutation bleed
                    const boxToPack = (0, utils_1.deepClone)(mat.box);
                    const res = packMaterial(boxToPack, container, mat.pallet, mat.quantity, mat.layerConfig, mat.id, 0, null, margins, mat.maxSt, 0);
                    loads = [...loads, ...res.loads];
                    totalItems += res.totalItems;
                    unpackedItems += res.unpackedItems;
                    totalActualUsedVolume += (res.actualUsedVolume || 0);
                    errors = [...errors, ...res.errors];
                    if (i === 0)
                        packedBoxDimensions = res.packedBoxDimensions;
                    // Update remaining quantity for post-processing
                    mat.quantity = res.unpackedItems;
                }
            }
            else {
                // FIX: Clone box to prevent mutation bleed
                const boxToPack = (0, utils_1.deepClone)(mat.box);
                const res = packMaterial(boxToPack, container, mat.pallet, mat.quantity, mat.layerConfig, mat.id, 0, null, margins, mat.maxSt, 0);
                loads = [...loads, ...res.loads];
                totalItems += res.totalItems;
                unpackedItems += res.unpackedItems;
                totalActualUsedVolume += (res.actualUsedVolume || 0);
                errors = [...errors, ...res.errors];
                if (i === 0)
                    packedBoxDimensions = res.packedBoxDimensions;
                // Update remaining quantity for post-processing
                mat.quantity = res.unpackedItems;
            }
        }
        // === MAXST POST-PROCESSING PASS ===
        const marginL = (_a = margins.length) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_MARGIN_MM;
        const marginW = (_b = margins.width) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_MARGIN_MM;
        const marginH = (_c = margins.height) !== null && _c !== void 0 ? _c : constants_1.DEFAULT_MARGIN_MM;
        for (const load of loads) {
            for (const mat of activeMaterials) {
                if (!mat.maxSt || mat.quantity <= 0)
                    continue;
                // Find current max height in this load
                let maxY = 0;
                load.items.forEach(item => {
                    const itemTop = item.position[1] + item.dimensions.height / 2;
                    if (itemTop > maxY)
                        maxY = itemTop;
                });
                if (load.items.length === 0)
                    maxY = marginH;
                const availableHeadroom = container.dimensions.height - marginH - maxY;
                if (availableHeadroom <= 0)
                    continue;
                // Force flat orientation: smallest dim as height
                const sorted = [mat.box.dimensions.length, mat.box.dimensions.width, mat.box.dimensions.height].sort((a, b) => a - b);
                const flatHeight = sorted[0];
                // Option A: longest side along length
                const optA = { length: sorted[2], width: sorted[1], height: flatHeight };
                // Option B: middle side along length
                const optB = { length: sorted[1], width: sorted[2], height: flatHeight };
                // Pick best
                const availL = container.dimensions.length - marginL * 2;
                const availW = container.dimensions.width - marginW * 2;
                const countLA = Math.floor(availL / optA.length);
                const countWA = Math.floor(availW / optA.width);
                const totalA = countLA * countWA * Math.floor(availableHeadroom / flatHeight);
                const countLB = Math.floor(availL / optB.length);
                const countWB = Math.floor(availW / optB.width);
                const totalB = countLB * countWB * Math.floor(availableHeadroom / flatHeight);
                // Pick best orientation
                const useOptB = totalB > totalA;
                const flatDims = useOptB ? optB : optA;
                const countL = useOptB ? countLB : countLA;
                const countW = useOptB ? countWB : countWA;
                const countH = Math.floor(availableHeadroom / flatDims.height);
                const maxFlat = countL * countW * countH;
                if (maxFlat > 0) {
                    const toAdd = Math.min(mat.quantity, maxFlat);
                    let added = 0;
                    for (let y = 0; y < countH; y++) {
                        for (let x = 0; x < countL; x++) {
                            for (let z = 0; z < countW; z++) {
                                if (added >= toAdd)
                                    break;
                                load.items.push({
                                    position: [
                                        marginL + x * flatDims.length + flatDims.length / 2,
                                        maxY + y * flatDims.height + flatDims.height / 2,
                                        marginW + z * flatDims.width + flatDims.width / 2
                                    ],
                                    rotation: [0, 0, 0],
                                    dimensions: flatDims,
                                    type: 'box',
                                    itemCount: 1,
                                    materialId: mat.id,
                                    isFlatTopOff: true
                                });
                                added++;
                                mat.quantity--;
                            }
                            if (added >= toAdd)
                                break;
                        }
                        if (added >= toAdd)
                            break;
                    }
                    if (added > 0) {
                        totalItems += added;
                        unpackedItems -= added;
                        const addedVolume = added * flatDims.length * flatDims.width * flatDims.height;
                        totalActualUsedVolume += addedVolume;
                        // Update utilization
                        const currentLoadVol = load.items.reduce((sum, item) => sum + (item.itemCount || 1) * (item.dimensions.length * item.dimensions.width * item.dimensions.height), 0);
                        const containerVol = container.dimensions.length * container.dimensions.width * container.dimensions.height;
                        load.utilization = (currentLoadVol / containerVol) * 100;
                        load.itemCount = load.items.reduce((sum, item) => sum + (item.itemCount || 0), 0);
                    }
                }
            }
        }
        loads.forEach((l, i) => l.id = i + 1);
        return {
            totalItems,
            totalContainers: loads.length,
            loads,
            containerDimensions: container.dimensions,
            unpackedItems,
            packedBoxDimensions,
            errors,
            actualUsedVolume: totalActualUsedVolume
        };
    };
    return calculateStats(runSequence(activeMaterials));
};
exports.calculatePacking = calculatePacking;
