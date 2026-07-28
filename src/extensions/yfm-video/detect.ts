import {VideoService} from '@gravity-ui/markdown-editor/extensions/yfm/Video/VideoSpecs/md-video.js';

export function detectVideoService(url: string): VideoService {
    if (/(?:youtube\.com|youtu\.be)/i.test(url)) {
        return VideoService.YouTube;
    }
    if (/vimeo\.com/i.test(url)) {
        return VideoService.Vimeo;
    }
    if (/vk\.com|vkvideo\.ru/i.test(url)) {
        return VideoService.Vk;
    }
    if (/rutube\.ru/i.test(url)) {
        return VideoService.Rutube;
    }
    if (/yandex/i.test(url)) {
        return VideoService.Yandex;
    }

    return VideoService.url;
}
