[english](https://github.com/diplodoc-platform/vsc/blob/master/README.md) | **русский**

---

[![NPM version](https://img.shields.io/npm/v/diplodoc-vsc-extension.svg?style=flat)](https://www.npmjs.org/package/diplodoc-vsc-extension)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_diplodoc-vsc-extension&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_diplodoc-vsc-extension)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_diplodoc-vsc-extension&metric=coverage)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_diplodoc-vsc-extension)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_diplodoc-vsc-extension&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_diplodoc-vsc-extension)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_diplodoc-vsc-extension&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_diplodoc-vsc-extension)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_diplodoc-vsc-extension&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_diplodoc-vsc-extension)

# Diplodoc Extension для VS Code

Расширение VS Code для документационной платформы [Diplodoc](https://diplodoc.com). Предоставляет WYSIWYG-редактор Markdown, валидацию YAML, автодополнение, линтинг и визуальные редакторы для `.md`, `toc.yaml` и page-constructor `.yaml` файлов.

## Возможности

- **WYSIWYG-редактор Markdown** — визуальное редактирование с тулбаром для блоков Diplodoc (заметки, каты, табы, инклуды, page-constructor, HTML-блоки, диаграммы Mermaid)
- **Редактор TOC** — визуальный редактор для `toc.yaml`
- **Валидация YAML** — валидация по JSON Schema для `toc.yaml`, `.yfm`, `.yfmlint`, `presets.yaml`, `redirects.yaml`, `theme.yaml` и page-constructor файлов
- **Линтинг Markdown** — диагностика в реальном времени через `@diplodoc/yfmlint` с поддержкой плагинов
- **Автодополнение и подсказки** — автодополнение свойств YAML с документацией из схем
- **Навигация по ссылкам** — Ctrl+Click по путям к файлам и URL в YAML и Markdown для перехода к ним; ссылки с фрагментом `#anchor` переходят к точной строке якоря
- **Дополнение якорей** — при вводе `#` в ссылке Markdown или `{% include %}` предлагает корректные якоря YFM из целевого файла: заголовки с `{#id}` отображаются только по id (без слага), инлайн-якоря `{#id}` предлагаются в ссылках, но не в инклудах
- **Валидация якорей** — предупреждает (жёлтое подчёркивание), если `#anchor` в ссылке Markdown указывает на несуществующий заголовок или `{#id}` в целевом файле; работает для межфайловых ссылок, ссылок внутри файла (`#anchor`) и ссылок внутри YAML block scalar; пропускает fenced code blocks; запускается при открытии, сохранении и изменении (debounce 400 мс)
- **Обнаружение orphan-файлов** — подсветка `.md` и page-constructor `.yaml` файлов, не подключённых к `toc.yaml`, в Explorer значком `?`; при удалении файлов предлагает удалить из toc или добавить редирект; на orphan-файлах показывает Code Actions для **перехода** к ближайшему/корневому `toc.yaml` или **добавления** в него
- **Обновление MD-ссылок** — при переименовании или удалении `.md` файла находит и обновляет все markdown-ссылки (`[текст](путь.md)`) по всему проекту, а не только в `toc.yaml`
- **Пресеты переменных** — наведение на `{{переменная}}` показывает значения по всем пресетам; Ctrl+Click переходит к определению в `presets.yaml`; автодополнение внутри `{{ }}`
- **Liquid-синтаксис** — подсветка синтаксиса для `{{ }}` (вывод) и `{% %}` (управляющие теги) в Markdown; подсветка парных тегов `{% if %}` / `{% elsif %}` / `{% else %}` / `{% endif %}` и `{% for %}` / `{% endfor %}`; hover и навигация для переменных внутри управляющих тегов
- **Палитра цветов** — предпросмотр и выбор цветов в YAML-значениях
- **Сайдбар** — браузер файлов с поиском, навигацией и инициализацией проекта
- **Подсветка синтаксиса** — подсветка YAML внутри блоков `::: page-constructor` в Markdown; подсветка Liquid-синтаксиса в Markdown

## Требования

VS Code 1.110+

## Установка

Установите из [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=diplodoc.diplodoc-vsc-extension) или через командную строку:

```bash
code --install-extension diplodoc.diplodoc-vsc-extension
```

## Использование

Расширение активируется автоматически при открытии Markdown или YAML файла.

### WYSIWYG-редактор

Откройте визуальный Markdown-редактор:

- Нажмите на иконку Diplodoc в заголовке редактора
- Или выполните `Open Diplodoc Markdown Editor` через палитру команд

Редактор поддерживает два режима: **WYSIWYG** и **Markup**. Установите режим по умолчанию в настройках:

```json
{
  "diplodoc.editorMode": "wysiwyg"
}
```

### Настройки

| Настройка                | Тип     | По умолчанию                         | Описание                                                                                                          |
| ------------------------ | ------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `diplodoc.editorMode`    | string  | `wysiwyg`                            | Режим редактора Markdown по умолчанию (`wysiwyg` или `markup`).                                                   |
| `diplodoc.isOnlyYfm`     | boolean | `false`                              | Валидировать только Markdown-файлы внутри YFM-проекта. Блоки page-constructor валидируются всегда.                |
| `diplodoc.excludedDirs`  | array   | `[]`                                 | Доп. каталоги, исключаемые из валидации и сканирования. `node_modules`, `_build` и output исключены всегда.       |
| `diplodoc.excludedFiles` | array   | README/AGENTS/CONTRIBUTING/CHANGELOG | Файлы внутри YFM-проекта, которые не валидируются и не помечаются как orphan. Совпадение по имени/basename/regex. |
| `diplodoc.lintRules`     | object  | `{}`                                 | MD/YFM lint-правила для всех Markdown-файлов. Формат как у `.yfmlint`; `.yfmlint` проекта приоритетнее.           |

### Горячие клавиши

| Сочетание | Действие                   |
| --------- | -------------------------- |
| `Alt+T`   | Вставить таблицу           |
| `Alt+R`   | Вставить заметку (note)    |
| `Alt+C`   | Вставить кат (cut)         |
| `Alt+A`   | Вставить табы              |
| `Alt+O`   | Вставить блок кода         |
| `Alt+Z`   | Вставить инклуд            |
| `Alt+Q`   | Вставить цитату            |
| `Alt+M`   | Вставить диаграмму Mermaid |
| `Alt+F`   | Вставить фронтматтер       |
| `Alt+P`   | Вставить page-constructor  |
| `Alt+H`   | Вставить HTML-блок         |
| `Alt+V`   | Вставить видео             |

### Валидация

Расширение валидирует следующие типы файлов по JSON-схемам Diplodoc:

| Файл                    | Тип схемы            |
| ----------------------- | -------------------- |
| `toc.yaml`              | Оглавление           |
| `.yfm`                  | Конфигурация проекта |
| `.yfmlint`              | Конфигурация линтера |
| `presets.yaml`          | Пресеты              |
| `redirects.yaml`        | Редиректы            |
| `theme.yaml`            | Тема                 |
| `index.yaml`            | Лендинг              |
| YAML с ключом `blocks:` | Page Constructor     |
| Фронтматтер Markdown    | Фронтматтер          |

Markdown-файлы линтятся через `@diplodoc/yfmlint`. Настройте правила через `.yfmlint` в корне проекта:

```yaml
default: true
MD013: false
YFM003: error
log-levels:
  MD001: disabled
```

### Page Constructor

YAML-файлы с ключом `blocks:` верхнего уровня можно редактировать в WYSIWYG-редакторе. Расширение автоматически определяет такие файлы и показывает кнопку визуального редактора.

### Сайдбар

Сайдбар Diplodoc на панели активности показывает все `.md`, `toc.yaml` и page-constructor файлы в рабочей области. Используйте его для:

- Просмотра и поиска файлов проекта
- Открытия файлов в визуальном редакторе
- Инициализации нового проекта Diplodoc (`yfm init`)

## Участие в разработке

См. [CONTRIBUTING.ru.md](https://github.com/diplodoc-platform/vsc/blob/master/CONTRIBUTING.ru.md) — настройка окружения, архитектура, тестирование и правила контрибуции.

## Лицензия

MIT
