# Liquid

{{ presets_text }}

not_var{{ presets_text }}

{% if text == 'hello' %}

Hello

{% elsif text == 'world' %}

World

{% else %}

Welcome

{% endif %}

{% for product in products %}

{{ product.title }} — {{ product.price }}

{% endfor %}

{% for i in (1..5) %}

Item {{ i }}

{% endfor %}
