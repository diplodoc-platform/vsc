import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';

import {getFilesMap, isTrustedOrigin} from './utils';

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
