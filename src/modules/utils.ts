import {existsSync, readFileSync} from 'fs';
import {dirname, resolve} from 'path';
import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel('Diplodoc');

export function logger(message: unknown) {
    output.appendLine(JSON.stringify(message));
}

export function findYfmRoot(fsPath: string): string | null {
    let dir = dirname(fsPath);
    let parent = dirname(dir);

    while (dir !== parent) {
        if (existsSync(resolve(dir, '.yfm'))) {
            return dir;
        }

        dir = parent;
        parent = dirname(dir);
    }

    return null;
}

export function isYfmFile(fsPath: string): boolean {
    return findYfmRoot(fsPath) !== null;
}

function getExcludeDirs(): Set<string> {
    const dirs = new Set(['node_modules', '_build']);

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

    return dirs;
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
