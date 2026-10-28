import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {handler} from './collector';

const eventId = '207904f3-ed28-4f6f-97cb-9a0e24e79b3a';
const fetchMock = vi.fn();
const batch = (common: Record<string, unknown> = {}, event: Record<string, unknown> = {}) => ({
    schemaVersion: 1,
    installationId: '60f62126-19ad-4aad-b090-617253b6f011',
    sessionId: '3fc9e71c-7ee4-4531-9722-a82c0c2e89c6',
    extensionVersion: '1.4.1',
    vscodeVersion: '1.110.0',
    os: 'darwin',
    events: [
        {
            id: eventId,
            timestamp: Date.now(),
            name: 'references/find',
            kind: 'usage',
            properties: {},
            measurements: {found: 0},
            ...event,
        },
    ],
    ...common,
});

const request = (data: unknown) => ({
    httpMethod: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(data),
});

beforeEach(() => {
    fetchMock.mockReset().mockImplementation(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('TELEMETRY_ENVIRONMENT', 'testing');
    vi.stubEnv('MONIUM_APPLICATION_KEY', 'MONIUM_test');
    vi.useFakeTimers();
    vi.setSystemTime(1793188800123);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('telemetry collector', () => {
    it('forwards only allowlisted diagnostic counts and file types', async () => {
        const data = batch(
            {},
            {
                name: 'validation/diagnostics',
                kind: 'usage',
                properties: {fileType: 'yfm', path: '/private/.yfm', message: 'private contents'},
                measurements: {errors: 2, warnings: 1, line: 42},
            },
        );

        expect((await handler(request(data))).statusCode).toBe(202);

        const resource = JSON.parse(fetchMock.mock.calls[0][1].body).resourceLogs[0];
        const event = JSON.parse(resource.scopeLogs[0].logRecords[0].body.stringValue);

        expect(event.name).toBe('validation/diagnostics');
        expect(event.additional).toMatchObject({
            kind: 'usage',
            fileType: 'yfm',
            errors: 2,
            warnings: 1,
        });
        expect(JSON.stringify(event)).not.toMatch(/private|contents|"line"/);
    });

    it('forwards OTLP logs with event identity, timestamps, zero counters and stable installation identity', async () => {
        const data = batch();
        const result = await handler(request(data));

        expect(result.statusCode).toBe(202);
        expect(JSON.parse(result.body)).toEqual({forwarded: 1});

        const [url, options] = fetchMock.mock.calls[0];
        const resource = JSON.parse(options.body).resourceLogs[0];
        const logs = resource.scopeLogs[0].logRecords;

        expect(url).toBe('https://ingest.monium.yandex/otlp/v1/logs');
        expect(options.headers).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Application-Key MONIUM_test',
            'x-monium-project': 'docstools',
        });
        expect(resource.resource.attributes).toEqual([
            {key: 'project', value: {stringValue: 'docstools'}},
            {key: 'cluster', value: {stringValue: 'testing'}},
            {key: 'service', value: {stringValue: 'vscode-extension'}},
        ]);
        expect(logs).toHaveLength(1);
        expect(logs[0].timeUnixNano).toBe('1793188800123000000');
        expect(JSON.parse(logs[0].body.stringValue)).toEqual({
            event_id: eventId,
            client_timestamp: '1793188800123',
            installation_id: '86909440290814594',
            version: '1.4.1',
            name: 'references/find',
            additional: {
                schemaVersion: 1,
                sessionId: data.sessionId,
                kind: 'usage',
                os: 'darwin',
                vscodeVersion: '1.110.0',
                receivedAt: 1793188800123,
                found: 0,
            },
        });
        expect(options.body).not.toContain(data.installationId);
        expect(options.redirect).toBe('error');

        await handler(request(batch({sessionId: 'b7d0939f-21df-472a-811b-a73e433819b3'})));

        const next = JSON.parse(fetchMock.mock.calls[1][1].body);

        expect(
            JSON.parse(next.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue),
        ).toMatchObject({installation_id: '86909440290814594'});
    });

    it('preserves each event and its original time in a production batch', async () => {
        vi.stubEnv('TELEMETRY_ENVIRONMENT', 'production');

        const data = batch();

        data.events.push({
            ...data.events[0],
            id: 'b7d0939f-21df-472a-811b-a73e433819b3',
            timestamp: 1793188799000,
        });

        expect(JSON.parse((await handler(request(data))).body)).toEqual({forwarded: 2});

        const resource = JSON.parse(fetchMock.mock.calls[0][1].body).resourceLogs[0];
        const logs = resource.scopeLogs[0].logRecords;

        expect(resource.resource.attributes).toContainEqual({
            key: 'cluster',
            value: {stringValue: 'production'},
        });
        expect(logs).toHaveLength(2);
        expect(JSON.parse(logs[1].body.stringValue)).toMatchObject({
            event_id: 'b7d0939f-21df-472a-811b-a73e433819b3',
            client_timestamp: '1793188799000',
        });
        expect(logs[1].timeUnixNano).toBe('1793188800123000000');
    });

    it.each(['', '   '])(
        'rejects missing application credentials before sending data',
        async (key) => {
            vi.stubEnv('MONIUM_APPLICATION_KEY', key);

            expect((await handler(request(batch()))).statusCode).toBe(503);
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    it('rejects an invalid environment before sending data', async () => {
        vi.stubEnv('TELEMETRY_ENVIRONMENT', 'other');

        expect((await handler(request(batch()))).statusCode).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([1, '1'])(
        'reports rejected OTLP records without asking the sender to retry accepted records',
        async (rejectedLogRecords) => {
            fetchMock.mockResolvedValueOnce(
                Response.json({
                    partialSuccess: {rejectedLogRecords, errorMessage: 'private details'},
                }),
            );

            const data = batch();

            data.events.push({...data.events[0], id: 'b7d0939f-21df-472a-811b-a73e433819b3'});

            const result = await handler(request(data));

            expect(result.statusCode).toBe(422);
            expect(JSON.parse(result.body)).toEqual({error: 'collector_rejected', forwarded: 1});
        },
    );

    it('accepts an OTLP warning when no records were rejected', async () => {
        fetchMock.mockResolvedValueOnce(
            Response.json({partialSuccess: {rejectedLogRecords: '0', errorMessage: 'warning'}}),
        );

        expect((await handler(request(batch()))).statusCode).toBe(202);
    });

    it.each(['not json', 'null', '{"partialSuccess":{"rejectedLogRecords":"invalid"}}'])(
        'does not acknowledge an invalid OTLP response',
        async (body) => {
            fetchMock.mockResolvedValueOnce(new Response(body));

            expect((await handler(request(batch()))).statusCode).toBe(502);
        },
    );

    it('limits the upstream response before parsing it', async () => {
        fetchMock.mockResolvedValueOnce(new Response(' '.repeat(65537)));

        expect((await handler(request(batch()))).statusCode).toBe(422);
    });

    it('strips unknown fields and invalid dimension values before forwarding a base64 batch', async () => {
        const input = request(
            batch(
                {project: 'other-project', url: 'https://private.example'},
                {
                    message: '/Users/alice/private.md',
                    stack: 'secret',
                    properties: {source: '/private/path', text: 'secret'},
                },
            ),
        );
        const result = await handler({
            ...input,
            isBase64Encoded: true,
            body: Buffer.from(input.body).toString('base64'),
        });

        expect(result.statusCode).toBe(202);
        expect(fetchMock.mock.calls[0][1].body).not.toMatch(/private|secret|other-project/);
    });

    it.each([
        ['unknown event', {}, {name: 'arbitrary/event'}],
        ['forged category', {}, {kind: 'error'}],
        ['invalid identity', {installationId: 'alice@yandex.ru'}, {}],
        ['invalid version', {extensionVersion: '/secret'}, {}],
        ['stale event', {}, {timestamp: 0}],
        ['empty batch', {events: []}, {}],
        ['oversized batch', {events: Array(21).fill(batch().events[0])}, {}],
    ])('rejects %s without contacting the upstream', async (_name, common, event) => {
        expect((await handler(request(batch(common, event)))).statusCode).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects wrong methods, non-JSON, oversized and malformed bodies before forwarding', async () => {
        expect((await handler({...request(batch()), httpMethod: 'GET'})).statusCode).toBe(405);
        expect((await handler({...request(batch()), headers: {}})).statusCode).toBe(415);
        expect((await handler({...request(batch()), body: 'x'.repeat(65537)})).statusCode).toBe(
            413,
        );
        expect((await handler({...request(batch()), body: '{'})).statusCode).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports upstream failures without reflecting their body or exception text', async () => {
        fetchMock
            .mockResolvedValueOnce(new Response('private details', {status: 500}))
            .mockRejectedValueOnce(new Error('secret'));

        for (let i = 0; i < 2; i++) {
            const result = await handler(request(batch()));

            expect(result.statusCode).toBe(502);
            expect(result.body).not.toMatch(/private|secret/);
        }
    });
});
