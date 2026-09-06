import {afterEach, describe, expect, it, vi} from 'vitest';

import {handler} from './collector';

const eventId = '207904f3-ed28-4f6f-97cb-9a0e24e79b3a';
const batch = () => ({
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
        },
    ],
});

const request = (data: unknown) => ({
    httpMethod: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(data),
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('telemetry collector', () => {
    it('forwards an event with its ID, zero measurement and stable UInt64 installation identity', async () => {
        const fetch = vi.fn().mockResolvedValue(new Response('', {status: 200}));

        vi.stubGlobal('fetch', fetch);
        vi.stubEnv('TELEMETRY_ENVIRONMENT', 'testing');

        const data = batch();

        expect((await handler(request(data))).statusCode).toBe(202);

        const [url, options] = fetch.mock.calls[0];

        expect(url).toBe('https://yandex.ru/clck/click');
        expect(options.body).toContain(`/reqid=${eventId}/table=rum_events/path=690.32/vars=`);
        expect(options.body).toContain('-name=references%2Ffind');
        expect(options.body).toContain('-type=integer,-value=0');
        expect(options.body).toContain('-project=diplodoc-vsc');
        expect(options.body).toContain('-env=testing');
        expect(decodeURIComponent(options.body)).toContain('"found":0');

        const uid = options.body.match(/-yandexuid=(\d+)/)[1];

        expect(BigInt(uid)).toBeGreaterThan(0n);
        expect(BigInt(uid)).toBeLessThanOrEqual(18446744073709551615n);
        expect(options.headers).not.toHaveProperty('Cookie');
        expect(options.redirect).toBe('error');

        const second = batch();

        second.sessionId = 'b7d0939f-21df-472a-811b-a73e433819b3';
        await handler(request(second));
        expect(fetch.mock.calls[1][1].body).toContain(`-yandexuid=${uid}`);
    });

    it('strips unknown fields and invalid dimension values before forwarding a base64 batch', async () => {
        const fetch = vi.fn().mockResolvedValue(new Response('', {status: 200}));

        vi.stubGlobal('fetch', fetch);

        const data = batch();

        Object.assign(data, {
            project: 'other-project',
            url: 'https://private.example',
        });
        Object.assign(data.events[0], {
            message: '/Users/alice/private.md',
            stack: 'secret',
        });
        data.events[0].properties = {source: '/private/path', text: 'secret'};

        const input = request(data);
        const result = await handler({
            ...input,
            isBase64Encoded: true,
            body: Buffer.from(input.body).toString('base64'),
        });

        expect(result.statusCode).toBe(202);
        expect(fetch.mock.calls[0][1].body).not.toMatch(/private|secret|other-project/);
    });

    it.each([
        [
            'unknown event',
            (data: ReturnType<typeof batch>) => {
                data.events[0].name = 'arbitrary/event';
            },
        ],
        [
            'forged category',
            (data: ReturnType<typeof batch>) => {
                data.events[0].kind = 'error';
            },
        ],
        [
            'invalid identity',
            (data: ReturnType<typeof batch>) => {
                data.installationId = 'alice@yandex.ru';
            },
        ],
        [
            'invalid version',
            (data: ReturnType<typeof batch>) => {
                data.extensionVersion = '/secret';
            },
        ],
        [
            'stale event',
            (data: ReturnType<typeof batch>) => {
                data.events[0].timestamp = 0;
            },
        ],
        [
            'empty batch',
            (data: ReturnType<typeof batch>) => {
                data.events = [];
            },
        ],
        [
            'oversized batch',
            (data: ReturnType<typeof batch>) => {
                data.events = Array(21).fill(data.events[0]);
            },
        ],
    ])('rejects %s without contacting the upstream', async (_name, change) => {
        const fetch = vi.fn();

        vi.stubGlobal('fetch', fetch);

        const data = batch();

        change(data);
        expect((await handler(request(data))).statusCode).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects wrong methods, non-JSON, oversized and malformed bodies before forwarding', async () => {
        const fetch = vi.fn();

        vi.stubGlobal('fetch', fetch);
        expect((await handler({...request(batch()), httpMethod: 'GET'})).statusCode).toBe(405);
        expect((await handler({...request(batch()), headers: {}})).statusCode).toBe(415);
        expect((await handler({...request(batch()), body: 'x'.repeat(65537)})).statusCode).toBe(
            413,
        );
        expect((await handler({...request(batch()), body: '{'})).statusCode).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('reports upstream failures without reflecting their body or exception text', async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(new Response('private details', {status: 500}))
            .mockRejectedValueOnce(new Error('secret'));

        vi.stubGlobal('fetch', fetch);

        for (let i = 0; i < 2; i++) {
            const result = await handler(request(batch()));

            expect(result.statusCode).toBe(502);
            expect(result.body).not.toMatch(/private|secret/);
        }
    });
});
