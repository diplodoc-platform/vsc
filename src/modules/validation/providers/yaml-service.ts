import type {LanguageService, LanguageSettings} from 'yaml-language-server';

import {getLanguageService} from 'yaml-language-server';
import {TextDocument} from 'vscode-languageserver-textdocument';
import {
    frontmatterSchemaJson,
    leadingSchemaJson,
    pageConstructorSchemaJson,
    presetsSchemaJson,
    redirectsSchemaJson,
    themeSchemaJson,
    tocSchemaJson,
    yfmSchemaJson,
    yfmlintSchemaJson,
} from '@diplodoc/ajv';

export type SchemaType =
    | 'pc'
    | 'fm'
    | 'leading'
    | 'toc'
    | 'yfm'
    | 'yfmlint'
    | 'presets'
    | 'redirects'
    | 'theme';

interface SchemaEntry {
    schema: object;
    name: string;
}

function title(schema: object): string {
    return (schema as {title?: string}).title ?? '';
}

const SCHEMA_ENTRIES: Record<SchemaType, SchemaEntry> = {
    pc: {
        schema: pageConstructorSchemaJson,
        name: title(pageConstructorSchemaJson) || 'Page Constructor',
    },
    fm: {schema: frontmatterSchemaJson, name: title(frontmatterSchemaJson) || 'Frontmatter'},
    leading: {schema: leadingSchemaJson, name: title(leadingSchemaJson) || 'Leading'},
    toc: {schema: tocSchemaJson, name: title(tocSchemaJson) || 'TOC'},
    yfm: {schema: yfmSchemaJson, name: title(yfmSchemaJson) || '.yfm'},
    yfmlint: {schema: yfmlintSchemaJson, name: title(yfmlintSchemaJson) || '.yfmlint'},
    presets: {schema: presetsSchemaJson, name: title(presetsSchemaJson) || 'Presets'},
    redirects: {schema: redirectsSchemaJson, name: title(redirectsSchemaJson) || 'Redirects'},
    theme: {schema: themeSchemaJson, name: title(themeSchemaJson) || 'Theme'},
};

export const SCHEMA_NAMES: Record<SchemaType, string> = Object.fromEntries(
    Object.entries(SCHEMA_ENTRIES).map(([k, v]) => [k, v.name]),
) as Record<SchemaType, string>;

let service: LanguageService | null = null;
let versionCounter = 0;

export function getConfiguredService(): LanguageService {
    if (!service) {
        service = getLanguageService({
            schemaRequestService: () => Promise.resolve('{}'),
            workspaceContext: {
                resolveRelativePath: (relativePath: string) => relativePath,
            },
        });

        const settings: LanguageSettings = {
            validate: true,
            completion: true,
            hover: true,
            schemas: Object.entries(SCHEMA_ENTRIES).map(([type, entry]) => ({
                uri: `diplodoc://${type}-schema`,
                fileMatch: [`diplodoc://${type}.yaml`],
                schema: entry.schema,
                name: entry.name,
            })),
            customTags: [],
        };

        service.configure(settings);
    }

    return service;
}

export function createVirtualDocument(content: string, schemaType: SchemaType): TextDocument {
    return TextDocument.create(`diplodoc://${schemaType}.yaml`, 'yaml', ++versionCounter, content);
}
