import {TelemetryReporter} from '@vscode/extension-telemetry';

let reporter: TelemetryReporter | undefined;

export function activate(connectionString: string): TelemetryReporter {
    reporter = new TelemetryReporter(connectionString);

    return reporter;
}

export function getReporter() {
    return reporter;
}

export function sendEvent(
    eventName: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
    reporter?.sendTelemetryEvent(eventName, properties, measurements);
}

export function sendError(
    eventName: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
    reporter?.sendTelemetryErrorEvent(eventName, properties, measurements);
}

export function sendException(
    error: Error,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
    reporter?.sendTelemetryErrorEvent(
        error.name,
        {
            message: error.message,
            stack: error.stack ?? '',
            ...properties,
        },
        measurements,
    );
}

export function deactivate(): void {
    reporter?.dispose();
    reporter = undefined;
}
