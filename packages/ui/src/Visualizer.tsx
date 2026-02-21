import React, { useMemo } from 'react';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Center, Text } from '@react-three/drei';
import { Maximize, X, Palette } from 'lucide-react';
import type { PackingResult, Container, Box, Pallet, PlacedItem, Material } from '@stuffing-calc/core';
import { PASTEL_PALETTE } from './InputPanel';
import * as THREE from 'three';

interface VisualizerProps {
    result: PackingResult | null;
    container: Container;
    // Legacy props (optional)
    box?: Box | null;
    pallet?: Pallet | null;
    layerConfig?: string;
    box2?: Box | null;
    pallet2?: Pallet | null;
    layerConfig2?: string;

    // New prop
    materials?: Material[];

    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    activeMaterialId?: number;
    onUpdateMaterialColor?: (id: number, color: string) => void;
}

const ContainerView: React.FC<{ container: Container; position: [number, number, number] }> = ({ container, position }) => {
    const { length, width, height } = container.dimensions;
    const scale = 0.001;
    const l = length * scale;
    const w = width * scale;
    const h = height * scale;

    return (
        <group position={position}>
            {/* Floor - slightly lowered to avoid z-fighting with boxes */}
            <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[l, w]} />
                <meshStandardMaterial color="#e5e7eb" side={THREE.DoubleSide} />
            </mesh>

            {/* Wireframe Box */}
            <lineSegments position={[0, h / 2, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(l, h, w)]} />
                <lineBasicMaterial color="#9ca3af" />
            </lineSegments>
        </group>
    );
};

interface RenderItem {
    pos: [number, number, number];
    dims: [number, number, number];
    type: 'box' | 'pallet_base';
    isFlatTopOff?: boolean;
}

const Boxes: React.FC<{ items: PlacedItem[]; containerDims: any; offset: [number, number, number]; box: Box | null; pallet: Pallet | null; layerConfig: string; color?: string }> = ({ items, containerDims, offset, box, pallet, layerConfig, color }) => {
    const scale = 0.001;

    // Materials
    const boxMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: color || '#d2b48c', // Cardboard or custom color
        roughness: 0.8,
        metalness: 0.1
    }), [color]);

    const palletMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#8b5a2b', // Wood
        roughness: 0.9,
        metalness: 0.0
    }), []);

    const meshRef = React.useRef<THREE.InstancedMesh>(null);
    const palletMeshRef = React.useRef<THREE.InstancedMesh>(null);

    // Geometry - use box dimensions if available, otherwise default 1x1x1 (will be scaled)
    const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

    // Edges
    const [edgeGeometry, setEdgeGeometry] = React.useState<THREE.BufferGeometry | null>(null);

    React.useLayoutEffect(() => {
        if (!meshRef.current) return;

        const tempObject = new THREE.Object3D();
        const tempPallet = new THREE.Object3D();

        // Calculate items to render
        let itemsToRender: RenderItem[] = [];

        items.forEach(item => {
            if (item.type === 'pallet' && box && pallet) {
                // Render Pallet Base
                const palletHeight = 150; // Standard pallet height mm
                const baseH = palletHeight;

                const unitBottomY = item.position[1] - item.dimensions.height / 2;
                const baseCenterY = unitBottomY + baseH / 2;

                itemsToRender.push({
                    pos: [item.position[0], baseCenterY, item.position[2]],
                    dims: [item.dimensions.length, baseH, item.dimensions.width],
                    type: 'pallet_base'
                });

                // Render Boxes on Pallet
                // FIX: Use item.grid if available
                let cols = 1; // Visualizer X
                let rows = 1; // Visualizer Z
                let layers = 1;

                if (item.grid) {
                    cols = item.grid.cols;  // items along length
                    rows = item.grid.rows;  // items along width
                    layers = item.grid.layers;
                } else {
                    // Legacy fallback
                    const natCols = Math.floor(pallet.dimensions.length / box.dimensions.length);
                    const natRows = Math.floor(pallet.dimensions.width / box.dimensions.width);
                    const natLayers = Math.floor((pallet.maxLoadHeight - baseH) / box.dimensions.height);

                    cols = natCols;
                    rows = natRows;
                    layers = natLayers;

                    const normalizedConfig = layerConfig?.toLowerCase().replace(/[*×]/g, 'x') || '';
                    if (normalizedConfig && normalizedConfig.includes('x')) {
                        const parts = normalizedConfig.split('x');
                        const horizontal = parseInt(parts[0], 10) || 0;
                        const vertical = parseInt(parts[1], 10) || 0;
                        if (horizontal > 0 && vertical > 0) {
                            layers = vertical;
                        }
                    }
                }

                // Calculate individual box dimensions
                const loadHeight = item.dimensions.height - baseH;
                const singleBoxL = item.dimensions.length / cols;
                const singleBoxW = item.dimensions.width / rows;
                const singleBoxH = loadHeight / layers;

                const startX = item.position[0] - item.dimensions.length / 2;
                const startY = unitBottomY + baseH;
                const startZ = item.position[2] - item.dimensions.width / 2;

                // FIX: Use item.itemCount to limit rendered boxes
                const maxItemsToRender = item.itemCount !== undefined ? item.itemCount : (cols * rows * layers * (pallet.stackPallets ? 2 : 1));
                let itemsRenderedCount = 0;

                for (let l = 0; l < layers; l++) {
                    for (let r = 0; r < rows; r++) { // Z loop
                        for (let c = 0; c < cols; c++) { // X loop
                            if (itemsRenderedCount >= maxItemsToRender) break;

                            const bx = startX + c * singleBoxL + singleBoxL / 2;
                            const by = startY + l * singleBoxH + singleBoxH / 2;
                            const bz = startZ + r * singleBoxW + singleBoxW / 2;

                            itemsToRender.push({
                                pos: [bx, by, bz],
                                dims: [singleBoxL, singleBoxH, singleBoxW],
                                type: 'box'
                            });
                            itemsRenderedCount++;
                        }
                    }
                }

            } else {
                // Non-pallet mode - check if this is a stack unit that needs to be broken down
                // FIX: Use item.grid if available (preferred), otherwise parse layerConfig
                let cols = 1;
                let rows = 1;
                let layers = 1;

                if (item.grid) {
                    cols = item.grid.cols;
                    rows = item.grid.rows;
                    layers = item.grid.layers;
                } else {
                    // Legacy fallback - only for DEFAULT source items
                    // Pipeline items (TOP_UP, FULL_MIX) are individual boxes and 
                    // should NEVER be subdivided by layerConfig
                    const isPipelineItem = item.isFlatTopOff || item.source === 'TOP_UP' || item.source === 'FULL_MIX';
                    const normalizedConfig = layerConfig?.toLowerCase().replace(/[*×]/g, 'x') || '';
                    if (normalizedConfig && normalizedConfig.includes('x') && box && !isPipelineItem) {
                        const parts = normalizedConfig.split('x');
                        const horizontal = parseInt(parts[0], 10) || 0;
                        const vertical = parseInt(parts[1], 10) || 0;
                        if (horizontal > 0 && vertical > 0) {
                            cols = horizontal;
                            layers = vertical;
                        }
                    }
                }

                if (cols > 1 || layers > 1 || rows > 1) {
                    // Break down the stack unit into individual boxes
                    const unitBottomY = item.position[1] - item.dimensions.height / 2;

                    // Calculate individual box dimensions based on the UNIT dimensions and grid
                    // This ensures we render the ROTATED box dimensions correctly
                    const singleBoxL = item.dimensions.length / rows;
                    const singleBoxH = item.dimensions.height / layers;
                    const singleBoxW = item.dimensions.width / cols;

                    const startX = item.position[0] - item.dimensions.length / 2;
                    const startZ = item.position[2] - item.dimensions.width / 2;

                    // FIX: Use item.itemCount to limit rendered boxes
                    const maxItemsToRender = item.itemCount !== undefined ? item.itemCount : (cols * rows * layers);
                    let itemsRenderedCount = 0;

                    for (let l = 0; l < layers; l++) {
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                if (itemsRenderedCount >= maxItemsToRender) break;

                                const bx = startX + r * singleBoxL + singleBoxL / 2;
                                const by = unitBottomY + l * singleBoxH + singleBoxH / 2;
                                const bz = startZ + c * singleBoxW + singleBoxW / 2;

                                itemsToRender.push({
                                    pos: [bx, by, bz],
                                    dims: [singleBoxL, singleBoxH, singleBoxW],
                                    type: 'box',
                                    isFlatTopOff: item.isFlatTopOff
                                });
                                itemsRenderedCount++;
                            }
                        }
                    }
                } else {
                    // No config or single item - render individual box
                    itemsToRender.push({
                        pos: item.position,
                        dims: [item.dimensions.length, item.dimensions.height, item.dimensions.width],
                        type: 'box',
                        isFlatTopOff: item.isFlatTopOff
                    });
                }
            }
        });

        const boxes = itemsToRender.filter(i => i.type === 'box');
        const pallets = itemsToRender.filter(i => i.type === 'pallet_base');

        // Update Box Mesh
        if (meshRef.current) {
            const baseColor = new THREE.Color(color || '#d2b48c');
            const topOffColor = baseColor.clone().offsetHSL(0, 0, 0.3); // 30% lighter

            boxes.forEach((item, i) => {
                const x = (item.pos[0] - containerDims.length / 2) * scale + offset[0];
                const y = item.pos[1] * scale + offset[1];
                const z = (item.pos[2] - containerDims.width / 2) * scale + offset[2];

                tempObject.position.set(x, y, z);
                tempObject.scale.set(item.dims[0] * scale, item.dims[1] * scale, item.dims[2] * scale);
                tempObject.updateMatrix();
                meshRef.current!.setMatrixAt(i, tempObject.matrix);

                // Set color based on isFlatTopOff
                // We need to find the original item to check isFlatTopOff
                // But 'boxes' here are simplified render items.
                // We need to pass isFlatTopOff through itemsToRender.
                if (item.isFlatTopOff) {
                    meshRef.current!.setColorAt(i, topOffColor);
                } else {
                    meshRef.current!.setColorAt(i, baseColor);
                }
            });
            meshRef.current.count = boxes.length;
            meshRef.current.instanceMatrix.needsUpdate = true;
            if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        }

        // Update Pallet Mesh
        if (palletMeshRef.current) {
            pallets.forEach((item, i) => {
                const x = (item.pos[0] - containerDims.length / 2) * scale + offset[0];
                const y = item.pos[1] * scale + offset[1];
                const z = (item.pos[2] - containerDims.width / 2) * scale + offset[2];

                tempPallet.position.set(x, y, z);
                tempPallet.scale.set(item.dims[0] * scale, item.dims[1] * scale, item.dims[2] * scale);
                tempPallet.updateMatrix();
                palletMeshRef.current!.setMatrixAt(i, tempPallet.matrix);
            });
            palletMeshRef.current.count = pallets.length;
            palletMeshRef.current.instanceMatrix.needsUpdate = true;
        }

        // Edges (simplified for boxes)
        const unitBox = new THREE.BoxGeometry(1, 1, 1);
        const unitEdges = new THREE.EdgesGeometry(unitBox);
        const edgePositions = unitEdges.attributes.position.array;
        const totalVertices = boxes.length * edgePositions.length;
        const linePositions = new Float32Array(totalVertices);
        let vertexIndex = 0;

        boxes.forEach(item => {
            const x = (item.pos[0] - containerDims.length / 2) * scale + offset[0];
            const y = item.pos[1] * scale + offset[1];
            const z = (item.pos[2] - containerDims.width / 2) * scale + offset[2];

            for (let j = 0; j < edgePositions.length / 3; j++) {
                const vx = edgePositions[j * 3];
                const vy = edgePositions[j * 3 + 1];
                const vz = edgePositions[j * 3 + 2];

                linePositions[vertexIndex++] = (vx * item.dims[0] * scale) + x;
                linePositions[vertexIndex++] = (vy * item.dims[1] * scale) + y;
                linePositions[vertexIndex++] = (vz * item.dims[2] * scale) + z;
            }
        });

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        setEdgeGeometry(geom);

        unitBox.dispose();
        unitEdges.dispose();

    }, [items, containerDims, offset, scale, box, pallet, layerConfig]);

    return (
        <group>
            <instancedMesh
                ref={meshRef}
                args={[boxGeometry, boxMaterial, 100000]}
            />
            <instancedMesh
                ref={palletMeshRef}
                args={[boxGeometry, palletMaterial, 100]}
            />
            {edgeGeometry && (
                <lineSegments geometry={edgeGeometry}>
                    <lineBasicMaterial color="#000000" linewidth={1} />
                </lineSegments>
            )}
        </group>
    );
};

// Optimization: Use React.memo for the entire component
export const Visualizer = React.memo<VisualizerProps>(({ result, container, box, pallet, layerConfig, box2, pallet2, layerConfig2, materials, onToggleFullscreen, isFullscreen, activeMaterialId, onUpdateMaterialColor }) => {
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
    const [viewMode, setViewMode] = React.useState<'linear' | 'parallel' | 'grid'>('linear');
    const [showColorPicker, setShowColorPicker] = React.useState(false);
    const [monotoneMode, setMonotoneMode] = React.useState(false);

    const toggleViewMode = () => {
        if (viewMode === 'linear') setViewMode('parallel');
        else if (viewMode === 'parallel') setViewMode('grid');
        else setViewMode('linear');
    };

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    // Debug logs


    // Memoize loads to prevent unnecessary Canvas recreation (CRITICAL FIX)
    const stableLoads = useMemo(() => {
        if (!result?.loads) return [];
        return result.loads.filter(
            (load) => load && load.items && Array.isArray(load.items) && load.items.length > 0
        );
    }, [result]);

    // GUARD 1: No result at all
    if (!result) {
        return (
            <div className="h-full w-full bg-gray-900 relative flex items-center justify-center">
                <div className="text-gray-500 text-lg font-medium">Click "Calculate" to see packing visualization</div>

                {/* Keep fullscreen button if needed */}
                {onToggleFullscreen && (
                    <button
                        onClick={onToggleFullscreen}
                        className="absolute top-4 right-4 bg-white/10 backdrop-blur p-2 rounded-lg text-white hover:bg-white/20 transition-colors z-10"
                    >
                        {isFullscreen ? <X className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                    </button>
                )}
            </div>
        );
    }

    // GUARD 2: Result exists but no loads
    if (!result.loads || result.loads.length === 0 || stableLoads.length === 0) {
        return (
            <div className="h-full w-full bg-gray-900 relative flex items-center justify-center">
                <div className="text-gray-500 text-lg font-medium">No containers to display</div>
            </div>
        );
    }

    // Calculate spacing between containers
    const containerLengthM = container.dimensions.length * 0.001;
    const spacing = containerLengthM + 2; // 2 meters gap

    return (
        <div className="h-full w-full bg-gray-900 relative">
            {onToggleFullscreen && (
                <button
                    onClick={onToggleFullscreen}
                    className="absolute top-4 right-4 bg-white/10 backdrop-blur p-2 rounded-lg text-white hover:bg-white/20 transition-colors z-10"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    {isFullscreen ? <X className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </button>
            )}

            {/* View Toggle Button */}
            <button
                onClick={toggleViewMode}
                className="absolute bottom-4 left-4 bg-white/10 backdrop-blur px-3 py-2 rounded-lg text-white text-sm font-medium hover:bg-white/20 transition-colors z-10 border border-white/20"
                title="Change Container View"
            >
                Cntr View: {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
            </button>

            {/* Color Picker Button (Above View Toggle) */}
            {onUpdateMaterialColor && activeMaterialId && (
                <div className="absolute bottom-16 left-4 z-20">
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="bg-white/10 backdrop-blur p-2 rounded-lg text-white hover:bg-white/20 transition-colors border border-white/20 shadow-lg"
                        title="Change Material Color"
                    >
                        <Palette className="w-5 h-5" />
                    </button>
                    {showColorPicker && (
                        <div className="absolute bottom-full left-0 mb-2 p-3 bg-white rounded-lg shadow-xl border border-gray-200 w-64 animate-in fade-in zoom-in duration-200">
                            <div className="text-xs font-semibold text-gray-500 mb-2">Select Color</div>
                            <div className="grid grid-cols-6 gap-2">
                                {PASTEL_PALETTE.map((color) => (
                                    <button
                                        key={color}
                                        className="w-8 h-8 rounded-full border border-gray-100 hover:scale-110 transition-transform shadow-sm"
                                        style={{ backgroundColor: color }}
                                        onClick={() => {
                                            onUpdateMaterialColor(activeMaterialId, color);
                                            setShowColorPicker(false);
                                        }}
                                        title={color}
                                    />
                                ))}
                            </div>
                            {/* Monotone Toggle */}
                            <button
                                onClick={() => setMonotoneMode(!monotoneMode)}
                                className={`w-full mt-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${monotoneMode
                                        ? 'bg-indigo-500 text-white border-indigo-600 shadow-md'
                                        : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                    }`}
                                title="When enabled, Top-Up and Full-Mix boxes use the same color as the base material"
                            >
                                {monotoneMode ? '● Monotone ON' : '○ Monotone OFF'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <Canvas
                key="main-canvas" // Stable key to prevent recreation
                camera={{ position: [10, 10, 10], fov: 50 }}
                dpr={[1, 2]} // Optimize pixel ratio
                gl={{
                    preserveDrawingBuffer: true,
                    powerPreference: 'high-performance',
                    antialias: true
                }}
            >
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
                <OrbitControls makeDefault />

                <Center>
                    {stableLoads.map((load, index) => {
                        let xOffset = 0;
                        let zOffset = 0;

                        if (viewMode === 'linear') {
                            xOffset = index * spacing;
                        } else if (viewMode === 'parallel') {
                            zOffset = index * (container.dimensions.width * 0.001 + 2); // Width + 2m gap
                        } else if (viewMode === 'grid') {
                            const cols = Math.ceil(Math.sqrt(stableLoads.length));
                            const row = Math.floor(index / cols);
                            const col = index % cols;
                            xOffset = col * spacing;
                            zOffset = row * (container.dimensions.width * 0.001 + 2);
                        }

                        // Group items by materialId
                        const itemsByMaterial = new Map<number, PlacedItem[]>();
                        load.items.forEach(item => {
                            const mid = item.materialId || 1;
                            if (!itemsByMaterial.has(mid)) itemsByMaterial.set(mid, []);
                            itemsByMaterial.get(mid)!.push(item);
                        });

                        return (
                            <group key={`${load.id}`}> {/* Stable key based on load ID */}
                                <ContainerView
                                    container={container}
                                    position={[xOffset, 0, zOffset]}
                                />

                                {Array.from(itemsByMaterial.entries()).map(([mid, items]) => {
                                    // Find material data
                                    let matBox: Box | null = null;
                                    let matPallet: Pallet | null = null;
                                    let matConfig: string = '';

                                    if (materials) {
                                        const m = materials.find(mat => mat.id === mid);
                                        if (m) {
                                            matBox = m.box;
                                            matPallet = m.pallet;
                                            matConfig = m.layerConfig;
                                        }
                                    }

                                    // Fallback to legacy props
                                    if (!matBox) {
                                        if (mid === 1) {
                                            matBox = box || null;
                                            matPallet = pallet || null;
                                            matConfig = layerConfig || '';
                                        } else if (mid === 2) {
                                            matBox = box2 || null;
                                            matPallet = pallet2 || null;
                                            matConfig = layerConfig2 || '';
                                        }
                                    }

                                    if (!matBox) return null;

                                    const normalItems = items.filter(i => !i.isFlatTopOff && i.source !== 'FULL_MIX');
                                    const topOffItems = items.filter(i => i.isFlatTopOff);
                                    const fullMixItems = items.filter(i => i.source === 'FULL_MIX');

                                    const getLighterColor = (hex: string) => {
                                        try {
                                            const c = new THREE.Color(hex);
                                            c.offsetHSL(0, 0, 0.3);
                                            return '#' + c.getHexString();
                                        } catch (e) {
                                            return hex;
                                        }
                                    };

                                    const getDarkerColor = (hex: string) => {
                                        try {
                                            const c = new THREE.Color(hex);
                                            c.offsetHSL(0, 0, -0.2); // 20% darker
                                            return '#' + c.getHexString();
                                        } catch (e) {
                                            return hex;
                                        }
                                    };

                                    return (
                                        <React.Fragment key={mid}>
                                            {normalItems.length > 0 && (
                                                <Boxes
                                                    key={`${mid}-normal`}
                                                    items={normalItems}
                                                    containerDims={container.dimensions}
                                                    offset={[xOffset, 0, zOffset]}
                                                    box={matBox}
                                                    pallet={matPallet}
                                                    layerConfig={matConfig}
                                                    color={matBox.color}
                                                />
                                            )}
                                            {topOffItems.length > 0 && (
                                                <Boxes
                                                    key={`${mid}-topoff`}
                                                    items={topOffItems}
                                                    containerDims={container.dimensions}
                                                    offset={[xOffset, 0, zOffset]}
                                                    box={matBox}
                                                    pallet={matPallet}
                                                    layerConfig={matConfig}
                                                    color={monotoneMode ? matBox.color : getLighterColor(matBox.color)}
                                                />
                                            )}
                                            {fullMixItems.length > 0 && (
                                                <Boxes
                                                    key={`${mid}-fullmix`}
                                                    items={fullMixItems}
                                                    containerDims={container.dimensions}
                                                    offset={[xOffset, 0, zOffset]}
                                                    box={matBox}
                                                    pallet={matPallet}
                                                    layerConfig={matConfig}
                                                    color={monotoneMode ? matBox.color : getDarkerColor(matBox.color)}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                <Text
                                    position={[xOffset, -1, zOffset]}
                                    fontSize={0.5}
                                    color="white"
                                    anchorX="center"
                                    anchorY="middle"
                                >
                                    {load.type === 'full' ? `Container ${load.id} (Full)` : `Container ${load.id} (Partial)`}
                                </Text>
                            </group>
                        );
                    })}
                </Center>

                <Grid
                    infiniteGrid
                    fadeDistance={50}
                    sectionColor="#4b5563"
                    cellColor="#374151"
                    position={[0, 0.001, 0]}
                    cellSize={isMobile ? 1 : 0.5}
                    sectionSize={isMobile ? 5 : 1}
                />
            </Canvas>
        </div>
    );
}); // End React.memo
