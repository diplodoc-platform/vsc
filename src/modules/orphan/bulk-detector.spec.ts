import {describe, expect, it} from 'vitest';

import {createBulkOperationDetector} from './bulk-detector';

describe('createBulkOperationDetector', () => {
    it('is not bulk with no events', () => {
        const detector = createBulkOperationDetector({threshold: 3, windowMs: 1000, now: () => 0});

        expect(detector.isBulk()).toBe(false);
    });

    it('is not bulk below the threshold', () => {
        const detector = createBulkOperationDetector({
            threshold: 3,
            windowMs: 1000,
            now: () => 0,
        });

        detector.record();
        detector.record();

        expect(detector.isBulk()).toBe(false);
    });

    it('is bulk once the threshold is reached inside the window', () => {
        let time = 0;
        const detector = createBulkOperationDetector({
            threshold: 3,
            windowMs: 1000,
            now: () => time,
        });

        detector.record();
        time = 100;
        detector.record();
        time = 200;
        detector.record();

        expect(detector.isBulk()).toBe(true);
    });

    it('drops events that fall outside the window', () => {
        let time = 0;
        const detector = createBulkOperationDetector({
            threshold: 3,
            windowMs: 1000,
            now: () => time,
        });

        detector.record();
        time = 400;
        detector.record();
        time = 800;
        detector.record();

        expect(detector.isBulk()).toBe(true);

        time = 1500;

        expect(detector.isBulk()).toBe(false);
    });

    it('stays bulk while events keep arriving (rolling window)', () => {
        let time = 0;
        const detector = createBulkOperationDetector({
            threshold: 3,
            windowMs: 1000,
            now: () => time,
        });

        for (let i = 0; i < 10; i++) {
            time = i * 300;
            detector.record();
        }

        expect(detector.isBulk()).toBe(true);
    });

    it('defaults to Date.now when no clock is injected', () => {
        const detector = createBulkOperationDetector({threshold: 1, windowMs: 1000});

        detector.record();

        expect(detector.isBulk()).toBe(true);
    });
});
