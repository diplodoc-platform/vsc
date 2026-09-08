import {EVENTS} from './constants';

export const MAX_BATCH_SIZE = 20;
export const MAX_BODY_BYTES = 64 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const DAY = 24 * 60 * 60 * 1000;

export type EventKind = 'usage' | 'error';

export interface TelemetryEvent {
    id: string;
    timestamp: number;
    name: string;
    kind: EventKind;
    properties: Record<string, string>;
    measurements: Record<string, number>;
}

export interface TelemetryBatch {
    schemaVersion: 1;
    installationId: string;
    sessionId: string;
    extensionVersion: string;
    vscodeVersion: string;
    os: string;
    events: TelemetryEvent[];
}

const errors = new Set<string>([
    EVENTS.EDITOR_APPLY_ERROR,
    EVENTS.MD_EDITOR_SAVE_ERROR,
    EVENTS.VALIDATION_ERROR,
    EVENTS.ORPHAN_ERROR,
]);

const names = new Set<string>(Object.values(EVENTS));
const errorTypes = [
    'Error',
    'TypeError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'URIError',
    'EvalError',
];

const fields: Record<string, Record<string, readonly string[]>> = {
    [EVENTS.MD_EDITOR_OPENED]: {
        source: ['command', 'sidebar'],
        fileType: ['md', 'blocks-yaml'],
    },
    [EVENTS.TOC_EDITOR_OPENED]: {source: ['command', 'sidebar']},
    [EVENTS.MD_EDITOR_MODE]: {mode: ['wysiwyg', 'markup']},
    [EVENTS.BLOCK_INSERTED]: {
        type: [
            'table',
            'note',
            'cut',
            'tab',
            'codeBlock',
            'include',
            'quote',
            'mermaid',
            'frontmatter',
            'pageConstructor',
            'htmlBlock',
            'video',
            'comment',
        ],
    },
    [EVENTS.PROJECT_INIT]: {yfmInstalled: ['true', 'false']},
    [EVENTS.ORPHAN_DELETE_ACTION]: {
        action: ['remove', 'remove-and-replace', 'replace-md', 'redirect', 'nothing'],
    },
    [EVENTS.ORPHAN_RENAME_ACTION]: {action: ['rename', 'redirect', 'nothing']},
    [EVENTS.EDITOR_APPLY_ERROR]: {
        panel: ['diplodoc-md-editor', 'diplodoc-toc-editor'],
    },
    [EVENTS.ORPHAN_ERROR]: {operation: ['delete', 'rename']},
};

const counters: Record<string, string[]> = {
    [EVENTS.REFERENCES_FIND]: ['found'],
    [EVENTS.ORPHAN_DELETE_ACTION]: ['tocRefs', 'mdRefs'],
    [EVENTS.ORPHAN_RENAME_ACTION]: ['tocRefs', 'mdRefs'],
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function eventKind(name: string): EventKind | undefined {
    if (!names.has(name)) {
        return undefined;
    }

    return errors.has(name) ? 'error' : 'usage';
}

export function sanitizeEvent(name: string, properties: unknown, measurements: unknown) {
    const kind = eventKind(name);

    if (!kind) {
        return undefined;
    }

    const props: Record<string, string> = {};
    const nums: Record<string, number> = {};
    const allowed = {
        ...fields[name],
        ...(kind === 'error' ? {errorType: errorTypes} : {}),
    };

    for (const [key, values] of Object.entries(allowed)) {
        const value = isRecord(properties) ? properties[key] : undefined;

        if (typeof value === 'string' && values.includes(value)) {
            props[key] = value;
        }
    }

    for (const key of counters[name] ?? []) {
        const value = isRecord(measurements) ? measurements[key] : undefined;

        if (
            typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0 &&
            value <= 1_000_000
        ) {
            nums[key] = value;
        }
    }

    return {name, kind, properties: props, measurements: nums};
}

export function parseBatch(input: unknown, now: number): TelemetryBatch | undefined {
    if (
        !isRecord(input) ||
        input.schemaVersion !== 1 ||
        typeof input.installationId !== 'string' ||
        !UUID.test(input.installationId) ||
        typeof input.sessionId !== 'string' ||
        !UUID.test(input.sessionId) ||
        typeof input.extensionVersion !== 'string' ||
        !VERSION.test(input.extensionVersion) ||
        typeof input.vscodeVersion !== 'string' ||
        !VERSION.test(input.vscodeVersion) ||
        typeof input.os !== 'string' ||
        !['darwin', 'linux', 'win32', 'other'].includes(input.os) ||
        !Array.isArray(input.events) ||
        input.events.length < 1 ||
        input.events.length > MAX_BATCH_SIZE
    ) {
        return undefined;
    }

    const events: TelemetryEvent[] = [];

    for (const event of input.events) {
        const safe = parseEvent(event, now);

        if (!safe) {
            return undefined;
        }

        events.push(safe);
    }

    return {
        schemaVersion: 1,
        installationId: input.installationId,
        sessionId: input.sessionId,
        extensionVersion: input.extensionVersion,
        vscodeVersion: input.vscodeVersion,
        os: input.os,
        events,
    };
}

function parseEvent(event: unknown, now: number): TelemetryEvent | undefined {
    if (
        !isRecord(event) ||
        typeof event.name !== 'string' ||
        typeof event.id !== 'string' ||
        !UUID.test(event.id) ||
        typeof event.timestamp !== 'number' ||
        !Number.isSafeInteger(event.timestamp) ||
        event.timestamp < now - DAY ||
        event.timestamp > now + 300_000
    ) {
        return undefined;
    }

    const safe = sanitizeEvent(event.name, event.properties, event.measurements);

    if (!safe || safe.kind !== event.kind) {
        return undefined;
    }

    return {...safe, id: event.id, timestamp: event.timestamp};
}
