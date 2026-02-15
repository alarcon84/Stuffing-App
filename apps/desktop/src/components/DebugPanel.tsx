
import React, { useState } from 'react';
import { calculatePacking } from '@stuffing-calc/core';

export const DebugPanel = () => {
    const [testConfig, setTestConfig] = useState({
        usePallet: true,
        enableTopUp: false,
        enableFullMix: false,
        quantity: 100,
        layerConfig: '10x8',
        boxLength: 400,
        boxWidth: 300,
        boxHeight: 200
    });

    const [testResult, setTestResult] = useState<any>(null);

    const runTest = () => {
        const container20ft = {
            name: '20ft',
            type: '20' as const,
            dimensions: { length: 5900, width: 2350, height: 2390 },
            maxWeight: 28000
        };

        const material = {
            id: 1,
            box: {
                id: 'test-box',
                dimensions: {
                    length: testConfig.boxLength,
                    width: testConfig.boxWidth,
                    height: testConfig.boxHeight
                },
                weight: 10,
                color: '#ff0000',
                allowedRotations: { x: true, y: true, z: true }
            },
            pallet: {
                dimensions: { length: 1200, width: 1000, height: 144 },
                maxLoadHeight: 2000,
                usePallet: testConfig.usePallet
            },
            quantity: testConfig.quantity,
            layerConfig: testConfig.layerConfig,
            active: true
        };

        try {
            const result = calculatePacking(
                container20ft,
                [material],
                testConfig.usePallet,
                { length: 0, width: 0, height: 0 },
                'SEQUENTIAL',
                testConfig.enableTopUp,
                testConfig.enableFullMix
            );

            setTestResult({
                success: true,
                result,
                analysis: analyzeResult(result)
            });
        } catch (error) {
            setTestResult({
                success: false,
                error: (error as any).message
            });
        }
    };

    const analyzeResult = (result: any) => {
        const analysis = {
            totalItems: result.totalItems,
            containers: result.totalContainers,
            utilization: result.loads[0]?.utilization || 0,
            sources: {} as Record<string, number>,
            heightRange: { min: Infinity, max: -Infinity },
            errors: result.errors
        };

        if (result.loads[0]) {
            result.loads[0].items.forEach((item: any) => {
                const source = item.source || 'PRIMARY';
                analysis.sources[source] = (analysis.sources[source] || 0) + 1;

                const y = item.position[1];
                if (y < analysis.heightRange.min) analysis.heightRange.min = y;
                if (y > analysis.heightRange.max) analysis.heightRange.max = y;
            });
        }

        return analysis;
    };

    const [isMinimized, setIsMinimized] = useState(false);

    return (
        <div className="debug-panel" style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px', // Moved to right
            zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '8px',
            maxHeight: isMinimized ? '50px' : '80vh',
            width: isMinimized ? 'auto' : '300px',
            overflowY: isMinimized ? 'hidden' : 'auto',
            transition: 'all 0.3s ease'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMinimized ? 0 : '10px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', cursor: 'pointer' }} onClick={() => setIsMinimized(!isMinimized)}>
                    Debug Panel {isMinimized ? '(+)' : '(-)'}
                </h2>
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    {isMinimized ? 'Show' : 'Hide'}
                </button>
            </div>

            {!isMinimized && (
                <div className="debug-content">
                    <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={testConfig.usePallet}
                                onChange={(e) => setTestConfig(prev => ({ ...prev, usePallet: e.target.checked }))}
                            />
                            Use Pallets
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={testConfig.enableTopUp}
                                onChange={(e) => setTestConfig(prev => ({ ...prev, enableTopUp: e.target.checked }))}
                            />
                            Enable Top-Up
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={testConfig.enableFullMix}
                                onChange={(e) => setTestConfig(prev => ({ ...prev, enableFullMix: e.target.checked }))}
                            />
                            Enable Full-Mix
                        </label>

                        <label>
                            Quantity:
                            <input
                                type="number"
                                value={testConfig.quantity}
                                onChange={(e) => setTestConfig(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                style={{ width: '60px', marginLeft: '5px', color: 'black' }}
                            />
                        </label>

                        <label>
                            Layer Config:
                            <input
                                type="text"
                                value={testConfig.layerConfig}
                                onChange={(e) => setTestConfig(prev => ({ ...prev, layerConfig: e.target.value }))}
                                style={{ width: '60px', marginLeft: '5px', color: 'black' }}
                            />
                        </label>

                        <div style={{ display: 'flex', gap: '5px' }}>
                            <label>L: <input type="number" value={testConfig.boxLength} onChange={e => setTestConfig(p => ({ ...p, boxLength: +e.target.value }))} style={{ width: '40px', color: 'black' }} /></label>
                            <label>W: <input type="number" value={testConfig.boxWidth} onChange={e => setTestConfig(p => ({ ...p, boxWidth: +e.target.value }))} style={{ width: '40px', color: 'black' }} /></label>
                            <label>H: <input type="number" value={testConfig.boxHeight} onChange={e => setTestConfig(p => ({ ...p, boxHeight: +e.target.value }))} style={{ width: '40px', color: 'black' }} /></label>
                        </div>

                        <button onClick={runTest} style={{ marginTop: '10px', cursor: 'pointer', padding: '5px', color: 'black' }}>Run Test</button>
                    </div>

                    {testResult && (
                        <div className="results" style={{ marginTop: '15px', borderTop: '1px solid #555', paddingTop: '10px' }}>
                            {testResult.success ? (
                                <>
                                    <h3 style={{ color: '#4caf50', margin: '5px 0' }}>✅ Test Passed</h3>
                                    <div className="analysis" style={{ fontSize: '14px' }}>
                                        <p style={{ margin: '2px 0' }}><strong>Items:</strong> {testResult.analysis.totalItems}</p>
                                        <p style={{ margin: '2px 0' }}><strong>Cont:</strong> {testResult.analysis.containers}</p>
                                        <p style={{ margin: '2px 0' }}><strong>Util:</strong> {testResult.analysis.utilization.toFixed(1)}%</p>

                                        <h4 style={{ margin: '5px 0' }}>Sources:</h4>
                                        <ul style={{ paddingLeft: '20px', margin: '2px 0' }}>
                                            {Object.entries(testResult.analysis.sources).map(([source, count]) => (
                                                <li key={source}>{source}: {count as number}</li>
                                            ))}
                                        </ul>

                                        {testResult.analysis.errors && testResult.analysis.errors.length > 0 && (
                                            <>
                                                <h4 style={{ margin: '5px 0' }}>⚠️ Errors:</h4>
                                                <ul style={{ paddingLeft: '20px', margin: '2px 0' }}>
                                                    {testResult.analysis.errors.map((err: string, i: number) => (
                                                        <li key={i} style={{ color: '#ff6b6b' }}>{err}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3 style={{ color: '#f44336' }}>❌ Failed</h3>
                                    <pre style={{ color: '#f44336', whiteSpace: 'pre-wrap', fontSize: '12px' }}>{String(testResult.error)}</pre>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
