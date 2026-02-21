# Antigravity Agent Contract: Stuffing Calculator

## 1. Strict Context Limits (The 1GB Rule)
* **NEVER** read, index, or analyze the following directories: `node_modules`, `dist`, `build`, `.git`, or any compiled `.exe`/`.app` files. 
* Keep your token footprint as minimal as possible to prevent rate limiting. Only read the specific files requested in the prompt.

## 2. Core Packing Algorithm Isolation
* All spatial math, calculations, dimension matching, and layer configurations are strictly isolated to the core packing algorithm files (likely within the `@stuffing-calc/core` package). 
* **Do not** modify React/UI components when fixing mathematical logic or orientation corruption.

## 3. Technical Drawing & Exports Separation
* The logic for generating PDFs, rendering `html2canvas`, and handling `jspdf` linear dimensioning must remain entirely separate from the core calculator. 
* Never mix DOM-rendering logic with the background spatial math.

## 4. The "Planning Mode" Execution Protocol
* Before executing any code changes—especially regarding the packing algorithm—you **must** write out a step-by-step logical implementation plan.
* Stop and wait for explicit user approval on the proposed logic before modifying any files.
