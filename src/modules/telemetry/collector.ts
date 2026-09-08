import {createHash} from 'node:crypto';

import {MAX_BODY_BYTES, isRecord, parseBatch} from './schema';

const reply = (statusCode: number, data: Record<string, unknown>) => ({
    statusCode,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
    body: JSON.stringify(data),
});

const encode = (value: unknown) => encodeURIComponent(String(value)).replace(/\*/g, '%2A');

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

    const uid = createHash('sha256')
        .update(`diplodoc-vsc:${batch.installationId}`)
        .digest()
        .readBigUInt64BE();

    const lines = batch.events.map((item) => {
        const fields = {
            project: 'diplodoc-vsc',
            env: environment,
            service: 'vscode-extension',
            page: item.name.split('/')[0],
            platform: 'desktop',
            version: batch.extensionVersion,
            yandexuid: (uid || 1n).toString(),
            ts: item.timestamp,
            type: 'integer',
            value: item.measurements.found ?? 1,
            name: item.name,
            additional: JSON.stringify({
                schemaVersion: 1,
                sessionId: batch.sessionId,
                kind: item.kind,
                os: batch.os,
                vscodeVersion: batch.vscodeVersion,
                receivedAt: now,
                ...item.properties,
                ...item.measurements,
            }),
        };

        const vars = Object.entries(fields)
            .map(([key, value]) => `-${key}=${encode(value)}`)
            .join(',');

        return `/reqid=${item.id}/table=rum_events/path=690.32/vars=${vars}/cts=${now}/*`;
    });

    try {
        const response = await fetch('https://yandex.ru/clck/click', {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=UTF-8'},
            body: lines.join('\r\n'),
            redirect: 'error',
            signal: AbortSignal.timeout(3000),
        });

        await response.body?.cancel();

        if (!response.ok) {
            return reply(502, {error: 'collector_rejected'});
        }

        return reply(202, {forwarded: batch.events.length});
    } catch {
        return reply(502, {error: 'collector_unavailable'});
    }
}
