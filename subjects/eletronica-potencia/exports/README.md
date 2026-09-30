# Formulário das quatro provas

Folha única escura, PNG 3600 × 3120 e SVG vetorial. Fonte: as doze resoluções em `../content.html`; gráficos calculados pelo modelo físico de `../subject.js`. Abre em `/formulario-provas.html`, com download e ampliação; acessível na página de fórmulas e no pop-up das provas.

As relações repetidas e suas formas algébricas equivalentes foram agrupadas. Os valores numéricos dos enunciados não ocupam espaço na folha.

| Prova/questão | Relações incluídas |
| --- | --- |
| 2024 Q1; maio/2025 Q1 | Buck-Boost DCM: etapas, pico, corrente crítica, D2, média de diodo, tensão via Io ou R |
| setembro/2025 Q1 | Boost DCM: mesmas etapas e médias, tensão via Io e ganho quadrático via R |
| 2024 Q2 | Boost CCM: média de diodo = carga; capacitor por área, cruzamento dentro do OFF, extrema de vC; L crítica |
| maio/2025 Q2; setembro/2025 Q2 | Inversor/Boost: capacitor descarregando em ON; balanço para E; média de diodo; ΔiC = ΔiL em OFF; L pela rampa |
| 2024 Q3; maio/2025 Q3; setembro/2025 Q3; 2026 Q3 | Buck: balanço, duty pelo tempo de chave/diodo, média trapezoidal, R, L, L crítica, extrema de vC |
| 2026 Q1 | Inversor: estados DCM teóricos; vL,OFF = −V, gráfico numérico CCM e média de iL |
| 2026 Q2 | Boost DCM: D/D2/D3; pico, média de diodo, iC, rampa do diodo, Δt+, ΔQ, C, balanço para V, R |

Cada um dos seis conjuntos traz vL, iL, iS/iD, iC, vC = |vo| e io = vC/R. Ripple ampliado e escalas próprias por sinal. Para o inversor, os sinais desenhados usam o terminal positivo do capacitor: vo referida ao terra tem sinal oposto.

O Boost CCM foi configurado para mostrar o cruzamento de iC dentro do OFF presente na prova de 2024: a fórmula C = Io·D·Ts/ΔVpp não cobre esse caso. O formulário explicita a condição Imin ≥ Io e a integração da área triangular quando ela não é atendida.

Regeneração (Node e Python com matplotlib):

```sh
python -m pip install matplotlib
python scripts/build-exam-formula.py
python scripts/build-topic-pages.py
```

O exportador reaproveita o modelo testado do app. Antes de desenhar, valida o balanço volt-segundo, a corrente média entregue à saída e a periodicidade da tensão do capacitor. PNG e SVG são servidos como arquivos estáticos; a exportação não depende de bibliotecas externas no navegador.
