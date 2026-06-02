import {existsSync, readFileSync} from 'fs';
import {basename, dirname, resolve} from 'path';
import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel('Diplodoc');

export function logger(message: unknown) {
    output.appendLine(JSON.stringify(message));
}

const yfmRootCache = new Map<string, string | null>();

export function findYfmRoot(fsPath: string): string | null {
    const dir = dirname(fsPath);

    const cached = yfmRootCache.get(dir);

    if (cached !== undefined) {
        return cached;
    }

    const visited: string[] = [];
    let current = dir;
    let parent = dirname(current);

    while (current !== parent) {
        const alreadyCached = yfmRootCache.get(current);

        if (alreadyCached !== undefined) {
            for (const d of visited) {
                yfmRootCache.set(d, alreadyCached);
            }

            return alreadyCached;
        }

        visited.push(current);

        if (existsSync(resolve(current, '.yfm'))) {
            for (const d of visited) {
                yfmRootCache.set(d, current);
            }

            return current;
        }

        current = parent;
        parent = dirname(current);
    }

    for (const d of visited) {
        yfmRootCache.set(d, null);
    }

    return null;
}

export function clearYfmRootCache(): void {
    yfmRootCache.clear();
}

export function isYfmFile(fsPath: string): boolean {
    return findYfmRoot(fsPath) !== null;
}

export function getVscConfig<T>(configName: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('diplodoc');

    return config.get<T>(configName, defaultValue);
}

export function isFileExcluded(fullFileName: string, excludedFiles: string[]): boolean {
    const baseFileName = basename(fullFileName);

    return excludedFiles.some((excludedFile) => {
        if (excludedFile === fullFileName || excludedFile === baseFileName) {
            return true;
        }

        try {
            const pattern = new RegExp(excludedFile);

            return pattern.test(fullFileName) || pattern.test(baseFileName);
        } catch {
            return false;
        }
    });
}

let excludeDirsCache: Set<string> | null = null;

function getExcludeDirs(): Set<string> {
    if (excludeDirsCache) {
        return excludeDirsCache;
    }

    const dirs = new Set(['node_modules', '_build']);

    const userExclude = getVscConfig<string[]>('excludedDirs', []);

    for (const dir of userExclude) {
        if (dir) {
            dirs.add(dir);
        }
    }

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const yfmPath = resolve(folder.uri.fsPath, '.yfm');

        if (!existsSync(yfmPath)) {
            continue;
        }

        try {
            const content = readFileSync(yfmPath, 'utf-8');
            const match = content.match(/^output:\s*['"]?(.+?)['"]?\s*$/m);

            if (match) {
                const dir = match[1].replace(/^\.\//, '').split('/')[0];

                if (dir && dir !== '..' && !dir.startsWith('/')) {
                    dirs.add(dir);
                }
            }
        } catch {}
    }

    excludeDirsCache = dirs;

    return dirs;
}

export function clearExcludeDirsCache(): void {
    excludeDirsCache = null;
}

export function getExcludePattern(): string {
    const dirs = getExcludeDirs();

    return `{${[...dirs].map((d) => `**/${d}/**`).join(',')}}`;
}

export function isInExcludedDir(fsPath: string): boolean {
    const dirs = getExcludeDirs();
    const segments = fsPath.split(/[/\\]/);

    return segments.some((s) => dirs.has(s));
}

export function isIncluded(fsPath: string): boolean {
    const parts = fsPath.split(/[/\\]/);
    const dirs = parts.slice(0, -1);

    return dirs.some((dir) => dir === 'includes' || dir.startsWith('_'));
}
