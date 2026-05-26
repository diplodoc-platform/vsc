import {existsSync, readFileSync} from 'fs';
import {basename, dirname, join} from 'path';
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
        const candidate = join(dir, PRESETS_FILENAME);

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

function flattenObject(key: string, value: unknown): Array<[string, string]> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const result: Array<[string, string]> = [];

        for (const [childKey, childValue] of Object.entries(value)) {
            result.push(...flattenObject(`${key}.${childKey}`, childValue));
        }

        return result;
    }

    return [[key, String(value)]];
}

function processI18n(
    result: Map<string, VariableEntry[]>,
    preset: string,
    i18n: Record<string, unknown>,
    filePath: string,
    content: string,
): void {
    for (const [lang, langVars] of Object.entries(i18n)) {
        if (typeof langVars !== 'object' || langVars === null) {
            continue;
        }

        for (const [name, value] of Object.entries(langVars)) {
            for (const [flatName, flatValue] of flattenObject(name, value)) {
                const line = findVariableLineInI18n(content, preset, lang, flatName);
                const entries = result.get(flatName) || [];

                entries.push({
                    preset: `${preset}/i18n/${lang}`,
                    value: flatValue,
                    filePath,
                    line,
                });
                result.set(flatName, entries);
            }
        }
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
                if (name === 'i18n' && typeof value === 'object' && value !== null) {
                    processI18n(
                        result,
                        preset,
                        value as Record<string, unknown>,
                        filePath,
                        content,
                    );

                    continue;
                }

                for (const [flatName, flatValue] of flattenObject(name, value)) {
                    const line = findVariableLine(content, preset, flatName);
                    const entries = result.get(flatName) || [];

                    entries.push({preset, value: flatValue, filePath, line});
                    result.set(flatName, entries);
                }
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
    const parts = varName.split('.');
    const presetRe = new RegExp(`^${preset}:\\s*$`);

    let inPreset = false;
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
        if (presetRe.test(lines[i])) {
            inPreset = true;
            depth = 0;

            continue;
        }

        if (inPreset) {
            if (/^\S/.test(lines[i]) && lines[i].trim() !== '') {
                inPreset = false;
                depth = 0;

                continue;
            }

            const keyRe = new RegExp(`^\\s+${parts[depth]}:\\s?`);

            if (keyRe.test(lines[i])) {
                if (depth === parts.length - 1) {
                    return i;
                }

                depth++;
            }
        }
    }

    return 0;
}

function findVariableLineInI18n(
    content: string,
    preset: string,
    lang: string,
    varName: string,
): number {
    const lines = content.split('\n');
    const presetRe = new RegExp(`^${preset}:\\s*$`);
    const i18nRe = /^\s+i18n:\s*$/;
    const langRe = new RegExp(`^\\s+${lang}:\\s*$`);
    const parts = varName.split('.');

    let inPreset = false;
    let inI18n = false;
    let inLang = false;
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
        if (presetRe.test(lines[i])) {
            inPreset = true;
            inI18n = false;
            inLang = false;
            depth = 0;

            continue;
        }

        if (inPreset && /^\S/.test(lines[i]) && lines[i].trim() !== '') {
            inPreset = false;
            inI18n = false;
            inLang = false;

            continue;
        }

        if (inPreset && !inI18n && i18nRe.test(lines[i])) {
            inI18n = true;

            continue;
        }

        if (inI18n && !inLang && langRe.test(lines[i])) {
            inLang = true;

            continue;
        }

        if (inLang) {
            const keyRe = new RegExp(`^\\s+${parts[depth]}:\\s?`);

            if (keyRe.test(lines[i])) {
                if (depth === parts.length - 1) {
                    return i;
                }

                depth++;
            }
        }
    }

    return 0;
}
