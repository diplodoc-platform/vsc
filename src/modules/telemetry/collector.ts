import {createHash} from 'node:crypto';

import {MAX_BODY_BYTES, isRecord, parseBatch} from './schema';

const reply = (statusCode: number, data: Record<string, unknown>) => ({
    statusCode,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
    body: JSON.stringify(data),
});

export async function handler(event: unknown) {
    if (!isRecord(event) || event.httpMethod !== 'POST') {
        return reply(405, {error: 'method_not_allowed'});
    }

    const headers = isRecord(event.headers)
        ? Object.fromEntries(
              Object.entries(event.headers).map(([key, value]) => [key.toLowerCase(), value]),
          )
        : {};

    if (
        typeof headers['content-type'] !== 'string' ||
        headers['content-type'].split(';')[0].trim().toLowerCase() !== 'application/json' ||
        (headers['content-encoding'] && headers['content-encoding'] !== 'identity')
    ) {
        return reply(415, {error: 'json_required'});
    }

    if (typeof event.body !== 'string') {
        return reply(400, {error: 'invalid_body'});
    }

    if (
        event.body.length >
        (event.isBase64Encoded ? Math.ceil(MAX_BODY_BYTES / 3) * 4 : MAX_BODY_BYTES)
    ) {
        return reply(413, {error: 'body_too_large'});
    }

    const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

    if (body.length > MAX_BODY_BYTES) {
        return reply(413, {error: 'body_too_large'});
    }

    let input: unknown;

    try {
        input = JSON.parse(body.toString('utf8'));
    } catch {
        return reply(400, {error: 'invalid_json'});
    }

    const now = Date.now();
    const batch = parseBatch(input, now);

    if (!batch) {
        return reply(400, {error: 'invalid_batch'});
    }

    const environment = process.env.TELEMETRY_ENVIRONMENT || 'testing';

    if (!['testing', 'production'].includes(environment)) {
        return reply(503, {error: 'invalid_environment'});
    }

    const applicationKey = process.env.MONIUM_APPLICATION_KEY?.trim();

    if (!applicationKey) {
        return reply(503, {error: 'missing_application_key'});
    }

    const uid = createHash('sha256')
        .update(`diplodoc-vsc:${batch.installationId}`)
        .digest()
        .readBigUInt64BE();

    const logRecords = batch.events.map((item) => ({
        timeUnixNano: (BigInt(now) * 1_000_000n).toString(),
        body: {
            stringValue: JSON.stringify({
                event_id: item.id,
                client_timestamp: String(item.timestamp),
                installation_id: (uid || 1n).toString(),
                version: batch.extensionVersion,
                name: item.name,
                additional: {
                    schemaVersion: 1,
                    sessionId: batch.sessionId,
                    kind: item.kind,
                    os: batch.os,
                    vscodeVersion: batch.vscodeVersion,
                    receivedAt: now,
                    ...item.properties,
                    ...item.measurements,
                },
            }),
        },
    }));

    const attributes = Object.entries({
        project: 'docstools',
        cluster: environment,
        service: 'vscode-extension',
    }).map(([key, value]) => ({key, value: {stringValue: value}}));

    try {
        const response = await fetch('https://ingest.monium.yandex/otlp/v1/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Application-Key ${applicationKey}`,
                'x-monium-project': 'docstools',
            },
            body: JSON.stringify({
                resourceLogs: [{resource: {attributes}, scopeLogs: [{logRecords}]}],
            }),
            redirect: 'error',
            signal: AbortSignal.timeout(3000),
        });

        return await readCollectorResponse(response, batch.events.length);
    } catch {
        return reply(502, {error: 'collector_unavailable'});
    }
}

async function readCollectorResponse(response: Response, eventCount: number) {
    if (response.status !== 200) {
        await response.body?.cancel();

        return reply(502, {error: 'collector_rejected'});
    }

    const chunks: Uint8Array[] = [];
    let size = 0;

    for await (const chunk of response.body ?? []) {
        size += chunk.length;

        if (size > MAX_BODY_BYTES) {
            return reply(422, {error: 'collector_response_too_large'});
        }

        chunks.push(chunk);
    }

    const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    if (
        !isRecord(result) ||
        (result.partialSuccess !== undefined && !isRecord(result.partialSuccess))
    ) {
        return reply(502, {error: 'invalid_collector_response'});
    }

    const rejected = isRecord(result.partialSuccess)
        ? Number(result.partialSuccess.rejectedLogRecords ?? 0)
        : 0;

    if (!Number.isSafeInteger(rejected) || rejected < 0 || rejected > eventCount) {
        return reply(502, {error: 'invalid_collector_response'});
    }

    if (rejected > 0) {
        return reply(422, {
            error: 'collector_rejected',
            forwarded: eventCount - rejected,
        });
    }

    return reply(202, {forwarded: eventCount});
}
