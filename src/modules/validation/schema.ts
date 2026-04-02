/**
 * Shared schema utilities for frontmatter validation, hover, and completion.
 * The JSON is inlined at build time by esbuild — no runtime file I/O.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require('../../../schemas/frontmatter-schema.json') as RawSchema;

interface RawProp {
    type?: string | string[];
    description?: string;
    markdownDescription?: string;
    enum?: string[];
    '$ref'?: string;
    oneOf?: RawProp[];
    items?: RawProp;
    properties?: Record<string, RawProp>;
}

interface RawSchema {
    properties: Record<string, RawProp>;
    definitions: Record<string, RawProp>;
}

export interface SubFieldInfo {
    key: string;
    typeLabel: string;
    description: string;
}

export interface FieldInfo {
    key: string;
    /** Human-readable type extracted from markdownDescription, e.g. "string[]" */
    typeLabel: string;
    description: string;
    markdownDescription: string;
    /** Allowed enum values (only for fields like `stage`) */
    enumValues?: string[];
    /** Fields written by the build system, not by authors */
    isSystem: boolean;
    /** Sub-properties for object-type fields */
    subFields?: SubFieldInfo[];
}

const SYSTEM_FIELDS = new Set([
    'author', 'contributors', 'updatedAt', 'editable',
    'theme', '__system', '__metadata', 'vcsPath', 'sourcePath',
]);

function extractTypeLabel(prop: RawProp): string {
    // Prefer the label already encoded in markdownDescription: "**`string[]`** ..."
    if (prop.markdownDescription) {
        const m = /\*\*`([^`]+)`\*\*/.exec(prop.markdownDescription);
        if (m) return m[1];
    }
    if (prop.enum) return prop.enum.map(v => `'${v}'`).join(' | ');
    if (prop.type) return Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type;
    if (prop['$ref']) return prop['$ref'].split('/').pop() ?? 'object';
    if (prop.oneOf) return prop.oneOf.map(extractTypeLabel).join(' | ');
    return 'any';
}

function buildFieldMap(schema: RawSchema): Map<string, FieldInfo> {
    const map = new Map<string, FieldInfo>();
    for (const [key, prop] of Object.entries(schema.properties ?? {})) {
        const subFields: SubFieldInfo[] | undefined = prop.properties
            ? Object.entries(prop.properties).map(([k, p]) => ({
                key: k,
                typeLabel: extractTypeLabel(p),
                description: (p.description ?? '').replace(/^[^.]+\.\s*/, ''), // strip "type. " prefix
            }))
            : undefined;

        map.set(key, {
            key,
            typeLabel: extractTypeLabel(prop),
            description: prop.description ?? '',
            markdownDescription: prop.markdownDescription ?? prop.description ?? '',
            enumValues: prop.enum,
            isSystem: SYSTEM_FIELDS.has(key),
            subFields,
        });
    }
    return map;
}

/** All known frontmatter fields keyed by field name. */
export const KNOWN_FIELDS: ReadonlyMap<string, FieldInfo> = buildFieldMap(raw);

/** The raw AJV-compatible schema object (used by Ajv.compile). */
export const FRONTMATTER_SCHEMA: object = raw;

/**
 * Parse the raw YAML body (everything between the two `---` delimiters).
 * Returns null if there is no frontmatter block.
 */
export interface FrontmatterBlock {
    /** Raw YAML text between the delimiters */
    rawYaml: string;
    /** 0-based document line of the opening `---` */
    openLine: number;
    /** 0-based document line where the YAML body starts (openLine + 1) */
    bodyLine: number;
    /** 0-based document line of the closing `---` */
    closeLine: number;
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseFrontmatterBlock(text: string): FrontmatterBlock | null {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) return null;

    const rawYaml = m[1];
    const bodyLine = 1;
    const closeLine = bodyLine + rawYaml.split('\n').length;

    return { rawYaml, openLine: 0, bodyLine, closeLine };
}
