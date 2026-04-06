---
title: Features test page
description: Страница для тестирования всех поддерживаемых фич редактора
neuroExpert:
  projectId:
      default: rrrr
meta:
  - name: keywords
    content: diplodoc, markdown, test
---
# Поддерживаемые фичи редактора

## YFM Notes (работает в wysiwyg)

привет

{% note alert "Note" %}

Информационная заметка. Поддерживается в wysiwyg-режиме через `preset: 'yfm'`.

{% endnote %}

{% note tip "Tip" %}

Подсказка. Это полезный совет.

{% endnote %}

{% note warning "Warning" %}

Предупреждение. Будьте осторожны.

{% endnote %}

{% note alert "Alert" %}

Критическое предупреждение!

{% endnote %}

## YFM Tabs (работает в wysiwyg)

{% list tabs %}

- Tab A

  Содержимое первой вкладки.

- Tab B

  Содержимое второй вкладки.

- Tab C

  Содержимое третьей вкладки.

{% endlist %}

## YFM Cut / Spoiler (работает в wysiwyg)

{% cut "Скрытый контент" %}

Этот текст скрыт под спойлером. Нажмите чтобы раскрыть.

{% endcut %}

## LaTeX / Math (работает в wysiwyg)

Inline формула: $E = mc^2$

Блочная формула:

$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

## Mermaid (работает в wysiwyg)

```mermaid
graph TD
    A[Начало] --> B{Условие}
    B -->|Да| C[Действие A]
    B -->|Нет| D[Действие B]
    C --> E[Конец]
    D --> E
```
## Include (только markup-режим)

Инклюды разрешаются во время сборки, не в редакторе.
В wysiwyg-режиме показывается как текст со ссылкой.

\{% include [level1-include](level1/includes/level1-include.md) %\}

## Page Constructor (только markup-режим)

Блок `page-constructor` отображается как текст в wysiwyg-режиме.
Для редактирования используйте markup-режим.

\::: page-constructor
blocks:

- type: 'header-block'
  title: 'Заголовок страницы'
  description: 'Описание страницы'
  \:::

## OpenAPI (только markup-режим)

\::: openapi
path: ./openapi.yaml
\:::