import {existsSync, readFileSync} from 'fs';
import {basename, dirname, resolve} from 'path';
import {load as yamlLoad} from 'js-yaml';

import {findYfmRoot} from '../utils';

import {PRESETS_FILENAME, VARIABLE_RE} from './constants';

export interface VariableEntry {
    preset: string;
    value: string;
    filePath: string;
    line: number;
}

export function findPresetsFiles(fsPath: string): string[] {
    const root = findYfmRoot(fsPath);

    if (!root) {
        return [];
    }

    const files: string[] = [];
    let dir = dirname(fsPath);

    if (basename(fsPath) === PRESETS_FILENAME) {
        dir = dirname(dir);
    }

    for (let parent = dirname(dir); ; parent = dirname(dir)) {
        const candidate = resolve(dir, PRESETS_FILENAME);

        if (existsSync(candidate)) {
            files.push(candidate);
        }

        if (dir === root || parent === dir) {
            break;
        }

        dir = parent;
    }

    return files;
}

export function parsePresetsFile(filePath: string): Record<string, Record<string, string>> | null {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const data = yamlLoad(content);

        if (!data || typeof data !== 'object') {
            return null;
        }

        return data as Record<string, Record<string, string>>;
    } catch {
        return null;
    }
}

export function resolveVariables(fsPath: string): Map<string, VariableEntry[]> {
    const files = findPresetsFiles(fsPath);
    const result = new Map<string, VariableEntry[]>();

    for (const filePath of files) {
        const data = parsePresetsFile(filePath);

        if (!data) {
            continue;
        }

        let content: string;

        try {
            content = readFileSync(filePath, 'utf-8');
        } catch {
            continue;
        }

        for (const [preset, vars] of Object.entries(data)) {
            if (typeof vars !== 'object' || vars === null) {
                continue;
            }

            for (const [name, value] of Object.entries(vars)) {
                const line = findVariableLine(content, preset, name);
                const entries = result.get(name) || [];

                entries.push({preset, value: String(value), filePath, line});
                result.set(name, entries);
            }
        }
    }

    return result;
}

export function getVariableAtPosition(
    lineText: string,
    character: number,
): {name: string; start: number; end: number} | null {
    const re = new RegExp(VARIABLE_RE.source, 'g');
    let match;

    while ((match = re.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (character >= start && character < end) {
            return {name: match[1], start, end};
        }
    }

    return null;
}

export function findVariableLine(content: string, preset: string, varName: string): number {
    const lines = content.split('\n');
    const presetRe = new RegExp(`^${preset}:\\s*$`);
    const varRe = new RegExp(`^\\s+${varName}:\\s`);

    let inPreset = false;

    for (let i = 0; i < lines.length; i++) {
        if (presetRe.test(lines[i])) {
            inPreset = true;

            continue;
        }

        if (inPreset) {
            if (/^\S/.test(lines[i]) && lines[i].trim() !== '') {
                inPreset = false;

                continue;
            }

            if (varRe.test(lines[i])) {
                return i;
            }
        }
    }

    return 0;
}
