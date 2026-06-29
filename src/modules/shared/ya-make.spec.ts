import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {join} from 'node:path';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';

import {getYaMakeDests, getYaMakeSources} from './ya-make';

describe('getYaMakeSources', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = join(tmpdir(), `ya-make-vsc-${Date.now()}`);
        mkdirSync(tmp, {recursive: true});
    });

    afterEach(() => rmSync(tmp, {recursive: true, force: true}));

    it('returns empty map when ya.make does not exist', () => {
        expect(getYaMakeSources(tmp).size).toBe(0);
    });

    it('returns dst→src entry from COPY_FILE', () => {
        writeFileSync(join(tmp, 'ya.make'), 'COPY_FILE(source.md dest.md)\nEND()');

        const sources = getYaMakeSources(tmp);

        expect(sources.get('dest.md')).toBe(join(tmp, 'source.md'));
    });

    it('returns entries for multiple COPY_FILE macros', () => {
        writeFileSync(join(tmp, 'ya.make'), 'COPY_FILE(a.md x.md)\nCOPY_FILE(b.md y.md)\nEND()');
        const sources = getYaMakeSources(tmp);

        expect(sources.size).toBe(2);
        expect(sources.has('x.md')).toBe(true);
        expect(sources.has('y.md')).toBe(true);
    });

    it('swallows errors when ya.make is unreadable', () => {
        writeFileSync(join(tmp, 'ya.make'), '');
        expect(() => getYaMakeSources(tmp)).not.toThrow();
        expect(getYaMakeSources(tmp).size).toBe(0);
    });
});

describe('getYaMakeDests', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = join(tmpdir(), `ya-make-vsc-dests-${Date.now()}`);
        mkdirSync(tmp, {recursive: true});
    });

    afterEach(() => rmSync(tmp, {recursive: true, force: true}));

    it('returns empty set when no ya.make', () => {
        expect(getYaMakeDests(tmp).size).toBe(0);
    });

    it('returns set of dst filenames', () => {
        writeFileSync(
            join(tmp, 'ya.make'),
            'COPY_FILE(source.md dest.md)\nCOPY_FILE(other.md other-dest.md)\nEND()',
        );

        const dests = getYaMakeDests(tmp);

        expect(dests.has('dest.md')).toBe(true);
        expect(dests.has('other-dest.md')).toBe(true);
    });
});
