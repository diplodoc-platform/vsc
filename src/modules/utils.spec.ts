import {describe, expect, it} from 'vitest';

import {isYfmFile} from './utils';

describe('isYfmFile', () => {
    it('returns true for files inside yfm project (tests/mocks has .yfm)', () => {
        const mocksDir = `${process.cwd()}/tests/mocks`;

        expect(isYfmFile(`${mocksDir}/index.md`)).toBe(true);
        expect(isYfmFile(`${mocksDir}/level1/page1.md`)).toBe(true);
    });

    it('returns false for files outside any yfm project', () => {
        expect(isYfmFile('/tmp/random/file.md')).toBe(false);
    });
});
