import {getLanguageService, LanguageService, LanguageSettings} from 'yaml-language-server';
import {TextDocument} from 'vscode-languageserver-textdocument';

import pageConstructorSchema from '../../../../schemas/page-constructor-schema.json';
import frontmatterSchema from '../../../../schemas/frontmatter-schema.json';
import leadingSchema from '../../../../schemas/leading-schema.json';
import tocSchema from '../../../../schemas/toc-schema.json';
import yfmSchema from '../../../../schemas/yfm-schema.json';
import yfmlintSchema from '../../../../schemas/yfmlint-schema.json';
import presetsSchema from '../../../../schemas/presets-schema.json';
import redirectsSchema from '../../../../schemas/redirects-schema.json';
import themeSchema from '../../../../schemas/theme-schema.json';

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
    pc: {schema: pageConstructorSchema, name: title(pageConstructorSchema) || 'Page Constructor'},
    fm: {schema: frontmatterSchema, name: title(frontmatterSchema) || 'Frontmatter'},
    leading: {schema: leadingSchema, name: title(leadingSchema) || 'Leading'},
    toc: {schema: tocSchema, name: title(tocSchema) || 'TOC'},
    yfm: {schema: yfmSchema, name: title(yfmSchema) || '.yfm'},
    yfmlint: {schema: yfmlintSchema, name: title(yfmlintSchema) || '.yfmlint'},
    presets: {schema: presetsSchema, name: title(presetsSchema) || 'Presets'},
    redirects: {schema: redirectsSchema, name: title(redirectsSchema) || 'Redirects'},
    theme: {schema: themeSchema, name: title(themeSchema) || 'Theme'},
};

export const SCHEMA_NAMES: Record<SchemaType, string> = Object.fromEntries(
    Object.entries(SCHEMA_ENTRIES).map(([k, v]) => [k, v.name]),
) as Record<SchemaType, string>;

let service: LanguageService | null = null;
let versionCounter = 0;

/**
 * Returns a singleton LanguageService with ALL schemas registered.
 * Each schema is matched by virtual document URI (diplodoc://<type>.yaml).
 * This avoids race conditions from reconfiguring per-request.
 */
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
    return TextDocument.create(
        `diplodoc://${schemaType}.yaml`,
        'yaml',
        ++versionCounter,
        content,
    );
}
