---
interface:
  toc: true
  search: true
  feedback: true
  qqq: 123
---

## Notes

{% note tip "" %}

Это примечание.

{% endnote %}

## Таблица с якорями в ячейках

#|
|| **Параметр** | **Описание** | **Тип** ||
|| `allowHTML` {#allow-html} | Разрешить использование HTML в markdown-файлах. | `bool` ||
|| `langs` {#langs} | Список языков, на которые локализована документация. | `string[]` ||
|| `vcs` {#vcs} | Настройка подключения к VCS. Её включение позволяет использовать [##authors##](#vcs-authors) и [##contributors##](#vcs-contributors). | `Object` ||
|| `authors` {#vcs-authors} | Включить отображение автора статьи. | `bool` ||
|| `contributors` {#vcs-contributors} | Включить отображение контрибьюторов. | `bool` ||
|#
