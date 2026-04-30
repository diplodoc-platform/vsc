[english](https://github.com/diplodoc-platform/vsc/blob/master/CONTRIBUTING.md) | **русский**

---

# Участие в разработке

## Требования

- Node.js 22+
- npm >= 11.5
- VS Code 1.110+
- Git

## Настройка

```bash
git clone https://github.com/diplodoc-platform/vsc.git
cd vsc
npm install
npm run compile
```

Проверка:

```bash
npm run typecheck
npm test
npm run lint
```

## Запуск расширения локально

1. Откройте проект в VS Code
2. Нажмите `F5` — откроется новое окно VS Code (Extension Development Host) с загруженным расширением
3. Откройте любой Markdown или YAML файл в dev host для тестирования

Для быстрой итерации:

```bash
npm run watch:ext       # пересборка extension host при изменениях
npm run watch:webview   # пересборка webview при изменениях
```

Запустите оба в отдельных терминалах. После пересборки: `Ctrl+Shift+P` → `Developer: Reload Window` в dev host.

Для тестирования из упакованного `.vsix`:

```bash
npm run vsce
code --install-extension diplodoc-vsc-extension-*.vsix --force
```

## Структура проекта

```
src/
├── index.ts                          # activate() — точка входа
├── commands.ts                       # Обработчики команд
├── utils.ts                          # Общие утилиты
├── modules/
│   ├── shared/base-editor.ts         # Абстрактный базовый класс визуальных редакторов
│   ├── md-editor/editor.ts           # WYSIWYG Markdown редактор (наследует BaseEditor)
│   ├── toc-editor/editor.ts          # TOC редактор (наследует BaseEditor)
│   ├── main/sidebar.ts               # Сайдбар — браузер файлов
│   ├── color/                        # YAML color picker
│   └── validation/                   # YAML схема-валидация + Markdown линтинг
│       ├── index.ts                  # Оркестратор: события, кэш, debounce
│       ├── parser.ts                 # Извлечение frontmatter + page-constructor блоков
│       ├── markdown.ts               # Интеграция @diplodoc/yfmlint
│       ├── utils.ts                  # Ошибки → vscode.Diagnostic
│       └── providers/
│           ├── yaml-service.ts       # Синглтон yaml-language-server
│           ├── diagnostic.ts         # Диагностики схем-валидации
│           ├── completion.ts         # YAML автодополнение
│           ├── hover.ts              # YAML hover-документация
│           └── position.ts           # Маппинг координат редактор ↔ блок
├── ui/                               # React webview (работает в браузере)
│   ├── md-editor/                    # UI Markdown редактора
│   ├── toc-editor/                   # UI TOC редактора
│   └── sidebar/                      # UI сайдбара
├── extensions/                       # Кастомные markdown-it плагины
│   ├── yfm-include/                  # {% include %}
│   └── yfm-frontmatter/              # --- frontmatter ---
├── i18n/                             # Локализация (en, ru)
schemas/
├── *.json                            # Сгенерированные JSON Schema файлы (закоммичены)
├── overlays/*.yaml                   # VS Code-специфичные расширения схем
scripts/
└── merge-schemas.js                  # Пайплайн CLI schema → JSON Schema
syntaxes/
└── markdown-page-constructor.json    # TextMate грамматика для ::: page-constructor
tests/mocks/                          # Файлы для ручного тестирования
```

## Обзор архитектуры

Расширение работает в двух средах:

### Extension Host (Node.js)

Точка входа: `src/index.ts` → `build/index.js`

Собирается esbuild в единый CJS-бандл (~8 МБ). Только `vscode` — внешняя зависимость, всё остальное (включая `yaml-language-server`) инлайнится. Три esbuild-плагина решают проблемы бандлинга:

- **yamlServerFixes** — перенаправляет `vscode-json-languageservice/lib/umd/` → `lib/esm/`; стабит `prettier` и `request-light` (не используются)
- **nodeShims** — стабит `fs`/`path`/`process` для webview-бандлов; подключает браузерные полифиллы для `punycode`/`url`
- **pageConstructorFixes** — исправляет резолв `@gravity-ui/markdown-editor/pm/*` и webpack-стилевые `~` импорты

### Webview (Браузер)

Три отдельных IIFE-бандла: `md-editor`, `toc-editor`, `sidebar`. React 18 + @gravity-ui/uikit. Ассеты встроены как data URL.

Коммуникация между extension host и webview — через `postMessage()`. Таблицы протокола — в AGENTS.md.

### Иерархия классов редакторов

Визуальные редакторы наследуют общий базовый класс:

```
BaseEditor (abstract)          — src/modules/shared/base-editor.ts
├── MdEditor                   — src/modules/md-editor/editor.ts
│   Добавляет: WYSIWYG режим, сохранение пробелов,
│   page-constructor wrap/unwrap, pending sync, save
└── TocEditor                  — src/modules/toc-editor/editor.ts
    Тождественные трансформации, только change-сообщения
```

Для нового визуального редактора: наследуйте `BaseEditor`, реализуйте абстрактные методы (`_panelId`, `_panelTitle`, `_buildSubdir`, `_canSync`, `_onWebviewMessage`, `_transformForWebview`, `_transformFromWebview`).

## Работа со схемами

JSON-схемы генерируются из YAML-схем `@diplodoc/cli` с наложением VS Code-специфичных оверлеев.

### Обновление схем

```bash
npm run merge-schemas
```

Читает из `../packages/cli/schemas/`, применяет оверлеи из `schemas/overlays/`, пишет в `schemas/*.json`. Если CLI-схемы в другом месте, скрипт спросит путь.

### Добавление нового типа схемы

1. CLI-схема должна быть в `../packages/cli/schemas/<name>.yaml`
2. Создайте оверлей `schemas/overlays/<name>.yaml` (минимум: `title` и `additionalProperties: false`)
3. Добавьте запись в `SCHEMAS` в `scripts/merge-schemas.js`
4. Запустите `npm run merge-schemas`
5. В `yaml-service.ts`: импортируйте схему, добавьте в `SCHEMA_ENTRIES`
6. В `validation/index.ts`: добавьте в `YAML_FILE_SCHEMAS`
7. По желанию добавьте имя файла в `contributes.languages` в `package.json`

### Изменение hover/completion контента

Редактируйте `schemas/overlays/<name>.yaml` и запустите `npm run merge-schemas`. Оверлеи поддерживают:

- `markdownDescription` — расширенный hover-контент
- `defaultSnippets` — сниппеты автодополнения
- `additionalProperties: false` — строгая проверка свойств

Важно: когда определение использует `oneOf`/`anyOf` с `$ref`, все ссылаемые свойства должны также быть перечислены в родительском `properties`, если установлен `additionalProperties: false`.

## Система валидации

Два независимых пути валидации:

- **YAML-валидация** — `yaml-language-server` как in-process синглтон, виртуальные документы, блочные координаты
- **Markdown-линтинг** — `@diplodoc/yfmlint` со всеми Diplodoc transform-плагинами

Ключевые решения задокументированы в AGENTS.md: синглтон с предрегистрацией всех схем (без гонок), инкрементация версии виртуальных документов (без устаревших диагностик), ленивый парсинг блоков (hover/completion работают до первой валидации).

### Добавление обработчика ошибок директивы

Добавьте запись в `DIRECTIVE_HANDLERS` в `src/modules/validation/utils.ts`:

```typescript
{message: /^My block must be closed/, open: /{%\s*myblock\b[^%]*%}/, close: /{%\s*endmyblock\s*%}/}
```

## Тестирование

```bash
npm test                # Запуск всех тестов (vitest)
npm run test:coverage   # С отчётом о покрытии
```

### Паттерны тестирования

- **Мок vscode API**: централизован в `src/test-setup.ts` — MockPosition, MockRange, MockDiagnostic, MockColor, MockHover, MockCompletionItem и др.
- **Мок документов**: фабричные функции (`mockDocument(text)`) создают минимальный `vscode.TextDocument` с `lineCount` и `lineAt()`
- **Мок yaml-language-server**: `vi.mock('yaml-language-server')` с контролируемыми возвращаемыми значениями
- **Мок модулей**: `vi.mock('./module')` для изоляции провайдеров от yaml-service, position utils и др.
- **Реальная файловая система**: тесты `findConfig()` используют реальные директории в `/tmp`

Тесты располагаются рядом с тестируемым кодом (`*.spec.ts`). Файлы для ручного интеграционного тестирования — в `tests/mocks/`.

### Что тестировать

- **Новые фичи валидации**: конвертация диагностик, расчёт диапазонов, форматирование ошибок
- **Новые типы схем**: через `getDiagnostics()` с реальным контентом + тип схемы
- **Новые фичи редакторов**: мок протокола webview-сообщений
- **Новые UI-компоненты**: тестирование с мок `window` и `MessageEvent`

## Отладка

- **Output channel**: `logger()` из `src/modules/utils.ts` пишет в VS Code Output → "Diplodoc"
- **Extension Host log**: показывает ошибки активации и необработанные исключения
- **Webview DevTools**: в dev host: `Ctrl+Shift+P` → `Developer: Open Webview Developer Tools`
- **Автономные тесты yaml-language-server**: `node -e "..."` скрипты для вызова validation/hover/completion без VS Code

## Стиль кода

Управляется `@diplodoc/lint` (обёртка над ESLint + Prettier + Stylelint):

```bash
npm run lint            # Проверка
npm run lint:fix        # Автоисправление
```

Ключевые правила:

- TypeScript strict mode
- Порядок импортов: `import type` первым, затем внешние пакеты, затем локальные (разделены пустыми строками)
- Нет `any` без `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Public перед protected, protected перед private (`@typescript-eslint/member-ordering`)
- Все комментарии и commit-сообщения на английском

## Правила коммитов

Формат [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

| Тип        | Когда                                   |
| ---------- | --------------------------------------- |
| `feat`     | Новая пользовательская функциональность |
| `fix`      | Исправление бага                        |
| `perf`     | Улучшение производительности            |
| `refactor` | Рефакторинг (без изменения поведения)   |
| `docs`     | Только документация                     |
| `chore`    | Сборка, CI, зависимости                 |

Subject: повелительное наклонение, строчная буква, без точки. Scope — опционально (напр. `validation`, `editor`, `schemas`).

Релизы управляются автоматически через [release-please](https://github.com/googleapis/release-please).

## Процесс pull request

1. Ветка от `master`: `git checkout -b feat/my-feature`
2. Внесите изменения, убедитесь что все проверки проходят:
   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```
3. Пуш и создание PR в `master`
4. Заполните описание PR — что изменилось и почему
5. Отреагируйте на замечания ревью

### Чеклист PR

- [ ] `npm run typecheck` проходит
- [ ] `npm test` проходит
- [ ] `npm run lint` проходит (ноль warnings)
- [ ] Новый код покрыт тестами
- [ ] AGENTS.md обновлён, если изменилась архитектура

## CLA

Участвуя в проекте, вы соглашаетесь с [CLA Яндекса](https://yandex.ru/legal/cla/?lang=ru). Добавьте в первый PR:

> I hereby agree to the terms of the CLA available at: https://yandex.ru/legal/cla/?lang=en
