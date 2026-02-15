import { useState, useCallback, Suspense, lazy } from 'react';
import { InputPanel, BatchProcessor } from '@stuffing-calc/ui';
import { calculatePacking } from '@stuffing-calc/core';
import type { Container, PackingResult, Material } from '@stuffing-calc/core';
import { X, FileText, DollarSign, Scale, Loader2 } from 'lucide-react';
import './index.css';

// Lazy load Visualizer for performance
const Visualizer = lazy(() => import('@stuffing-calc/ui').then(module => ({ default: module.Visualizer })));

const CONTAINER_TYPES: Container[] = [
  { name: "20' Standard", type: '20', dimensions: { length: 5898, width: 2352, height: 2393 } },
  { name: "40' Standard", type: '40', dimensions: { length: 12032, width: 2352, height: 2393 } },
  { name: "40' High Cube", type: '40HC', dimensions: { length: 12032, width: 2352, height: 2698 } },
  { name: "53' Trailer", type: '53', dimensions: { length: 16000, width: 2540, height: 2700 } },
];

function App() {
  const [packingResult, setPackingResult] = useState<PackingResult | null>(null);
  const [currentContainer, setCurrentContainer] = useState<Container>({
    name: "53' Trailer",
    type: '53',
    dimensions: { length: 16000, width: 2540, height: 2700 }
  });

  // Multi-Material State
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

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);


  const handleCalculate = useCallback((
    container: Container,
    materials: Material[],
    packingMode: import('@stuffing-calc/core').PackingMode,
    margins?: { length: number; width: number; height: number },
    enableTopUp?: boolean,
    enableFullMix?: boolean
  ) => {
    setCurrentContainer(container);
    setCurrentMaterials(materials);

    const result = calculatePacking(container, materials, false, margins, packingMode, enableTopUp, enableFullMix);
    console.log('Calculation result:', result);
    setPackingResult(result);
  }, []);

  const handleShowAllContainers = () => {
    if (currentMaterials.length === 0) return;

    // Only calculate for the first active material for this quick view
    const firstMat = currentMaterials.find(m => m.active);
    if (!firstMat) return;

    let data = "Container\t20ft\t40ft\t40ftHC\t53ft\n";
    data += "Items per full";

    const results = CONTAINER_TYPES.map(cont => {
      // Create a temp material with large quantity
      const tempMat = { ...firstMat, quantity: 100000 };

      const res = calculatePacking(
        cont,
        [tempMat],
        false,
        { length: 20, width: 20, height: 20 },
        'SEQUENTIAL'
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
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden">
      <InputPanel onCalculate={handleCalculate} />
      <div className={isFullscreen ? "fixed inset-0 z-50 w-screen h-screen bg-gray-900" : "flex-1 relative h-full"}>
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
          <Visualizer
            result={packingResult}
            container={currentContainer}
            materials={currentMaterials}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            // Legacy props for safety/compatibility if needed, but Visualizer handles materials prop now
            box={currentMaterials[0]?.box}
            pallet={currentMaterials[0]?.pallet}
            layerConfig={currentMaterials[0]?.layerConfig}
            box2={currentMaterials[1]?.box}
            pallet2={currentMaterials[1]?.pallet}
            layerConfig2={currentMaterials[1]?.layerConfig}
          />
        </Suspense>

        {/* Overlay Stats */}
        {packingResult && (
          <div className="absolute top-4 right-4 flex gap-2 items-start pointer-events-none">
            {/* Action Buttons - Pointer events auto */}
            <div className="flex flex-col gap-2 pointer-events-auto">
              <button
                onClick={() => setShowCostModal(true)}
                className="bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-200 text-gray-700 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Cost Estimator"
              >
                <DollarSign className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowWeightModal(true)}
                className={`bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-200 transition-colors ${isOverLimit ? 'text-red-600 bg-red-50 border-red-200 animate-pulse' : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'}`}
                title={isOverLimit ? "Over Limit – Click for details" : "Weight & Volume Limits"}
              >
                <Scale className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg border border-gray-200 w-72 pointer-events-auto hidden md:block">
              <h3 className="font-bold text-gray-800 mb-2">Packing Results</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold">{packingResult.totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Containers:</span>
                  <span className="font-semibold">{packingResult.totalContainers}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Total Pallets:</span>
                  <span className="font-semibold">{packingResult.totalPallets ?? 0}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Total Lots:</span>
                  <span className="font-semibold">{packingResult.totalLots ?? 0}</span>
                </div>

                <div className="border-t pt-2 mt-2">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Load Details:</div>
                  {packingResult.loads.map(load => {
                    const itemsByMaterial = new Map<number, number>();
                    load.items.forEach(item => {
                      const mid = item.materialId || 1;
                      const count = item.itemCount || 0;
                      itemsByMaterial.set(mid, (itemsByMaterial.get(mid) || 0) + count);
                    });

                    return (
                      <div key={load.id} className="mb-2 border-b border-gray-100 pb-1 last:border-0">
                        <div className="flex justify-between text-xs font-medium text-gray-700">
                          <span>#{load.id} ({load.type})</span>
                          <span>{load.utilization.toFixed(1)}% Util</span>
                        </div>
                        {Array.from(itemsByMaterial.entries()).map(([mid, count]) => {
                          const mat = currentMaterials.find(m => m.id === mid);
                          return (
                            <div key={mid} className="flex justify-between text-[10px] text-gray-500 pl-2">
                              <span style={{ color: mat?.box.color }}>Mat {mid}:</span>
                              <span>{count} items</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        )}

        {/* All Containers Button */}
        <button
          onClick={handleShowAllContainers}
          className="absolute bottom-4 right-4 bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-200 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2 text-sm font-semibold"
          title="Calculate for all container types"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden md:inline">All Containers</span>
        </button>

        {/* Footer Info */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-400/50 pointer-events-none select-none z-10 font-sans">
          © Jorge Alarcón 2026 • Reynosa, MX
        </div>

        {/* Excel Up Button */}
        <button
          onClick={() => setShowBatchModal(true)}
          className="absolute bottom-4 right-16 md:right-40 bg-white/90 backdrop-blur p-2 rounded-lg shadow-lg border border-gray-200 text-gray-700 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center gap-2 text-sm font-semibold"
          title="Batch process Excel file"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden md:inline">Excel Up</span>
        </button>

        {/* Batch Processor Modal */}
        {showBatchModal && (
          <BatchProcessor onClose={() => setShowBatchModal(false)} />
        )}

        {/* All Containers Modal */}
        {showAllContainers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[600px] overflow-hidden m-4">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-bold text-lg text-gray-800">All Containers Calculation</h3>
                <button
                  onClick={() => setShowAllContainers(false)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <p className="text-sm text-gray-500 mb-4">
                  Max items per single full container (Material 1 only). Select table content to copy to Excel.
                </p>

                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-semibold">
                      <tr>
                        <th className="p-3 border-b border-r">Container</th>
                        <th className="p-3 border-b border-r">20ft</th>
                        <th className="p-3 border-b border-r">40ft</th>
                        <th className="p-3 border-b border-r">40ftHC</th>
                        <th className="p-3 border-b">53ft</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-gray-50">
                        <td className="p-3 border-r font-medium text-gray-600">Items per full</td>
                        {allContainersData.map((count, idx) => (
                          <td key={idx} className="p-3 border-r last:border-r-0 font-mono">
                            {count}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  * Click and drag to select table cells, then Ctrl+C to copy.
                </p>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
                <button
                  onClick={() => setShowAllContainers(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cost Estimator Modal */}
        {showCostModal && packingResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden m-4">
              <div className="flex items-center justify-between p-4 border-b bg-green-50">
                <h3 className="font-bold text-lg text-green-800 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" /> Cost Estimator
                </h3>
                <button onClick={() => setShowCostModal(false)} className="p-1 hover:bg-green-100 rounded text-green-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-500">Total Estimated Cost</div>
                  <div className="text-3xl font-bold text-gray-800">
                    ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Cost per Container</label>
                    <div className="flex items-center mt-1">
                      <span className="bg-gray-100 border border-r-0 rounded-l p-2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={costPerContainer}
                        onChange={(e) => setCostPerContainer(Number(e.target.value))}
                        className="w-full p-2 border rounded-r focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {packingResult.totalContainers} containers × ${costPerContainer} = ${(packingResult.totalContainers * costPerContainer).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Cost per Item</label>
                    <div className="flex items-center mt-1">
                      <span className="bg-gray-100 border border-r-0 rounded-l p-2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={costPerItem}
                        onChange={(e) => setCostPerItem(Number(e.target.value))}
                        step="0.01"
                        className="w-full p-2 border rounded-r focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {packingResult.totalItems} items × ${costPerItem} = ${(packingResult.totalItems * costPerItem).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowCostModal(false)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weight & Volume Modal */}
        {showWeightModal && weightStats && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden m-4">
              <div className="flex items-center justify-between p-4 border-b bg-blue-50">
                <h3 className="font-bold text-lg text-blue-800 flex items-center gap-2">
                  <Scale className="w-5 h-5" /> Weight & Volume
                </h3>
                <button onClick={() => setShowWeightModal(false)} className="p-1 hover:bg-blue-100 rounded text-blue-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Switch to {weightUnit === 'kg' ? 'lbs/ft³' : 'kg/m³'}
                  </button>
                </div>

                {/* Weight Section */}
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-sm font-bold text-gray-700">Total Weight (1st Container)</label>
                    <span className={`text-xs font-semibold ${weightStats.isWeightOver ? 'text-red-600' : 'text-green-600'}`}>
                      {weightStats.isWeightOver ? 'OVER LIMIT' : 'WITHIN LIMIT'}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${weightStats.isWeightOver ? 'text-red-600' : 'text-gray-800'}`}>
                    {weightUnit === 'kg'
                      ? `${weightStats.totalWeightKg.toLocaleString()} kg`
                      : `${(weightStats.totalWeightKg * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`
                    }
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Limit: {weightUnit === 'kg' ? `${weightStats.maxWeightKg.toLocaleString()} kg` : `${(weightStats.maxWeightKg * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`}
                  </div>
                  {weightStats.isWeightOver && (
                    <div className="text-xs text-red-500 mt-1 font-medium">
                      Exceeds limit by {weightUnit === 'kg'
                        ? `${(weightStats.totalWeightKg - weightStats.maxWeightKg).toLocaleString()} kg`
                        : `${((weightStats.totalWeightKg - weightStats.maxWeightKg) * 2.20462).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`
                      }
                    </div>
                  )}
                </div>

                <hr />

                {/* Volume Section */}
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-sm font-bold text-gray-700">Total Volume (1st Container)</label>
                    <span className={`text-xs font-semibold ${weightStats.isVolumeOver ? 'text-red-600' : 'text-green-600'}`}>
                      {weightStats.isVolumeOver ? 'OVER LIMIT' : 'WITHIN LIMIT'}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${weightStats.isVolumeOver ? 'text-red-600' : 'text-gray-800'}`}>
                    {weightUnit === 'kg'
                      ? `${weightStats.totalVolumeM3.toFixed(2)} m³`
                      : `${(weightStats.totalVolumeM3 * 35.3147).toFixed(0)} ft³`
                    }
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Limit: {weightUnit === 'kg' ? `${weightStats.maxVolumeM3} m³` : `${(weightStats.maxVolumeM3 * 35.3147).toFixed(0)} ft³`}
                  </div>
                  {weightStats.isVolumeOver && (
                    <div className="text-xs text-red-500 mt-1 font-medium">
                      Exceeds limit by {weightUnit === 'kg'
                        ? `${(weightStats.totalVolumeM3 - weightStats.maxVolumeM3).toFixed(2)} m³`
                        : `${((weightStats.totalVolumeM3 - weightStats.maxVolumeM3) * 35.3147).toFixed(0)} ft³`
                      }
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowWeightModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

export default App;
