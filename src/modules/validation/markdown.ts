import type {PluginMessage} from './types';
import type {TextDocument} from 'vscode';

import * as path from 'path';
import {yfmlint} from '@diplodoc/yfmlint';
import defaultPlugins from '@diplodoc/transform/lib/plugins';
import changelogPlugin from '@diplodoc/transform/lib/plugins/changelog';
import checkboxPlugin from '@diplodoc/transform/lib/plugins/checkbox';
import cutPlugin from '@diplodoc/transform/lib/plugins/cut';
import filePlugin from '@diplodoc/transform/lib/plugins/file';
import imagesPlugin from '@diplodoc/transform/lib/plugins/images';
import includesPlugin from '@diplodoc/transform/lib/plugins/includes';
import linksPlugin from '@diplodoc/transform/lib/plugins/links';

import {buildLintConfig, findConfig, toDiagnostics} from './utils';

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

export async function validateMarkdown(document: TextDocument) {
    const content = document.getText();
    const filePath = document.fileName;
    const root = path.dirname(filePath);
    const pluginMessages: PluginMessage[] = [];
    const yfmConfig = findConfig(root, '.yfm');
    const yfmlintConfig = findConfig(root, '.yfmlint');
    const allowHtml = yfmConfig?.allowHtml ?? yfmConfig?.allowHTML ?? false;

    const lintConfig = buildLintConfig(yfmlintConfig, Boolean(allowHtml));

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

    const errors = [...(lintErrors || []), ...pluginMessages];

    return toDiagnostics(errors, document);
}
