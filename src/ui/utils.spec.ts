import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';

import {getFilesMap, isTrustedOrigin, resolveMediaSrc} from './utils';

describe('isTrustedOrigin', () => {
    beforeAll(() => {
        vi.stubGlobal('window', {location: {origin: 'http://localhost'}});
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('trusts empty origin (VS Code extension host)', () => {
        expect(isTrustedOrigin('')).toBe(true);
    });

    it('trusts same origin as window.location', () => {
        expect(isTrustedOrigin('http://localhost')).toBe(true);
    });

    it('rejects foreign origin', () => {
        expect(isTrustedOrigin('https://evil.example.com')).toBe(false);
    });

    it('rejects null string origin', () => {
        expect(isTrustedOrigin('null')).toBe(false);
    });
});

describe('getFilesMap', () => {
    const files = ['docs/guide/intro.md', 'docs/guide/setup.md', 'docs/api/rest.md', 'readme.md'];

    it('groups files by directory', () => {
        const result = getFilesMap('', files);

        expect([...result.keys()]).toEqual(['', 'docs/api', 'docs/guide']);
        expect(result.get('')).toEqual(['readme.md']);
        expect(result.get('docs/guide')).toEqual(['docs/guide/intro.md', 'docs/guide/setup.md']);
    });

    it('filters by filename (case-insensitive)', () => {
        const result = getFilesMap('REST', files);

        expect(result.size).toBe(1);
        expect(result.get('docs/api')).toEqual(['docs/api/rest.md']);
    });

    it('returns empty map when no matches', () => {
        const result = getFilesMap('nonexistent', files);

        expect(result.size).toBe(0);
    });

    it('sorts root directory first', () => {
        const result = getFilesMap('.md', files);
        const keys = [...result.keys()];

        expect(keys[0]).toBe('');
    });
});

describe('resolveMediaSrc', () => {
    const base = 'https://file+.vscode-resource.vscode-cdn.net/docs/';

    it('resolves a relative path against the base', () => {
        expect(resolveMediaSrc(base, './_assets/img.png')).toBe(`${base}_assets/img.png`);
    });

    it('appends a trailing slash to the base when missing', () => {
        expect(resolveMediaSrc('https://host/docs', 'img.png')).toBe('https://host/docs/img.png');
    });

    it.each(['http://x/a.png', 'https://x/a.png', 'data:image/png;base64,AAA', 'blob:abc'])(
        'leaves absolute source %s unchanged',
        (src) => {
            expect(resolveMediaSrc(base, src)).toBe(src);
        },
    );

    it('leaves already-resolved webview sources unchanged', () => {
        const src = 'vscode-resource://file/img.png';

        expect(resolveMediaSrc(base, src)).toBe(src);
    });

    it('returns the source as-is when base is missing', () => {
        expect(resolveMediaSrc(undefined, './img.png')).toBe('./img.png');
    });

    it('returns an empty source unchanged', () => {
        expect(resolveMediaSrc(base, '')).toBe('');
    });
});
