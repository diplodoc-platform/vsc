import {readFileSync, readdirSync} from 'node:fs';
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {load as yamlLoad} from 'js-yaml';

import {findYfmRoot} from '../utils';

const TOC_RE = /^toc(?:-.+)?\.ya?ml$/;
const OPERATION_ID_RE = /^\s*operationId:\s*(?:"([^"]+)"|'([^']+)'|([^\s#]+))/gm;

type GeneratedApi = {dir: string; spec: string};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function* records(value: unknown): Generator<Record<string, unknown>> {
    if (Array.isArray(value)) {
        for (const item of value) {
            yield* records(item);
        }
    } else if (isRecord(value)) {
        yield value;
        for (const item of Object.values(value)) {
            yield* records(item);
        }
    }
}

function findNearestTocs(filePath: string, root: string): string[] {
    for (let current = dirname(filePath); current.startsWith(root); current = dirname(current)) {
        try {
            const tocs = readdirSync(current)
                .filter((name) => TOC_RE.test(name))
                .map((name) => join(current, name));

            if (tocs.length) {
                return tocs;
            }
        } catch {}
    }

    return [];
}

export function createOpenApiLinkSkipper(filePath: string): (href: string) => boolean {
    const root = findYfmRoot(filePath);

    if (!root) {
        return () => false;
    }

    const generated: GeneratedApi[] = [];

    for (const tocPath of findNearestTocs(filePath, root)) {
        try {
            for (const {include} of records(yamlLoad(readFileSync(tocPath, 'utf8')))) {
                if (!isRecord(include) || typeof include.path !== 'string') {
                    continue;
                }

                const includer = (Array.isArray(include.includers) ? include.includers : []).find(
                    (item) => isRecord(item) && item.name === 'openapi',
                );

                if (isRecord(includer) && typeof includer.input === 'string') {
                    generated.push({
                        dir: resolve(dirname(tocPath), include.path),
                        spec: resolve(root, includer.input),
                    });
                }
            }
        } catch {}
    }

    return (href) => {
        const target = resolve(dirname(filePath), href.split(/[?#]/, 1)[0]);

        return generated.some(({dir, spec}) => {
            const pathFromGeneratedDir = relative(dir, target);
            const isInside =
                pathFromGeneratedDir !== '..' &&
                !pathFromGeneratedDir.startsWith(`..${sep}`) &&
                !isAbsolute(pathFromGeneratedDir);

            if (!isInside) {
                return false;
            }

            try {
                return [...readFileSync(spec, 'utf8').matchAll(OPERATION_ID_RE)].some(
                    (match) => `${match[1] ?? match[2] ?? match[3]}.md` === basename(target),
                );
            } catch {
                return false;
            }
        });
    };
}
