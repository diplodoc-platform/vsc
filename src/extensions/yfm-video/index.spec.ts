import {describe, expect, it} from 'vitest';

import {buildExternalVideoDom} from './index';

function iframeAttrs(dom: unknown): Record<string, string> {
    const div = dom as [string, object, [string, Record<string, string>]];
    const [tag, attrs] = div[2];
    expect(tag).toBe('iframe');

    return attrs;
}

describe('buildExternalVideoDom', () => {
    it('builds an iframe with the raw url for the empty/url service', () => {
        const url =
            'https://frontend.vh.yandex.ru/runtime/player/video/vplvic7jsotpobyc7o5b?mute=0';
        const attrs = iframeAttrs(buildExternalVideoDom('url', url));

        expect(attrs.src).toBe(url);
        expect(attrs.class).toBe('embed-responsive-item url-player');
    });

    it('builds a vk video_ext iframe', () => {
        const attrs = iframeAttrs(
            buildExternalVideoDom('vk', 'oid=-207738372&id=456239060&hd=2&autoplay=1'),
        );

        expect(attrs.src).toContain('https://vk.com/video_ext.php?');
        expect(attrs.class).toBe('embed-responsive-item vk-player');
    });

    it('builds a rutube embed iframe', () => {
        const attrs = iframeAttrs(buildExternalVideoDom('rutube', 'abc123'));

        expect(attrs.src).toBe('https://rutube.ru/play/embed/abc123');
    });

    it('returns null for services the base spec already renders', () => {
        expect(buildExternalVideoDom('youtube', 'dQw4w9WgXcQ')).toBeNull();
        expect(buildExternalVideoDom('vimeo', '19706846')).toBeNull();
    });

    it('returns null when the video id is missing', () => {
        expect(buildExternalVideoDom('url', '')).toBeNull();
    });
});
