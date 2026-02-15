import fs from 'fs';
import path from 'path';
import { calculatePacking } from './packingAlgorithm';
import { SNAPSHOT_SCENARIOS } from './snapshot_scenarios';

// Ensure snapshot directory exists
const SNAPSHOT_DIR = path.join(__dirname, '__snapshots__');
if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

const saveSnapshot = (name: string, data: any) => {
    const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved snapshot: ${name}`);
};

const main = () => {
    console.log('Starting Snapshot Capture...');
    for (const scenario of SNAPSHOT_SCENARIOS) {
        console.log(`Running Scenario: ${scenario.name}...`);
        const result = calculatePacking(scenario.container, scenario.materials);
        saveSnapshot(scenario.name, result);
    }
    console.log('All snapshots captured.');
};

main();
