# Central de Estudos

Este repositório deixou de ser uma página monolítica de Eletrônica de Potência e passou a ser uma base reutilizável para múltiplas matérias.

## Estrutura

```text
/
├─ index.html                    # Home com cards e progresso geral
├─ guide.html                    # Shell único para qualquer matéria
├─ assets/
│  ├─ css/
│  │  ├─ study-guide.css         # Design system/componentes compartilhados
│  │  └─ home.css
│  └─ js/
│     ├─ progress.js             # Persistência e cálculo de progresso
│     ├─ home.js                 # Dashboard
│     └─ study-guide.js          # Engine do guia
└─ subjects/
   ├─ registry.json              # Matérias exibidas na home
   ├─ _template/                 # Modelo e documentação
   └─ eletronica-potencia/
      ├─ subject.json            # Metadados, módulos e ferramentas
      ├─ content.html            # Conteúdo didático, sem engine
      └─ subject.js              # Apenas lógica específica da matéria
```

## Como abrir uma matéria

A home aponta para o shell compartilhado:

```
guide.html?subject=eletronica-potencia
```

O shell carrega a configuração e o conteúdo da pasta correspondente. Assim, não existe um `index.html` duplicado por disciplina.

## Adicionando uma nova matéria

1. Copie `subjects/_template/` para `subjects/<slug-da-materia>/`.
2. Preencha `subject.json`.
3. Escreva o material em `content.html`, reutilizando as classes dos componentes existentes.
4. Use `subject.js` apenas se a matéria realmente precisar de simuladores ou lógica exclusiva.
5. Adicione a matéria em `subjects/registry.json`.

O progresso usa uma chave independente por matéria. A Eletrônica de Potência migra automaticamente a chave antiga `ep_p1_utfpr_progress_v1`.
