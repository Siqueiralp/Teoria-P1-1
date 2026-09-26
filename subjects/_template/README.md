# Template de matéria

Cada pasta de matéria contém apenas o que varia entre disciplinas.

- `subject.json`: metadados, módulos, ferramentas e chave de progresso.
- `content.html`: teoria, exercícios e componentes didáticos. Não coloque lógica de aplicação aqui.
- `subject.js`: opcional. Use apenas para simuladores ou comportamento exclusivo da matéria.

O layout, navegação, busca, checklist, persistência, acordeões, KaTeX e medição de progresso já são fornecidos por `assets/js/study-guide.js`.

## Contrato mínimo

Use `subject.json.example` e `content.html.example` como ponto de partida. Se não houver JavaScript específico, não declare a propriedade `script`.
