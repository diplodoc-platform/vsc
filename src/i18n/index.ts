import en from './en.json';
import ru from './ru.json';

const locales = {en, ru} as const;

type Lang = keyof typeof locales;
type Messages = typeof en;

type Flatten<T, P extends string = ''> = {
    [K in keyof T]: T[K] extends Record<string, string>
        ? Flatten<T[K], `${P}${K & string}.`>
        : `${P}${K & string}`;
}[keyof T];

export type I18nKey = Flatten<Messages>;

function detectLang(): Lang {
    const code = document.documentElement.lang.split('-')[0];
    return (code in locales ? code : 'en') as Lang;
}

function resolve(obj: Record<string, unknown>, key: string): string {
    const parts = key.split('.');
    let current: unknown = obj;

    for (const part of parts) {
        if (typeof current !== 'object' || current === null) return key;
        current = (current as Record<string, unknown>)[part];
    }

    return typeof current === 'string' ? current : key;
}

const messages = locales[detectLang()] as Record<string, unknown>;
const fallback = locales.en as Record<string, unknown>;

export function t(key: I18nKey): string {
    return resolve(messages, key) || resolve(fallback, key) || key;
}
