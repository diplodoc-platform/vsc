// @vitest-environment jsdom
import type {EditorCommand, EditorInstance} from './types';

import {afterEach, describe, expect, it, vi} from 'vitest';

import {useShortcuts} from './useShortcuts';

vi.mock('../utils', () => ({
    isTrustedOrigin: (origin: string) => origin === '' || origin === 'http://localhost',
}));

vi.mock('./match', () => ({
    matchesShortcut: vi.fn(() => false),
}));

function createEditor(): EditorInstance {
    return {
        focus: vi.fn(),
        currentMode: 'wysiwyg',
    } as unknown as EditorInstance;
}

const effectCleanups: Array<() => void> = [];

vi.mock('react', () => ({
    useEffect: (fn: () => void | (() => void)) => {
        const cleanup = fn();
        if (typeof cleanup === 'function') effectCleanups.push(cleanup);
    },
}));

function dispatchMessage(data: unknown, origin = '') {
    window.dispatchEvent(new MessageEvent('message', {data, origin}));
}

describe('useShortcuts message origin check', () => {
    afterEach(() => {
        effectCleanups.forEach((c) => c());
        effectCleanups.length = 0;
    });

    it('calls handler for trusted (empty) origin', () => {
        const handler = vi.fn();
        const editor = createEditor();
        const commands: EditorCommand[] = [{action: 'testAction', handler}];

        useShortcuts(commands, editor);

        dispatchMessage({command: 'action', action: 'testAction'}, '');

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(editor);
    });

    it('ignores messages from untrusted origin', () => {
        const handler = vi.fn();
        const editor = createEditor();
        const commands: EditorCommand[] = [{action: 'testAction', handler}];

        useShortcuts(commands, editor);

        dispatchMessage({command: 'action', action: 'testAction'}, 'https://evil.example.com');

        expect(handler).not.toHaveBeenCalled();
    });

    it('does not call handler when action does not match', () => {
        const handler = vi.fn();
        const editor = createEditor();
        const commands: EditorCommand[] = [{action: 'testAction', handler}];

        useShortcuts(commands, editor);

        dispatchMessage({command: 'action', action: 'unknownAction'}, '');

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores messages without command field', () => {
        const handler = vi.fn();
        const editor = createEditor();
        const commands: EditorCommand[] = [{action: 'testAction', handler}];

        useShortcuts(commands, editor);

        dispatchMessage({someOtherField: true}, '');

        expect(handler).not.toHaveBeenCalled();
    });
});
