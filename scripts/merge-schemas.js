#!/usr/bin/env node
'use strict';
const {readFileSync, writeFileSync, existsSync, mkdirSync} = require('fs');
const {join} = require('path');
const {load} = require('js-yaml');
const readline = require('readline');

const ROOT = join(__dirname, '..');
const OVERLAYS = join(ROOT, 'schemas/overlays');
const OUTPUT = join(ROOT, 'schemas');

const CLI_KEYS = new Set(['translate', 'optionName']);

const SCHEMAS = [
    ['frontmatter-schema', 'frontmatter-schema.yaml'],
    ['toc-schema', 'toc-schema.yaml'],
    ['yfm-schema', 'yfm-schema.yaml'],
    ['presets-schema', 'presets-schema.yaml'],
    ['redirects-schema', 'redirects-schema.yaml'],
    ['theme-schema', 'theme-schema.yaml'],
    ['leading-schema', 'leading-schema.yaml'],
    ['yfmlint-schema', 'yfmlint-schema.yaml'],
    ['page-constructor-schema', 'page-constructor-schema.yaml'],
];

function prompt(question) {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function resolveCliSchemas() {
    const defaultPath = join(ROOT, '../packages/cli/schemas');

    if (existsSync(defaultPath)) {
        return defaultPath;
    }

    console.warn('Could not find @diplodoc/cli schemas directory at ../packages/cli/schemas.');

    const answer = await prompt('Enter path to @diplodoc/cli root: ');
    const resolved = join(answer, 'schemas');

    if (!existsSync(resolved)) {
        console.error(`✗  Directory not found: ${resolved}`);
        process.exit(1);
    }

    return resolved;
}

function stripCliKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(stripCliKeys);
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};

        for (const [k, v] of Object.entries(obj)) {
            if (!CLI_KEYS.has(k)) {
                result[k] = stripCliKeys(v);
            }
        }

        return result;
    }

    return obj;
}

function inferTypeLabel(schema) {
    if (!schema || typeof schema !== 'object') {
        return null;
    }

    if (schema.$ref) {
        const match = schema.$ref.match(/#\/definitions\/(.+)/);
        return match ? match[1] : null;
    }

    if (schema.oneOf || schema.anyOf) {
        const items = schema.oneOf ?? schema.anyOf;
        const labels = items.map(inferTypeLabel).filter(Boolean);
        return labels.length ? labels.join(' | ') : null;
    }

    if (schema.enum) {
        return schema.enum.map(v => `'${v}'`).join(' | ');
    }

    if (schema.type) {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];

        if (types.includes('array')) {
            const itemLabel = schema.items ? inferTypeLabel(schema.items) : null;
            return itemLabel ? `${itemLabel}[]` : 'array';
        }

        if (types.includes('object')) {
            if (schema.title) {
                return schema.title;
            }

            if (schema.properties) {
                const keys = Object.keys(schema.properties);

                if (keys.length <= 4) {
                    return `{${keys.join(', ')}}`;
                }

                return `{${keys.slice(0, 3).join(', ')}, ...}`;
            }

            return null;
        }

        return types.join(' | ');
    }

    return null;
}

function convertSelectToOneOf(obj) {
    if (Array.isArray(obj)) {
        return obj.map(convertSelectToOneOf);
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};

        for (const [k, v] of Object.entries(obj)) {
            result[k] = convertSelectToOneOf(v);
        }

        if (result.select && result.selectCases) {
            const dataPath = result.select.$data;

            if (dataPath) {
                const propName = dataPath.split('/').pop();
                const allOf = [];

                for (const [caseValue, caseSchema] of Object.entries(result.selectCases)) {
                    allOf.push({
                        if: {properties: {[propName]: {const: caseValue}}},
                        then: convertSelectToOneOf(caseSchema),
                    });
                }

                result.allOf = allOf;
            }

            delete result.select;
            delete result.selectCases;
        }

        return result;
    }

    return obj;
}

function addMarkdownDescriptions(obj) {
    if (Array.isArray(obj)) {
        return obj.map(addMarkdownDescriptions);
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};

        for (const [k, v] of Object.entries(obj)) {
            result[k] = addMarkdownDescriptions(v);
        }

        if (!result.markdownDescription) {
            const typeLabel = inferTypeLabel(result);

            if (result.description && typeof result.description === 'string') {
                const desc = result.description.trim();
                
                result.description = desc;
                result.markdownDescription = typeLabel ? `**\`${typeLabel}\`** ${desc}` : desc;
            } else if (typeLabel && typeof result.type === 'string') {
                result.markdownDescription = `**\`${typeLabel}\`**`;
            }
        }

        return result;
    }

    return obj;
}

/**
 * Post-process: replace generic **`object`** in markdownDescription with inferred type.
 * This fixes overlay descriptions that use `object` as placeholder.
 */
function fixObjectTypeLabels(obj) {
    if (Array.isArray(obj)) {
        return obj.map(fixObjectTypeLabels);
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};

        for (const [k, v] of Object.entries(obj)) {
            result[k] = fixObjectTypeLabels(v);
        }

        if (result.markdownDescription && typeof result.markdownDescription === 'string' &&
            result.markdownDescription.includes('`object`')) {
            const typeLabel = inferTypeLabel(result);
            if (typeLabel) {
                result.markdownDescription = result.markdownDescription.replace(/`object`/g, `\`${typeLabel}\``);
            }
        }

        return result;
    }

    return obj;
}

function deepMerge(base, overlay) {
    if (typeof overlay !== 'object' || overlay === null || Array.isArray(overlay)) {
        return overlay;
    }

    const result = typeof base === 'object' && base !== null && !Array.isArray(base)
        ? {...base}
        : {};

    for (const [k, v] of Object.entries(overlay)) {
        const baseVal = result[k];
        const bothObjects =
            baseVal !== undefined &&
            typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal) &&
            typeof v === 'object' && v !== null && !Array.isArray(v);

        result[k] = bothObjects ? deepMerge(baseVal, v) : v;
    }

    return result;
}

function processSchema(name, cliFile, cliSchemas) {
    const cliPath = join(cliSchemas, cliFile);

    if (!existsSync(cliPath)) {
        console.warn(`CLI schema not found, skipping: ${cliPath}`);
        return;
    }

    let schema = load(readFileSync(cliPath, 'utf8'));
    schema = stripCliKeys(schema);
    schema = convertSelectToOneOf(schema);
    schema = addMarkdownDescriptions(schema);

    const overlayPath = join(OVERLAYS, `${name}.yaml`);

    if (existsSync(overlayPath)) {
        const overlay = load(readFileSync(overlayPath, 'utf8'));
        schema = deepMerge(schema, overlay);
        schema = fixObjectTypeLabels(schema);
        console.log(`  overlay applied: ${name}.yaml`);
    }

    const outPath = join(OUTPUT, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n');
    console.log(`✓ ${name}.json`);
}

async function main() {
    const cliSchemas = await resolveCliSchemas();

    mkdirSync(OUTPUT, {recursive: true});
    mkdirSync(OVERLAYS, {recursive: true});

    let ok = true;

    for (const [name, file] of SCHEMAS) {
        try {
            processSchema(name, file, cliSchemas);
        } catch (err) {
            console.error(`✗  ${name}: ${err.message}`);
            ok = false;
        }
    }

    process.exit(ok ? 0 : 1);
}

main();
