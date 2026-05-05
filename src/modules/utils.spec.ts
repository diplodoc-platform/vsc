import {mkdirSync, rmSync, writeFileSync} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {isYfmFile} from './utils';

describe('isYfmFile', () => {
    const testRoot = join(tmpdir(), `yfm-test-${Date.now()}`);
    const nestedDir = join(testRoot, 'sub');

    beforeAll(() => {
        mkdirSync(nestedDir, {recursive: true});
        writeFileSync(join(testRoot, '.yfm'), 'allowHtml: true\n');
    });

    afterAll(() => {
        rmSync(testRoot, {recursive: true, force: true});
    });

    it('returns true for files inside yfm project', () => {
        expect(isYfmFile(join(testRoot, 'index.md'))).toBe(true);
        expect(isYfmFile(join(nestedDir, 'page.md'))).toBe(true);
    });

    it('returns false for files outside any yfm project', () => {
        expect(isYfmFile('/tmp/random/file.md')).toBe(false);
    });
});
