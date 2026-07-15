export interface BulkOperationDetector {
    record(): void;
    isBulk(): boolean;
}

interface BulkOperationDetectorOptions {
    threshold: number;
    windowMs: number;
    now?: () => number;
}

export function createBulkOperationDetector(
    options: BulkOperationDetectorOptions,
): BulkOperationDetector {
    const {threshold, windowMs} = options;
    const now = options.now ?? (() => Date.now());

    let timestamps: number[] = [];

    function prune(current: number): void {
        const cutoff = current - windowMs;
        let firstFresh = 0;

        while (firstFresh < timestamps.length && timestamps[firstFresh] < cutoff) {
            firstFresh++;
        }

        if (firstFresh > 0) {
            timestamps = timestamps.slice(firstFresh);
        }
    }

    return {
        record() {
            const current = now();

            prune(current);
            timestamps.push(current);
        },
        isBulk() {
            prune(now());

            return timestamps.length >= threshold;
        },
    };
}
