import type {TelemetryBatch, TelemetryEvent} from './schema';

import {randomUUID} from 'node:crypto';

import {MAX_BATCH_SIZE, MAX_BODY_BYTES, sanitizeEvent} from './schema';

const INTERVAL = 10_000;
const MAX_QUEUE = 100;
const MAX_AGE = 300_000;

type Pending = {event: TelemetryEvent; attempts: number};

export class EventQueue {
    private queue: Pending[] = [];
    private timer?: ReturnType<typeof setTimeout>;
    private request?: AbortController;
    private flight?: Promise<void>;
    private enabled = {usage: false, error: false};
    private generation = 0;
    private disposed = false;

    private readonly endpoint: string;
    private readonly common: Omit<TelemetryBatch, 'events'>;

    constructor(endpoint: string, common: Omit<TelemetryBatch, 'events'>) {
        this.endpoint = endpoint;
        this.common = common;
    }

    setEnabled(usage: boolean, error: boolean) {
        if ((this.enabled.usage && !usage) || (this.enabled.error && !error)) {
            this.generation++;
            this.request?.abort();
        }

        this.enabled = {usage, error};
        this.queue = this.queue.filter(({event}) => this.enabled[event.kind]);

        if (!this.queue.length) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    enqueue(name: string, data: Record<string, unknown> = {}) {
        const safe = sanitizeEvent(name, data, data);

        if (!safe || this.disposed || !this.enabled[safe.kind]) {
            return;
        }

        if (this.queue.length >= MAX_QUEUE) {
            this.queue.shift();
        }

        this.queue.push({
            event: {...safe, id: randomUUID(), timestamp: Date.now()},
            attempts: 0,
        });
        this.schedule();
    }

    flush(): Promise<void> {
        if (this.flight) {
            return this.flight;
        }

        clearTimeout(this.timer);
        this.timer = undefined;

        if (this.disposed) {
            return Promise.resolve();
        }

        this.queue = this.queue.filter(
            ({event}) => this.enabled[event.kind] && Date.now() - event.timestamp <= MAX_AGE,
        );

        const pending = this.queue.splice(0, MAX_BATCH_SIZE);

        if (!pending.length) {
            return Promise.resolve();
        }

        const generation = this.generation;
        const controller = new AbortController();

        this.request = controller;

        const timeout = setTimeout(() => controller.abort(), 6000);

        timeout.unref();

        let retry = false;

        this.flight = (async () => {
            try {
                const body = JSON.stringify({
                    ...this.common,
                    events: pending.map(({event}) => event),
                });

                if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
                    return;
                }

                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body,
                    redirect: 'error',
                    credentials: 'omit',
                    signal: controller.signal,
                });

                await response.body?.cancel();
                retry =
                    response.status === 408 || response.status === 429 || response.status >= 500;
            } catch {
                retry = true;
            } finally {
                clearTimeout(timeout);
            }
        })().then(() => {
            this.flight = undefined;
            this.request = undefined;

            if (retry && !this.disposed && generation === this.generation) {
                const retries = pending
                    .filter(
                        ({event, attempts}) =>
                            attempts < 2 &&
                            this.enabled[event.kind] &&
                            Date.now() - event.timestamp <= MAX_AGE,
                    )
                    .map(({event, attempts}) => ({event, attempts: attempts + 1}));

                this.queue = [...retries, ...this.queue].slice(0, MAX_QUEUE);
            }

            this.schedule(retry ? INTERVAL * 2 ** (pending[0].attempts + 1) : INTERVAL);
        });

        return this.flight;
    }

    dispose() {
        this.disposed = true;
        this.generation++;
        this.queue = [];
        clearTimeout(this.timer);
        this.request?.abort();
    }

    private schedule(delay = INTERVAL) {
        if (this.disposed || this.timer || this.flight || !this.queue.length) {
            return;
        }

        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.flush().catch(() => {});
        }, delay);
        this.timer.unref();
    }
}
