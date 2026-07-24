import {describe, expect, it} from 'vitest';

import {detectVideoService} from './detect';

describe('detectVideoService', () => {
    it.each([
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'],
        ['https://youtu.be/dQw4w9WgXcQ', 'youtube'],
        ['https://vimeo.com/19706846', 'vimeo'],
        ['https://vk.com/video_ext.php?oid=-1&id=2', 'vk'],
        ['https://rutube.ru/video/abc123/', 'rutube'],
        ['https://frontend.vh.yandex.ru/player/xyz', 'yandex'],
    ])('detects %s as %s', (url, service) => {
        expect(detectVideoService(url)).toBe(service);
    });

    it('falls back to url for unknown hosts', () => {
        expect(detectVideoService('https://example.com/player/embed/1')).toBe('url');
    });
});
