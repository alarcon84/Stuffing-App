import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { calculatePacking } from '@stuffing-calc/core';
import type { Container, Box, Material, PackingMode } from '@stuffing-calc/core';
import { Upload, FileSpreadsheet, Download, AlertCircle, Loader2, X } from 'lucide-react';

interface BatchProcessorProps {
    onClose: () => void;
    currentSettings?: {
        packingMode: PackingMode;
        margins: { length: number; width: number; height: number };
        enableTopUp: boolean;
        enableFullMix: boolean;
        fullMixRotations: { x: boolean; y: boolean; z: boolean };
        activeMaterial?: Material;
    } | null;
}

const CONTAINER_DEFAULTS: Record<string, Container> = {
    '20ft': { name: "20' Standard", type: '20', dimensions: { length: 5898, width: 2352, height: 2393 } },
    '40ft': { name: "40' Standard", type: '40', dimensions: { length: 12032, width: 2352, height: 2393 } },
    '40ftHC': { name: "40' High Cube", type: '40HC', dimensions: { length: 12032, width: 2352, height: 2698 } },
    '53ft': { name: "53' Trailer", type: '53', dimensions: { length: 16000, width: 2540, height: 2700 } }
};

export function BatchProcessor({ onClose, currentSettings }: BatchProcessorProps) {
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [calculationMode, setCalculationMode] = useState<'optimal' | 'horizontal' | 'flat' | 'current'>('current');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setDownloadUrl(null);
        }
    };

    const processFile = async () => {
        if (!file) return;

        setProcessing(true);
        setProgress('Reading file...');
        setError(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON to process rows
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error("File appears to be empty.");
            }

            // Basic validation of first row keys (headers)
            const firstRow = jsonData[0];
            const requiredHeaders = ['Model', 'Length', 'Width', 'Height', 'CBM'];
            const missingHeaders = requiredHeaders.filter(h => !(h in firstRow));

            if (missingHeaders.length > 0) {
                throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
            }

            const updatedData = [];
            const totalRows = jsonData.length;

            for (let i = 0; i < totalRows; i++) {
                const row = jsonData[i];

                // Update progress every 10 rows
                if (i % 10 === 0) {
                    setProgress(`Processing row ${i + 1} of ${totalRows}...`);
                    // Allow UI to update
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                const length = Number(row['Length']);
                const width = Number(row['Width']);
                const height = Number(row['Height']);

                if (isNaN(length) || isNaN(width) || isNaN(height) || length <= 0 || width <= 0 || height <= 0) {
                    // Skip invalid rows or mark them? Let's keep original data but maybe add error note?
                    // For now, just copy as is.
                    updatedData.push(row);
                    continue;
                }

                let allowedRotations = { x: true, y: true, z: true };
                let packingMode: PackingMode = 'SEQUENTIAL';
                let margins = { length: 20, width: 20, height: 20 };
                let enableTopUp = false;
                let enableFullMix = false;
                let fullMixRotations = { x: true, y: true, z: true };
                let orientationPreference: 'default' | 'rotated' | undefined = undefined;

                if (calculationMode === 'horizontal') {
                    allowedRotations = { x: false, y: true, z: false };
                } else if (calculationMode === 'flat') {
                    allowedRotations = { x: false, y: false, z: true };
                } else if (calculationMode === 'current' && currentSettings) {
                    // Use active material's rotations if available
                    if (currentSettings.activeMaterial) {
                        allowedRotations = currentSettings.activeMaterial.box.allowedRotations;
                        orientationPreference = currentSettings.activeMaterial.orientationPreference;
                    }
                    packingMode = currentSettings.packingMode;
                    margins = currentSettings.margins;
                    enableTopUp = currentSettings.enableTopUp;
                    enableFullMix = currentSettings.enableFullMix;
                    fullMixRotations = currentSettings.fullMixRotations;
                }

                const box: Box = {
                    id: 'batch-box',
                    color: '#cc8855',
                    dimensions: { length, width, height },
                    allowedRotations: allowedRotations
                };

                // Create a material object for the calculation
                const material: Material = {
                    id: 1,
                    box: box,
                    orientationPreference: orientationPreference,
                    pallet: { dimensions: { length: 0, width: 0, height: 0 }, maxLoadHeight: 0, stackPallets: false, usePallet: false },
                    quantity: 100000, // Large quantity for "full container" calculation
                    layerConfig: '',
                    active: true
                };

                // Calculate for each container type
                const resultRow = { ...row };

                ['20ft', '40ft', '40ftHC', '53ft'].forEach(type => {
                    const container = CONTAINER_DEFAULTS[type];
                    // Calculate max items for full container (infinite quantity)
                    const result = calculatePacking(
                        container,
                        [material],
                        false,
                        margins,
                        packingMode,
                        enableTopUp,
                        enableFullMix,
                        fullMixRotations
                    );

                    // Get count from first load (should be full)
                    const count = result.loads.length > 0 ? result.loads[0].itemCount : 0;
                    resultRow[type] = count;
                });

                updatedData.push(resultRow);
            }

            setProgress('Generating new Excel file...');

            // Create new workbook
            const newWorksheet = XLSX.utils.json_to_sheet(updatedData);
            const newWorkbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Updated Stuffing");

            // Write file
            const wbout = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            setDownloadUrl(url);
            setProcessing(false);
            setProgress('Done!');

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred while processing the file.");
            setProcessing(false);
        }
    };

    const downloadTemplate = () => {
        const templateData = [
            {
                "Model": "OLED.EXAMPLE",
                "Length": 1600,
                "Width": 175,
                "Height": 800,
                "CBM": 0.224,
                "20ft": 78,
                "40ft": 182,
                "40ftHC": 273,
                "53ft": 350
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
        XLSX.writeFile(workbook, "stuffing_template.xlsx");
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[500px] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Excel Up - Batch Processor
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!downloadUrl ? (
                        <>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors relative">
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={processing}
                                />
                                <div className="flex flex-col items-center gap-2 pointer-events-none">
                                    <Upload className="w-10 h-10 text-gray-400" />
                                    <p className="text-sm font-medium text-gray-600">
                                        {file ? file.name : "Click or drag to upload .xlsx file"}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Required columns: Model, Length, Width, Height, CBM
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {processing && (
                                <div className="text-center space-y-2">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                                    <p className="text-sm text-gray-600">{progress}</p>
                                </div>
                            )}

                            {!processing && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Calculation Mode</label>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="calcMode"
                                                value="current"
                                                checked={calculationMode === 'current'}
                                                onChange={(e) => setCalculationMode(e.target.value as any)}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700 font-medium">
                                                Current Configuration
                                                <span className="block text-xs text-gray-400 font-normal">
                                                    Uses selected options (Horizontal/Vertical, Fill, Max, etc.)
                                                </span>
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="calcMode"
                                                value="horizontal"
                                                checked={calculationMode === 'horizontal'}
                                                onChange={(e) => setCalculationMode(e.target.value as any)}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Default (Horizontal only)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="calcMode"
                                                value="optimal"
                                                checked={calculationMode === 'optimal'}
                                                onChange={(e) => setCalculationMode(e.target.value as any)}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Optimal (All orientations)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="calcMode"
                                                value="flat"
                                                checked={calculationMode === 'flat'}
                                                onChange={(e) => setCalculationMode(e.target.value as any)}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Flat (Flat Stack only)</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between pt-2">
                                <button
                                    onClick={downloadTemplate}
                                    className="px-4 py-2 rounded font-medium text-gray-600 hover:bg-gray-100 border border-gray-300 flex items-center gap-2"
                                    disabled={processing}
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Template
                                </button>
                                <button
                                    onClick={processFile}
                                    disabled={!file || processing}
                                    className={`px-4 py-2 rounded font-medium flex items-center gap-2 ${!file || processing
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {processing ? 'Processing...' : 'Process File'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center space-y-6 py-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-gray-800">Processing Complete!</h4>
                                <p className="text-gray-500 mt-1">Your file is ready for download.</p>
                            </div>

                            <a
                                href={downloadUrl}
                                download={`updated_${file?.name || 'stuffing_calc.xlsx'}`}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-lg transition-transform hover:scale-105"
                            >
                                <Download className="w-5 h-5" />
                                Download Updated Excel
                            </a>

                            <div className="pt-4">
                                <button
                                    onClick={() => {
                                        setDownloadUrl(null);
                                        setFile(null);
                                        setError(null);
                                    }}
                                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                                >
                                    Process another file
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
