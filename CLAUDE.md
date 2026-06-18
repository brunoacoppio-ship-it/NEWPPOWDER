# Powder Window — CLAUDE.md

> Este arquivo é carregado automaticamente pelo Claude Code em toda sessão.
> São as regras permanentes do projeto. Leia os documentos referenciados antes de agir.

Outlook sazonal de neve para os Andes: ranqueia resorts pela condição **esperada**
em uma data/mês futuro, com **banda de confiança honesta**. Não é "previsão do tempo".

## Stack
- Vite + React + TypeScript. Sem backend, exceto funções serverless em `api/`.
- Previsão/clima: **Open-Meteo** (previsão 16d, sazonal SEAS5, histórico ERA5) — grátis, sem chave.
- Pistas/lifts: **site oficial de cada resort** (scraping em `api/`, um adaptador por resort).

## Como trabalhamos
- Uma tarefa por vez. Antes de concluir, rodar `npm test` e `npm run build` sem erro.
- Não reintroduzir dependências removidas (leaflet/recharts só se realmente usados).
- Mudanças focadas; não refatorar o que não foi pedido.

## Identidade visual — OBRIGATÓRIO
Antes de mexer em qualquer UI/CSS, leia **`docs/identidade-visual.md`** e siga à risca:
- Paleta do logo: **preto + ciano→azul + branco. Sem roxo, sem verde.** Use os tokens
  CSS do arquivo de identidade — não invente cores.
- Tipografia: **display = Saira · corpo = Inter · números = SEMPRE IBM Plex Mono.**
  (Não usar serif/Fraunces no display.)
- A nota + banda de confiança são renderizadas como o **mostrador (anel) da marca**:
  arco preenchido = nota; segmento aceso = confiança (largo = baixa, estreito = alta).
  Quando a previsão real entra (≤16d), o arco encurta.
- Logo: `src/assets/logo.png` (completo) e `src/assets/logo-icon.png` (ícone/header/favicon).
  Não esticar, recolorir nem rotacionar.

## Princípio do modelo — NÃO regredir
A nota é uma **fusão de múltiplos termos por inverso da variância**, nunca uma fórmula única:
1. **Climatologia recente (5 anos)** — o esqueleto.
2. **Estado atual da temporada (âncora — obrigatório)** — neve caída até hoje vs. normal,
   persistida para frente (`anomalia × autocorrelação`).
3. **Análogo de ENSO** — o histórico **filtrado** pelos anos parecidos com o atual.
4. **SEAS5** (sazonal) e **previsão real** (≤16d; domina e **colapsa a banda**).

Regras invioláveis:
- **O histórico NUNCA age sozinho.** ERA5 isolado = climatologia disfarçada de previsão.
- A **banda de confiança deve sempre aparecer na UI** (é a alma da ferramenta).
- Os modos previsão/sazonal devem ser **contínuos** — sem salto de nota no dia 16.
- A geografia (barlavento/sotavento, base vs. linha de neve) converte a anomalia em
  nota de esquiada.
- O motor de scoring deve ser função pura e testada.

## Roadmap
Itens, prioridades e o que **não** vale a pena estão em **`docs/roadmap.md`**.
Trabalhar item a item, na ordem pedida (ex.: "aplique o item 1.1").

## Estrutura de docs esperada
```
powder-window/
  CLAUDE.md                  ← este arquivo (raiz)
  docs/
    identidade-visual.md     ← identidade visual (tokens, fontes, motivos)
    roadmap.md               ← roadmap completo e ordenado
```
