import fs from 'fs';
import path from 'path';
import { calculatePacking } from './packingAlgorithm';
import { SNAPSHOT_SCENARIOS } from './snapshot_scenarios';

const SNAPSHOT_DIR = path.join(__dirname, '__snapshots__');

const loadSnapshot = (name: string) => {
    const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Snapshot not found: ${name}`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const deepEqual = (actual: any, expected: any, path: string = ''): void => {
    if (actual === expected) return;
    if (typeof actual !== typeof expected) throw new Error(`Type mismatch at ${path}`);
    if (actual === null || expected === null) throw new Error(`Null mismatch at ${path}`);

    if (Array.isArray(actual)) {
        if (!Array.isArray(expected)) throw new Error(`Array mismatch at ${path}`);
        if (actual.length !== expected.length) throw new Error(`Length mismatch at ${path}: ${actual.length} vs ${expected.length}`);
        for (let i = 0; i < actual.length; i++) deepEqual(actual[i], expected[i], `${path}[${i}]`);
        return;
    }

    if (typeof actual === 'object') {
        const keysA = Object.keys(actual).sort();
        const keysB = Object.keys(expected).sort();
        if (keysA.length !== keysB.length) {
            const added = keysA.filter(k => !keysB.includes(k));
            const removed = keysB.filter(k => !keysA.includes(k));
            throw new Error(`Key mismatch at ${path}. +${added} -${removed}`);
        }
        for (const key of keysA) {
            if (!keysB.includes(key)) throw new Error(`Missing key ${key} at ${path}`);
            deepEqual(actual[key], expected[key], `${path}.${key}`);
        }
        return;
    }
    throw new Error(`Value mismatch at ${path}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
};

const runRegression = () => {
    let passed = 0;
    let failed = 0;
    console.log('Running Snapshot Regression Tests...');

    for (const scenario of SNAPSHOT_SCENARIOS) {
        console.log(`Testing ${scenario.name}...`);
        try {
            const expected = loadSnapshot(scenario.name);
            const actual = calculatePacking(scenario.container, scenario.materials);
            deepEqual(actual, expected, scenario.name);
            console.log('  ✅ PASS');
            passed++;
        } catch (e: any) {
            console.log('  ❌ FAIL');
            console.error(`  Error: ${e.message}`);
            failed++;
            process.exit(1);
        }
    }
    console.log(`\nRegression Complete. ${passed} Passed.`);
};

runRegression();
