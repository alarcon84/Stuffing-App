import React, { useState, useCallback } from 'react';
import type { Box, Container, Pallet, Dimensions, Material, PackingMode } from '@stuffing-calc/core';
import { Settings, Box as BoxIcon, Container as ContainerIcon, Pencil, X, Layers, Calculator, Wand2, Plus, Trash2, Copy } from 'lucide-react';
import { calculatePacking } from '@stuffing-calc/core';

interface InputPanelProps {
    onCalculate: (
        container: Container,
        materials: Material[],
        packingMode: PackingMode,
        margins: { length: number; width: number; height: number },
        enableTopUp?: boolean,
        enableFullMix?: boolean,
        fullMixRotations?: { x: boolean; y: boolean; z: boolean }
    ) => void;
    optimizations?: import('@stuffing-calc/core').OptimizationResult[];
    onSettingsChange?: (settings: {
        container: Container;
        materials: Material[];
        packingMode: PackingMode;
        margins: { length: number; width: number; height: number };
        enableTopUp: boolean;
        enableFullMix: boolean;
        fullMixRotations: { x: boolean; y: boolean; z: boolean };
        activeMaterial?: Material;
    }) => void;
    pendingColorUpdate?: { id: number; color: string } | null;
}

const CONTAINER_TYPES: Container[] = [
    // --- Current inner / door-height accurate presets ---
    { name: "20ft", type: '20', dimensions: { length: 5865, width: 2330, height: 2200 }, doorHeight: 2200 },
    { name: "40ft", type: '40', dimensions: { length: 12000, width: 2330, height: 2200 }, doorHeight: 2200 },
    { name: "40HC", type: '40HC', dimensions: { length: 12000, width: 2330, height: 2540 }, doorHeight: 2540 },
    { name: "EU Trailer", type: 'eu-trailer', dimensions: { length: 13600, width: 2450, height: 2600 } },
    { name: "EU Mega", type: 'eu-mega', dimensions: { length: 13600, width: 2450, height: 2700 } },
    { name: "53ft", type: '53', dimensions: { length: 15955, width: 2560, height: 2820 } },
    { name: "11Ton WT", type: '11tonwt', dimensions: { length: 9100, width: 2380, height: 2325 } },
    // --- Legacy "Std" presets (old values preserved) ---
    { name: "20ft Std", type: 'custom', dimensions: { length: 5898, width: 2352, height: 2393 } },
    { name: "40ft Std", type: 'custom', dimensions: { length: 12032, width: 2352, height: 2393 } },
    { name: "40HC Std", type: 'custom', dimensions: { length: 12032, width: 2352, height: 2698 } },
    { name: "53ft Std", type: 'custom', dimensions: { length: 16000, width: 2540, height: 2700 } },
    // --- Fully custom ---
    { name: "Custom", type: 'custom', dimensions: { length: 12000, width: 2400, height: 2600 } },
];

// Inner heights for the sea containers that have a door height
const INNER_HEIGHTS: Record<string, number> = {
    '20ft': 2350,
    '40ft': 2350,
    '40HC': 2690,
};

const COLORS = [
    '#0ea5e9', // Sky Blue
    '#f43f5e', // Rose Coral
    '#14b8a6', // Deep Teal
    '#eab308', // Amber Gold
    '#8b5cf6', // Violet
    '#f97316', // Vibrant Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#ec4899', // Pink
    '#6366f1', // Indigo
];

export const PASTEL_PALETTE = [
    '#fb7185', '#f43f5e', '#e11d48', // Corals/Roses
    '#fb923c', '#f97316', '#ea580c', // Oranges
    '#fbbf24', '#f59e0b', '#d97706', // Ambers
    '#34d399', '#10b981', '#059669', // Emeralds
    '#2dd4bf', '#14b8a6', '#0d9488', // Teals
    '#38bdf8', '#0ea5e9', '#0284c7', // Sky Blues
    '#818cf8', '#6366f1', '#4f46e5', // Indigos
    '#a78bfa', '#8b5cf6', '#7c3aed', // Violets
    '#f472b6', '#ec4899', '#db2777', // Pinks
    '#9ca3af', '#6b7280', '#4b5563'  // Grays
];

export const InputPanel: React.FC<InputPanelProps> = ({ onCalculate, optimizations, onSettingsChange, pendingColorUpdate }) => {
    // --- State ---
    const [materials, setMaterials] = useState<Material[]>([
        {
            id: 1,
            active: true,
            quantity: 425,
            layerConfig: '',
            box: {
                id: 'box-1',
                materialId: 1,
                dimensions: { length: 1600, width: 175, height: 800 },
                color: '#fcd34d',
                allowedRotations: { x: false, y: true, z: false }
            },
            orientationPreference: 'default', // Default to face walls
            pallet: {
                dimensions: { length: 1600, width: 1050, height: 150 },
                maxLoadHeight: 2650,
                usePallet: false,
                stackPallets: false
            }
        }
    ]);

    const [activeTabId, setActiveTabId] = useState<number>(1);
    // PHASE 8 Step 3.5: Minimal Stub - packingMode replaces isCombined + enableFullMix
    const [packingMode, setPackingMode] = useState<PackingMode>('SEQUENTIAL');
    const [container, setContainer] = useState<Container>(CONTAINER_TYPES[5]); // Default 53ft
    // Door-height toggle: true = use door height (default for sea containers), false = use inner height
    const [useDoorHeight, setUseDoorHeight] = useState<boolean>(true);
    const [margins, setMargins] = useState<{ length: number; width: number; height: number }>({ length: 20, width: 20, height: 20 });
    const [addCount, setAddCount] = useState<number>(1);

    // Pipeline Pass Toggles
    const [enableTopUp, setEnableTopUp] = useState<boolean>(false);
    const [enableFullMix, setEnableFullMix] = useState<boolean>(false);
    const [fullMixRotations, setFullMixRotations] = useState({ x: true, y: true, z: true });

    // Editable container types for the modal
    const [editableContainers, setEditableContainers] = useState<Container[]>([...CONTAINER_TYPES]);
    const [showEditModal, setShowEditModal] = useState(false);

    // Optimization State
    interface OptimizationSuggestion {
        config: string;
        containers: number;
        utilization: number;
        itemsPerLayer: number;
        layers: number;
    }
    const [optimizationSuggestions, setOptimizationSuggestions] = useState<OptimizationSuggestion[]>([]);
    const [showOptimizationModal, setShowOptimizationModal] = useState(false);
    const [optimizingMaterialId, setOptimizingMaterialId] = useState<number | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [showMargins, setShowMargins] = useState(false);
    // const [showColorPicker, setShowColorPicker] = useState(false); // Moved to Visualizer

    // --- Helpers ---
    const activeMaterial = materials.find(m => m.id === activeTabId) || materials[0];

    // --- Handlers ---



    // --- Broadcast Settings Change ---
    React.useEffect(() => {
        if (onSettingsChange) {
            onSettingsChange({
                container,
                materials,
                packingMode,
                margins,
                enableTopUp,
                enableFullMix,
                fullMixRotations,
                activeMaterial
            });
        }
    }, [container, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations, activeMaterial, onSettingsChange]);

    const updateMaterial = (id: number, updates: Partial<Material>) => {
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const updateBox = (matId: number, updates: Partial<Box>) => {
        setMaterials(prev => prev.map(m => m.id === matId ? { ...m, box: { ...m.box, ...updates } } : m));
    };

    const updateBoxDims = (matId: number, key: keyof Dimensions, value: number) => {
        setMaterials(prev => prev.map(m => m.id === matId ? {
            ...m,
            box: { ...m.box, dimensions: { ...m.box.dimensions, [key]: value } }
        } : m));
    };

    // --- Sync Color from Visualizer ---
    React.useEffect(() => {
        if (pendingColorUpdate) {
            setMaterials(prev => prev.map(m => m.id === pendingColorUpdate.id ? {
                ...m,
                box: { ...m.box, color: pendingColorUpdate.color }
            } : m));
        }
    }, [pendingColorUpdate]);

    const updatePallet = (matId: number, updates: Partial<Pallet>) => {
        setMaterials(prev => prev.map(m => m.id === matId ? { ...m, pallet: { ...m.pallet, ...updates } } : m));
    };

    const updatePalletDims = (matId: number, key: keyof Dimensions, value: number) => {
        setMaterials(prev => prev.map(m => m.id === matId ? {
            ...m,
            pallet: { ...m.pallet, dimensions: { ...m.pallet.dimensions, [key]: value } }
        } : m));
    };

    const handleAddMaterial = () => {
        if (materials.length + addCount > 100) {
            alert("Maximum 100 materials allowed.");
            return;
        }

        const newMaterials: Material[] = [];
        let nextId = Math.max(...materials.map(m => m.id)) + 1;

        for (let i = 0; i < addCount; i++) {
            newMaterials.push({
                id: nextId,
                active: true,
                quantity: 425,
                layerConfig: '',
                box: {
                    id: `box-${nextId}`,
                    materialId: nextId,
                    dimensions: { length: 1600, width: 175, height: 750 },
                    color: COLORS[(nextId - 1) % COLORS.length],
                    allowedRotations: { x: false, y: true, z: false }
                },
                orientationPreference: 'default',
                pallet: {
                    dimensions: { length: 1200, width: 1000, height: 150 },
                    maxLoadHeight: container.dimensions.height - 50,
                    usePallet: false,
                    stackPallets: false
                }
            });
            nextId++;
        }

        setMaterials(prev => [...prev, ...newMaterials]);
        setActiveTabId(newMaterials[0].id);

        // Note: Combined Packing is now OFF by default - user must manually enable
    };

    const handleRemoveMaterial = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (materials.length <= 1) return;

        const newMaterials = materials.filter(m => m.id !== id);
        setMaterials(newMaterials);
        if (activeTabId === id) {
            setActiveTabId(newMaterials[0].id);
        }
    };

    const handleDuplicateMaterial = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (materials.length >= 100) return;

        const source = materials.find(m => m.id === id);
        if (!source) return;

        const nextId = Math.max(...materials.map(m => m.id)) + 1;
        const newMat: Material = {
            ...source,
            id: nextId,
            box: { ...source.box, id: `box-${nextId}`, materialId: nextId, color: COLORS[(nextId - 1) % COLORS.length] },
            pallet: { ...source.pallet }
        };

        setMaterials(prev => [...prev, newMat]);
        setActiveTabId(nextId);
    };

    // --- Auto-Recalculate ---
    // Build the container object with the currently active height (door vs inner)
    const effectiveContainer: Container = (container.doorHeight && !useDoorHeight && INNER_HEIGHTS[container.name])
        ? { ...container, dimensions: { ...container.dimensions, height: INNER_HEIGHTS[container.name] } }
        : container;

    const handleRecalculate = useCallback(() => {
        onCalculate(effectiveContainer, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations);
    }, [effectiveContainer, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations, onCalculate]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRecalculate();
        }
    };

    // --- Paste Handler ---
    const handlePaste = (
        e: React.ClipboardEvent<HTMLInputElement>,
        setLength: (val: number) => void,
        setWidth: (val: number) => void,
        setHeight?: (val: number) => void
    ) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        if (!text) return;
        const values = text.split(/[\t,\s]+/).filter(v => v.trim() !== '').map(Number);
        if (values.some(isNaN)) return;
        if (values.length >= 2) {
            setLength(values[0]);
            setWidth(values[1]);
            if (values.length >= 3 && setHeight) setHeight(values[2]);
        }
    };

    // --- Pallet Calculation ---
    const calculatePerfectPallet = (mat: Material) => {
        const config = mat.layerConfig;
        if (!config || !config.includes('x')) return;

        const parts = config.toLowerCase().split('x');
        const itemsPerLayer = parseInt(parts[0], 10);
        if (isNaN(itemsPerLayer) || itemsPerLayer <= 0) return;

        let boxL = mat.box.dimensions.length;
        let boxW = mat.box.dimensions.width;

        if (mat.box.allowedRotations.y) {
            // Horizontal default
        } else if (mat.box.allowedRotations.x) {
            boxL = mat.box.dimensions.height;
            boxW = mat.box.dimensions.width;
        } else if (mat.box.allowedRotations.z) {
            boxL = mat.box.dimensions.length;
            boxW = mat.box.dimensions.height;
        }

        let bestL = itemsPerLayer * boxL;
        let bestW = boxW;
        let bestRatio = Math.max(bestL, bestW) / Math.min(bestL, bestW);

        for (let r = 1; r <= itemsPerLayer; r++) {
            if (itemsPerLayer % r === 0) {
                const c = itemsPerLayer / r;
                const currentL = r * boxL;
                const currentW = c * boxW;
                const currentRatio = Math.max(currentL, currentW) / Math.min(currentL, currentW);

                if (currentRatio < bestRatio - 0.01) {
                    bestL = currentL;
                    bestW = currentW;
                    bestRatio = currentRatio;
                } else if (Math.abs(currentRatio - bestRatio) <= 0.01) {
                    if (currentW > bestW) {
                        bestL = currentL;
                        bestW = currentW;
                        bestRatio = currentRatio;
                    }
                }
            }
        }

        updatePallet(mat.id, {
            dimensions: { ...mat.pallet.dimensions, length: bestL, width: bestW },
            usePallet: true
        });
    };

    const isConfigValid = (config: string) => {
        if (!config || !config.includes('x')) return false;
        const parts = config.toLowerCase().split('x');
        return parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]));
    };

    // --- Optimization ---
    const handleOptimize = async (materialId: number) => {
        setIsOptimizing(true);
        setOptimizingMaterialId(materialId);
        setOptimizationSuggestions([]);
        await new Promise(resolve => setTimeout(resolve, 50));

        const mat = materials.find(m => m.id === materialId);
        if (!mat) return;

        const maxLoadHeight = mat.pallet.usePallet ? mat.pallet.maxLoadHeight : container.dimensions.height;
        const maxLayersNoPallet = 3;
        const candidates: { a: number, b: number }[] = [];

        for (let a = 2; a <= 20; a++) {
            for (let b = 1; b <= 8; b++) {
                const totalItems = a * b;
                if (totalItems < 6 || totalItems > 100) continue;
                const minDim = Math.min(mat.box.dimensions.length, mat.box.dimensions.width, mat.box.dimensions.height);
                if (b * minDim > maxLoadHeight) continue;
                if (!mat.pallet.usePallet && b > maxLayersNoPallet) continue;
                candidates.push({ a, b });
            }
        }

        const results: OptimizationSuggestion[] = [];
        // We need to simulate just this material for optimization
        // Create a temp materials array with just this one, or pass it as single
        // But calculatePacking expects full context. 
        // For optimization of CONFIG, we usually care about how *this* material packs.
        // So we can run calculatePacking with just this material.

        for (const cand of candidates) {
            const config = `${cand.a}x${cand.b}`;
            const tempMat = { ...mat, layerConfig: config };

            // Run calc for just this material to check efficiency
            const res = calculatePacking(container, [tempMat], false);

            if (res.totalContainers > 0) {
                const avgUtil = res.loads.reduce((sum, l) => sum + l.utilization, 0) / res.loads.length;
                results.push({
                    config,
                    containers: res.totalContainers,
                    utilization: avgUtil,
                    itemsPerLayer: cand.a,
                    layers: cand.b
                });
            }
        }

        results.sort((x, y) => {
            if (x.containers !== y.containers) return x.containers - y.containers;
            return y.utilization - x.utilization;
        });

        setOptimizationSuggestions(results.slice(0, 3));
        setShowOptimizationModal(true);
        setIsOptimizing(false);
    };

    const applyOptimization = (config: string) => {
        if (optimizingMaterialId) {
            updateMaterial(optimizingMaterialId, { layerConfig: config });
            setTimeout(handleRecalculate, 0);
        }
        setShowOptimizationModal(false);
    };

    // --- Optimization (Orientation) ---
    const activeOptimization = optimizations?.find(o => o.materialId === activeMaterial.id);

    const handleApplyOptimization = () => {
        if (activeOptimization) {
            updateMaterial(activeMaterial.id, { orientationPreference: activeOptimization.recommendedPreference });
            setTimeout(handleRecalculate, 0);
        }
    };

    const handleRotateToggle = () => {
        const currentPref = activeMaterial.orientationPreference || 'default';
        const newPref = currentPref === 'default' ? 'rotated' : 'default';
        updateMaterial(activeMaterial.id, { orientationPreference: newPref });
        setTimeout(handleRecalculate, 0);
    };

    // --- Container Edit ---
    const handleContainerDimensionChange = (index: number, key: keyof Dimensions, value: number) => {
        setEditableContainers(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                dimensions: { ...updated[index].dimensions, [key]: value }
            };
            return updated;
        });
    };

    const handleSaveContainers = () => {
        const currentIndex = editableContainers.findIndex(c => c.name === container.name);
        if (currentIndex >= 0) {
            setContainer(editableContainers[currentIndex]);
        }
        setShowEditModal(false);
        setTimeout(handleRecalculate, 0);
    };

    return (
        <div className="flex flex-col h-[40vh] md:h-full w-full md:w-[380px] bg-[#121212] border-r border-[#333] z-30 shadow-2xl relative">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
                <h1 className="text-2xl font-bold tracking-tight text-[#E0E0E0] md:mt-2 mb-2 flex items-center gap-2">
                    <BoxIcon className="w-6 h-6 text-blue-500" /> Stuffing Calc
                </h1>

                {/* Container Selection Card */}
                <section className="bg-[#1E1E1E] rounded-xl border border-[#333] p-4 flex flex-col gap-3 shadow-md">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-[#E0E0E0] flex items-center gap-2 text-sm uppercase tracking-wide">
                            <ContainerIcon className="w-4 h-4 text-blue-400" /> Container
                        </h2>
                        <button onClick={() => setShowEditModal(true)} className="text-gray-400 hover:text-blue-400 transition-colors">
                            <Pencil className="w-4 h-4" />
                        </button>
                    </div>
                    <select
                        value={container.name}
                        onChange={(e) => {
                            const selected = CONTAINER_TYPES.find(c => c.name === e.target.value);
                            if (selected) {
                                setContainer(selected);
                                const newUseDoor = !!selected.doorHeight;
                                setUseDoorHeight(newUseDoor);
                                const eff = (selected.doorHeight && !newUseDoor && INNER_HEIGHTS[selected.name])
                                    ? { ...selected, dimensions: { ...selected.dimensions, height: INNER_HEIGHTS[selected.name] } }
                                    : selected;
                                setTimeout(() => onCalculate(eff, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations), 0);
                            }
                        }}
                        className="w-full bg-[#2A2D34] text-white border border-[#444] rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                        {CONTAINER_TYPES.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    {/* Door / Inner height toggle */}
                    {container.doorHeight && INNER_HEIGHTS[container.name] && (
                        <div className="flex items-center justify-between bg-[#2A2D34] p-1.5 rounded-lg border border-[#444]">
                            <span className="text-xs text-gray-400 font-medium pl-1 hidden sm:inline">Height Mode:</span>
                            <div className="flex rounded-md overflow-hidden bg-[#1E1E1E] p-0.5">
                                <button
                                    onClick={() => {
                                        setUseDoorHeight(true);
                                        setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations), 0);
                                    }}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${useDoorHeight ? 'bg-[#3A3D44] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Use door aperture height">
                                    Door
                                </button>
                                <button
                                    onClick={() => {
                                        setUseDoorHeight(false);
                                        const eff = INNER_HEIGHTS[container.name]
                                            ? { ...container, dimensions: { ...container.dimensions, height: INNER_HEIGHTS[container.name] } }
                                            : container;
                                        setTimeout(() => onCalculate(eff, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations), 0);
                                    }}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${!useDoorHeight ? 'bg-[#3A3D44] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Use inner body height">
                                    Inner
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-gray-500 flex justify-between px-1 font-mono">
                        <span>L: {effectiveContainer.dimensions.length}</span>
                        <span>W: {effectiveContainer.dimensions.width}</span>
                        <span className="flex gap-1 items-center">
                            H: {effectiveContainer.dimensions.height}
                            {container.doorHeight && INNER_HEIGHTS[container.name] && (
                                <span className={useDoorHeight ? "text-orange-900/50" : "text-blue-900/50"}></span>
                            )}
                        </span>
                    </div>
                </section>

                {/* Post-Processing Passes — MOVED TO TOP */}
                {/* Space Optimization Card */}
                <section className="bg-[#1E1E1E] rounded-xl border border-[#333] p-4 flex flex-col gap-3 shadow-md">
                    <h2 className="font-semibold text-[#E0E0E0] flex items-center gap-2 text-sm uppercase tracking-wide mb-1">
                        <Wand2 className="w-4 h-4 text-purple-400" /> Space Optimization
                    </h2>

                    <div className="flex flex-col gap-3">
                        {/* Fill Vertical Toggle */}
                        <div className="flex items-center justify-between border border-[#444] rounded-lg p-2 bg-[#2A2D34] hover:border-[#555] transition-colors">
                            <div className="flex-1 pr-2">
                                <div className="text-sm font-semibold text-white">Top Up</div>
                                <div className="text-[10px] text-gray-400 leading-tight mt-0.5">Fill vertical gaps above loads</div>
                            </div>
                            <button
                                onClick={() => {
                                    const newValue = !enableTopUp;
                                    setEnableTopUp(newValue);
                                    setTimeout(() => onCalculate(container, materials, packingMode, margins, newValue, enableFullMix, fullMixRotations), 0);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableTopUp ? 'bg-blue-500' : 'bg-[#444]'}`}
                            >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableTopUp ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Maximize Space Toggle */}
                        <div className="flex flex-col border border-[#444] rounded-lg p-2 bg-[#2A2D34] hover:border-[#555] transition-colors">
                            <div className="flex items-center justify-between pointer-events-auto">
                                <div className="flex-1 pr-2">
                                    <div className="text-sm font-semibold text-white">Full Mix</div>
                                    <div className="text-[10px] text-gray-400 leading-tight mt-0.5">Aggressive void filling</div>
                                </div>
                                <button
                                    onClick={() => {
                                        const newValue = !enableFullMix;
                                        setEnableFullMix(newValue);
                                        setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, newValue, fullMixRotations), 0);
                                    }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableFullMix ? 'bg-purple-500' : 'bg-[#444]'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableFullMix ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Full Mix Rotations */}
                            {enableFullMix && (
                                <div className="mt-3 pt-3 border-t border-[#444] grid grid-cols-3 gap-1 animate-in fade-in zoom-in duration-200">
                                    <button
                                        onClick={() => {
                                            const newVal = { ...fullMixRotations, x: !fullMixRotations.x };
                                            setFullMixRotations(newVal);
                                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, newVal), 0);
                                        }}
                                        className={`py-1 text-[10px] font-semibold rounded text-center border transition-all ${fullMixRotations.x ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm' : 'bg-[#1E1E1E] text-gray-500 border-[#333] hover:border-[#555]'}`}
                                    >Vert</button>
                                    <button
                                        onClick={() => {
                                            const newVal = { ...fullMixRotations, y: !fullMixRotations.y };
                                            setFullMixRotations(newVal);
                                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, newVal), 0);
                                        }}
                                        className={`py-1 text-[10px] font-semibold rounded text-center border transition-all ${fullMixRotations.y ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm' : 'bg-[#1E1E1E] text-gray-500 border-[#333] hover:border-[#555]'}`}
                                    >Horiz</button>
                                    <button
                                        onClick={() => {
                                            const newVal = { ...fullMixRotations, z: !fullMixRotations.z };
                                            setFullMixRotations(newVal);
                                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, newVal), 0);
                                        }}
                                        className={`py-1 text-[10px] font-semibold rounded text-center border transition-all ${fullMixRotations.z ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm' : 'bg-[#1E1E1E] text-gray-500 border-[#333] hover:border-[#555]'}`}
                                    >Flat</button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Packing Mode Selection */}
                <div className="flex flex-col gap-2 pb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Multi-Material Mode</h3>
                    <div className="flex bg-[#2A2D34] p-1.5 rounded-lg border border-[#444]">
                        <button
                            onClick={() => setPackingMode('SEQUENTIAL')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${packingMode === 'SEQUENTIAL' ? 'bg-[#3A3D44] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Sequential
                        </button>
                        <button
                            onClick={() => setPackingMode('SMART_STACK')}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${packingMode === 'SMART_STACK' ? 'bg-[#3A3D44] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Smart Stack
                        </button>
                    </div>

                    {/* Visual Validation for SMART_STACK */}
                    {packingMode === 'SMART_STACK' && (
                        <div className="mt-1 p-2 bg-blue-900/20 border border-blue-800/50 rounded-lg text-[10px] text-blue-300 flex items-start gap-1.5 animate-in fade-in zoom-in duration-200">
                            <span className="font-bold flex-shrink-0 mt-0.5">ℹ️</span>
                            <span className="leading-tight">Mixes materials in the same container to achieve optimal density.</span>
                        </div>
                    )}
                </div>

                {/* Margins */}
                <section className="bg-[#1E1E1E] rounded-xl border border-[#333] p-3 shadow-md mt-2">
                    <button
                        onClick={() => setShowMargins(!showMargins)}
                        className="flex items-center justify-between w-full text-sm font-semibold text-[#E0E0E0] hover:text-white transition-colors uppercase tracking-wide"
                    >
                        <div className="flex items-center gap-2">
                            <Settings className="w-4 h-4 text-orange-400" />
                            <span>Margins <span className="text-gray-500 text-xs font-mono ml-1">({margins.length}/{margins.width}/{margins.height})</span></span>
                        </div>
                        <span className={`text-xs text-gray-500 transition-transform ${showMargins ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showMargins && (
                        <div className="mt-3 grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Length</label>
                                <input
                                    type="number"
                                    value={margins.length}
                                    onChange={(e) => setMargins({ ...margins, length: parseInt(e.target.value) || 0 })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent text-white text-sm outline-none text-center font-mono"
                                />
                            </div>
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Width</label>
                                <input
                                    type="number"
                                    value={margins.width}
                                    onChange={(e) => setMargins({ ...margins, width: parseInt(e.target.value) || 0 })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent text-white text-sm outline-none text-center font-mono"
                                />
                            </div>
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Height</label>
                                <input
                                    type="number"
                                    value={margins.height}
                                    onChange={(e) => setMargins({ ...margins, height: parseInt(e.target.value) || 0 })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent text-white text-sm outline-none text-center font-mono"
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* Materials Tabs */}
                <div className="flex flex-wrap gap-1 pb-1 mt-4">
                    {materials.map(m => (
                        <div
                            key={m.id}
                            onClick={() => setActiveTabId(m.id)}
                            className={`
                            relative px-3 py-2 rounded-t-lg text-sm font-semibold cursor-pointer flex items-center gap-2 transition-colors border
                            ${activeTabId === m.id ? 'bg-[#1E1E1E] border-[#333] border-b-[#1E1E1E] text-white z-10' : 'bg-[#121212] border-transparent text-gray-500 hover:text-gray-300'}
                        `}
                            style={{
                                borderTop: activeTabId === m.id ? `3px solid ${m.box.color}` : '1px solid transparent',
                                marginBottom: activeTabId === m.id ? '-1px' : '0'
                            }}
                        >
                            <span>Mat {m.id}</span>
                            {materials.length > 1 && (
                                <button
                                    onClick={(e) => handleRemoveMaterial(m.id, e)}
                                    className="hover:text-red-500 p-0.5 rounded transition-colors"
                                    title="Remove"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Add Material Button */}
                    <div className="flex items-center gap-1 ml-1 self-end pb-1">
                        {materials.length < 100 && (
                            <>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={addCount}
                                    onChange={(e) => setAddCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                                    className="w-10 p-1 text-xs bg-[#2A2D34] text-white border border-[#444] rounded text-center h-8 outline-none focus:border-blue-500 transition-colors"
                                    title="Count to add"
                                />
                                <button
                                    onClick={handleAddMaterial}
                                    className="p-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/40 hover:text-blue-300 transition-colors h-8 w-8 flex items-center justify-center"
                                    title={`Add ${addCount} Material(s)`}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Active Material Inputs */}
                <div className="bg-[#1E1E1E] rounded-b-xl rounded-tr-xl border border-[#333] p-4 flex flex-col gap-5 shadow-md animate-in fade-in zoom-in duration-200 relative z-0 mb-20" onKeyDown={handleKeyDown}>
                    {/* Header Actions */}
                    <div className="flex justify-between items-center border-b border-[#333] pb-2">
                        <h2 className="font-bold text-white flex items-center gap-2">
                            <span style={{ color: activeMaterial.box.color }}>Material {activeMaterial.id} Settings</span>
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => handleDuplicateMaterial(activeMaterial.id, e)}
                                className="text-gray-400 hover:text-blue-400 p-1 transition-colors"
                                title="Duplicate Material"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => handleRemoveMaterial(activeMaterial.id, e)}
                                className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                                title="Delete Material"
                                disabled={materials.length <= 1}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Box Dimensions */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[#E0E0E0] flex items-center gap-2 text-sm uppercase tracking-wide">
                                <BoxIcon className="w-4 h-4 text-blue-400" /> Box Dimensions
                                <span className="text-gray-500 text-[10px] font-mono lowercase">(mm)</span>
                            </h3>
                            <div className="flex items-center gap-2 bg-[#2A2D34] px-2 py-1 rounded-md border border-[#444]">
                                <label className="text-[10px] uppercase font-semibold text-gray-400">Wgt<span className="text-gray-500 lowercase">(kg)</span></label>
                                <input
                                    type="number"
                                    value={activeMaterial.box.weightKg || ''}
                                    onChange={(e) => updateBox(activeMaterial.id, { weightKg: e.target.value ? Number(e.target.value) : undefined })}
                                    className="w-12 bg-transparent text-white text-sm outline-none text-right font-mono"
                                    placeholder="Opt"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Length</label>
                                <input
                                    type="number"
                                    value={activeMaterial.box.dimensions.length}
                                    onChange={(e) => updateBoxDims(activeMaterial.id, 'length', Number(e.target.value))}
                                    onPaste={(e) => handlePaste(e,
                                        (l) => updateBoxDims(activeMaterial.id, 'length', l),
                                        (w) => updateBoxDims(activeMaterial.id, 'width', w),
                                        (h) => updateBoxDims(activeMaterial.id, 'height', h)
                                    )}
                                    className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                />
                            </div>
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Width</label>
                                <input
                                    type="number"
                                    value={activeMaterial.box.dimensions.width}
                                    onChange={(e) => updateBoxDims(activeMaterial.id, 'width', Number(e.target.value))}
                                    className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                />
                            </div>
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Height</label>
                                <input
                                    type="number"
                                    value={activeMaterial.box.dimensions.height}
                                    onChange={(e) => updateBoxDims(activeMaterial.id, 'height', Number(e.target.value))}
                                    className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Stacking Options */}
                    <section className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-[#E0E0E0] flex items-center gap-2 text-sm uppercase tracking-wide">
                                <Settings className="w-4 h-4 text-purple-400" /> Stacking Options
                            </h3>
                            <div className="flex gap-2">
                                {/* Optimization Button */}
                                {activeOptimization && (
                                    <button
                                        onClick={handleApplyOptimization}
                                        className="px-2 py-1 text-xs font-bold text-white bg-green-600/80 rounded hover:bg-green-500 animate-pulse shadow-sm flex items-center gap-1 border border-green-500/50"
                                        title={`Optimize: Switch to ${activeOptimization.recommendedPreference} orientation`}
                                    >
                                        <Wand2 className="w-3 h-3" /> Optimize
                                    </button>
                                )}

                                {/* Rotate Button */}
                                <button
                                    onClick={handleRotateToggle}
                                    className="p-1 text-gray-400 hover:text-blue-400 border border-[#444] rounded bg-[#2A2D34] hover:border-[#555] transition-colors"
                                    title={`Rotate Orientation (Current: ${activeMaterial.orientationPreference || 'default'})`}
                                >
                                    <div className={`transform transition-transform ${activeMaterial.orientationPreference === 'rotated' ? 'rotate-90' : ''}`}>
                                        <BoxIcon className="w-4 h-4" />
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="bg-[#2A2D34] p-1.5 rounded-lg border border-[#444]">
                            <div className="flex justify-between gap-1.5">
                                <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 rounded cursor-pointer border transition-colors ${activeMaterial.box.allowedRotations.x ? 'bg-[#3A3D44] border-blue-500/50 shadow-sm' : 'hover:bg-[#333] border-transparent'}`}>
                                    <input
                                        type="checkbox"
                                        checked={activeMaterial.box.allowedRotations.x}
                                        onChange={(e) => updateBox(activeMaterial.id, { allowedRotations: { ...activeMaterial.box.allowedRotations, x: e.target.checked } })}
                                        className="hidden"
                                    />
                                    <div className="w-8 h-8 flex items-end justify-center">
                                        <div className="w-4 h-8 bg-blue-500/80 rounded-sm border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                                    </div>
                                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activeMaterial.box.allowedRotations.x ? 'text-blue-300' : 'text-gray-500'}`}>Vertical</span>
                                </label>

                                <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 rounded cursor-pointer border transition-colors ${activeMaterial.box.allowedRotations.y ? 'bg-[#3A3D44] border-blue-500/50 shadow-sm' : 'hover:bg-[#333] border-transparent'}`}>
                                    <input
                                        type="checkbox"
                                        checked={activeMaterial.box.allowedRotations.y}
                                        onChange={(e) => updateBox(activeMaterial.id, { allowedRotations: { ...activeMaterial.box.allowedRotations, y: e.target.checked } })}
                                        className="hidden"
                                    />
                                    <div className="w-8 h-8 flex items-end justify-center">
                                        <div className="w-8 h-4 bg-blue-500/80 rounded-sm border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                                    </div>
                                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activeMaterial.box.allowedRotations.y ? 'text-blue-300' : 'text-gray-500'}`}>Horizontal</span>
                                </label>

                                <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 rounded cursor-pointer border transition-colors ${activeMaterial.box.allowedRotations.z ? 'bg-[#3A3D44] border-blue-500/50 shadow-sm' : 'hover:bg-[#333] border-transparent'}`}>
                                    <input
                                        type="checkbox"
                                        checked={activeMaterial.box.allowedRotations.z}
                                        onChange={(e) => updateBox(activeMaterial.id, { allowedRotations: { ...activeMaterial.box.allowedRotations, z: e.target.checked } })}
                                        className="hidden"
                                    />
                                    <div className="w-8 h-8 flex items-end justify-center perspective-[100px]">
                                        <div className="w-8 h-6 bg-blue-500/80 rounded-sm border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)] transform rotate-x-60"></div>
                                    </div>
                                    <span className={`text-[10px] uppercase font-bold tracking-wider ${activeMaterial.box.allowedRotations.z ? 'text-blue-300' : 'text-gray-500'}`}>Flat</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Layer Configuration */}
                    <section className="space-y-3">
                        <h3 className="font-semibold text-[#E0E0E0] flex items-center gap-2 text-sm uppercase tracking-wide">
                            <Layers className="w-4 h-4 text-pink-400" /> Layer Configuration
                        </h3>
                        <div className="space-y-2">
                            <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                <input
                                    type="text"
                                    value={activeMaterial.layerConfig}
                                    onChange={(e) => updateMaterial(activeMaterial.id, { layerConfig: e.target.value })}
                                    placeholder="No constraint (full fill)"
                                    className="w-full bg-transparent text-white text-base outline-none text-center font-mono placeholder-[#555]"
                                    title="Enter 'AxB' to apply strict layer constraints"
                                />
                            </div>
                            <div className="flex justify-between items-center px-1">
                                <div className="text-[10px] text-gray-500 font-mono">
                                    Format: [items]x[layers] (e.g., "6x3")
                                </div>
                                <button
                                    onClick={() => handleOptimize(activeMaterial.id)}
                                    disabled={isOptimizing}
                                    className="text-[10px] uppercase font-bold text-gray-400 hover:text-pink-400 flex items-center gap-1 transition-colors"
                                >
                                    {isOptimizing && optimizingMaterialId === activeMaterial.id ? (
                                        <span className="animate-spin">⌛</span>
                                    ) : (
                                        <Wand2 className="w-3 h-3" />
                                    )}
                                    Optimize
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Pallet Settings */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[#E0E0E0] flex items-center gap-2 text-sm uppercase tracking-wide">
                                <Settings className="w-4 h-4 text-orange-400" /> Pallet
                            </h3>
                            <button
                                onClick={() => updatePallet(activeMaterial.id, { usePallet: !activeMaterial.pallet.usePallet })}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${activeMaterial.pallet.usePallet ? 'bg-orange-500' : 'bg-[#444]'}`}
                            >
                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${activeMaterial.pallet.usePallet ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <button
                            onClick={() => calculatePerfectPallet(activeMaterial)}
                            disabled={!isConfigValid(activeMaterial.layerConfig)}
                            className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors ${isConfigValid(activeMaterial.layerConfig)
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 hover:text-blue-300'
                                : 'bg-[#2A2D34] text-gray-600 border border-[#333] cursor-not-allowed'
                                }`}
                        >
                            <Calculator className="w-4 h-4" />
                            Create Pallet from Config
                        </button>

                        {activeMaterial.pallet.usePallet && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                        <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Length</label>
                                        <input
                                            type="number"
                                            value={activeMaterial.pallet.dimensions.length}
                                            onChange={(e) => updatePalletDims(activeMaterial.id, 'length', Number(e.target.value))}
                                            className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                        />
                                    </div>
                                    <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                        <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Width</label>
                                        <input
                                            type="number"
                                            value={activeMaterial.pallet.dimensions.width}
                                            onChange={(e) => updatePalletDims(activeMaterial.id, 'width', Number(e.target.value))}
                                            className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                        <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Max Load Height</label>
                                        <input
                                            type="number"
                                            value={activeMaterial.pallet.maxLoadHeight}
                                            onChange={(e) => updatePallet(activeMaterial.id, { maxLoadHeight: Number(e.target.value) })}
                                            className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                        />
                                    </div>
                                    <div className="w-20 bg-[#2A2D34] rounded-lg border border-[#444] p-1.5 focus-within:border-blue-500 shadow-inner">
                                        <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Wgt(kg)</label>
                                        <input
                                            type="number"
                                            value={activeMaterial.pallet.weightKg || ''}
                                            onChange={(e) => updatePallet(activeMaterial.id, { weightKg: e.target.value ? Number(e.target.value) : undefined })}
                                            className="w-full bg-transparent text-white text-base outline-none text-center font-mono"
                                            placeholder="Opt"
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-2.5 bg-[#2A2D34] rounded-lg border border-[#444] hover:border-[#555] transition-colors mt-2">
                                    <input
                                        type="checkbox"
                                        checked={activeMaterial.pallet.stackPallets || false}
                                        onChange={(e) => updatePallet(activeMaterial.id, { stackPallets: e.target.checked })}
                                        className="w-4 h-4 text-orange-500 bg-[#1E1E1E] border-[#555] rounded focus:ring-orange-500 focus:ring-offset-[#2A2D34]"
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-orange-400" />
                                        <span className="font-medium text-xs">Stack Pallets (max 2)</span>
                                    </div>
                                </label>
                            </div>
                        )}
                    </section>

                    {/* Quantity */}
                    <section className="space-y-2">
                        <h3 className="font-semibold text-[#E0E0E0] text-sm uppercase tracking-wide">Quantity</h3>
                        <div className="bg-[#2A2D34] rounded-lg border border-[#444] p-2 focus-within:border-blue-500 shadow-inner">
                            <input
                                type="number"
                                value={activeMaterial.quantity}
                                onChange={(e) => updateMaterial(activeMaterial.id, { quantity: Number(e.target.value) })}
                                className="w-full bg-transparent text-white text-xl outline-none text-center font-black font-mono pl-4 tracking-widest"
                            />
                        </div>
                    </section>
                </div>

                {/* Recalculate Button (Sticky Bottom) */}
                <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent pt-6 pb-4 px-4 -mx-4 z-40 mt-auto">
                    <button
                        onClick={handleRecalculate}
                        className="w-full relative group overflow-hidden bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all flex items-center justify-center gap-2"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400 transition-colors"></div>
                        <Calculator className="w-5 h-5 relative z-10" />
                        <span className="relative z-10 text-[15px] tracking-wide uppercase">Recalculate</span>
                    </button>
                </div>

                {/* Modals */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="font-bold text-lg text-gray-800">Edit Containers</h3>
                                <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                                {editableContainers.map((c, idx) => (
                                    <div key={c.name} className="border p-3 rounded bg-gray-50">
                                        <div className="font-semibold text-sm mb-2">{c.name}</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-xs text-gray-500">Length</label>
                                                <input
                                                    type="number"
                                                    value={c.dimensions.length}
                                                    onChange={(e) => handleContainerDimensionChange(idx, 'length', Number(e.target.value))}
                                                    className="w-full p-1 border rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500">Width</label>
                                                <input
                                                    type="number"
                                                    value={c.dimensions.width}
                                                    onChange={(e) => handleContainerDimensionChange(idx, 'width', Number(e.target.value))}
                                                    className="w-full p-1 border rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500">Height</label>
                                                <input
                                                    type="number"
                                                    value={c.dimensions.height}
                                                    onChange={(e) => handleContainerDimensionChange(idx, 'height', Number(e.target.value))}
                                                    className="w-full p-1 border rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button onClick={handleSaveContainers} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {showOptimizationModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b bg-purple-50">
                                <h3 className="font-bold text-lg text-purple-800 flex items-center gap-2">
                                    <Wand2 className="w-5 h-5" /> Optimization Suggestions
                                </h3>
                                <button onClick={() => setShowOptimizationModal(false)} className="p-1 hover:bg-purple-100 rounded text-purple-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 space-y-2">
                                <p className="text-sm text-gray-600 mb-2">
                                    Best configurations found for Material {optimizingMaterialId}:
                                </p>
                                {optimizationSuggestions.length === 0 ? (
                                    <div className="text-center text-gray-500 py-4">No better configurations found.</div>
                                ) : (
                                    optimizationSuggestions.map((sugg, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => applyOptimization(sugg.config)}
                                            className="w-full text-left p-3 border rounded hover:bg-purple-50 hover:border-purple-300 transition-colors group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-gray-800">{sugg.config}</span>
                                                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                    {sugg.containers} Container{sugg.containers > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 flex justify-between">
                                                <span>{sugg.itemsPerLayer} items/layer × {sugg.layers} layers</span>
                                                <span className="group-hover:text-purple-600">Apply →</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
