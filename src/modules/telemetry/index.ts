import {randomUUID} from 'node:crypto';
import * as vscode from 'vscode';

import {UUID, eventKind, sanitizeEvent} from './schema';
import {EventQueue} from './sender';

declare const __DIPLODOC_TELEMETRY_ENDPOINT__: string;

let reporter: vscode.TelemetryLogger | undefined;
let queue: EventQueue | undefined;
let subscription: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    dispose();

    context.subscriptions.push({dispose});
    const endpoint =
        typeof __DIPLODOC_TELEMETRY_ENDPOINT__ === 'string' ? __DIPLODOC_TELEMETRY_ENDPOINT__ : '';

    try {
        const url = new URL(endpoint);

        if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
            return;
        }
    } catch {
        return;
    }

    const key = 'telemetry.installationId';
    let installationId = context.globalState.get<string>(key);

    if (!installationId || !UUID.test(installationId)) {
        installationId = randomUUID();

        try {
            await context.globalState.update(key, installationId);
        } catch {
            return;
        }
    }

    const currentQueue = new EventQueue(endpoint, {
        schemaVersion: 1,
        installationId,
        sessionId: randomUUID(),
        extensionVersion: context.extension.packageJSON.version.split('-')[0],
        vscodeVersion: vscode.version.split('-')[0],
        os: ['darwin', 'linux', 'win32'].includes(process.platform) ? process.platform : 'other',
    });

    queue = currentQueue;

    const prefix = `${context.extension.id}/`;

    reporter = vscode.env.createTelemetryLogger(
        {
            sendEventData(name, data) {
                if (name.startsWith(prefix)) {
                    currentQueue.enqueue(name.slice(prefix.length), data);
                }
            },
            sendErrorData() {},
        },
        {ignoreBuiltInCommonProperties: true, ignoreUnhandledErrors: true},
    );

    const logger = reporter;
    const update = () => currentQueue.setEnabled(logger.isUsageEnabled, logger.isErrorsEnabled);

    subscription = logger.onDidChangeEnableStates(update);
    update();
}

export function sendEvent(
    name: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
    const safe = sanitizeEvent(name, properties, measurements);

    if (safe?.kind === 'usage') {
        reporter?.logUsage(name, {...safe.properties, ...safe.measurements});
    }
}

export function sendError(
    name: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
    const safe = sanitizeEvent(name, properties, measurements);

    if (safe?.kind === 'error') {
        reporter?.logError(name, {...safe.properties, ...safe.measurements});
    }
}

export function sendException(
    error: Error,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
    const name = properties?.event;

    if (!name || eventKind(name) !== 'error') {
        return;
    }

    sendError(name, {...properties, errorType: error.name}, measurements);
}

function dispose() {
    queue?.dispose();
    queue = undefined;

    subscription?.dispose();
    subscription = undefined;

    reporter?.dispose();
    reporter = undefined;
}

export async function deactivate(): Promise<void> {
    try {
        await queue?.flush();
    } finally {
        dispose();
    }
}
