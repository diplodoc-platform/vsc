#!/usr/bin/env node
'use strict';
const {writeFileSync, existsSync, readFileSync, mkdirSync} = require('fs');
const {join} = require('path');
const https = require('https');
const {load} = require('js-yaml');

const ROOT = join(__dirname, '..');
const OVERLAYS = join(ROOT, 'schemas/overlays');
const OUTPUT = join(ROOT, 'schemas');

const BASE_URL = 'https://raw.githubusercontent.com/diplodoc-platform/cli/master/schemas';

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
    [
        'page-constructor-schema',
        'page-constructor-schema.yaml',
        'page-constructor-schema-extend.yaml',
    ],
];

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchText(res.headers.location).then(resolve, reject);
                }

                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                }

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                res.on('error', reject);
            })
            .on('error', reject);
    });
}

async function fetchYaml(filename) {
    const url = `${BASE_URL}/${filename}`;
    console.log(`  fetching ${url}`);
    const text = await fetchText(url);
    return load(text);
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
        return schema.enum.map((v) => `'${v}'`).join(' | ');
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

function fixObjectTypeLabels(obj) {
    if (Array.isArray(obj)) {
        return obj.map(fixObjectTypeLabels);
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};

        for (const [k, v] of Object.entries(obj)) {
            result[k] = fixObjectTypeLabels(v);
        }

        if (
            result.markdownDescription &&
            typeof result.markdownDescription === 'string' &&
            result.markdownDescription.includes('`object`')
        ) {
            const typeLabel = inferTypeLabel(result);
            if (typeLabel) {
                result.markdownDescription = result.markdownDescription.replace(
                    /`object`/g,
                    `\`${typeLabel}\``,
                );
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

    const result =
        typeof base === 'object' && base !== null && !Array.isArray(base) ? {...base} : {};

    for (const [k, v] of Object.entries(overlay)) {
        const baseVal = result[k];
        const bothObjects =
            baseVal !== undefined &&
            typeof baseVal === 'object' &&
            baseVal !== null &&
            !Array.isArray(baseVal) &&
            typeof v === 'object' &&
            v !== null &&
            !Array.isArray(v);

        result[k] = bothObjects ? deepMerge(baseVal, v) : v;
    }

    return result;
}

async function processSchema(name, file, extendFile) {
    let schema = await fetchYaml(file);

    if (extendFile) {
        const extend = await fetchYaml(extendFile);
        schema = deepMerge(schema, extend);
        console.log(`  extend applied: ${extendFile}`);
    }

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
    mkdirSync(OUTPUT, {recursive: true});
    mkdirSync(OVERLAYS, {recursive: true});

    let ok = true;

    for (const [name, file, extendFile] of SCHEMAS) {
        try {
            await processSchema(name, file, extendFile);
        } catch (err) {
            console.error(`✗  ${name}: ${err.message}`);
            ok = false;
        }
    }

    process.exit(ok ? 0 : 1);
}

main();
