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
    { name: "20' Standard", type: '20', dimensions: { length: 5898, width: 2352, height: 2393 } },
    { name: "40' Standard", type: '40', dimensions: { length: 12032, width: 2352, height: 2393 } },
    { name: "40' High Cube", type: '40HC', dimensions: { length: 12032, width: 2352, height: 2698 } },
    { name: "53' Trailer", type: '53', dimensions: { length: 16000, width: 2540, height: 2700 } },
    { name: "Custom", type: 'custom', dimensions: { length: 12000, width: 2400, height: 2600 } },
];

const COLORS = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#f97316', // Orange
    '#6366f1', // Indigo
];

export const PASTEL_PALETTE = [
    '#fca5a5', '#fdba74', '#fcd34d', '#86efac', '#6ee7b7', '#5eead4', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#f9a8d4',
    '#fda4af', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
    '#ef4444', '#f59e0b', '#84cc16', '#10b981', '#64748b', '#71717a'
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
    const [container, setContainer] = useState<Container>(CONTAINER_TYPES[3]); // Default 53'
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
    const handleRecalculate = useCallback(() => {
        onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations);
    }, [container, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations, onCalculate]);

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
        <div className="p-4 bg-gray-50 overflow-y-auto border-r border-gray-200 flex flex-col gap-6 w-full md:w-80 h-[35vh] md:h-full text-base">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BoxIcon className="w-6 h-6" /> Stuffing Calc
            </h1>

            {/* Container Selection */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                        <ContainerIcon className="w-4 h-4" /> Container
                    </h2>
                    <button onClick={() => setShowEditModal(true)} className="text-blue-600 hover:text-blue-800">
                        <Pencil className="w-4 h-4" />
                    </button>
                </div>
                <select
                    value={container.name}
                    onChange={(e) => {
                        const selected = CONTAINER_TYPES.find(c => c.name === e.target.value);
                        if (selected) {
                            setContainer(selected);
                            setTimeout(() => onCalculate(selected, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations), 0);
                        }
                    }}
                    className="w-full p-3 border rounded text-base h-12 bg-white"
                >
                    {CONTAINER_TYPES.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                </select>
                <div className="text-xs text-gray-500 flex justify-between px-1">
                    <span>L: {container.dimensions.length}</span>
                    <span>W: {container.dimensions.width}</span>
                    <span>H: {container.dimensions.height}</span>
                </div>
            </section>

            {/* Post-Processing Passes — MOVED TO TOP */}
            <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                <div className="text-xs font-medium text-gray-500 mb-2">Space Optimization</div>

                <label className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                    <input
                        type="checkbox"
                        checked={enableTopUp}
                        onChange={(e) => {
                            const newValue = e.target.checked;
                            setEnableTopUp(newValue);
                            setTimeout(() => onCalculate(container, materials, packingMode, margins, newValue, enableFullMix, fullMixRotations), 0);
                        }}
                        className="mt-0.5"
                    />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Fill Vertical Space</div>
                        <div className="text-xs text-gray-500">Add flat-oriented boxes above loads to use empty vertical space</div>
                    </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                    <input
                        type="checkbox"
                        checked={enableFullMix}
                        onChange={(e) => {
                            const newValue = e.target.checked;
                            setEnableFullMix(newValue);
                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, newValue, fullMixRotations), 0);
                        }}
                        className="mt-0.5"
                    />
                    <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Maximize Space</div>
                        <div className="text-xs text-gray-500">Aggressively fill all remaining spaces with best-fit orientations</div>

                        {/* Full Mix Orientation Controls */}
                        {enableFullMix && (
                            <div className="mt-2 flex gap-3 items-center animate-in fade-in slide-in-from-top-1">
                                <span className="text-xs font-semibold text-gray-500">Allowed:</span>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={fullMixRotations.x}
                                        onChange={(e) => {
                                            const newVal = { ...fullMixRotations, x: e.target.checked };
                                            setFullMixRotations(newVal);
                                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, newVal), 0);
                                        }}
                                        className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-600">Vert (V)</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={fullMixRotations.y}
                                        onChange={(e) => {
                                            const newVal = { ...fullMixRotations, y: e.target.checked };
                                            setFullMixRotations(newVal);
                                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, newVal), 0);
                                        }}
                                        className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-600">Horiz (H)</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={fullMixRotations.z}
                                        onChange={(e) => {
                                            const newVal = { ...fullMixRotations, z: e.target.checked };
                                            setFullMixRotations(newVal);
                                            setTimeout(() => onCalculate(container, materials, packingMode, margins, enableTopUp, enableFullMix, newVal), 0);
                                        }}
                                        className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-600">Flat (F)</span>
                                </label>
                            </div>
                        )}
                    </div>
                </label>

                {(enableTopUp || enableFullMix) && (
                    <div className="flex gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200 mt-2">
                        <div className="mt-0.5">ℹ️</div>
                        <div>Only applied to fully packed containers</div>
                    </div>
                )}
            </div>

            {/* Packing Mode Selection */}
            <div className="flex flex-col gap-2 pb-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Multi-Material Mode</h3>
                <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="packingMode"
                            value="SEQUENTIAL"
                            checked={packingMode === 'SEQUENTIAL'}
                            onChange={() => setPackingMode('SEQUENTIAL')}
                            className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                            <span className="font-medium">Sequential</span> – Materials share containers, no mixing
                        </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="packingMode"
                            value="SMART_STACK"
                            checked={packingMode === 'SMART_STACK'}
                            onChange={() => setPackingMode('SMART_STACK')}
                            className="mt-1"
                        />
                        <span className="text-sm text-gray-700">
                            <span className="font-medium">Smart Stack</span> – Mix materials if space allows (with Fill/Maximize)
                        </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-not-allowed opacity-60">
                        <input
                            type="radio"
                            name="packingMode"
                            value="TETRIS"
                            checked={packingMode === 'TETRIS'}
                            disabled={true}
                            className="mt-1 cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700">
                            <span className="font-medium">Tetris (Coming Soon)</span> – Free-form optimal packing
                        </span>
                    </label>
                </div>

                {/* Visual Validation for SMART_STACK */}
                {packingMode === 'SMART_STACK' && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex flex-col gap-1">
                        <span className="font-bold flex items-center gap-1">ℹ️ Smart Stack Mode</span>
                        <span>Materials fill remaining space in each other's containers when Fill or Maximize is enabled</span>
                    </div>
                )}
            </div>

            {/* Margins — Collapsed by default */}
            <div className="border-b border-gray-200 pb-3">
                <button
                    onClick={() => setShowMargins(!showMargins)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors w-full"
                >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Margins ({margins.length}/{margins.width}/{margins.height} mm)</span>
                    <span className={`ml-auto text-xs transition-transform ${showMargins ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {showMargins && (
                    <div className="mt-2 bg-white p-2 rounded border border-gray-200 animate-in fade-in slide-in-from-top-1">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] text-gray-400 block">Length</label>
                                <input
                                    type="number"
                                    value={margins.length}
                                    onChange={(e) => setMargins({ ...margins, length: parseInt(e.target.value) || 0 })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full p-1 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block">Width</label>
                                <input
                                    type="number"
                                    value={margins.width}
                                    onChange={(e) => setMargins({ ...margins, width: parseInt(e.target.value) || 0 })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full p-1 border rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 block">Height</label>
                                <input
                                    type="number"
                                    value={margins.height}
                                    onChange={(e) => setMargins({ ...margins, height: parseInt(e.target.value) || 0 })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full p-1 border rounded text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Materials Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-1">
                {materials.map(m => (
                    <div
                        key={m.id}
                        onClick={() => setActiveTabId(m.id)}
                        className={`
                            relative px-3 py-2 rounded-t-lg text-sm font-medium cursor-pointer flex items-center gap-2 transition-colors
                            ${activeTabId === m.id ? 'bg-white border border-b-0 border-gray-200 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                        `}
                        style={{ borderTop: activeTabId === m.id ? `3px solid ${m.box.color}` : undefined }}
                    >
                        <span>Mat {m.id}</span>
                        {materials.length > 1 && (
                            <button
                                onClick={(e) => handleRemoveMaterial(m.id, e)}
                                className="hover:text-red-500 p-0.5 rounded"
                                title="Remove"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}

                {/* Add Material Button */}
                <div className="flex items-center gap-1 ml-1">
                    {materials.length < 100 && (
                        <>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={addCount}
                                onChange={(e) => setAddCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                                className="w-10 p-1 text-xs border rounded text-center h-8"
                                title="Count to add"
                            />
                            <button
                                onClick={handleAddMaterial}
                                className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors h-8 w-8 flex items-center justify-center"
                                title={`Add ${addCount} Material(s)`}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Active Material Inputs */}
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6" onKeyDown={handleKeyDown}>
                {/* Header Actions */}
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <span style={{ color: activeMaterial.box.color }}>Material {activeMaterial.id} Settings</span>
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => handleDuplicateMaterial(activeMaterial.id, e)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Duplicate Material"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => handleRemoveMaterial(activeMaterial.id, e)}
                            className="text-gray-400 hover:text-red-600 p-1"
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
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                            <BoxIcon className="w-4 h-4" /> Box Dimensions (mm)
                        </h3>
                        <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">Wgt(kg)</label>
                            <input
                                type="number"
                                value={activeMaterial.box.weightKg || ''}
                                onChange={(e) => updateBox(activeMaterial.id, { weightKg: e.target.value ? Number(e.target.value) : undefined })}
                                className="w-16 p-1 border rounded text-sm text-right"
                                placeholder="Opt"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs text-gray-500">Length</label>
                            <input
                                type="number"
                                value={activeMaterial.box.dimensions.length}
                                onChange={(e) => updateBoxDims(activeMaterial.id, 'length', Number(e.target.value))}
                                onPaste={(e) => handlePaste(e,
                                    (l) => updateBoxDims(activeMaterial.id, 'length', l),
                                    (w) => updateBoxDims(activeMaterial.id, 'width', w),
                                    (h) => updateBoxDims(activeMaterial.id, 'height', h)
                                )}
                                className="w-full p-3 border rounded text-base h-12"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Width</label>
                            <input
                                type="number"
                                value={activeMaterial.box.dimensions.width}
                                onChange={(e) => updateBoxDims(activeMaterial.id, 'width', Number(e.target.value))}
                                className="w-full p-3 border rounded text-base h-12"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Height</label>
                            <input
                                type="number"
                                value={activeMaterial.box.dimensions.height}
                                onChange={(e) => updateBoxDims(activeMaterial.id, 'height', Number(e.target.value))}
                                className="w-full p-3 border rounded text-base h-12"
                            />
                        </div>
                    </div>
                </section>

                {/* Stacking Options */}
                <section className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                            <Settings className="w-4 h-4" /> Stacking Options
                        </h3>
                        <div className="flex gap-2">
                            {/* Optimization Button */}
                            {activeOptimization && (
                                <button
                                    onClick={handleApplyOptimization}
                                    className="px-2 py-1 text-xs font-bold text-white bg-green-500 rounded hover:bg-green-600 animate-pulse shadow-sm flex items-center gap-1"
                                    title={`Optimize: Switch to ${activeOptimization.recommendedPreference} orientation`}
                                >
                                    <Wand2 className="w-3 h-3" /> Optimize
                                </button>
                            )}

                            {/* Rotate Button */}
                            <button
                                onClick={handleRotateToggle}
                                className="p-1 text-gray-500 hover:text-blue-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                                title={`Rotate Orientation (Current: ${activeMaterial.orientationPreference || 'default'})`}
                            >
                                <div className={`transform transition-transform ${activeMaterial.orientationPreference === 'rotated' ? 'rotate-90' : ''}`}>
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                            </button>
                        </div>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200">
                        <div className="flex justify-between gap-2">
                            <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 rounded cursor-pointer border transition-colors ${activeMaterial.box.allowedRotations.x ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}>
                                <input
                                    type="checkbox"
                                    checked={activeMaterial.box.allowedRotations.x}
                                    onChange={(e) => updateBox(activeMaterial.id, { allowedRotations: { ...activeMaterial.box.allowedRotations, x: e.target.checked } })}
                                    className="hidden"
                                />
                                <div className="w-8 h-8 flex items-end justify-center">
                                    <div className="w-4 h-8 bg-blue-500 rounded-sm border border-blue-600 shadow-sm"></div>
                                </div>
                                <span className={`text-xs font-medium ${activeMaterial.box.allowedRotations.x ? 'text-blue-700' : 'text-gray-500'}`}>Vertical</span>
                            </label>

                            <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 rounded cursor-pointer border transition-colors ${activeMaterial.box.allowedRotations.y ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}>
                                <input
                                    type="checkbox"
                                    checked={activeMaterial.box.allowedRotations.y}
                                    onChange={(e) => updateBox(activeMaterial.id, { allowedRotations: { ...activeMaterial.box.allowedRotations, y: e.target.checked } })}
                                    className="hidden"
                                />
                                <div className="w-8 h-8 flex items-end justify-center">
                                    <div className="w-8 h-4 bg-blue-500 rounded-sm border border-blue-600 shadow-sm"></div>
                                </div>
                                <span className={`text-xs font-medium ${activeMaterial.box.allowedRotations.y ? 'text-blue-700' : 'text-gray-500'}`}>Horizontal</span>
                            </label>

                            <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 rounded cursor-pointer border transition-colors ${activeMaterial.box.allowedRotations.z ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}>
                                <input
                                    type="checkbox"
                                    checked={activeMaterial.box.allowedRotations.z}
                                    onChange={(e) => updateBox(activeMaterial.id, { allowedRotations: { ...activeMaterial.box.allowedRotations, z: e.target.checked } })}
                                    className="hidden"
                                />
                                <div className="w-8 h-8 flex items-end justify-center perspective-[100px]">
                                    <div className="w-8 h-6 bg-blue-500 rounded-sm border border-blue-600 shadow-sm transform rotate-x-60"></div>
                                </div>
                                <span className={`text-xs font-medium ${activeMaterial.box.allowedRotations.z ? 'text-blue-700' : 'text-gray-500'}`}>Flat</span>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Layer Configuration */}
                <section className="space-y-3">
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                        <Layers className="w-4 h-4" /> Layer Configuration
                    </h3>
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={activeMaterial.layerConfig}
                            onChange={(e) => updateMaterial(activeMaterial.id, { layerConfig: e.target.value })}
                            placeholder="No constraint (full fill)"
                            className="w-full p-3 border rounded text-base h-12"
                            title="Enter 'AxB' to apply strict layer constraints"
                        />
                        <div className="flex justify-between items-center">
                            <div className="text-xs text-gray-400">
                                Format: [items]x[layers] (e.g., "6x3")
                            </div>
                            <button
                                onClick={() => handleOptimize(activeMaterial.id)}
                                disabled={isOptimizing}
                                className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1 transition-colors"
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
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                            <Settings className="w-4 h-4" /> Pallet
                        </h3>
                        <input
                            type="checkbox"
                            checked={activeMaterial.pallet.usePallet}
                            onChange={(e) => updatePallet(activeMaterial.id, { usePallet: e.target.checked })}
                            className="w-4 h-4"
                        />
                    </div>

                    <button
                        onClick={() => calculatePerfectPallet(activeMaterial)}
                        disabled={!isConfigValid(activeMaterial.layerConfig)}
                        className={`w-full py-2 px-3 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isConfigValid(activeMaterial.layerConfig)
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Calculator className="w-4 h-4" />
                        Create Pallet from Config
                    </button>

                    {activeMaterial.pallet.usePallet && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500">Length</label>
                                    <input
                                        type="number"
                                        value={activeMaterial.pallet.dimensions.length}
                                        onChange={(e) => updatePalletDims(activeMaterial.id, 'length', Number(e.target.value))}
                                        className="w-full p-3 border rounded text-base h-12"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">Width</label>
                                    <input
                                        type="number"
                                        value={activeMaterial.pallet.dimensions.width}
                                        onChange={(e) => updatePalletDims(activeMaterial.id, 'width', Number(e.target.value))}
                                        className="w-full p-3 border rounded text-base h-12"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Max Load Height</label>
                                    <input
                                        type="number"
                                        value={activeMaterial.pallet.maxLoadHeight}
                                        onChange={(e) => updatePallet(activeMaterial.id, { maxLoadHeight: Number(e.target.value) })}
                                        className="w-full p-3 border rounded text-base h-12"
                                    />
                                </div>
                                <div className="w-20">
                                    <label className="text-xs text-gray-500">Wgt(kg)</label>
                                    <input
                                        type="number"
                                        value={activeMaterial.pallet.weightKg || ''}
                                        onChange={(e) => updatePallet(activeMaterial.id, { weightKg: e.target.value ? Number(e.target.value) : undefined })}
                                        className="w-full p-3 border rounded text-base h-12"
                                        placeholder="Opt"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 bg-white rounded border border-gray-200">
                                <input
                                    type="checkbox"
                                    checked={activeMaterial.pallet.stackPallets || false}
                                    onChange={(e) => updatePallet(activeMaterial.id, { stackPallets: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex items-center gap-1">
                                    <Layers className="w-4 h-4 text-gray-500" />
                                    <span>Stack Pallets (max 2)</span>
                                </div>
                            </label>
                        </div>
                    )}
                </section>

                {/* Quantity */}
                <section className="space-y-3 pb-20">
                    <h3 className="font-semibold text-gray-700 text-sm">Quantity</h3>
                    <input
                        type="number"
                        value={activeMaterial.quantity}
                        onChange={(e) => updateMaterial(activeMaterial.id, { quantity: Number(e.target.value) })}
                        className="w-full p-3 border rounded text-base h-12"
                    />
                </section>
            </div>

            {/* Recalculate Button (Floating) */}
            <div className="absolute bottom-4 left-4 right-4 md:w-72">
                <button
                    onClick={handleRecalculate}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Calculator className="w-5 h-5" />
                    Recalculate
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
    );
};
