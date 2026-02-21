
export class DebugLogger {
    private enabled = (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env.NODE_ENV === 'development') || (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process.env.VITEST === 'true');
    private logs: Array<{ timestamp: number; category: string; message: string; data?: any }> = [];

    log(category: string, message: string, data?: any) {
        // Determine if we should log based on environment
        // In tests, we might want to capture logs but not print them to keep output clean,
        // or print them if debugging. For now, let's keep the user's logic.
        // The user had: private enabled = process.env.NODE_ENV === 'development';

        // If we are running in a test environment, we might want to enable it explicitly or check a flag.
        // For now I'll stick to the user's code but allow enablement via a property or method if needed later.
        if (!this.enabled) return;

        const entry = {
            timestamp: Date.now(),
            category,
            message,
            data
        };

        this.logs.push(entry);
        console.log(`[${category}] ${message}`, data || '');
    }

    error(category: string, message: string, error: any) {
        const entry = {
            timestamp: Date.now(),
            category,
            message,
            data: { error: error.message, stack: error.stack }
        };

        this.logs.push(entry);
        console.error(`[${category}] ERROR: ${message}`, error);
    }

    getLogs() {
        return this.logs;
    }

    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }

    clear() {
        this.logs = [];
    }
}

export const debugLogger = new DebugLogger();
