# Arquitetura multi-matéria

## Regra de separação

- Comportamento reutilizável: `assets/`.
- Conhecimento da disciplina: `subjects/<id>/content.html`.
- Metadados e estrutura da matéria: `subjects/<id>/subject.json`.
- Lógica exclusiva, como simuladores específicos: `subjects/<id>/subject.js`.

## Fluxo de carregamento

1. `index.html` lê `subjects/registry.json`.
2. Cada card lê o `subject.json` correspondente e calcula o progresso.
3. `guide.html?subject=<id>` inicia a engine compartilhada.
4. A engine valida o slug e carrega `subject.json` + `content.html`.
5. Sidebar, busca, checklists, progresso e acordeões são montados pela engine.
6. Se o manifesto declarar `script`, a extensão específica da matéria é carregada por último.

## Persistência

Cada matéria possui uma chave própria de `localStorage`. O campo `legacyStorageKeys` permite migrar progresso de versões anteriores.

## Extensibilidade

A home não possui disciplinas hardcoded em JavaScript. Para incluir uma matéria nova, basta criar sua pasta e registrar seu caminho em `subjects/registry.json`.
