"""Build a compact dark PNG/SVG from the four exam solutions and app wave model.

Requires matplotlib: python -m pip install matplotlib
Run from any directory: python scripts/build-exam-formula.py
"""
import json
import re
import subprocess
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'subjects/eletronica-potencia/exports'
OUT.mkdir(exist_ok=True)
models = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/export-formula-waveforms.cjs')], encoding='utf8'))
W, H = 1800, 1560
BG = SURFACE = '#000000'
FG = MUTED = '#ffffff'
BLUE = GREEN = GOLD = ORANGE = PURPLE = '#ffffff'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'mathtext.fontset': 'dejavusans',
                     'svg.fonttype': 'path', 'svg.hashsalt': 'p1-four-papers'})
fig = plt.figure(figsize=(W / 100, H / 100), dpi=200, facecolor=BG)
canvas = fig.add_axes([0, 0, 1, 1]); canvas.set_xlim(0, W); canvas.set_ylim(H, 0); canvas.axis('off')


def text(x, y, s, size=14, color=FG, weight='normal', **kw):
    return canvas.text(x, y, s, fontsize=size * .72, color=color, weight=weight, va='top', **kw)


def mathtext_formula(s):
    # Mathtext uses explicit fraction/overline bodies rather than TeX's \over.
    s = re.sub(r'\\overline\s+([A-Za-z])', r'\\overline{\1}', s)
    s = re.sub(r'\\sqrt\s+([A-Za-z])', r'\\sqrt{\1}', s)
    def group(value):
        result, i = '', 0
        while i < len(value):
            if value[i] == '{':
                depth, j = 1, i + 1
                while depth:
                    depth += (value[j] == '{') - (value[j] == '}')
                    j += 1
                body = value[i + 1:j - 1]
                level, split = 0, None
                for k, c in enumerate(body):
                    level += (c == '{') - (c == '}')
                    if level == 0 and body[k:k + 5] == r'\over' and not body[k:k + 9] == r'\overline':
                        split = k
                        break
                result += ('{\\frac{' + group(body[:split]) + '}{' + group(body[split + 5:]) + '}}'
                           if split is not None else '{' + group(body) + '}')
                i = j
            else:
                result += value[i]
                i += 1
        return result
    return group(s)


def math(x, y, s, size=17, color=FG):
    return text(x, y, '$' + mathtext_formula(s) + '$', size, color)


def box(x, y, w, h, title, color=GOLD):
    canvas.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0,rounding_size=8',
                                  facecolor=SURFACE, edgecolor='#404040', linewidth=.6))
    text(x + 12, y + 10, title, 17, color, 'bold')


text(20, 12, 'P1  •  FORMULÁRIO DAS 4 PROVAS', 25, FG, 'bold')
text(1780, 17, 'NOV/2024 · MAI/2025 · SET/2025 · ABR/2026', 14, MUTED, ha='right')
text(20, 44, 'Ideal · regime periódico · pequena ondulação · ESR desprezível. V = |tensão média de saída|; inversor: vₒ = −vC.', 14, MUTED)

# Shared relations used in all four papers, grouped by the decision they support.
box(20, 70, 570, 147, '1  TEMPOS E BALANÇOS')
math(32, 100, r'T_s=1/f_s,\quad D=t_{on}/T_s,\quad D_2=t_D/T_s,\quad D_3=1-D-D_2', 16)
math(32, 131, r't_{off}=(1-D)T_s,\quad t_D=D_2T_s,\quad t_0=D_3T_s', 16)
math(32, 157, r'\int_0^{T_s}v_L\,dt=0\ \Rightarrow\ v_{L,on}t_{on}+v_{L,off}t_D=0', 15.5)
text(32, 192, 'CCM: D₂ = 1 − D. DCM: tD < toff; D₃ > 0. Crítica: Imin = 0, D₃ = 0.', 13)
box(605, 70, 570, 147, '2  RAMPA, MÉDIA E GEOMETRIA')
math(617, 100, r'v_L=L\,di_L/dt,\quad \Delta I_L=I_{max}-I_{min},\quad L=|v_L|\Delta t/\Delta I_L', 16)
math(617, 132, r'\overline I={1\over T_s}\int i\,dt,\quad A_\triangle={bh\over2},\quad A_{trap}={(h_1+h_2)b\over2}', 17)
math(617, 166, r'\overline I_{L,CCM}={I_{max}+I_{min}\over2},\quad I_{min/max}=\overline I_L\mp{\Delta I_L\over2}', 17)
text(617, 198, 'Média = área / período inteiro; corrente crítica no indutor = Ipk / 2.', 13)
box(1190, 70, 590, 147, '3  CARGA E CAPACITOR')
math(1202, 100, r'I_o=V/R,\quad R=V/I_o,\quad i_C=C\,dv_C/dt', 18)
math(1202, 133, r'v_C(t)=v_C(t_a)+{1\over C}\int_{t_a}^{t}i_C\,dt,\quad C={\Delta Q\over\Delta V_{pp}}', 17)
text(1202, 168, 'iC > 0: vC sobe. iC < 0: vC cai. iC = 0: extremo (ou patamar).', 13)
text(1202, 189, 'Média de iC = 0. Buck: iC = iL − Io. Boost/inversor: iC = iD − Io.', 13)

tops = [
    ('buck', 'BUCK  ·  rebaixador', BLUE, [
        ('CCM', r'V=DE,\quad \overline I_L=I_o'),
        ('Ondulação', r'\Delta I_L={(E-V)DT_s\over L}={V(1-D)T_s\over L}'),
        ('L pela rampa', r'L={(E-V)t_{on}\over\Delta I_L}={Vt_D\over\Delta I_L}'),
        ('L crítica', r'L_{crit}={(1-D)RT_s\over2}={V(1-D)T_s\over2I_o}'),
        ('DCM: pico', r'I_{pk}={(E-V)DT_s\over L},\quad D_2={D(E-V)\over V}'),
        ('DCM: médias', r'I_o=\overline I_L={I_{pk}(D+D_2)\over2}'),
        ('DCM: ganho', r'{V\over E}={2\over1+\sqrt{1+4K/D^2}},\quad K={2L\over RT_s}'),
        ('Balanço', r'(E-V)D-VD_2=0\ \Rightarrow\ V={ED\over D+D_2}'),
    ]),
    ('boost', 'BOOST  ·  elevador', GREEN, [
        ('CCM', r'V={E\over1-D},\quad I_o=(1-D)\overline I_L'),
        ('Ondulação', r'\Delta I_L={EDT_s\over L}={(V-E)(1-D)T_s\over L}'),
        ('L pela rampa', r'L={Et_{on}\over\Delta I_L}={(V-E)t_D\over\Delta I_L}'),
        ('L crítica', r'L_{crit}={D(1-D)^2RT_s\over2}={ED(1-D)T_s\over2I_o}'),
        ('DCM: pico', r'I_{pk}={EDT_s\over L},\quad D_2={ED\over V-E}'),
        ('DCM: médias', r'I_o={I_{pk}D_2\over2},\quad\overline I_L={I_{pk}(D+D_2)\over2}'),
        ('DCM: ganho', r'{V\over E}={1+\sqrt{1+4D^2/K}\over2}'),
        ('V direto', r'V=E\left(1+{D\over D_2}\right)=E+{E^2D^2T_s\over2LI_o}'),
    ]),
    ('buckboost', 'BUCK-BOOST  ·  inversor', PURPLE, [
        ('CCM', r'V={ED\over1-D},\quad v_o=-v_C,\quad I_o=(1-D)\overline I_L'),
        ('Ondulação', r'\Delta I_L={EDT_s\over L}={V(1-D)T_s\over L}'),
        ('L pela rampa', r'L={Et_{on}\over\Delta I_L}={Vt_D\over\Delta I_L}'),
        ('L crítica', r'L_{crit}={(1-D)^2RT_s\over2}={ED(1-D)T_s\over2I_o}'),
        ('DCM: pico', r'I_{pk}={EDT_s\over L},\quad D_2={ED\over V}'),
        ('DCM: médias', r'I_o={I_{pk}D_2\over2},\quad\overline I_L={I_{pk}(D+D_2)\over2}'),
        ('DCM: ganho', r'{V\over E}={D\over\sqrt K},\quad K={2L\over RT_s}'),
        ('V direto', r'V={ED\over D_2}={E^2D^2T_s\over2LI_o}=ED\sqrt{RT_s\over2L}'),
    ]),
]
for col, (top, title, color, rows) in enumerate(tops):
    x = 20 + col * 590
    box(x, 230, 580, 305, title, color)
    for j, (label, equation) in enumerate(rows):
        yy = 266 + j * 32
        text(x + 12, yy + 6, label, 12, MUTED)
        math(x + 103, yy, equation, 15.5)
    text(x + 12, 521, 'Crítica: ΔIL = 2 ĪL; CCM: Imin > 0; DCM: Imin = 0 e D₃ > 0.', 11.5, MUTED)


def wave_panel(model, x, y):
    p, top, mode = model['params'], model['topology'], model['mode']
    D, d2, d3 = p['D'], p['D2'], p['D3']
    # Validate balances independently before exporting any figure.
    on = p['Vin'] - p['Vo'] if top == 'buck' else p['Vin']
    off = p['Vin'] - p['Vo'] if top == 'boost' else -p['Vo']
    assert abs(on * D + off * d2) < 1e-8
    mean_l = (p['Imin'] + p['Imax']) * (D + d2) / 2
    out_mean = mean_l if top == 'buck' else (p['Imin'] + p['Imax']) * d2 / 2
    assert abs(out_mean - p['Io']) < 1e-8
    assert abs(model['samples'][0]['vC'] - model['samples'][-1]['vC']) < 1e-8
    box(x, y, 580, 333, mode + ('  ·  corrente de L sempre > 0' if mode == 'CCM' else '  ·  três etapas, corrente nula em D₃'), BLUE if mode == 'CCM' else ORANGE)
    px, pw = x + 116, 440
    # Time intervals aligned vertically across all six signals.
    for a, b, label, cc in [(0, D, 'D · Ts | ON', BLUE), (D, D+d2, 'D₂ · Ts | diodo', GREEN), (D+d2, 1, 'D₃ · Ts | nulo', ORANGE)]:
        if b-a > 1e-8:
            text(px + (a+b)/2*pw, y+36, label, 10.5, cc, ha='center')
    samples = model['samples']; t = np.array([s['t'] for s in samples])
    crossing = []
    ratio = (p['Io'] - p['Imin']) / p['deltaIL']
    if 0 < ratio < 1:
        if top == 'buck': crossing.append((ratio*D, 'min'))
        crossing.append((D + (1-ratio)*d2, 'max'))
    if top != 'buck': crossing.append((D, 'min'))
    signals = [('vL', BLUE, r'$v_L$ [V]'), ('iL', GREEN, r'$i_L$ [A]'),
               ('switches', ORANGE, r'$i_S,\ i_D$ [A]'), ('iC', PURPLE, r'$i_C$ [A]'),
               ('vC', GOLD, r'$v_C=|v_o|$ [V]'), ('load', GOLD, r'$i_o=v_C/R$ [A]')]
    for row, (key, color, title) in enumerate(signals):
        yy, hh = y + 56 + row*40, 35
        ax = fig.add_axes([px/W, 1-(yy+hh)/H, pw/W, hh/H], facecolor='none')
        for boundary in [D,D+d2] if mode == 'DCM' else [D]:
            ax.axvline(boundary,color='#333333',lw=.5,ls=(0,(3,4)))
        vals = np.array([s['iS'] if key=='switches' else s['vC']/p['R'] if key=='load' else s[key] for s in samples])
        all_vals = np.concatenate((vals,[0])) if key not in ['vC','load'] else vals
        lo,hi = min(all_vals),max(all_vals); span=max(hi-lo,1e-8)
        ax.set_xlim(0,1.01);ax.set_ylim(lo-.18*span,hi+.3*span)
        ax.plot(t,vals,color=color,lw=1.1)
        if key=='switches': ax.plot(t,[s['iD'] for s in samples],color=PURPLE,lw=1.1,ls=(0,(3,2)))
        if key in ['vL','iC']: ax.axhline(0,color='#505050',lw=.45)
        if key=='iC':
            for boundary,_ in crossing:
                # A zero crossing is a dot only if the current is continuous there.
                if top=='buck' or boundary>D+1e-8: ax.plot(boundary,0,'o',ms=2.3,color=GOLD)
        if key == 'vC':
            voltage_events = crossing + ([(1, 'max')] if top != 'buck' and ratio <= 0 else [])
            for boundary,label in voltage_events:
                ind=np.argmin(abs(t-boundary)); val=vals[ind]
                ax.plot(boundary,val,'o',ms=2.4,color=GOLD)
                ax.annotate(label,(boundary,val),xytext=(2,3 if label=='min' else -9),textcoords='offset points',fontsize=6.5,color=GOLD)
        ax.axis('off')
        text(x+12,yy+9,title,12,color)
        if key=='vL':
            labels=('E − V','E − V') if top=='buck' else ('E','E − V' if top=='boost' else '−V')
            ax.text(D/2,on+span*.06,labels[0],color=BLUE,fontsize=6.8,ha='center')
            ax.text(D+d2/2,off+span*.08,labels[1] if top!='buck' else '−V',color=BLUE,fontsize=6.8,ha='center')
            if d3>0: ax.text(D+d2+d3/2,span*.06,'0',color=BLUE,fontsize=6.8,ha='center')
        if key=='iL':
            ax.annotate('Ipk' if mode=='DCM' else 'Imax',(D,p['Imax']),xytext=(3,1),textcoords='offset points',color=GREEN,fontsize=6.8)
            ax.text(.99,p['Imin']+span*.05,'0' if mode=='DCM' else 'Imin',ha='right',color=GREEN,fontsize=6.8)
        if key=='switches':
            ax.text(D/2,p['Imax']*.82,'iS',color=ORANGE,fontsize=7)
            ax.text(D+d2/2,p['Imax']*.8,'iD',color=PURPLE,fontsize=7)
        if key=='iC':
            ax.text(.02,lo+span*.06,'−Io' if top!='buck' else 'Imin − Io',color=PURPLE,fontsize=6.5)
            ax.text(.97,0+span*.08,'0',ha='right',color=MUTED,fontsize=6.5)
    ty=y+299
    text(px,ty,'0',11,MUTED,ha='center')
    text(px+D*pw,ty,'D',11,BLUE,ha='center')
    if mode=='DCM':text(px+(D+d2)*pw,ty,'D + D₂',11,GREEN,ha='center')
    text(px+pw,ty,'1  (t/Ts)',11,MUTED,ha='right')
    if top=='buck': note='Extremos: min em DTs/2; max em (D + D₂/2)Ts [CCM].'
    else: note='Min em DTs; max no cruzamento iD = Io (ou fim de OFF).'
    if mode=='DCM' and top=='buck': note='Min em (Io/Ipk)DTs; max em [D + D₂(1 − Io/Ipk)]Ts.'
    text(x+12,y+318,note,10.5,MUTED)


for col,(top,*_) in enumerate(tops):
    for mode,y in [('CCM',548),('DCM',893)]:
        wave_panel(next(m for m in models if m['topology']==top and m['mode']==mode),20+590*col,y)

box(20,1239,865,227,'CAPACITÂNCIA E EXTREMOS  ·  escolha pelo formato de iC')
math(32,1271,r'\Delta V_{pp}=v_{C,max}-v_{C,min}=\Delta Q/C,\quad \Delta Q=\int_{t_{min}}^{t_{max}}i_C\,dt',15.5)
text(32,1316,'Buck CCM',13,BLUE,'bold')
math(176,1310,r'\Delta Q={\Delta I_LT_s\over8},\quad C={\Delta I_LT_s\over8\Delta V_{pp}}',17)
text(32,1342,'Boost / inversor CCM: se Imin ≥ Io, todo OFF carrega C.',13,GREEN)
math(32,1363,r'\Delta Q=I_oDT_s,\quad C={I_oDT_s\over\Delta V_{pp}}',17)
text(450,1342,'OFF: ΔiC = ΔIL; cruzamento por zero:',13,PURPLE)
math(450,1363,r'a=I_{max}-I_o,\ b=I_{min}-I_o',16)
math(450,1394,r'\Delta t_+=t_D{a\over a-b},\quad \Delta Q={a\Delta t_+\over2}',17)
text(32,1414,'Boost / inversor DCM (Imin = 0):',13,ORANGE)
math(32,1434,r'\Delta Q={I_{pk}D_2T_s\over2}\left(1-{I_o\over I_{pk}}\right)^2=I_oT_s\left(1-{D_2\over2}\right)^2',17)
box(900,1239,880,227,'CONSULTA RÁPIDA  ·  sinais, unidades e cuidados')
text(912,1274,'E: entrada [V]  ·  V: módulo médio de saída [V]  ·  R: carga [Ω]',14)
text(912,1296,'L: indutância [H]  ·  C: capacitância [F]  ·  Ts, ton, tD, t0: tempos [s]',14)
text(912,1318,'I: nível [A]  ·  Ī: média [A]  ·  i(t): instantânea [A]  ·  D, D₂, D₃, M, K: adimensionais',14)
text(912,1340,'ΔIL: pico a pico [A]  ·  Ipk: pico [A]  ·  ΔQ: carga elétrica [C]  ·  ΔVpp: ripple [V]',14)
text(912,1368,'V·µs/A → µH   |   A·µs → µC   |   µC/V → µF   |   mH = 1000 µH',14,GOLD,'bold')
text(912,1395,'Inversor: gráficos mostram vC = |vo| e a corrente no terminal positivo de C.',13)
text(912,1417,'A tensão vo referida ao terra tem sinal oposto; sua corrente em R também.',13)
text(912,1439,'Colchete de ΔI ≠ Imin. Se faltar ΔVpp, deixe C simbólico. D₂ ≠ OFF em DCM.',13,ORANGE)
text(20,1480,'GRÁFICOS: um ciclo; escalas próprias; ripple ampliado. iS: linha contínua; iD: tracejada. Pontos: cruzamentos de iC / extremos de vC.',13,MUTED)
text(20,1502,'Boost CCM acima inclui iC < 0 no fim do OFF (caso Nov/2024 Q2). No inversor CCM, Imin ≥ Io: vC atinge máximo no fim do OFF.',13,MUTED)
math(20,1526,r'E={|v_{L,off}|t_D\over t_{on}}\quad\mathrm{(Boost/inversor)}',15,GOLD)
math(630,1526,r'V={v_{L,on}t_{on}\over t_D}\quad\mathrm{(Buck)}',15,GOLD)
math(1200,1526,r'i_D(t)=I_{max}-{\Delta I_L(t-t_{on})\over t_D}\quad\mathrm{(OFF)}',15,GOLD)

for suffix in ['png','svg']:
    output = OUT / ('formulario-p1-4-provas-escuro.'+suffix)
    fig.savefig(output,facecolor=BG,dpi=200,metadata={'Date': None} if suffix == 'svg' else None)
    if suffix == 'svg':
        output.write_text('\n'.join(line.rstrip() for line in output.read_text(encoding='utf8').splitlines())+'\n', encoding='utf8')
plt.close(fig)
print('Exportado: PNG 3600×3120 e SVG vetorial; seis topologias/regimes com balanços validados.')
