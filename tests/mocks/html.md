---
title: HTML Block Test
---

# HTML Block Example

Simple text before HTML block.

::: html

<style>
html, body {
    background-color: var(--yfm-html-color-background);
    color: var(--yfm-html-color-text-primary);
    font-size: var(--yfm-html-font-size);
    font-family: var(--yfm-html-font-family);
}
</style>

<h1>HTML content inside YFM html block</h1>
<p>This paragraph is rendered as HTML, not as Markdown.</p>
<ul>
    <li>Item 1</li>
    <li>Item 2</li>
</ul>

:::

Text after HTML block.

## Inline HTML

This line has <span style="color: red;">inline HTML</span> that should not be escaped.

And a <br> line break.
