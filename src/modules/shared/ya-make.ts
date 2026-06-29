import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {parseYaMake} from '@diplodoc/utils/ya-make';

export function getYaMakeSources(dir: string): Map<string, string> {
    const yamakePath = join(dir, 'ya.make');
    const sources = new Map<string, string>();

    if (!existsSync(yamakePath)) {
        return sources;
    }

    try {
        const parsed = parseYaMake(yamakePath, dir);

        for (const {src, dst} of parsed.copyFileSingle) {
            sources.set(dst, src);
        }
    } catch {}

    return sources;
}

export function getYaMakeDests(dir: string): Set<string> {
    return new Set(getYaMakeSources(dir).keys());
}
