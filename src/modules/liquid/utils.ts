import type {VariableEntry} from './resolver';
import type {LiquidTag, Variable} from './types';

import {basename, relative} from 'path';

import {LIQUID_CONTROL_KEYWORDS, LIQUID_KEYWORDS, PRESET_END, PRESET_START} from './constants';

export function formatEntries(entries: VariableEntry[], root: string | null): string {
    const byFile = new Map<string, VariableEntry[]>();

    for (const entry of entries) {
        const group = byFile.get(entry.filePath) || [];

        group.push(entry);
        byFile.set(entry.filePath, group);
    }

    const parts: string[] = [];

    for (const [filePath, fileEntries] of byFile) {
        const fileName = root ? relative(root, filePath).replace(/\\/g, '/') : basename(filePath);

        if (byFile.size > 1) {
            parts.push(`*${fileName}*\n`);
        }

        parts.push('| Preset | Value |');
        parts.push('|--------|-------|');

        for (const entry of fileEntries) {
            parts.push(`| ${entry.preset} | \`${entry.value}\` |`);
        }

        if (byFile.size === 1) {
            parts.push(`\n*${fileName}*`);
        }
    }

    return parts.join('\n');
}

export function getLiquidTagKeyword(lineText: string, charPos: number): LiquidTag | null {
    const tagRe = /\{%-?\s*(\w+)[^%]*?-?%\}/g;
    let m: RegExpExecArray | null;

    while ((m = tagRe.exec(lineText)) !== null) {
        const tagStart = m.index;
        const tagEnd = m.index + m[0].length;

        if (charPos < tagStart || charPos > tagEnd) {
            continue;
        }

        const keyword = m[1];

        if (LIQUID_CONTROL_KEYWORDS.has(keyword)) {
            return {keyword, start: tagStart, end: tagEnd};
        }
    }

    return null;
}

export function findVariableInTag(lineText: string, charPos: number): Variable | null {
    const tagRe = /\{%-?[\s\S]*?-?%\}/g;
    let tagMatch: RegExpExecArray | null;
    let tagStart = -1;
    let tagEnd = -1;

    while ((tagMatch = tagRe.exec(lineText)) !== null) {
        if (charPos >= tagMatch.index && charPos <= tagMatch.index + tagMatch[0].length) {
            tagStart = tagMatch.index;
            tagEnd = tagMatch.index + tagMatch[0].length;
            break;
        }
    }

    if (tagStart === -1) {
        return null;
    }

    const varRe = /[\w][\w.-]*/g;
    let m: RegExpExecArray | null;

    while ((m = varRe.exec(lineText)) !== null) {
        const varStart = m.index;
        const varEnd = m.index + m[0].length;

        if (varStart < tagStart || varEnd > tagEnd) {
            continue;
        }

        if (charPos < varStart || charPos > varEnd) {
            continue;
        }

        const name = m[0];

        if (LIQUID_KEYWORDS.has(name) || /^\d/.test(name)) {
            continue;
        }

        return {name, start: varStart, end: varEnd};
    }

    return null;
}

export function getVariableFromOutput(lineText: string, charPos: number): Variable | null {
    let startIdx = lineText.indexOf(PRESET_START);

    while (startIdx !== -1) {
        const endIdx = lineText.indexOf(PRESET_END, startIdx + PRESET_START.length);

        if (endIdx >= 0 && charPos >= startIdx && charPos <= endIdx + PRESET_END.length) {
            return {
                name: lineText.slice(startIdx + PRESET_START.length, endIdx).trim(),
                start: startIdx,
                end: endIdx + PRESET_END.length,
            };
        }

        startIdx = lineText.indexOf(PRESET_START, startIdx + 1);
    }

    return null;
}
