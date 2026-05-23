import type {VariableEntry} from './resolver';

import {basename, relative} from 'path';

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
