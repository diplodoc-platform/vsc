import type {ExtensionAuto, ExtensionNodeSpec} from '@gravity-ui/markdown-editor';

import {
    VideoService,
    defaults,
} from '@gravity-ui/markdown-editor/extensions/yfm/Video/VideoSpecs/md-video.js';
import {VideoAttr} from '@gravity-ui/markdown-editor/extensions/yfm/Video/VideoSpecs/const.js';

type DOMOutputSpec = ReturnType<NonNullable<ExtensionNodeSpec['spec']['toDOM']>>;

const EXTERNAL_SERVICES: ReadonlySet<string> = new Set([
    VideoService.url,
    VideoService.Yandex,
    VideoService.Vk,
    VideoService.Rutube,
]);

export function buildExternalVideoDom(service: string, videoId: string): DOMOutputSpec | null {
    if (!EXTERNAL_SERVICES.has(service) || !videoId) {
        return null;
    }

    const {width, height} = defaults[service as VideoService];
    const src = defaults.videoUrl(service, videoId, defaults);

    return [
        'div',
        {class: 'embed-responsive embed-responsive-16by9'},
        [
            'iframe',
            {
                class: `embed-responsive-item ${service}-player`,
                type: 'text/html',
                width: String(width),
                height: String(height),
                src,
                frameborder: '0',
                webkitallowfullscreen: '',
                mozallowfullscreen: '',
                allowfullscreen: '',
                [VideoAttr.Service]: service,
                [VideoAttr.VideoID]: videoId,
            },
        ],
    ];
}

export const YfmVideo: ExtensionAuto = (builder) => {
    builder.overrideNodeSpec('video', (prev) => {
        const baseToDOM = prev.toDOM;

        return {
            ...prev,
            toDOM(node) {
                const service = node.attrs[VideoAttr.Service];
                const videoId = node.attrs[VideoAttr.VideoID];

                return buildExternalVideoDom(service, videoId) ?? baseToDOM?.(node) ?? '';
            },
        };
    });
};
