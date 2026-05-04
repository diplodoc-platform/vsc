import {existsSync} from 'fs';
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
