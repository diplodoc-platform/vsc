import {mkdirSync, rmSync, writeFileSync} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

import {isFileExcluded, isIncluded, isYfmFile} from './utils';

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

describe('isAutoIncluded', () => {
    it('returns true for files in includes directory', () => {
        expect(isIncluded('/docs/includes/fragment.md')).toBe(true);
    });

    it('returns true for files in nested includes directory', () => {
        expect(isIncluded('/docs/guides/includes/snippet.md')).toBe(true);
    });

    it('returns true for files in directory starting with _', () => {
        expect(isIncluded('/docs/_includes/fragment.md')).toBe(true);
        expect(isIncluded('/docs/_assets/image.md')).toBe(true);
        expect(isIncluded('/docs/_hidden/page.md')).toBe(true);
    });

    it('returns false for regular files', () => {
        expect(isIncluded('/docs/guide/intro.md')).toBe(false);
        expect(isIncluded('/docs/index.md')).toBe(false);
    });

    it('does not match filename, only directories', () => {
        expect(isIncluded('/docs/guide/_hidden.md')).toBe(false);
        expect(isIncluded('/docs/includes.md')).toBe(false);
    });
});

describe('isFileExcluded', () => {
    const defaults = [
        '^README(?:\\.[a-z]{2})?\\.md$',
        '^AGENTS(?:\\.[a-z]{2})?\\.md$',
        '^CONTRIBUTING(?:\\.[a-z]{2})?\\.md$',
        '^CHANGELOG(?:\\.[a-z]{2})?\\.md$',
    ];

    it('matches by exact full path', () => {
        expect(isFileExcluded('/docs/README.md', ['/docs/README.md'])).toBe(true);
    });

    it('matches by basename', () => {
        expect(isFileExcluded('/docs/sub/README.md', ['README.md'])).toBe(true);
    });

    it('matches by regex pattern', () => {
        expect(isFileExcluded('/docs/CHANGELOG.md', ['^CHANGELOG(?:\\.[a-z]{2})?\\.md$'])).toBe(
            true,
        );
    });

    it('matches default doc-file patterns including localized variants', () => {
        expect(isFileExcluded('/docs/README.ru.md', defaults)).toBe(true);
        expect(isFileExcluded('/docs/AGENTS.md', defaults)).toBe(true);
        expect(isFileExcluded('/docs/CONTRIBUTING.en.md', defaults)).toBe(true);
    });

    it('does not match regular md files', () => {
        expect(isFileExcluded('/docs/guide.md', defaults)).toBe(false);
    });

    it('returns false on invalid regex without throwing', () => {
        expect(isFileExcluded('/docs/guide.md', ['['])).toBe(false);
    });

    it('returns false for empty exclude list', () => {
        expect(isFileExcluded('/docs/guide.md', [])).toBe(false);
    });
});
