import type {TelemetryBatch} from './schema';
import type {ExtensionContext, TelemetrySender} from 'vscode';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as vscode from 'vscode';

import {parseBatch} from './schema';

import * as telemetry from './index';

const state = vi.hoisted(() => ({
    usage: true,
    errors: true,
    listener: () => {},
}));

vi.mock('vscode', () => ({
    version: '1.110.0',
    env: {
        createTelemetryLogger: vi.fn((sender: TelemetrySender) => ({
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
        })),
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

const endpoint = 'https://test.apigw.yandexcloud.net/telemetry';
const fetchMock = vi.fn();
const batches = (): TelemetryBatch[] =>
    fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));

const setLevel = (usage: boolean, errors: boolean) => {
    state.usage = usage;
    state.errors = errors;
    state.listener();
};

beforeEach(() => {
    vi.useFakeTimers();
    state.usage = state.errors = true;
    fetchMock.mockReset().mockImplementation(async () => new Response('', {status: 202}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('__DIPLODOC_TELEMETRY_ENDPOINT__', endpoint);
});

afterEach(async () => {
    setLevel(false, false);
    await telemetry.deactivate();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('extension telemetry', () => {
    it('keeps installation identity across sessions and sends only sanitized fields', async () => {
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

        const first = batches()[0];

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(parseBatch(first, Date.now())).toEqual(first);
        expect(first.events).toMatchObject([
            {name: 'md-editor/opened', properties: {source: 'command', fileType: 'md'}},
            {name: 'validation/error', kind: 'error', properties: {errorType: 'TypeError'}},
            {name: 'references/find', measurements: {found: 0}},
        ]);
        expect(JSON.stringify(first)).not.toMatch(/secret|document|stack|diplodoc-vsc-extension/);
        expect(vscode.env.createTelemetryLogger).toHaveBeenCalledWith(expect.anything(), {
            ignoreBuiltInCommonProperties: true,
            ignoreUnhandledErrors: true,
        });
        await telemetry.deactivate();
        await telemetry.activate(ctx);
        telemetry.sendEvent('settings/opened');
        await vi.advanceTimersByTimeAsync(10000);
        expect(batches()[1].installationId).toBe(first.installationId);
        expect(batches()[1].sessionId).not.toBe(first.sessionId);
    });

    it('drops queued usage when switched to error-only and drops all queued data on opt-out', async () => {
        await telemetry.activate(context());
        telemetry.sendEvent('settings/opened');
        telemetry.sendError('validation/error', {message: '/secret'});
        setLevel(false, true);
        await vi.advanceTimersByTimeAsync(10000);
        expect(batches()[0].events.map((event) => event.name)).toEqual(['validation/error']);
        telemetry.sendError('validation/error');
        setLevel(false, false);
        telemetry.sendEvent('settings/opened');
        telemetry.sendException(new Error('secret'), {event: 'validation/error'});
        setLevel(true, true);
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('aborts a pending request on opt-out and never retries it after re-enabling', async () => {
        let reject: (error: Error) => void = () => {};
        fetchMock.mockImplementation(
            () =>
                new Promise((_resolve, fail) => {
                    reject = fail;
                }),
        );

        await telemetry.activate(context());
        telemetry.sendEvent('settings/opened');
        await vi.advanceTimersByTimeAsync(10000);

        const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;

        setLevel(false, false);
        expect(signal.aborted).toBe(true);
        setLevel(true, true);
        reject(new Error('cancelled'));
        await vi.advanceTimersByTimeAsync(60000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('bounds a burst and retries failed batches at most three times with stable event IDs', async () => {
        fetchMock.mockImplementation(async () => new Response('', {status: 503}));

        await telemetry.activate(context());
        telemetry.sendEvent('settings/opened');
        await vi.advanceTimersByTimeAsync(120000);
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const attempts = batches();

        expect(attempts[1].events[0].id).toBe(attempts[0].events[0].id);
        fetchMock.mockClear();
        fetchMock.mockImplementation(async () => new Response('', {status: 202}));

        for (let i = 0; i < 1000; i++) {
            telemetry.sendEvent('settings/opened');
        }

        await vi.advanceTimersByTimeAsync(120000);

        const sent = batches().flatMap((batch) => batch.events);

        expect(sent.length).toBeGreaterThan(0);
        expect(sent.length).toBeLessThanOrEqual(100);
        expect(batches().every((batch) => batch.events.length <= 20)).toBe(true);
    });

    it('sends nothing without a configured HTTPS endpoint or after disposal', async () => {
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

        vi.stubGlobal('__DIPLODOC_TELEMETRY_ENDPOINT__', endpoint);

        const ctx = context();

        await telemetry.activate(ctx);

        telemetry.sendEvent('settings/opened');
        ctx.subscriptions.forEach((disposable) => disposable.dispose());
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
