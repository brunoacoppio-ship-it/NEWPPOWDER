# Powder Window — Roadmap completo (ordenado)

Resumo de tudo que conversamos, na ordem de implementação. Cada item tem
**esforço** e **dependência**. Os números servem de referência para a gente
depois pedir item a item ao Claude Code.

---

## ✅ Já está pronto (base atual)

- Conceito de **outlook sazonal** (prever agosto em junho), não previsão do tempo.
- **Curva da temporada por data** (`seasonalFactor`) — julho ≠ agosto ≠ outubro.
- **Climatologia de 5 anos + análogo de ENSO** (histórico re-ponderado por anos
  parecidos) + **fusão por inverso da variância**.
- **Qualidade geográfica** (barlavento/sotavento, base vs. linha de neve).
- **Modo previsão real** (≤16 dias) via Open-Meteo.
- Mapa, painel de detalhe, layout responsivo, logo/marca.
- **Adaptador de pistas do Valle Nevado** (serverless, em finalização/calibração).

---

## Bloco 1 — Correções de fundação
*Fazer primeiro. Baixo esforço, alto valor, sem dependência externa.*

- **1.1 — Trazer a banda de confiança de volta ao card.** O dado (`low/high/
  confidence`) já é calculado; o card só não mostra. É a alma da ferramenta. ⚡ baixo
- **1.2 — Unificar os dois modos num motor contínuo.** A previsão real entra como
  *estimador dentro do motor sazonal* em vez de trocar a fórmula. Acaba o salto de
  nota no dia 16 e a banda encolhe suave. 🔧 médio
- **1.3 — Travar datas na temporada (jun–out).** Fora disso, estado explícito
  "fora de temporada" em vez de notas zeradas confusas. ⚡ baixo
- **1.4 — Consertar o cache.** Hoje `clearForecastCache()` roda a cada render e
  re-busca tudo. Cachear por (resort, data). ⚡ baixo
- **1.5 — Data padrão no pico (~15 ago)** em vez de "hoje". ⚡ baixo
- **1.6 — Linha "última atualização · fonte"** no modo previsão (confiança). ⚡ baixo

## Bloco 2 — Recursos grátis com o dado que já existe
*Alto valor, sem dependência externa nova.*

- **2.1 — Buscador de melhor janela.** Usuário escolhe um **intervalo** ("10–20
  ago") e o app acha o melhor resort **e os melhores dias**. Casa com viagem real. 🔧 médio
- **2.2 — Risco de lift fechado por vento.** Vento forte fecha lifts altos
  (Portillo, Marte do Las Leñas). Open-Meteo dá vento → indicador de "hold". ⚡ baixo
- **2.3 — Linha do tempo de qualidade da neve** (pó / batida / úmida), dia a dia,
  de temperatura + neve fresca. ⚡ baixo
- **2.4 — Recomendação consciente da incerteza.** A banda vira conselho: "Valle
  (alta confiança) ou aposte no Chillán (teto alto, baixa confiança)". ⚡ baixo
- **2.5 — Explorador de anos análogos.** Mostrar quais anos o modelo usa ("este El
  Niño se parece com 2015 e 2023"). Transparência + credibilidade. ⚡ baixo

## Bloco 3 — O modelo de múltiplos termos (o cérebro)
*O maior salto de credibilidade. Tudo no Open-Meteo (grátis).*

> **Princípio que rege este bloco:** o histórico **nunca age sozinho**. A previsão
> é uma **soma ponderada de termos**, cada um com peso proporcional à sua
> confiabilidade naquele horizonte. O histórico é só o esqueleto; o **estado real
> e atual da temporada é o termo âncora** que prende a estimativa no presente. Num
> ano atrasado e seco, o termo atual puxa a nota para baixo mesmo que o histórico e
> o El Niño sugiram um bom ano — o modelo *discorda* do histórico quando a realidade
> contradiz. Esse é o comportamento correto.

Os cinco termos da fusão (cada um entrega valor + incerteza σ; combina por inverso
da variância):

- **3.1 — Termo histórico (ERA5, 5 anos): o esqueleto, não a resposta.** Reconstrói
  o "normal" daquela data por resort a partir do ERA5 (grátis, desde 1940). Entra
  como **contexto**, sempre corrigido pelos termos abaixo — nunca como previsão
  isolada. 🔧 médio
- **3.2 — Termo do estado ATUAL da temporada (âncora — obrigatório).** Quanto de
  neve **já caiu este ano** até hoje, medido (ERA5 recente / Open-Meteo). A anomalia
  atual **persiste** para frente: `anomalia_hoje × autocorrelação(distância até a
  data)`. É o canal que faz o modelo responder a *este* ano e não a uma média. Sem
  ele, o app é histórico disfarçado. 🔧 médio · **central**
- **3.3 — Termo análogo de ENSO: o histórico FILTRADO por este ano.** Não o passado
  cru — só os anos de El Niño/La Niña parecidos com o atual (kernel sobre o ONI). 🔧 médio
- **3.4 — Termo do modelo físico sazonal (SEAS5).** Física rodando para frente
  (até 7 meses), não estatística do passado. Estimador opcional que reforça/corrige. 🔧 médio
- **3.5 — Termo da previsão real do tempo (≤16 dias).** Quando a data entra na
  janela, domina a fusão e a banda colapsa (já existe; é o que o 1.2 integra). ✅/🔧

- **3.6 — Previsão adaptativa de início/fim de temporada.** Mesma filosofia: ERA5
  reconstrói as datas de abertura/fechamento de ~40 anos, e a projeção é a média
  **corrigida pela direção que as coisas estão tomando** — tendência robusta
  (Theil-Sen / Mann-Kendall) capta a deriva ("a temporada anda chegando mais tarde")
  + termo de ENSO. **Apresentar como janela**, não data cravada. É o diferencial
  intelectual, e é o mesmo princípio: o histórico ajustado pelo presente. 🔧🔧 alto

## Bloco 4 — Marca e contexto estático
*Sua escolha estética + tabelas simples.*

- **4.1 — Aplicar a identidade visual** (ver arquivo de identidade): paleta do logo
  (preto + ciano→azul + branco, **sem roxo**), display em Saira, e a banda de
  confiança no formato do **mostrador do logo**. ⚡ baixo
- **4.2 — Calendário de multidão.** Tabela estática: férias de julho do Brasil +
  inverno de Chile/Argentina → flag "alta lotação". ⚡ baixo
- **4.3 — Logística por cidade.** Distância/tempo de Santiago/Mendoza, aeroporto
  mais próximo. Tabela estática. ⚡ baixo

## Bloco 5 — Conteúdo ao vivo (visual e grudação)
*Dependência externa leve.*

- **5.1 — Mapa de acumulação de neve ao vivo.** (a) embed do **Windy** camada "snow
  accumulation" (rápido) ou (b) overlay próprio da grade `snowfall` do Open-Meteo
  no Leaflet (seu, sem depender de ninguém). 🔧 médio
- **5.2 — Webcams dos resorts.** **Windy Webcams API** pega câmera por coordenada;
  tier grátis com atribuição. Muitos resorts também têm câmera própria pra embed. ⚡ baixo

## Bloco 6 — Pistas ao vivo por resort
*Maior manutenção e mais sazonal → por último, um a um.*

- **6.1 — Finalizar o Valle Nevado** (calibrar mapa de status dos lifts e
  vocabulário das pistas em temporada; ligar `useSnowReport` no card). 🔧 médio
- **6.2 — Replicar adaptador por resort:** Portillo, Las Leñas, Nevados de Chillán,
  Corralco, Chapelco, Cerro Castor. Um adaptador completo de cada vez, com a mesma
  saída `SnowReport`. 🔧🔧 alto (recorrente)

---

## ❌ Não vale a pena / evitar

- **Usar o histórico (ERA5) sozinho como base.** Histórico é diferente todo ano; ele
  é um *termo*, nunca a previsão. Tem que agir junto com o estado real e atual da
  temporada (3.2). ERA5 isolado = climatologia disfarçada de previsão.
- **Tentar transformar o Open-Meteo em OpenSnow.** Reimplementar o pós-processamento
  de montanha (downscaling, razão neve/líquido) é anos de trabalho. Use o OpenSnow no
  celular para a decisão pessoal; não tente recriá-lo no app.
- **Snow-Forecast como espinha dorsal de dados.** 6 dias de horizonte + exige
  contato/atribuição. Pistas vêm dos sites oficiais; previsão vem do Open-Meteo.
- **Headless browser (Playwright) para o Valle Nevado.** Desnecessário — a página é
  HTML puro. Só considerar se algum resort específico exigir JavaScript.
- **Escrever os 7 scrapers de uma vez.** É onde projetos assim morrem na manutenção.
  Um por vez, cada um completo.
- **Cravar data exata de abertura de temporada.** Sempre janela com banda de
  confiança, nunca um dia fixo — em resort único o sinal é ruidoso.
- **Pistas ao vivo como prioridade inicial.** É o de maior manutenção e o mais
  sazonal (fora de temporada fica vazio). Por isso fica no Bloco 6.

---

## Sugestão de ordem de ataque

1. **Bloco 1** inteiro (devolve a alma + tira os bugs de fundação).
2. **Bloco 2** (puro ganho, sem dependência).
3. **Bloco 3** (o cérebro — modelo de múltiplos termos com o estado atual como âncora).
4. **Bloco 5** (mapa + webcams, dão impacto visual).
5. **Bloco 4** (marca/estático, quando quiser polir — ou já junto do 1.1).
6. **Bloco 6** (pistas, contínuo, conforme a temporada abre).
