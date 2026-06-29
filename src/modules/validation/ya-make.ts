import type {PluginMessage, ValidationMessage, YfmLintError} from './types';

import {basename} from 'node:path';

const UNREACHABLE_LINK_RULE = 'unreachable-link';
const UNREACHABLE_LINK_RE = /Unreachable link:\s+"([^"]+)"/;
const PLUGIN_UNREACHABLE_RE = /^Link is unreachable:\s+([^\n]+)/;

export function matchesYaMakeDest(linkPath: string, yaMakeDests: Set<string>): boolean {
    const name = basename(linkPath.trim());

    return yaMakeDests.has(name) || yaMakeDests.has(name + '.md');
}

export function isYaMakeProvidedLink(error: ValidationMessage, yaMakeDests: Set<string>): boolean {
    if (!yaMakeDests.size) {
        return false;
    }

    if (!('ruleNames' in error) && 'message' in error) {
        const match = PLUGIN_UNREACHABLE_RE.exec((error as PluginMessage).message);

        return match ? matchesYaMakeDest(match[1], yaMakeDests) : false;
    }

    const ruleNames = (error as YfmLintError).ruleNames ?? [];

    if (!ruleNames.includes(UNREACHABLE_LINK_RULE)) {
        return false;
    }

    const errorContext = (error as YfmLintError).errorContext ?? '';
    const match = UNREACHABLE_LINK_RE.exec(errorContext);

    return match ? matchesYaMakeDest(match[1], yaMakeDests) : false;
}
