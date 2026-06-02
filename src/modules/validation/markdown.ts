import type {PluginMessage, ValidationMessage} from './types';
import type {TextDocument} from 'vscode';

import * as path from 'path';
import {readFileSync} from 'fs';
import {yfmlint} from '@diplodoc/yfmlint';
import defaultPlugins from '@diplodoc/transform/lib/plugins';
import changelogPlugin from '@diplodoc/transform/lib/plugins/changelog';
import checkboxPlugin from '@diplodoc/transform/lib/plugins/checkbox';
import cutPlugin from '@diplodoc/transform/lib/plugins/cut';
import filePlugin from '@diplodoc/transform/lib/plugins/file';
import imagesPlugin from '@diplodoc/transform/lib/plugins/images';
import includesPlugin from '@diplodoc/transform/lib/plugins/includes';
import linksPlugin from '@diplodoc/transform/lib/plugins/links';

import {isIncluded} from '../utils';

import {
    buildLintConfig,
    findConfig,
    hasExplicitAnchor,
    isTermDefinition,
    parseMissingAnchor,
    toDiagnostics,
} from './utils';

function isResolvedConditionalAnchor(error: ValidationMessage): boolean {
    if (!('message' in error) || typeof error.message !== 'string') {
        return false;
    }

    const parsed = parseMissingAnchor(error.message);

    if (!parsed) {
        return false;
    }

    const targetPath = parsed.link
        ? path.resolve(path.dirname(parsed.source), parsed.link)
        : parsed.source;

    try {
        return hasExplicitAnchor(readFileSync(targetPath, 'utf8'), parsed.anchor);
    } catch {
        return false;
    }
}

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

const allPlugins = [
    ...defaultPlugins,
    changelogPlugin,
    checkboxPlugin,
    cutPlugin,
    filePlugin,
    imagesPlugin,
    includesPlugin,
    linksPlugin,
];

export async function validateMarkdown(
    document: TextDocument,
    vscLintRules: Record<string, unknown> = {},
) {
    const content = document.getText();
    const filePath = document.fileName;
    const root = path.dirname(filePath);
    const pluginMessages: PluginMessage[] = [];
    const yfmConfig = findConfig(root, '.yfm');
    const yfmlintConfig = findConfig(root, '.yfmlint');
    const allowHtml = yfmConfig?.allowHtml ?? yfmConfig?.allowHTML ?? false;
    const isFileIncluded = isIncluded(filePath);

    const lintConfig = buildLintConfig(
        yfmlintConfig,
        Boolean(allowHtml),
        isFileIncluded,
        vscLintRules,
    );

    const lintErrors = await yfmlint(content, filePath, {
        plugins: allPlugins,
        pluginOptions: {
            path: filePath,
            root,
            log: {
                error(message: string) {
                    pluginMessages.push({level: 'error', message});
                },
                warn(message: string) {
                    pluginMessages.push({level: 'warn', message});
                },
                info(message: string) {
                    pluginMessages.push({level: 'info', message});
                },
            },
        },
        frontMatter: FRONTMATTER_RE,
        lintConfig,
    });

    const errors = [...(lintErrors || []), ...pluginMessages].filter(
        (error) => !isTermDefinition(error, content) && !isResolvedConditionalAnchor(error),
    );

    return toDiagnostics(errors, document);
}
