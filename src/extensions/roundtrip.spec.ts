import type {ExtensionAuto} from '@gravity-ui/markdown-editor';

import {describe, expect, it} from 'vitest';
import {ExtensionsManager} from '@gravity-ui/markdown-editor/core';
import {YfmSpecsPreset} from '@gravity-ui/markdown-editor/_/presets/yfm-specs.js';

import {YfmImageReparse} from './yfm-image-reparse';
import {YfmLinks} from './yfm-links';
import {YfmLiquidInline} from './yfm-liquid-inline';
import {YfmSerializer} from './yfm-serializer';
import {YfmTables} from './yfm-tables';

const SERIALIZER_OPTIONS = {
    commonEscape: /.^/,
    startOfLineEscape: /.^/,
};

function createManager() {
    const extensions: ExtensionAuto = (builder) => {
        builder.use(YfmSpecsPreset, {});
        builder.use(YfmLiquidInline);
        builder.use(YfmTables);
        builder.use(YfmImageReparse);
        builder.use(YfmLinks);
        builder.use(YfmSerializer);
    };

    return ExtensionsManager.process(extensions, {mdOpts: {html: true}});
}

function roundtrip(markdown: string): string {
    const {markupParser, serializer} = createManager();

    const doc = markupParser.parse(markdown);

    return serializer.serialize(doc, SERIALIZER_OPTIONS);
}

function serializeDoc(docJson: object): string {
    const {schema, serializer} = createManager();

    const doc = schema.nodeFromJSON(docJson);

    return serializer.serialize(doc, SERIALIZER_OPTIONS);
}

describe('roundtrip: tables with images', () => {
    const src = [
        '#|',
        '||  | **Пробная** | **Полная** ||',
        '|| Ограничение по сроку лицензии | 30 дней | Зависит от соглашения ||',
        '|| Обновления | ![Есть](_assets/icons/tick-outline-md.svg) | ![Есть](_assets/icons/tick-outline-md.svg) ||',
        '|| Пользователи | ![Нет](_assets/icons/close-outline-md.svg) | ![Нет](_assets/icons/close-outline-md.svg) ||',
        '|| [Отсрочка ограничений](*graceperiod) при превышении срока | ![Нет](_assets/icons/close-outline-md.svg) | 30 дней ||',
        '|#',
    ].join('\n');

    const out = roundtrip(src);

    it('does not delete images from table cells', () => {
        expect(out).toContain('![Есть](_assets/icons/tick-outline-md.svg)');
        expect(out).toContain('![Нет](_assets/icons/close-outline-md.svg)');
    });

    it('does not escape underscores in image src', () => {
        expect(out).not.toContain('\\_assets');
    });

    it('keeps bold cell content and links with anchors', () => {
        expect(out).toContain('**Пробная**');
        expect(out).toContain('[Отсрочка ограничений](*graceperiod)');
    });
});

describe('roundtrip: liquid variables through the save pipeline', () => {
    it('keeps liquid variables in tab titles', () => {
        const src = '{% list tabs group=os %}\n\n- {{ presets_text }}\n\n{% endlist %}\n';

        const out = roundtrip(src);

        expect(out).toContain('- {{ presets_text }}');
        expect(out).not.toContain('\\{\\{');
    });

    it('keeps liquid variables in paragraphs', () => {
        const src = 'Пресет {{ aaa.b }} {{aaa.c.d}} {{dddd}}\n';

        const out = roundtrip(src);

        expect(out).toContain('Пресет {{ aaa.b }} {{aaa.c.d}} {{dddd}}');
    });
});

describe('roundtrip: radio tabs', () => {
    it('keeps radio tabs structure and content', () => {
        const src = [
            '{% list tabs radio %}',
            '',
            '- Tab A',
            '',
            '  Content A',
            '',
            '- Tab B',
            '',
            '  Content B',
            '',
            '{% endlist %}',
            '',
        ].join('\n');

        const out = roundtrip(src);

        expect(out).toContain('{% list tabs radio');
        expect(out).toContain('- Tab A');
        expect(out).toContain('- Tab B');
        expect(out).toContain('Content A');
        expect(out).toContain('Content B');
        expect(out).toContain('{% endlist %}');
    });
});

describe('roundtrip: gfm tables', () => {
    it('pads gfm table columns and keeps alignment', () => {
        const src = ['| a | b | c |', '|:--|:-:|--:|', '| 1 | 2 | 3 |', ''].join('\n');

        const out = roundtrip(src);

        expect(out).toContain('| a   | b   | c   |');
        expect(out).toContain('| 1   | 2   | 3   |');
        expect(out).toContain(':-:');
        expect(out).toContain('--:');
    });
});

describe('roundtrip: links with formatting', () => {
    it('moves bold outside the link syntax', () => {
        const out = roundtrip('[**bold link**](https://example.com)\n');

        expect(out).toContain('**[bold link](https://example.com)**');
    });

    it('keeps braces in link hrefs', () => {
        const out = roundtrip('[x](path/{var}.md)\n');

        expect(out).toContain('[x](path/{var}.md)');
    });
});

describe('roundtrip: image size cleanup', () => {
    it('removes the width key when the width is cleared in the editor', () => {
        const out = serializeDoc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'image',
                            attrs: {src: 'x.png', rawAttrs: 'width=600 a=1', width: ''},
                        },
                    ],
                },
            ],
        });

        expect(out).toContain('![](x.png){a=1}');
    });

    it('drops the attrs block when all sizes are cleared', () => {
        const out = serializeDoc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {type: 'image', attrs: {src: 'x.png', rawAttrs: 'width=600', width: ''}},
                    ],
                },
            ],
        });

        expect(out).toContain('![](x.png)');
        expect(out).not.toContain('{');
    });
});
