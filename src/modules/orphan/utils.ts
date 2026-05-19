import {existsSync, statSync} from 'fs';
import {join} from 'path';

const VCS_DIRS = ['.git', '.arc'];

const VCS_SENTINELS = [
    'rebase-merge',
    'rebase-apply',
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
];

export function findVcsDir(folderPath: string): string | null {
    for (const name of VCS_DIRS) {
        const dir = join(folderPath, name);

        try {
            if (existsSync(dir) && statSync(dir).isDirectory()) {
                return dir;
            }
        } catch {
            continue;
        }
    }

    return null;
}

export function isVcsOperationInProgress(folderPaths: string[]): boolean {
    for (const folderPath of folderPaths) {
        const vcsDir = findVcsDir(folderPath);

        if (!vcsDir) {
            continue;
        }

        for (const sentinel of VCS_SENTINELS) {
            if (existsSync(join(vcsDir, sentinel))) {
                return true;
            }
        }
    }

    return false;
}
