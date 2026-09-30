# Revisão da P1 — Eletrônica de Potência

Data: 29/09/2026.

## Resultado

A base teórica já abrangia as três topologias em CCM/DCM e suas equações principais. Faltavam rastreabilidade por prova/questão, treino com os gráficos reais e tensão do capacitor sincronizada à corrente. O simulado existente continha exercícios autorais.

A revisão acrescenta resoluções das 12 questões principais e dos subitens legíveis, nove gráficos dos dados das provas, três gráficos da integração de iC e a análise de recorrência. Duas inconsistências das fotos foram preservadas e explicadas. Não há gabarito oficial entre os arquivos examinados.

O app agora cobre os pedidos identificados nas quatro folhas. Isso não comprova cobertura de todo o programa ou de uma futura P1. Dados ausentes resultam em respostas simbólicas; dados conflitantes têm ressalva junto da solução.

## Fontes

Pasta: `C:\Users\Leo\Desktop\UTFPR\Eletronica de Potencia\Provas Anteriores\P1`.
Contém quatro JPEGs, examinados visualmente, com ampliação dos detalhes. Folhas parcialmente visíveis ao fundo da foto de maio/2025 não foram contadas como provas adicionais. Nomes, notas e respostas dos alunos não foram usados como gabarito ou copiados para o app.

| Data na folha | Arquivo |
|---|---|
| 12/11/2024 | `859c0e82-f21d-4676-9c9b-156483a8a0ed.jpeg` |
| 07/05/2025 | `7cc6b6a5-4fa3-45de-94ac-a56738742fd6.jpeg` |
| 24/09/2025 | `63fcc2bd-4245-46e3-9731-1dedf11b89cd.jpeg` |
| 22/04/2026 | `c203d2fa-b648-4aeb-b021-b7ff23580d07.jpeg` |

SHA-256, na mesma ordem:

```text
543AFB1284C8CFD80420400C6FDC54C5ABF737B2E6784D29544191F391280E75
1C47C0ADE9A3F2FFB8C5032E740D8481F028FC81CA00C9EB5DAFD023756A043D
F0EE874959DF94C85B9A710BF2F732A444F9514AC52AEADD0B25941180C78120
23E45666C4F9441333855313BC3FE9DCE06B7C100EC782F61C75034889DDAE12
```

## Recorrência

| Competência | Provas |
|---|---:|
| Reconhecer Buck, Boost e Buck-Boost inversor | 4/4 |
| Descrever três etapas DCM e desenhar vL/iL | 4/4 |
| Ler gráficos, integrar correntes e aplicar balanços | 4/4 |
| Deduzir capacitância pela carga e ondulação | 4/4 |
| Condução crítica e/ou indutância crítica | 4/4 |
| Deduzir explicitamente o ganho DCM | 3/4 |
| Escolher vo a partir de iC | 2/4 |
| Questão principal específica de perdas de diodo | 0/4 |

Prioridade: formas de onda e balanços, três topologias, fronteira e DCM, dedução de C. RMS e perdas continuam úteis como fundamentos. As contagens são por folha, não por subitem, e não constituem previsão estatística.

## Cobertura e resultados de conferência

| Prova / questão | Pedidos e resultados | Âncora no app |
|---|---|---|
| 2024 Q1 | Etapas DCM; média crítica de L = 1,3333 A; ganho DCM do inversor em E, D, Ts, L e Io | `#p1-2024` |
| 2024 Q2 | C = 9,72 µC/ΔVpp; Io = 2,4 A; terceira curva; Lcrit paramétrico | `#p1-2024` |
| 2024 Q3 | D = 0,8; V = 48 V; R = 12 Ω; L = 480 µH, pelos dados textuais | `#p1-2024` |
| Maio/2025 Q1 | Etapas DCM; média crítica de L = 5 A; ganho do inversor | `#p1-2025-maio` |
| Maio/2025 Q2 | C = 70 µC/ΔVpp; E = 42,857 V; média do diodo = 1 A; L = 1,5 mH | `#p1-2025-maio` |
| Maio/2025 Q3 | Média de L = 7 A; D = 0,3; L = 1,05 mH; Lcrit = 150 µH | `#p1-2025-maio` |
| Setembro/2025 Q1 | Etapas DCM; média crítica de L = 5 A; V = E + E²D²Ts/(2LIo) em DCM | `#p1-2025-setembro` |
| Setembro/2025 Q2 | C = 50 µC/ΔVpp; E = 60 V; média do diodo = 1 A; L = 1,5 mH | `#p1-2025-setembro` |
| Setembro/2025 Q3 | Média de L = 7 A; D = 0,7; L = 1,05 mH; Lcrit = 150 µH | `#p1-2025-setembro` |
| 2026 Q1 | DCM conceitual separado do gráfico CCM; V = 150 V na polaridade impressa; média de L = 8,5 A | `#p1-2026` |
| 2026 Q2 | D = 0,3; D2 = 0,2; D3 = 0,5; V = 250 V; R = 625 Ω; C = 32,4 µC/ΔVpp | `#p1-2026` |
| 2026 Q3 | Curva de C correta reconstruída; média de L = 3 A; L = 1,2 mH; Lcrit = 400 µH | `#p1-2026` |

## Alterações no material

1. Seção “Provas anteriores” com matriz, prioridade, roteiro de estudo, resumos dos enunciados e 12 soluções expansíveis. As duas versões das mesmas questões foram consolidadas, com circuitos, gráficos calculados e alternativas dentro de cada resolução. “Simulados e exercícios” reúne os dois simulados autorais, os três projetos de conversores e o sprint de fundamentos. O menu separa “Revisão e consulta” de “Provas e prática”; a ordem das seções acompanha o menu.
2. Canal de capacitor com integral de iC ampliada em torno do nível CC. C = 100 µF nos seis exemplos; a parcela alternada tem média zero e fecha o período. No inversor, a tensão referida ao terra tem sinal oposto ao módulo mostrado.
3. Dedução de C pela carga, regra de sinais, trechos lineares/parabólicos, CCM com e sem cruzamento de iC e DCM. Três gráficos resolvidos mostram tensão normalizada e corrente.
4. Diferença entre duração e posição do pulso: iS entre 70–100 µs em maio/2025 implica D = 0,3; iD no mesmo intervalo em setembro implica D = 0,7.
5. Distinção entre média crítica de L e corrente crítica de saída: no Boost/inversor, Io,crit = (1 − D) IL,crit.
6. Ganho DCM deduzido também com Io e Ts, além de M(D,K).
7. Tabela por etapa com vL, vS, vD, iS, iD e iC, referências de polaridade, terceira etapa DCM e condições de validade. Os diagramas de topologia dos módulos 4–9 foram conferidos e preservados.
8. Gráficos calculados dos exercícios aparecem ao abrir a resolução; os dados gráficos das fotos continuam junto ao enunciado. O treino duplicado de média/RMS aponta para o módulo 1. Os seis gabaritos autorais usam delimitadores LaTeX corretos, com unidades e sem os resíduos de exportação. Links antigos para `#quizSection` continuam no grupo de dimensionamento.

## Inconsistências e dados ausentes

- **2024 Q3:** mínimo de iL parece marcado “1 A”. Média 4 A e ondulação 2 A do texto implicam mínimo 3 A e máximo 5 A. A solução usa o texto e explicita o conflito. ON foi lido como 80 µs.
- **2026 Q3(a):** as três alternativas começam com tensão crescente e iC negativa, embora a seta entre no terminal positivo de C. Nenhuma satisfaz iC = C dvo/dt. A central tem forma suave, mas derivada com sinal invertido; seria compatível com a referência oposta de corrente. O app mostra a integral coerente sem atribuir uma resposta oficial.
- **2024 Q2(d):** faltam E, V ou R numéricos. Lcrit = 0,72 µs × R = (0,30 µH/V) × V = (0,50 µH/V) × E.
- **Questões de C:** sem ΔVpp numérico, o resultado é carga/ΔVpp.
- **2026 Q1:** descrever DCM no item (a) não transforma em DCM o gráfico numérico, cuja mínima é 6 A. A marca 5 A é a ondulação a partir do pico de 11 A.

## Verificação

- `node --test tests/converters.test.cjs`: **14 testes passaram**, cobrindo modelos das seis topologias/regimes, calculadora, balanços, continuidade, C dv/dt = iC, média da tensão alternada, áreas históricas e oito pontos de operação das provas.
- Curvas normalizadas: extremos em 4/9,4 µs (2024 Q2), 30/48 µs (2026 Q2) e 30/80 µs (2026 Q3), periodicidade e queda inicial para iC negativa.
- `node --check subjects/eletronica-potencia/subject.js` e `git diff --check`.
- Navegador local: nove gráficos dos dados, três gráficos de capacitor, seis diagramas e 12 soluções abertas. Sem erros de fórmulas, caminhos SVG inválidos ou erros de console nas verificações. Inspeção em larguras de desktop e celular, com rolagem horizontal nos gráficos para preservar a legibilidade.

Modelos ideais, regime periódico e pequena ondulação. Não representam transientes com ESR, ESL ou perdas. Alterações locais; publicação não faz parte desta verificação.

## Referências auxiliares

- [Texas Instruments SLVAFJ5 — seções Buck e Boost](https://www.ti.com/document-viewer/lit/html/SLVAFJ5). A seção de buck-boost de duas chaves não foi usada como substituta do inversor das provas.
- [Texas Instruments SLVA061 — Understanding Boost Power Stages](https://www.ti.com/lit/an/slva061/slva061.pdf), análise de regime permanente, CCM/DCM e indutância crítica.

As contas específicas, a classificação e os gráficos históricos foram derivados das fotos e dos balanços físicos nesta revisão.

## Apresentação das provas — 30/09/2026

As quatro páginas de P1 agora usam uma folha clara, com cabeçalho acadêmico,
questões numeradas e subitens na ordem das fotos. Os circuitos são reconstruídos
em SVG monocromático, ao lado das formas de onda no desktop. As alternativas
aparecem junto ao enunciado, antes de abrir a resolução.

A referência de leitura foi `APS 1/resolucao_aps_buck_boost.html`: texto de
16–17 px, separadores simples, rótulos “Fórmula” e “Substituição” e resultados
destacados. As 12 resoluções foram desdobradas por item. Dados ausentes continuam
simbólicos; os conflitos de 2024 Q3 e 2026 Q3 permanecem explicados.

Os gráficos do enunciado indicam simbolicamente os níveis não impressos, e as
contas mostram sua dedução. Os gráficos DCM conceituais distinguem chave,
diodo e corrente nula. No celular, circuitos e gráficos ficam em sequência,
com rolagem local para conservar o tamanho dos rótulos e das equações.

O conteúdo canônico permanece em `content.html`; `scripts/build-topic-pages.py`
gera as quatro páginas e suas âncoras. O estilo claro de `exam-paper.css` fica
restrito às folhas, mantendo a navegação e os outros tópicos no tema do app.

### Raciocínio e nomenclatura

As 12 resoluções incluem um roteiro de solução e uma legenda local com nomes,
significados e unidades das variáveis. Os 47 passos de resposta explicam a
escolha da relação física antes da fórmula, com desenvolvimento intermediário
e interpretação do resultado. A legenda diferencia valores instantâneos,
médias, picos, ondulações, módulos de tensão e referências de polaridade.

As deduções mostram a origem das médias por área, o balanço volt-segundo,
o balanço de carga do capacitor, os cruzamentos de corrente por zero e a
condição crítica. Foram explicitadas a conversão mH/µH, a diferença entre
OFF e condução do diodo em DCM, e a diferença entre corrente média da carga,
do indutor e dos pulsos da chave ou do diodo.

## Navegação por páginas — 29/09/2026

- Conteúdo dividido em 30 páginas carregadas sob demanda. Teoria, provas, simulados e projetos abrem um tópico ou conjunto por vez.
- Revisão com abas Buck, Boost e Buck-Boost e subabas CCM/DCM; um circuito ativo por página. O regime é mantido ao trocar a topologia. Descrições completas e tabela por etapa são recolhíveis e se expandem na impressão.
- Fórmulas consultáveis por modal em qualquer página, carregadas na primeira abertura. Circuitos e gráficos ficam na revisão por topologia, com link na página de fórmulas.
- Progresso global preservado: 37 itens e nove módulos. Âncoras antigas, atualização e voltar/avançar continuam disponíveis.
- `python scripts/build-topic-pages.py --check` confere o material gerado a partir de `content.html`. O workflow do deploy gera as páginas e executa os testes.
- Verificação: 22 testes de física, cobertura do conteúdo, destinos de links/abas, progresso e busca apenas da página selecionada. Navegador local: troca de topologia/regime, teclado, gráficos de capacitor, resoluções, projetos, modal, link antigo, progresso entre páginas e largura de 390 px; Controle 1 também carrega corretamente.

## Subabas pré-carregadas e vista compacta — 29/09/2026

- As seis combinações de topologia/regime e o roteiro permanecem em memória na revisão. Cada simulador é inicializado uma vez; trocar a aba preserva play/pause, instante, velocidade e canal.
- Abas ocultas congelam o tempo, mantendo a intenção de reproduzir ou pausar. O retorno retoma do instante retido. URL, favoritos, teclado e voltar/avançar continuam disponíveis.
- Circuito e osciloscópio lado a lado no desktop, com alturas de 165/190 px na largura testada de 1271 px. O toolbar de reprodução aparece acima dos diagramas; fórmulas ficam junto às abas. Descrições e referências são expansíveis.
- Rótulos dos diagramas foram ajustados para a escala compacta. A integração parabólica de corrente do capacitor e os pontos de máximo/mínimo permanecem visíveis. Em celulares, os diagramas empilham e mantêm rolagem horizontal local.
- Verificação: 26 testes passaram, incluindo reutilização do cache, pedidos simultâneos e recuperação de falha no pré-carregamento. No navegador, Buck CCM preservou pausa, tempo em 50%, velocidade 2× e canal do capacitor; em play, ficou congelado em 60,2% enquanto oculto e retomou ao voltar. Modal sem erros KaTeX, sete painéis/seis simuladores/um painel visível, sem IDs duplicados; telas de desktop e 390 px conferidas.
