# Central de Estudos

<!-- analytics:start -->
## Uso do guia

Coleta diária concluída; lotes confirmados após preservar o banco no GitHub.

Último evento coletado (UTC): Nenhum evento coletado.

Histórico preservado: **0 eventos**. Nos últimos 30 dias: **0 visitas**, **0 sessões de abas**, **0.0 minutos ativos**.

| Página | Visitas | Minutos ativos | Ações nos gráficos |
| --- | ---: | ---: | ---: |

Sessões de abas não equivalem a pessoas únicas. IPs, IDs de sessões e eventos individuais ficam no banco criptografado da branch `codex/analytics-data`.
<!-- analytics:end -->

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

Eletrônica de Potência carrega um tópico por página. Por exemplo:

```text
guide.html?subject=eletronica-potencia&page=revisao-boost-dcm
```

A revisão tem abas Buck, Boost e Buck-Boost, com subabas CCM/DCM. Provas, simulados e projetos também são separados. Links antigos com `#mod4`, `#historySection` e outras âncoras continuam funcionando.

As subabas da revisão são pré-carregadas e retêm suas instâncias: alternar preserva play/pause, instante do ciclo, velocidade e canal do gráfico. A animação de uma aba oculta fica congelada até o retorno. Circuito, formas de onda e controles usam uma vista compacta no desktop.

Após editar `subjects/eletronica-potencia/content.html`, atualize e confira as páginas:

```sh
python scripts/build-topic-pages.py
python scripts/build-topic-pages.py --check
node --test tests/*.test.cjs
```

## Adicionando uma nova matéria

1. Copie `subjects/_template/` para `subjects/<slug-da-materia>/`.
2. Preencha `subject.json`.
3. Escreva o material em `content.html`, reutilizando as classes dos componentes existentes.
4. Use `subject.js` apenas se a matéria realmente precisar de simuladores ou lógica exclusiva.
5. Adicione a matéria em `subjects/registry.json`.

O progresso usa uma chave independente por matéria. A Eletrônica de Potência migra automaticamente a chave antiga `ep_p1_utfpr_progress_v1`.
