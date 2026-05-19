import {beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    statSync: vi.fn(),
}));
import {existsSync, statSync} from 'fs';
import {join} from 'path';

import {findVcsDir, isVcsOperationInProgress} from './utils';

const existsSyncMock = vi.mocked(existsSync);
const statSyncMock = vi.mocked(statSync);

function mockFs(dirs: Set<string>, files: Set<string> = new Set()) {
    existsSyncMock.mockImplementation((p) => {
        const s = String(p);

        return dirs.has(s) || files.has(s);
    });

    statSyncMock.mockImplementation((p) => {
        const s = String(p);

        if (dirs.has(s)) {
            return {isDirectory: () => true} as ReturnType<typeof statSync>;
        }

        if (files.has(s)) {
            return {isDirectory: () => false} as ReturnType<typeof statSync>;
        }

        throw new Error(`ENOENT: ${s}`);
    });
}

const P = '/project';
const A = '/arcadia';
const PA = '/project-a';
const PB = '/project-b';
const HG = '/has-git';

describe('findVcsDir', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns .git when it exists', () => {
        mockFs(new Set([join(P, '.git')]));

        expect(findVcsDir(P)).toBe(join(P, '.git'));
    });

    it('returns .arc when only .arc exists', () => {
        mockFs(new Set([join(P, '.arc')]));

        expect(findVcsDir(P)).toBe(join(P, '.arc'));
    });

    it('prefers .git over .arc', () => {
        mockFs(new Set([join(P, '.git'), join(P, '.arc')]));

        expect(findVcsDir(P)).toBe(join(P, '.git'));
    });

    it('returns null when no VCS directory exists', () => {
        mockFs(new Set());

        expect(findVcsDir(P)).toBeNull();
    });

    it('skips non-directory entries', () => {
        mockFs(new Set(), new Set([join(P, '.git')]));

        expect(findVcsDir(P)).toBeNull();
    });

    it('handles statSync errors gracefully', () => {
        existsSyncMock.mockReturnValue(true);
        statSyncMock.mockImplementation(() => {
            throw new Error('permission denied');
        });

        expect(findVcsDir(P)).toBeNull();
    });
});

describe('isVcsOperationInProgress', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when no VCS directory exists', () => {
        mockFs(new Set());

        expect(isVcsOperationInProgress([P])).toBe(false);
    });

    it('returns false when no sentinel files exist', () => {
        mockFs(new Set([join(P, '.git')]));

        expect(isVcsOperationInProgress([P])).toBe(false);
    });

    it('detects rebase-merge (git rebase)', () => {
        mockFs(new Set([join(P, '.git'), join(P, '.git', 'rebase-merge')]));

        expect(isVcsOperationInProgress([P])).toBe(true);
    });

    it('detects rebase-apply (git am / rebase --apply)', () => {
        mockFs(new Set([join(P, '.git'), join(P, '.git', 'rebase-apply')]));

        expect(isVcsOperationInProgress([P])).toBe(true);
    });

    it('detects MERGE_HEAD (git merge)', () => {
        mockFs(new Set([join(P, '.git')]), new Set([join(P, '.git', 'MERGE_HEAD')]));

        expect(isVcsOperationInProgress([P])).toBe(true);
    });

    it('detects CHERRY_PICK_HEAD', () => {
        mockFs(new Set([join(P, '.git')]), new Set([join(P, '.git', 'CHERRY_PICK_HEAD')]));

        expect(isVcsOperationInProgress([P])).toBe(true);
    });

    it('detects REVERT_HEAD', () => {
        mockFs(new Set([join(P, '.git')]), new Set([join(P, '.git', 'REVERT_HEAD')]));

        expect(isVcsOperationInProgress([P])).toBe(true);
    });

    it('detects operations in .arc directory', () => {
        mockFs(new Set([join(A, '.arc'), join(A, '.arc', 'rebase-merge')]));

        expect(isVcsOperationInProgress([A])).toBe(true);
    });

    it('checks all workspace folders', () => {
        mockFs(
            new Set([join(PA, '.git'), join(PB, '.git')]),
            new Set([join(PB, '.git', 'MERGE_HEAD')]),
        );

        expect(isVcsOperationInProgress([PA, PB])).toBe(true);
    });

    it('returns false when all folders are clean', () => {
        mockFs(new Set([join(PA, '.git'), join(PB, '.arc')]));

        expect(isVcsOperationInProgress([PA, PB])).toBe(false);
    });

    it('skips folders without VCS', () => {
        mockFs(new Set([join(HG, '.git')]), new Set([join(HG, '.git', 'MERGE_HEAD')]));

        expect(isVcsOperationInProgress(['/no-vcs', HG])).toBe(true);
    });
});
