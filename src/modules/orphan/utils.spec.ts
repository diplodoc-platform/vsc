import {beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    statSync: vi.fn(),
}));
import {existsSync, statSync} from 'fs';

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

describe('findVcsDir', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns .git when it exists', () => {
        mockFs(new Set(['/project/.git']));

        expect(findVcsDir('/project')).toBe('/project/.git');
    });

    it('returns .arc when only .arc exists', () => {
        mockFs(new Set(['/project/.arc']));

        expect(findVcsDir('/project')).toBe('/project/.arc');
    });

    it('prefers .git over .arc', () => {
        mockFs(new Set(['/project/.git', '/project/.arc']));

        expect(findVcsDir('/project')).toBe('/project/.git');
    });

    it('returns null when no VCS directory exists', () => {
        mockFs(new Set());

        expect(findVcsDir('/project')).toBeNull();
    });

    it('skips non-directory entries', () => {
        mockFs(new Set(), new Set(['/project/.git']));

        expect(findVcsDir('/project')).toBeNull();
    });

    it('handles statSync errors gracefully', () => {
        existsSyncMock.mockReturnValue(true);
        statSyncMock.mockImplementation(() => {
            throw new Error('permission denied');
        });

        expect(findVcsDir('/project')).toBeNull();
    });
});

describe('isVcsOperationInProgress', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when no VCS directory exists', () => {
        mockFs(new Set());

        expect(isVcsOperationInProgress(['/project'])).toBe(false);
    });

    it('returns false when no sentinel files exist', () => {
        mockFs(new Set(['/project/.git']));

        expect(isVcsOperationInProgress(['/project'])).toBe(false);
    });

    it('detects rebase-merge (git rebase)', () => {
        mockFs(new Set(['/project/.git', '/project/.git/rebase-merge']));

        expect(isVcsOperationInProgress(['/project'])).toBe(true);
    });

    it('detects rebase-apply (git am / rebase --apply)', () => {
        mockFs(new Set(['/project/.git', '/project/.git/rebase-apply']));

        expect(isVcsOperationInProgress(['/project'])).toBe(true);
    });

    it('detects MERGE_HEAD (git merge)', () => {
        mockFs(new Set(['/project/.git']), new Set(['/project/.git/MERGE_HEAD']));

        expect(isVcsOperationInProgress(['/project'])).toBe(true);
    });

    it('detects CHERRY_PICK_HEAD', () => {
        mockFs(new Set(['/project/.git']), new Set(['/project/.git/CHERRY_PICK_HEAD']));

        expect(isVcsOperationInProgress(['/project'])).toBe(true);
    });

    it('detects REVERT_HEAD', () => {
        mockFs(new Set(['/project/.git']), new Set(['/project/.git/REVERT_HEAD']));

        expect(isVcsOperationInProgress(['/project'])).toBe(true);
    });

    it('detects operations in .arc directory', () => {
        mockFs(new Set(['/arcadia/.arc', '/arcadia/.arc/rebase-merge']));

        expect(isVcsOperationInProgress(['/arcadia'])).toBe(true);
    });

    it('checks all workspace folders', () => {
        mockFs(
            new Set(['/project-a/.git', '/project-b/.git']),
            new Set(['/project-b/.git/MERGE_HEAD']),
        );

        expect(isVcsOperationInProgress(['/project-a', '/project-b'])).toBe(true);
    });

    it('returns false when all folders are clean', () => {
        mockFs(new Set(['/project-a/.git', '/project-b/.arc']));

        expect(isVcsOperationInProgress(['/project-a', '/project-b'])).toBe(false);
    });

    it('skips folders without VCS', () => {
        mockFs(new Set(['/has-git/.git']), new Set(['/has-git/.git/MERGE_HEAD']));

        expect(isVcsOperationInProgress(['/no-vcs', '/has-git'])).toBe(true);
    });
});
