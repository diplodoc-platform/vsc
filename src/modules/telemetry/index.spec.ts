import type {TelemetryBatch, TelemetryEvent} from './schema';
import type {ExtensionContext, TelemetrySender} from 'vscode';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {handler} from './collector';

import * as telemetry from './index';

const state = vi.hoisted(() => ({
    usage: true,
    errors: true,
    listener: () => {},
    sender: undefined as TelemetrySender | undefined,
}));

vi.mock('vscode', () => ({
    version: '1.110.0',
    env: {
        createTelemetryLogger: vi.fn((sender: TelemetrySender) => {
            state.sender = sender;

            return {
                get isUsageEnabled() {
                    return state.usage;
                },
                get isErrorsEnabled() {
                    return state.errors;
                },
                onDidChangeEnableStates: (listener: () => void) => {
                    state.listener = listener;

                    return {dispose() {}};
                },
                logUsage(name: string, data: object) {
                    if (state.usage) {
                        sender.sendEventData(`diplodoc.diplodoc-vsc-extension/${name}`, data);
                    }
                },
                logError(name: string, data: object) {
                    if (state.errors) {
                        sender.sendEventData(`diplodoc.diplodoc-vsc-extension/${name}`, data);
                    }
                },
                dispose() {},
            };
        }),
    },
}));

const context = () => {
    const storage = new Map<string, unknown>();

    return {
        subscriptions: [],
        extension: {
            id: 'diplodoc.diplodoc-vsc-extension',
            packageJSON: {version: '1.4.1'},
        },
        globalState: {
            get: (key: string) => storage.get(key),
            update: async (key: string, value: unknown) => {
                storage.set(key, value);
            },
        },
    } as unknown as ExtensionContext;
};

const setLevel = (usage: boolean, errors: boolean) => {
    state.usage = usage;
    state.errors = errors;
    state.listener();
};

beforeEach(() => {
    vi.useFakeTimers();
    state.usage = state.errors = true;
    vi.stubGlobal(
        '__DIPLODOC_TELEMETRY_ENDPOINT__',
        'https://test.apigw.yandexcloud.net/telemetry',
    );
});
afterEach(async () => {
    setLevel(false, false);
    await telemetry.deactivate();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('extension telemetry', () => {
    it('keeps identity across sessions and carries sanitized events through the real collector', async () => {
        const forwarded: string[] = [];
        const batches: TelemetryBatch[] = [];

        vi.stubGlobal(
            'fetch',
            vi.fn(async (url, options) => {
                if (url === 'https://yandex.ru/clck/click') {
                    forwarded.push(options.body);

                    return new Response('', {status: 200});
                }

                batches.push(JSON.parse(options.body));

                const result = await handler({
                    httpMethod: 'POST',
                    headers: options.headers,
                    body: options.body,
                });

                return new Response(result.body, {status: result.statusCode});
            }),
        );

        const ctx = context();

        await telemetry.activate(ctx);
        telemetry.sendEvent('md-editor/opened', {
            source: 'command',
            fileType: 'md',
            path: '/secret',
        });
        telemetry.sendException(new TypeError('secret document'), {
            event: 'validation/error',
        });
        telemetry.sendEvent('references/find', undefined, {found: 0, secret: 3});
        await vi.advanceTimersByTimeAsync(10000);
        expect(forwarded).toHaveLength(1);
        expect(forwarded[0].split('\r\n')).toHaveLength(3);
        expect(forwarded[0]).not.toMatch(/secret|document|stack|diplodoc-vsc-extension%2F/);
        expect(decodeURIComponent(forwarded[0])).toContain('"errorType":"TypeError"');
        expect(decodeURIComponent(forwarded[0])).toContain('"source":"command"');
        expect(decodeURIComponent(forwarded[0])).toContain('"found":0');
        expect(vscode.env.createTelemetryLogger).toHaveBeenCalledWith(expect.anything(), {
            ignoreBuiltInCommonProperties: true,
            ignoreUnhandledErrors: true,
        });
        await telemetry.deactivate();
        await telemetry.activate(ctx);
        telemetry.sendEvent('settings/opened');
        await vi.advanceTimersByTimeAsync(10000);
        expect(batches[1].installationId).toBe(batches[0].installationId);
        expect(batches[1].sessionId).not.toBe(batches[0].sessionId);
    });

    it('drops queued usage when switched to error-only and drops all queued data on opt-out', async () => {
        const fetch = vi.fn().mockImplementation(async () => new Response('', {status: 202}));

        vi.stubGlobal('fetch', fetch);
        await telemetry.activate(context());
        telemetry.sendEvent('settings/opened');
        telemetry.sendError('validation/error', {message: '/secret'});
        setLevel(false, true);
        await vi.advanceTimersByTimeAsync(10000);
        expect(
            JSON.parse(fetch.mock.calls[0][1].body).events.map(
                (event: TelemetryEvent) => event.name,
            ),
        ).toEqual(['validation/error']);
        telemetry.sendError('validation/error');
        setLevel(false, false);
        telemetry.sendEvent('settings/opened');
        telemetry.sendException(new Error('secret'), {event: 'validation/error'});
        setLevel(true, true);
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('aborts a pending request on opt-out and never retries it after re-enabling', async () => {
        let reject: (error: Error) => void = () => {};
        const fetch = vi.fn().mockImplementation(
            () =>
                new Promise((_resolve, fail) => {
                    reject = fail;
                }),
        );

        vi.stubGlobal('fetch', fetch);
        await telemetry.activate(context());
        telemetry.sendEvent('settings/opened');
        await vi.advanceTimersByTimeAsync(10000);

        const signal = fetch.mock.calls[0][1].signal as AbortSignal;

        setLevel(false, false);
        expect(signal.aborted).toBe(true);
        setLevel(true, true);
        reject(new Error('cancelled'));
        await vi.advanceTimersByTimeAsync(60000);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('bounds a burst and retries failed batches at most three times with stable event IDs', async () => {
        const fetch = vi.fn().mockImplementation(async () => new Response('', {status: 503}));

        vi.stubGlobal('fetch', fetch);
        await telemetry.activate(context());
        telemetry.sendEvent('settings/opened');
        await vi.advanceTimersByTimeAsync(120000);
        expect(fetch).toHaveBeenCalledTimes(3);

        const attempts = fetch.mock.calls.map(([, options]) => JSON.parse(options.body));

        expect(attempts[1].events[0].id).toBe(attempts[0].events[0].id);
        fetch.mockClear();
        fetch.mockImplementation(async () => new Response('', {status: 202}));

        for (let i = 0; i < 1000; i++) {
            telemetry.sendEvent('settings/opened');
        }

        await vi.advanceTimersByTimeAsync(120000);

        const sent = fetch.mock.calls.flatMap(([, options]) => JSON.parse(options.body).events);

        expect(sent.length).toBeGreaterThan(0);
        expect(sent.length).toBeLessThanOrEqual(100);
        expect(
            fetch.mock.calls.every(([, options]) => JSON.parse(options.body).events.length <= 20),
        ).toBe(true);
    });

    it('sends nothing without a configured HTTPS endpoint or after disposal', async () => {
        const fetch = vi.fn();

        vi.stubGlobal('fetch', fetch);

        for (const endpoint of [
            '',
            'http://example.com/telemetry',
            'https://user:password@example.com',
        ]) {
            vi.stubGlobal('__DIPLODOC_TELEMETRY_ENDPOINT__', endpoint);
            await telemetry.activate(context());
            telemetry.sendEvent('settings/opened');
            await vi.advanceTimersByTimeAsync(30000);
            await telemetry.deactivate();
        }

        vi.stubGlobal(
            '__DIPLODOC_TELEMETRY_ENDPOINT__',
            'https://test.apigw.yandexcloud.net/telemetry',
        );

        const ctx = context();

        await telemetry.activate(ctx);

        telemetry.sendEvent('settings/opened');
        ctx.subscriptions.forEach((disposable) => disposable.dispose());
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetch).not.toHaveBeenCalled();
    });
});
