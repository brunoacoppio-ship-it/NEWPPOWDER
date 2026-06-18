# Powder Window — Identidade Visual (para o Claude Code)

Guia de identidade derivado do logo oficial. O objetivo é que todo o site fale a
mesma língua visual da marca. Os tokens estão prontos para colar como CSS variables.

---

## 1. Essência

Precisa · glacial · técnica-esportiva · honesta. O app mede neve como um
instrumento e é transparente sobre incerteza. A estética é fria, escura e nítida —
nada de "fofo" ou genérico.

**Decisões que este guia trava:**
- Paleta: **preto + ciano→azul + branco de neve. Sem roxo, sem verde** (o brilho
  roxo atual deve sair).
- Fonte de display: trocar o serif **Fraunces** por uma **sans técnica-esportiva**
  que combine com o wordmark do logo (ver §3).
- O **mostrador/gauge do logo é a linguagem do score e da banda de confiança** (§5).

---

## 2. Logo

- **Marca completa** (montanha + wordmark + tagline): hero, tela de carregamento,
  splash. Arquivo: `src/assets/logo.png`.
- **Ícone** (anel + montanha): header, favicon, avatar. Arquivo: `src/assets/logo-icon.png`.
- **Área de proteção:** margem mínima ao redor = altura da "P" de POWDER.
- **Tamanho mínimo do ícone:** 28 px de altura.
- **Fundo:** desenhado para fundo escuro. Em fundo claro, usar uma versão em caixa
  escura. Não colocar sobre fotos cheias.
- **Não fazer:** recolorir, esticar, rotacionar, aplicar sombra dura, nem usar o
  wordmark em corpo de texto.

---

## 3. Tipografia

```text
Display  → Saira         (600/700, leve tracking; itálico opcional no hero p/ ecoar o logo)
Corpo    → Inter         (400/500/600)
Números  → IBM Plex Mono  (400/500) — TODA cifra: nota, cm, datas, intervalos, %
```

Import:
```css
@import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,500;0,600;0,700;1,600;1,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
```

Escala sugerida: H1 32–38 / H2 22 / título de card 17 / corpo 15 / legenda 12.5.
Mono para números reforça o "instrumento" — é regra, não enfeite.

---

## 4. Cores (tokens)

```css
:root {
  color-scheme: dark;

  /* Fundo */
  --bg: #05070d;            /* near-black azulado (mais suave que o preto puro) */
  --bg-deep: #000000;       /* preto do logo — hero/splash */
  --surface: rgba(255,255,255,0.04);
  --surface-2: rgba(255,255,255,0.07);
  --surface-solid: #0c1322;

  /* Tinta / neve */
  --snow: #ffffff;
  --ink: #eaf2fb;
  --muted: #9db0cc;
  --faint: #5e6e8c;
  --line: rgba(255,255,255,0.09);
  --line-strong: rgba(255,255,255,0.16);

  /* Marca: ciano → azul (do wordmark e do mostrador) */
  --cyan-bright: #5be2ff;
  --cyan: #2dd4f8;
  --blue: #2a7fde;
  --blue-deep: #1e63c8;
  --gradient-brand: linear-gradient(120deg, #5be2ff 0%, #2dd4f8 35%, #2a7fde 100%);
  --glow-cyan: rgba(45,212,248,0.25);

  /* Semântica */
  --favored: #2dd4f8;       /* "acima do normal / favorecido" usa o ciano da marca */
  --favored-soft: rgba(45,212,248,0.14);
  --neutral: #8da0bd;       /* "perto do normal" */
  --neutral-soft: rgba(255,255,255,0.06);
  --warn: #fbbf24;          /* "variável/alerta" — único acento quente, usar pouco */
  --warn-soft: rgba(251,191,36,0.14);

  --radius: 14px;
  --radius-lg: 18px;
}
```

Regra de cor: o **ciano é a cor do "bom/favorecido"**; cinza-ardósia é o neutro;
âmbar só para incerteza/alerta e usado com parcimônia. Nada de roxo ou verde.

Brilho de fundo (substituir os radiais multicoloridos atuais por um só, ciano):
```css
body { background:
  radial-gradient(900px 600px at 15% -10%, var(--glow-cyan), transparent 60%),
  var(--bg);
}
```

---

## 5. Motivo-assinatura: o mostrador = score + banda de confiança

O anel do logo (branco → ciano, com ticks) é **a mesma coisa** que a banda de
confiança. Use-o como a representação visual da nota em vez de uma barra comum:

- A nota (0–100) vira um **arco/gauge** preenchido com `--gradient-brand`.
- A **banda de confiança** é o segmento "aceso" do anel: largo = baixa confiança,
  estreito = alta. Ticks ao redor ecoam o logo.
- Um floco (do logo) pode marcar o valor esperado.
- Quando a previsão real entra (≤16 dias) e a banda encolhe, o arco aceso encurta —
  visualmente "fechando o foco". É marca + função na mesma peça.

Onde não couber o arco (listas densas), usar a versão linear: trilho escuro +
segmento em gradiente da marca + marcador no esperado.

---

## 6. Outros motivos do logo

- **Powder dispersion** (o pixel-scatter na borda da "P"): textura para
  transições e skeletons de carregamento (shimmer que "desfaz" em partículas).
- **Montanha + onda de neve:** divisores de seção e ilustração vazia (empty states).
- **Floco:** acento pontual (valor esperado, marcador de "powder day"), nunca decorativo em excesso.

---

## 7. Superfícies, elevação, componentes

- **Cards:** `--surface` + borda `--line`, raio `--radius-lg`; no hover/seleção,
  borda `--line-strong` + leve `box-shadow: 0 0 0 1px var(--glow-cyan)`.
- **Header:** ícone do logo + wordmark (Saira) + tagline "Real snow data. Better
  days." em caixa-alta espaçada, flanqueada por traços finos (como no logo).
- **Badges de modo:** `PREVISÃO REAL` (ciano) / `MODELO SAZONAL` (âmbar) em mono caps.
- **Mapa:** tiles escuros; marcadores em ciano dimensionados pela nota; selecionado com glow ciano.
- **Inputs:** `--surface-2`, borda `--line-strong`, foco em ciano.
- **Skeleton/loading:** shimmer ciano com a textura de dispersão.

---

## 8. Iconografia

Linha fina, geométrica, 1.5px, cantos levemente arredondados (estilo Tabler/Lucide).
Tudo monocromático em `--ink`/`--muted`; ciano só para estado ativo.

---

## 9. Tom de voz

Direto, técnico, honesto sobre incerteza. Mostra a banda, não esconde. Tagline
oficial: **"Real snow data. Better days."** Português nas telas voltadas ao usuário BR.

---

## 10. Do / Don't

**Do:** manter tudo frio (ciano/branco/escuro); usar o gauge para qualquer coisa
medida; mono em todo número; um único acento quente (âmbar) e raro.

**Don't:** introduzir roxo ou verde; usar serif no display; encher de brilhos
multicoloridos; mostrar nota sem a banda; esticar/recolorir o logo.
