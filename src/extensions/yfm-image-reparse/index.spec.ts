import type {ExtensionAuto} from '@gravity-ui/markdown-editor';

import {describe, expect, it} from 'vitest';
import {ExtensionsManager} from '@gravity-ui/markdown-editor/core';
import {EditorState} from '@gravity-ui/markdown-editor/pm/state';
import {YfmSpecsPreset} from '@gravity-ui/markdown-editor/_/presets/yfm-specs.js';

import {YfmImageReparse} from '.';

function createManager() {
    const extensions: ExtensionAuto = (builder) => {
        builder.use(YfmSpecsPreset, {});
        builder.use(YfmImageReparse);
    };

    return ExtensionsManager.process(extensions, {mdOpts: {html: true}});
}

type Manager = ReturnType<typeof createManager>;

function createState(manager: Manager, docJson?: object): EditorState {
    const {schema, plugins} = manager;

    if (docJson) {
        return EditorState.create({schema, plugins, doc: schema.nodeFromJSON(docJson)});
    }

    return EditorState.create({schema, plugins});
}

function collectImages(state: EditorState) {
    const images: Array<{pos: number; attrs: Record<string, unknown>}> = [];

    state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
            images.push({pos, attrs: node.attrs as Record<string, unknown>});
        }
    });

    return images;
}

describe('YfmImageReparse', () => {
    it('replaces image markdown in text with an image node', () => {
        const manager = createManager();
        let state = createState(manager);

        state = state.apply(state.tr.insertText('![alt](x.png)', 1));

        const images = collectImages(state);
        expect(images).toHaveLength(1);
        expect(images[0].attrs).toMatchObject({src: 'x.png', alt: 'alt', rawAttrs: null});
    });

    it('keeps surrounding text around the replaced image', () => {
        const manager = createManager();
        let state = createState(manager);

        state = state.apply(state.tr.insertText('before ![alt](x.png) after', 1));

        expect(collectImages(state)).toHaveLength(1);
        expect(state.doc.textContent).toBe('before  after');
    });

    it('applies inline attrs to the created image node', () => {
        const manager = createManager();
        let state = createState(manager);

        state = state.apply(state.tr.insertText('![](x.png){width=600 height=300}', 1));

        const images = collectImages(state);
        expect(images).toHaveLength(1);
        expect(images[0].attrs).toMatchObject({
            src: 'x.png',
            width: '600',
            height: '300',
            rawAttrs: 'width=600 height=300',
        });
    });

    it('merges trailing attr text into a preceding image node', () => {
        const manager = createManager();
        let state = createState(manager, {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {type: 'image', attrs: {src: 'x.png'}},
                        {type: 'text', text: '{width=600} after'},
                    ],
                },
            ],
        });

        state = state.apply(state.tr.insertText('x', 1));

        const images = collectImages(state);
        expect(images).toHaveLength(1);
        expect(images[0].attrs).toMatchObject({
            src: 'x.png',
            width: '600',
            rawAttrs: 'width=600',
        });
        expect(state.doc.textContent).toBe('x after');
    });

    it('ignores image markdown inside code blocks', () => {
        const manager = createManager();
        const codeBlockName = Object.keys(manager.schema.nodes).find(
            (name) => manager.schema.nodes[name].spec.code,
        );

        if (!codeBlockName) {
            throw new Error('schema has no code block node');
        }

        let state = createState(manager, {
            type: 'doc',
            content: [
                {
                    type: codeBlockName,
                    content: [{type: 'text', text: '![alt](x.png)'}],
                },
            ],
        });

        state = state.apply(state.tr.insertText('x', 2));

        expect(collectImages(state)).toHaveLength(0);
        expect(state.doc.textContent).toBe('!x[alt](x.png)');
    });

    it('ignores image markdown marked as inline code', () => {
        const manager = createManager();
        const codeMarkName = Object.keys(manager.schema.marks).find(
            (name) => manager.schema.marks[name].spec.code,
        );

        if (!codeMarkName) {
            throw new Error('schema has no code mark');
        }

        let state = createState(manager, {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: '![alt](x.png)', marks: [{type: codeMarkName}]}],
                },
            ],
        });

        state = state.apply(state.tr.insertText('plain ', 1));

        expect(collectImages(state)).toHaveLength(0);
        expect(state.doc.textContent).toBe('plain ![alt](x.png)');
    });

    it('skips images whose src failed to load', () => {
        const manager = createManager();
        let state = createState(manager);

        state = state.apply(state.tr.setMeta('image-load-failed', 'bad.png'));
        state = state.apply(state.tr.insertText('![alt](bad.png)', 1));

        expect(collectImages(state)).toHaveLength(0);
        expect(state.doc.textContent).toBe('![alt](bad.png)');
    });

    it('ignores transactions that do not change the doc', () => {
        const manager = createManager();
        let state = createState(manager, {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: '![alt](x.png)'}],
                },
            ],
        });

        state = state.apply(state.tr.setMeta('custom', true));

        expect(collectImages(state)).toHaveLength(0);
        expect(state.doc.textContent).toBe('![alt](x.png)');
    });
});
