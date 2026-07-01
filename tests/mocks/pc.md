# Page constructor

::: page-constructor
blocks:
  - type: 'header-block'
    title: 'Заголовок'
    description: 'Описание'
:::

## Привет

## Bug 1: CardLayout.title не принимает объект Title (должно быть Title | string)

::: page-constructor
blocks:
  - type: 'card-layout-block'
    title:
      text: 'MonkeyUI'
      textSize: 'xs'
    colSizes:
      all: 12
      sm: 6
    children: []
:::

## Bug 2: TitleItemProps.textSize не принимает 'xs' и 'sm' (должно быть 'xs' | 's' | 'sm' | 'm' | 'l')

::: page-constructor
blocks:
  - type: 'card-layout-block'
    children:
      - type: 'basic-card'
        url: 'https://example.com'
        title:
          text: 'STQv2'
          textSize: 'xs'
:::

## Bug 3: BasicCard.size не принимается (поле есть в ContentBlockProps)

::: page-constructor
blocks:
  - type: 'card-layout-block'
    children:
      - type: 'basic-card'
        url: 'https://example.com'
        title: 'STQv2'
        size: 's'
:::
