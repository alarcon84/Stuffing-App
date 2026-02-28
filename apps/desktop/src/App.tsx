import { useState, useCallback, useRef, useEffect } from 'react';
import { InputPanel, Visualizer, BatchProcessor } from '@stuffing-calc/ui';
import { calculatePacking } from '@stuffing-calc/core';
import type { Container, PackingResult, Material, PackingMode } from '@stuffing-calc/core';
import { X, FileText, DollarSign, Scale, Minus, Maximize2, Bug } from 'lucide-react';
import './index.css';
import packageJson from '../package.json';

const CONTAINER_TYPES: Container[] = [
  { name: "20ft", type: '20', dimensions: { length: 5865, width: 2330, height: 2200 }, doorHeight: 2200 },
  { name: "40ft", type: '40', dimensions: { length: 12000, width: 2330, height: 2200 }, doorHeight: 2200 },
  { name: "40HC", type: '40HC', dimensions: { length: 12000, width: 2330, height: 2540 }, doorHeight: 2540 },
  { name: "EU Trailer", type: 'eu-trailer', dimensions: { length: 13600, width: 2450, height: 2600 } },
  { name: "EU Mega", type: 'eu-mega', dimensions: { length: 13600, width: 2450, height: 2700 } },
  { name: "53ft", type: '53', dimensions: { length: 15955, width: 2560, height: 2820 } },
  { name: "11Ton WT", type: '11tonwt', dimensions: { length: 9100, width: 2380, height: 2325 } },
  { name: "20ft Std", type: 'custom', dimensions: { length: 5898, width: 2352, height: 2393 } },
  { name: "40ft Std", type: 'custom', dimensions: { length: 12032, width: 2352, height: 2393 } },
  { name: "40HC Std", type: 'custom', dimensions: { length: 12032, width: 2352, height: 2698 } },
  { name: "53ft Std", type: 'custom', dimensions: { length: 16000, width: 2540, height: 2700 } },
  { name: "Custom", type: 'custom', dimensions: { length: 12000, width: 2400, height: 2600 } },
];

function App() {
  const [packingResult, setPackingResult] = useState<PackingResult | null>(null);
  const [currentContainer, setCurrentContainer] = useState<Container>({
    name: "53ft",
    type: '53',
    dimensions: { length: 15955, width: 2560, height: 2820 }
  });

  // Multi-Material State (for visualization)
  const [currentMaterials, setCurrentMaterials] = useState<Material[]>([]);

  const [showAllContainers, setShowAllContainers] = useState(false);
  const [allContainersData, setAllContainersData] = useState<number[]>([]);

  // Cost Estimator State
  const [showCostModal, setShowCostModal] = useState(false);
  const [costPerContainer, setCostPerContainer] = useState(1500);
  const [costPerItem, setCostPerItem] = useState(0.5);

  // Weight & Volume State
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // Batch Processor State
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Results Panel State
  const [resultsMinimized, setResultsMinimized] = useState(false);

  // Settings Tracker (from InputPanel)
  const [currentSettings, setCurrentSettings] = useState<{
    container: Container;
    materials: Material[];
    packingMode: PackingMode;
    margins: { length: number; width: number; height: number };
    enableTopUp: boolean;
    enableFullMix: boolean;
    fullMixRotations: { x: boolean; y: boolean; z: boolean };
    activeMaterial?: Material;
  } | null>(null);

  const [pendingColorUpdate, setPendingColorUpdate] = useState<{ id: number; color: string } | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [hoveredVcId, setHoveredVcId] = useState<string | null>(null);
  const [clickedVcId, setClickedVcId] = useState<string | null>(null);
  const activeVcId = clickedVcId || hoveredVcId;

  // Ref for debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to hold latest data for the async calculation to avoid closure staleness
  const latestDataRef = useRef<{
    container: Container;
    materials: Material[];
    packingMode: PackingMode;
    margins?: { length: number; width: number; height: number };
    enableTopUp?: boolean;
    enableFullMix?: boolean;
    fullMixRotations?: { x: boolean; y: boolean; z: boolean };
  } | null>(null);

  // Perform calculation using the REF data (always fresh)
  const performCalculationWithRef = useCallback(() => {
    if (!latestDataRef.current) return;

    const { container, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations } = latestDataRef.current;

    setIsCalculating(true);

    try {
      const newResult = calculatePacking(
        container,
        materials,
        false,
        margins,
        packingMode,
        enableTopUp,
        enableFullMix,
        fullMixRotations
      );



      setPackingResult(() => {
        // Always update result to ensure visualizer reflects changes in position/layout
        // even if totals remain the same (e.g. toggling Full Mix might move items but keep count)
        return newResult;
      });
    } catch (err) {
      console.error("Calculation failed", err);
    } finally {
      setIsCalculating(false);
    }
  }, []);

  const handleCalculate = useCallback((
    container: Container,
    materials: Material[],
    packingMode: PackingMode,
    margins?: { length: number; width: number; height: number },
    enableTopUp?: boolean,
    enableFullMix?: boolean,
    fullMixRotations?: { x: boolean; y: boolean; z: boolean }
  ) => {
    // Update local state for UI
    setCurrentContainer(container);
    setCurrentMaterials(materials);

    // Update ref for calculation - IMPLICIT SYNC (Backup)
    latestDataRef.current = { container, materials, packingMode, margins, enableTopUp, enableFullMix, fullMixRotations };

    // Clear any pending calculation
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the heavy calculation
    debounceTimerRef.current = setTimeout(() => {
      performCalculationWithRef();
    }, 300); // 300ms debounce
  }, [performCalculationWithRef]);

  // Global Enter Key Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        performCalculationWithRef();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performCalculationWithRef]);
  const captureSession = async () => {
    if (!packingResult) return;
    setIsCapturing(true);
    try {
      // Use window.require inside try/catch so browser testing doesn't crash completely
      // Only works if contextIsolation is false
      //@ts-ignore
      const fs = window.require?.('fs');
      //@ts-ignore
      const path = window.require?.('path');
      //@ts-ignore
      const { ipcRenderer } = window.require?.('electron');

      if (!fs || !path || !ipcRenderer) {
        console.error("Session logger only available in Electron mode");
        return;
      }

      // We assume process.cwd() is the project root
      //@ts-ignore
      const process = window.require?.('process');
      const debugDir = path.join(process?.cwd() || '.', 'Session Debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const debugData = {
        timestamp,
        settings: currentSettings,
        materials: currentMaterials,
        container: currentContainer,
        result: packingResult,
      };

      const jsonPath = path.join(debugDir, `debug_${timestamp}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(debugData, null, 2));

      const imgBufferData = await ipcRenderer.invoke('take-screenshot');
      const imgPath = path.join(debugDir, `debug_${timestamp}.png`);
      fs.writeFileSync(imgPath, imgBufferData);

      console.log(`Saved session debugger data to ${debugDir}`);

      // Give visual feedback by flashing the capture state slightly longer
      setTimeout(() => setIsCapturing(false), 500);
      return;
    } catch (err) {
      console.error('Failed to capture session data', err);
    }
    setIsCapturing(false);
  };


  const handleShowAllContainers = () => {
    if (currentMaterials.length === 0) return;

    // Only calculate for the first active material for this quick view
    const firstMat = currentMaterials.find(m => m.active);
    if (!firstMat) return;

    // Use current settings if available, else defaults
    const margin = currentSettings?.margins || { length: 20, width: 20, height: 20 };
    const mode = currentSettings?.packingMode || 'SEQUENTIAL';
    const topUp = currentSettings?.enableTopUp || false;
    const fullMix = currentSettings?.enableFullMix || false;
    const rotations = currentSettings?.fullMixRotations;

    const results = CONTAINER_TYPES.map(cont => {
      // Create a temp material with large quantity
      const tempMat = { ...firstMat, quantity: 100000 };

      const res = calculatePacking(
        cont,
        [tempMat],
        false,
        margin,
        mode,
        topUp,
        fullMix,
        rotations
      );

      // Find the item count of the first load (which should be full)
      if (res.loads.length > 0) {
        return res.loads[0].itemCount;
      }
      return 0;
    });

    setAllContainersData(results);
    setShowAllContainers(true);
  };

  // Cost Calculation
  const totalCost = packingResult ? (packingResult.totalContainers * costPerContainer) + (packingResult.totalItems * costPerItem) : 0;

  // Weight & Volume Calculation
  const getWeightAndVolumeStats = () => {
    if (!packingResult || packingResult.loads.length === 0) return null;

    const firstLoad = packingResult.loads[0];

    // Calculate Weight
    let totalWeightKg = 0;

    firstLoad.items.forEach(item => {
      const matId = item.materialId || 1;
      const count = item.itemCount || 1;
      const mat = currentMaterials.find(m => m.id === matId);

      if (mat) {
        if (mat.box.weightKg) {
          totalWeightKg += mat.box.weightKg * count;
        }
        if (item.type === 'pallet' && mat.pallet.weightKg) {
          totalWeightKg += mat.pallet.weightKg;
        }
      }
    });

    // Calculate Volume (m3)
    let totalVolumeM3 = 0;
    firstLoad.items.forEach(item => {
      const matId = item.materialId || 1;
      const count = item.itemCount || 1;
      const mat = currentMaterials.find(m => m.id === matId);

      if (mat) {
        const boxDims = mat.box.dimensions;
        const volM3 = (boxDims.length / 1000) * (boxDims.width / 1000) * (boxDims.height / 1000);
        totalVolumeM3 += volM3 * count;
      }
    });


    // Limits
    // 53' Trailer defaults
    let maxWeightKg = 20412; // ~45,000 lbs
    let maxVolumeM3 = 110; // ~3884 ft3 (approx for 53')

    if (currentContainer.type === '20') {
      maxWeightKg = 28000;
      maxVolumeM3 = 33;
    } else if (currentContainer.type === '40') {
      maxWeightKg = 26500;
      maxVolumeM3 = 67;
    } else if (currentContainer.type === '40HC') {
      maxWeightKg = 26300;
      maxVolumeM3 = 76;
    }

    const isWeightOver = totalWeightKg > maxWeightKg;
    const isVolumeOver = totalVolumeM3 > maxVolumeM3;

    return {
      totalWeightKg,
      totalVolumeM3,
      maxWeightKg,
      maxVolumeM3,
      isWeightOver,
      isVolumeOver
    };
  };

  const weightStats = getWeightAndVolumeStats();
  const isOverLimit = weightStats ? (weightStats.isWeightOver || weightStats.isVolumeOver) : false;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <InputPanel
        onCalculate={handleCalculate}
        optimizations={packingResult?.optimizationsAvailable}
        onSettingsChange={setCurrentSettings}
        pendingColorUpdate={pendingColorUpdate}
      />

      {/* Visualizer Wrapper with Transition */}
      <div className={`flex-1 relative transition-opacity duration-200 ${isCalculating ? 'opacity-60' : 'opacity-100'}`}>
        <Visualizer
          result={packingResult}
          container={currentContainer}
          // Pass legacy props for backward compatibility
          box={currentMaterials[0]?.box}
          pallet={currentMaterials[0]?.pallet}
          layerConfig={currentMaterials[0]?.layerConfig}
          box2={currentMaterials[1]?.box}
          pallet2={currentMaterials[1]?.pallet}
          layerConfig2={currentMaterials[1]?.layerConfig}
          // New prop for multi-material support
          materials={currentMaterials}
          activeMaterialId={currentSettings?.activeMaterial?.id}
          onUpdateMaterialColor={(id, color) => setPendingColorUpdate({ id, color })}
          highlightedVcId={activeVcId}
          topHeaderContent={
            packingResult && (
              <>
                <button onClick={() => setShowCostModal(true)} className="hover:text-green-400 flex items-center gap-1 transition-colors" title="Cost Estimator">
                  <DollarSign className="w-4 h-4" /> Cost
                </button>
                <div className="w-px h-4 bg-[#444]" />
                <button
                  onClick={() => setShowWeightModal(true)}
                  className={`flex items-center gap-1 transition-colors ${isOverLimit ? 'text-red-400 animate-pulse' : 'hover:text-blue-400'}`}
                  title={isOverLimit ? "Over Limit – Click for details" : "Weight & Volume Limits"}
                >
                  <Scale className="w-4 h-4" /> Limits
                </button>
                <div className="w-px h-4 bg-[#444]" />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{packingResult.totalItems} Items</span>
                  <span className="text-[#666]">•</span>
                  <span className="font-semibold text-white">{packingResult.totalContainers} Containers</span>
                </div>
                <button onClick={() => setResultsMinimized(!resultsMinimized)} className="ml-2 text-gray-400 hover:text-white transition-colors" title="Toggle Detailed Results">
                  {resultsMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                </button>
              </>
            )
          }
          extraToolbarButtons={
            <>
              <button onClick={() => setShowBatchModal(true)} className="hover:text-green-400 flex items-center gap-1 transition-colors" title="Batch process Excel file">
                <FileText className="w-4 h-4" /> Excel Up
              </button>
              <div className="w-px h-4 bg-[#444]" />
              <button onClick={handleShowAllContainers} className="hover:text-blue-400 flex items-center gap-1 transition-colors" title="Calculate for all container types">
                <FileText className="w-4 h-4" /> All Containers
              </button>
              {packingResult && (
                <>
                  <div className="w-px h-4 bg-[#444]" />
                  <button onClick={captureSession} disabled={isCapturing} className={`flex items-center gap-1 transition-colors ${isCapturing ? 'text-red-400' : 'hover:text-red-400'}`} title="Log Settings & Screenshot to Session Debug folder">
                    <Bug className="w-4 h-4" /> {isCapturing ? 'Capt...' : 'Debug'}
                  </button>
                </>
              )}
            </>
          }
        />

        {/* Loading Overlay */}
        {isCalculating && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#121212]/50 backdrop-blur-sm pointer-events-none">
            <div className="bg-[#1E1E1E] px-6 py-4 rounded-xl shadow-2xl border border-[#333] flex items-center gap-4 animate-in fade-in zoom-in duration-200">
              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-[#E0E0E0] font-semibold">Calculating Layout...</div>
            </div>
          </div>
        )}

        {/* Detailed Results Modal - Floating below header */}
        {packingResult && !resultsMinimized && (
          <div className="absolute top-[72px] right-4 bg-[#1E1E1E]/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#333] w-72 overflow-hidden z-20 animate-in fade-in slide-in-from-right-2">
            <div className="flex items-center justify-between p-4 pb-2 border-b border-[#333]">
              <h3 className="font-bold text-white">Packing Results</h3>
              <button
                onClick={() => setResultsMinimized(true)}
                className="p-1 hover:bg-[#2C2C2C] rounded transition-colors"
                title="Minimize"
              >
                <Minus className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="px-4 pb-4 pt-2">
              <div className="space-y-1 text-sm text-[#E0E0E0]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Items:</span>
                  <span className="font-semibold text-white">{packingResult.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Containers:</span>
                  <span className="font-semibold text-white">{packingResult.totalContainers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Pallets:</span>
                  <span className="font-semibold text-white">{packingResult.totalPallets ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Lots:</span>
                  <span className="font-semibold text-white">{packingResult.totalLots ?? 0}</span>
                </div>

                <div className="border-t border-[#333] pt-2 mt-2">
                  <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Load Details:</div>
                  <div className="max-h-80 overflow-y-auto pr-1 flex flex-col gap-2 no-scrollbar">
                    {packingResult.loads.map(load => {
                      const itemsByVc = new Map<string, Map<number, number>>();
                      let totalItemsInLoad = 0;
                      load.items.forEach(item => {
                        const vcId = item.vcId || 'Main Loading Area';
                        const mid = item.materialId || 1;
                        const count = item.itemCount || 0;
                        totalItemsInLoad += count;
                        if (!itemsByVc.has(vcId)) itemsByVc.set(vcId, new Map<number, number>());
                        const matMap = itemsByVc.get(vcId)!;
                        matMap.set(mid, (matMap.get(mid) || 0) + count);
                      });

                      return (
                        <div key={load.id} className="bg-[#2C2C2C] rounded-lg p-2 border border-[#444]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-white">#{load.id} ({load.type})</span>
                            <div className="flex gap-2 items-center">
                              <span className="text-[10px] text-gray-400">{totalItemsInLoad} items</span>
                              <span className={`text-xs font-semibold ${load.utilization > 85 ? 'text-green-400' : 'text-blue-400'}`}>{load.utilization.toFixed(1)}% Util</span>
                            </div>
                          </div>
                          {Array.from(itemsByVc.entries()).map(([vcId, matMap]) => (
                            <div key={vcId} className="mb-1">
                              <div
                                className={`text-[10px] font-semibold px-2 py-1 rounded mb-1 truncate cursor-pointer transition-all duration-200 border ${activeVcId === vcId
                                  ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm scale-[1.02]'
                                  : 'bg-[#1E1E1E] border-[#444] text-[#AAA] hover:bg-[#333] hover:border-[#555] hover:text-[#CCC]'
                                  }`}
                                title={vcId !== 'Main Loading Area' ? 'Click to persistent highlight in 3D View' : undefined}
                                onMouseEnter={() => vcId !== 'Main Loading Area' && setHoveredVcId(vcId)}
                                onMouseLeave={() => setHoveredVcId(null)}
                                onClick={() => vcId !== 'Main Loading Area' && setClickedVcId(clickedVcId === vcId ? null : vcId)}
                              >
                                {vcId.replace('vc_', 'Space: ').replace(/_/g, ' ')}
                              </div>
                              {
                                Array.from(matMap.entries()).map(([mid, count]) => {
                                  const mat = currentMaterials.find(m => m.id === mid);
                                  return (
                                    <div key={`${vcId}-${mid}`} className="flex justify-between text-[10px] text-gray-400 pl-2">
                                      <span style={{ color: mat?.box.color }}>Mat {mid}:</span>
                                      <span className="text-[#E0E0E0]">{count} items</span>
                                    </div>
                                  );
                                })
                              }
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-[#555] pointer-events-none select-none z-10 font-sans">
          © Jorge Alarcón 2026 • Reynosa, MX • v{packageJson.version}
        </div>

        {/* Batch Processor Modal */}
        {showBatchModal && (
          <BatchProcessor
            onClose={() => setShowBatchModal(false)}
            currentSettings={currentSettings}
          />
        )}

        {/* All Containers Modal */}
        {showAllContainers && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1E1E1E] border border-[#333] rounded-xl shadow-2xl w-[600px] overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between p-4 border-b border-[#333]">
                <h3 className="font-bold text-lg text-white">All Containers Calculation</h3>
                <button onClick={() => setShowAllContainers(false)} className="p-1 hover:bg-[#2C2C2C] rounded transition-colors">
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-400 mb-4">
                  Max items per single full container (Material 1 only). Select table content to copy to Excel.
                </p>

                <div className="border border-[#444] rounded-lg overflow-hidden bg-[#2C2C2C]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#121212] text-gray-300 font-semibold border-b border-[#444]">
                      <tr>
                        <th className="p-3 border-r border-[#444]">Container</th>
                        <th className="p-3 border-r border-[#444]">20ft</th>
                        <th className="p-3 border-r border-[#444]">40ft</th>
                        <th className="p-3 border-r border-[#444]">40ftHC</th>
                        <th className="p-3">53ft</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-[#333] transition-colors">
                        <td className="p-3 border-r border-[#444] font-medium text-gray-400 bg-[#121212]/50">Items per full</td>
                        {allContainersData.map((count, idx) => (
                          <td key={idx} className="p-3 border-r border-[#444] last:border-r-0 font-mono text-[#E0E0E0]">
                            {count}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  * Click and drag to select table cells, then Ctrl+C to copy.
                </p>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-[#333] bg-[#121212]/50">
                <button
                  onClick={() => setShowAllContainers(false)}
                  className="px-4 py-2 bg-[#333] text-white rounded-lg hover:bg-[#444] transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cost Estimator Modal */}
        {showCostModal && packingResult && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1E1E1E] border border-[#333] rounded-xl shadow-2xl w-96 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between p-4 border-b border-[#333] bg-green-900/20">
                <h3 className="font-bold text-lg text-green-400 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" /> Cost Estimator
                </h3>
                <button onClick={() => setShowCostModal(false)} className="p-1 hover:bg-green-900/40 rounded transition-colors text-green-500 hover:text-green-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-400">Total Estimated Cost</div>
                  <div className="text-4xl font-bold text-white tracking-tight mt-1">
                    ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost per Container</label>
                    <div className="flex items-center mt-1.5 shadow-sm rounded-lg overflow-hidden border border-[#444] bg-[#2C2C2C] focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                      <span className="bg-[#121212]/50 p-2.5 text-gray-500 font-medium">USD</span>
                      <input
                        type="number"
                        value={costPerContainer}
                        onChange={(e) => setCostPerContainer(Number(e.target.value))}
                        className="w-full p-2.5 bg-transparent text-white outline-none"
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5 flex justify-between">
                      <span>{packingResult.totalContainers} containers</span>
                      <span>${(packingResult.totalContainers * costPerContainer).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost per Item</label>
                    <div className="flex items-center mt-1.5 shadow-sm rounded-lg overflow-hidden border border-[#444] bg-[#2C2C2C] focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                      <span className="bg-[#121212]/50 p-2.5 text-gray-500 font-medium">USD</span>
                      <input
                        type="number"
                        value={costPerItem}
                        onChange={(e) => setCostPerItem(Number(e.target.value))}
                        step="0.01"
                        className="w-full p-2.5 bg-transparent text-white outline-none"
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5 flex justify-between">
                      <span>{packingResult.totalItems} items</span>
                      <span>${(packingResult.totalItems * costPerItem).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[#333] bg-[#121212]/50 flex justify-end">
                <button
                  onClick={() => setShowCostModal(false)}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 font-medium transition-colors shadow-lg"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weight & Volume Modal */}
        {showWeightModal && weightStats && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#1E1E1E] border border-[#333] rounded-xl shadow-2xl w-96 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between p-4 border-b border-[#333] bg-blue-900/20">
                <h3 className="font-bold text-lg text-blue-400 flex items-center gap-2">
                  <Scale className="w-5 h-5" /> Weight & Volume
                </h3>
                <button onClick={() => setShowWeightModal(false)} className="p-1 hover:bg-blue-900/40 rounded transition-colors text-blue-500 hover:text-blue-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg')}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Switch to {weightUnit === 'kg' ? 'lbs/ft³' : 'kg/m³'}
                  </button>
                </div>

                {/* Weight Section */}
                <div className="bg-[#2C2C2C] p-4 rounded-xl border border-[#444] relative overflow-hidden">
                  {weightStats.isWeightOver && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-semibold text-gray-300">Total Weight</label>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weightStats.isWeightOver ? 'bg-red-900/40 text-red-400 border border-red-800' : 'bg-green-900/40 text-green-400 border border-green-800'}`}>
                      {weightStats.isWeightOver ? 'OVER LIMIT' : 'OK'}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold tracking-tight ${weightStats.isWeightOver ? 'text-red-400' : 'text-white'}`}>
                    {weightUnit === 'kg'
                      ? `${weightStats.totalWeightKg.toLocaleString()} kg`
                      : `${(weightStats.totalWeightKg * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`
                    }
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#444]">
                    <div className="text-xs text-gray-500">
                      Limit: <span className="text-gray-400 font-medium">{weightUnit === 'kg' ? `${weightStats.maxWeightKg.toLocaleString()} kg` : `${(weightStats.maxWeightKg * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`}</span>
                    </div>
                    {weightStats.isWeightOver && (
                      <div className="text-xs text-red-400 font-medium">
                        +{weightUnit === 'kg'
                          ? `${(weightStats.totalWeightKg - weightStats.maxWeightKg).toLocaleString()} kg`
                          : `${((weightStats.totalWeightKg - weightStats.maxWeightKg) * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Volume Section */}
                <div className="bg-[#2C2C2C] p-4 rounded-xl border border-[#444] relative overflow-hidden">
                  {weightStats.isVolumeOver && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-semibold text-gray-300">Total Volume</label>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weightStats.isVolumeOver ? 'bg-red-900/40 text-red-400 border border-red-800' : 'bg-green-900/40 text-green-400 border border-green-800'}`}>
                      {weightStats.isVolumeOver ? 'OVER LIMIT' : 'OK'}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold tracking-tight ${weightStats.isVolumeOver ? 'text-red-400' : 'text-white'}`}>
                    {weightUnit === 'kg'
                      ? `${weightStats.totalVolumeM3.toFixed(2)} m³`
                      : `${(weightStats.totalVolumeM3 * 35.3147).toFixed(0)} ft³`
                    }
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#444]">
                    <div className="text-xs text-gray-500">
                      Limit: <span className="text-gray-400 font-medium">{weightUnit === 'kg' ? `${weightStats.maxVolumeM3} m³` : `${(weightStats.maxVolumeM3 * 35.3147).toFixed(0)} ft³`}</span>
                    </div>
                    {weightStats.isVolumeOver && (
                      <div className="text-xs text-red-400 font-medium">
                        +{weightUnit === 'kg'
                          ? `${(weightStats.totalVolumeM3 - weightStats.maxVolumeM3).toFixed(2)} m³`
                          : `${((weightStats.totalVolumeM3 - weightStats.maxVolumeM3) * 35.3147).toFixed(0)} ft³`
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-[#333] bg-[#121212]/50 flex justify-end">
                <button
                  onClick={() => setShowWeightModal(false)}
                  className="px-5 py-2 bg-[#333] text-white rounded-lg hover:bg-[#444] font-medium transition-colors shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      {/* DebugPanel removed to prevent user confusion with main controls */}
      {/* <DebugPanel /> */}
    </div >
  );
}

export default App;
