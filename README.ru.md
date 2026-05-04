[english](https://github.com/diplodoc-platform/vsc/blob/master/README.md) | **русский**

---

# Diplodoc Extension для VS Code

Расширение VS Code для документационной платформы [Diplodoc](https://diplodoc.com). Предоставляет WYSIWYG-редактор Markdown, валидацию YAML, автодополнение, линтинг и визуальные редакторы для `.md`, `toc.yaml` и page-constructor `.yaml` файлов.

## Возможности

- **WYSIWYG-редактор Markdown** — визуальное редактирование с тулбаром для блоков Diplodoc (заметки, каты, табы, инклуды, page-constructor, HTML-блоки, диаграммы Mermaid)
- **Редактор TOC** — визуальный редактор для `toc.yaml`
- **Валидация YAML** — валидация по JSON Schema для `toc.yaml`, `.yfm`, `.yfmlint`, `presets.yaml`, `redirects.yaml`, `theme.yaml` и page-constructor файлов
- **Линтинг Markdown** — диагностика в реальном времени через `@diplodoc/yfmlint` с поддержкой плагинов
- **Автодополнение и подсказки** — автодополнение свойств YAML с документацией из схем
- **Навигация по ссылкам** — Ctrl+Click по путям к файлам и URL в YAML для перехода к ним
- **Палитра цветов** — предпросмотр и выбор цветов в YAML-значениях
- **Сайдбар** — браузер файлов с поиском, навигацией и инициализацией проекта
- **Подсветка синтаксиса** — подсветка YAML внутри блоков `::: page-constructor` в Markdown

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
| `Alt+X`   | Вставить чекбокс           |
| `Alt+F`   | Вставить фронтматтер       |
| `Alt+P`   | Вставить page-constructor  |
| `Alt+H`   | Вставить HTML-блок         |

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
