// Bloco 6 — live trail/lift status, one registry of 5 official-site scrapers.
//
// Endpoint:  GET /api/snow-report?resort=<id>
// Each adapter scrapes the resort's official HTML (no headless browser) through a
// shared DOM tokenizer + helpers and returns the SAME SnowReport shape. Everything
// is fail-soft: a site that is down, reskinned, or out of season yields
// `stale: true` instead of throwing. Edge cache keeps official sites hit ≤1×/hour.

import { parse, type HTMLElement } from "node-html-parser";
import type { SnowReport, Difficulty, DifficultyTally } from "../src/data/snowReport";

// Minimal Vercel-style req/res typing so we don't depend on @vercel/node.
interface Req { query: Record<string, string | string[] | undefined> }
interface Res {
  setHeader(k: string, v: string): void;
  status(code: number): Res;
  json(body: unknown): void;
}

// ── shared fetch ────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (compatible; PowderWindowBot/1.0; +https://newppowder.vercel.app)";

async function fetchHtml(url: string, timeoutMs = 8000): Promise<HTMLElement> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html" },
    });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return parse(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

// ── shared DOM tokenizer ─────────────────────────────────────────────────────────
// A flat, document-order stream of the only things these scrapers care about:
// images (by src), text runs, and headings. Adapters pair an icon with the text or
// icon that follows it — robust to wrapper-markup changes.

type TokenKind = "img" | "text" | "heading";
interface Token { kind: TokenKind; value: string }

function tokenize(root: HTMLElement): Token[] {
  const out: Token[] = [];
  const walk = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      const el = child as unknown as HTMLElement;
      const tag = (el.tagName || "").toUpperCase();
      if (el.nodeType === 3) {
        const t = (el.text || "").replace(/\s+/g, " ").trim();
        if (t) out.push({ kind: "text", value: t });
      } else if (tag === "IMG") {
        out.push({ kind: "img", value: el.getAttribute("src") || "" });
      } else if (/^H[1-6]$/.test(tag)) {
        const t = (el.text || "").replace(/\s+/g, " ").trim();
        if (t) out.push({ kind: "heading", value: t });
      } else if (el.childNodes && el.childNodes.length) {
        walk(el);
      }
    }
  };
  walk(root);
  return out;
}

// ── small helpers ─────────────────────────────────────────────────────────────

const fileName = (src: string): string =>
  (src.split("?")[0].split("#")[0].split("/").pop() || "").toLowerCase();

const intIn = (s: string): number | null => {
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
};

function emptyReport(resortId: string, source: string): SnowReport {
  return {
    resortId, liftsOpen: null, liftsTotal: null, runsOpen: null, runsTotal: null,
    runsByDifficulty: null, baseDepthCm: null,
    updatedAt: new Date().toISOString(), source, stale: false,
  };
}

function addRun(by: Partial<Record<Difficulty, DifficultyTally>>, d: Difficulty, open: boolean) {
  const t = (by[d] ??= { open: 0, total: 0 });
  t.total++;
  if (open) t.open++;
}

const sumOpen = (by: Partial<Record<Difficulty, DifficultyTally>>) =>
  Object.values(by).reduce((s, t) => s + (t?.open ?? 0), 0);
const sumTotal = (by: Partial<Record<Difficulty, DifficultyTally>>) =>
  Object.values(by).reduce((s, t) => s + (t?.total ?? 0), 0);

/**
 * Final pass shared by every adapter: an open resort with zero open lifts AND zero
 * open runs is out of season, not an error — flag it stale so the UI shows the soft
 * "fora de temporada" state instead of a misleading "0/N".
 */
function finalize(r: SnowReport): SnowReport {
  const liftsZero = (r.liftsOpen ?? 0) === 0;
  const runsZero = (r.runsOpen ?? 0) === 0;
  const noneOpen = liftsZero && runsZero;
  if (noneOpen) r.stale = true;
  return r;
}

// ═══════════════════════════ ADAPTERS ═══════════════════════════════════════════

// ① Valle Nevado — https://www.vallenevado.com/pt/trilhos/
const VALLE_URL = "https://www.vallenevado.com/pt/trilhos/";
// TODO: confirm the SOFTLINE status map against a live in-season page. Provisional:
//   124 = fechado; 155 / 156 / 158 = aberto/agendado.
const VALLE_LIFT_OPEN = new Set([155, 156, 158]);
const VALLE_LIFT_CLOSED = new Set([124]);
const VALLE_DIFF: Record<string, Difficulty> = {
  beginner: "beginner", intermediate: "intermediate", advanced: "advanced",
  expert: "expert", freeride: "freeride",
};

async function valleNevado(): Promise<SnowReport> {
  const r = emptyReport("valle-nevado", VALLE_URL);
  const tokens = tokenize(await fetchHtml(VALLE_URL));

  // Lifts: SOFTLINE-NNN.png status icons.
  let liftsOpen = 0, liftsTotal = 0;
  for (const t of tokens) {
    if (t.kind !== "img") continue;
    const f = fileName(t.value);
    const m = f.match(/softline-(\d+)\.png/);
    if (!m) continue;
    const code = parseInt(m[1], 10);
    if (VALLE_LIFT_OPEN.has(code) || VALLE_LIFT_CLOSED.has(code)) {
      liftsTotal++;
      if (VALLE_LIFT_OPEN.has(code)) liftsOpen++;
    }
  }

  // Runs: icon-{difficulty}.svg followed by a status word.
  const by: Partial<Record<Difficulty, DifficultyTally>> = {};
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "img") continue;
    const m = fileName(tokens[i].value).match(/icon-(beginner|intermediate|advanced|expert|freeride)\.svg/);
    if (!m) continue;
    const diff = VALLE_DIFF[m[1]];
    // status = the next text token within a short lookahead
    let status = "";
    for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
      if (tokens[j].kind === "text" && /fresado|fechado|aberto/i.test(tokens[j].value)) {
        status = tokens[j].value.toLowerCase(); break;
      }
    }
    const open = status !== "" && !/fechado/.test(status); // Fresado / Não Fresado / Aberto = open
    addRun(by, diff, open);
  }

  if (liftsTotal > 0) { r.liftsOpen = liftsOpen; r.liftsTotal = liftsTotal; }
  if (sumTotal(by) > 0) {
    r.runsByDifficulty = by; r.runsOpen = sumOpen(by); r.runsTotal = sumTotal(by);
  }
  if (liftsTotal === 0 && sumTotal(by) === 0) r.stale = true;
  return finalize(r);
}

// ② Cerro Castor — https://www.cerrocastor.com/pt/estado-pistas-medios.html
const CASTOR_URL = "https://www.cerrocastor.com/pt/estado-pistas-medios.html";
const CASTOR_DIFF: Record<number, Difficulty> = {
  1: "beginner", 2: "intermediate", 3: "link", 4: "advanced", 5: "expert",
};

async function cerroCastor(): Promise<SnowReport> {
  const r = emptyReport("cerro-castor", CASTOR_URL);
  const root = await fetchHtml(CASTOR_URL);
  const tokens = tokenize(root);

  // Runs: pair each dificultad icon with the next estado icon.
  const by: Partial<Record<Difficulty, DifficultyTally>> = {};
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "img") continue;
    const dm = fileName(tokens[i].value).match(/ico_pista_dificultad_(\d)\.png/);
    if (!dm) continue;
    const diff = CASTOR_DIFF[parseInt(dm[1], 10)];
    if (!diff) continue;
    let estado: number | null = null;
    for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
      const em = tokens[j].kind === "img" && fileName(tokens[j].value).match(/ico_pista_estado_(\d)\.png/);
      if (em) { estado = parseInt(em[1], 10); break; }
    }
    addRun(by, diff, estado === 1 || estado === 2); // 1=open, 2=partial → open
  }

  // Lifts: ico_instalacion_estado_N.png → open = 1,2,3 (closed = 4).
  let liftsOpen = 0, liftsTotal = 0;
  for (const t of tokens) {
    if (t.kind !== "img") continue;
    const m = fileName(t.value).match(/ico_instalacion_estado_(\d)\.png/);
    if (!m) continue;
    liftsTotal++;
    if ([1, 2, 3].includes(parseInt(m[1], 10))) liftsOpen++;
  }

  // Snow: prefer the CIMEIRA "Espesor: N cm" sensor.
  const fullText = root.text.replace(/\s+/g, " ");
  const cimeira = fullText.match(/CIMEIRA[\s\S]{0,60}?Espesor[:\s]*(\d+)\s*cm/i)
    ?? fullText.match(/Espesor[:\s]*(\d+)\s*cm/i);
  if (cimeira) r.baseDepthCm = parseInt(cimeira[1], 10);

  if (liftsTotal > 0) { r.liftsOpen = liftsOpen; r.liftsTotal = liftsTotal; }
  if (sumTotal(by) > 0) {
    r.runsByDifficulty = by; r.runsOpen = sumOpen(by); r.runsTotal = sumTotal(by);
  }
  if (liftsTotal === 0 && sumTotal(by) === 0) r.stale = true;
  return finalize(r);
}

// ③ Portillo — https://skiportillo.com/pt/mountain/clima-e-condicoes/
const PORTILLO_URL = "https://skiportillo.com/pt/mountain/clima-e-condicoes/";
const PORTILLO_LIFTS = [
  "Cóndor", "Conejo", "Cumbre", "El Puma", "Corralito", "Juncalillo", "La Laguna",
  "La Princesa", "Las Lomas", "Los Canarios", "Plateau", "Roca Jack", "Vizcachas", "Caracara",
];
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

async function portillo(): Promise<SnowReport> {
  const r = emptyReport("portillo", PORTILLO_URL);
  const root = await fetchHtml(PORTILLO_URL);
  const fullText = root.text.replace(/\s+/g, " ");
  const nt = norm(fullText);

  // Lifts: for each known name, read the nearest Abierto/Cerrado after it.
  let liftsOpen = 0, liftsTotal = 0;
  for (const name of PORTILLO_LIFTS) {
    const idx = nt.indexOf(norm(name));
    if (idx < 0) continue;
    liftsTotal++;
    const after = nt.slice(idx, idx + name.length + 40);
    if (/\babierto\b/.test(after) && !/\bcerrado\b/.test(after)) liftsOpen++;
  }
  if (liftsTotal > 0) { r.liftsOpen = liftsOpen; r.liftsTotal = liftsTotal; }

  // Snow: "Nieve base actual Hotel" (cm).
  const base = nt.match(/nieve base actual hotel[^\d]{0,20}(\d+)/);
  if (base) r.baseDepthCm = parseInt(base[1], 10);

  // Portillo doesn't publish per-run status → leave runs null.
  if (liftsTotal === 0) r.stale = true;
  return finalize(r);
}

// ④ Las Leñas — two pages: runs + lifts. Fail-soft per page.
const LENAS_RUNS_URL = "https://laslenas.com/estado-pistas/";
const LENAS_LIFTS_URL = "https://laslenas.com/estado-pistas/medios/";
const LENAS_DIFF: Record<string, Difficulty> = {
  facil: "beginner", media: "intermediate", dificil: "advanced", avanzado: "expert",
};
const isOpenSvg = (f: string) => /estado_abierta\.svg/.test(f) || /caution\.png/.test(f);
const isClosedSvg = (f: string) => /estado_cerrada\.svg/.test(f);

async function lasLenas(): Promise<SnowReport> {
  const r = emptyReport("las-lenas", LENAS_RUNS_URL);
  let gotAny = false;

  // Runs page
  try {
    const tokens = tokenize(await fetchHtml(LENAS_RUNS_URL));
    const by: Partial<Record<Difficulty, DifficultyTally>> = {};
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].kind !== "img") continue;
      const dm = fileName(tokens[i].value).match(/estado_(facil|media|dificil|avanzado)\.svg/);
      if (!dm) continue;
      const diff = LENAS_DIFF[dm[1]];
      let open: boolean | null = null;
      for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
        if (tokens[j].kind !== "img") continue;
        const f = fileName(tokens[j].value);
        if (isOpenSvg(f)) { open = true; break; }
        if (isClosedSvg(f)) { open = false; break; }
      }
      if (open !== null) addRun(by, diff, open);
    }
    if (sumTotal(by) > 0) {
      r.runsByDifficulty = by; r.runsOpen = sumOpen(by); r.runsTotal = sumTotal(by);
      gotAny = true;
    }
  } catch { /* fail soft for this page */ }

  // Lifts page
  try {
    const tokens = tokenize(await fetchHtml(LENAS_LIFTS_URL));
    let liftsOpen = 0, liftsTotal = 0;
    for (const t of tokens) {
      if (t.kind !== "img") continue;
      const f = fileName(t.value);
      if (isOpenSvg(f)) { liftsTotal++; liftsOpen++; }
      else if (isClosedSvg(f)) { liftsTotal++; }
    }
    if (liftsTotal > 0) { r.liftsOpen = liftsOpen; r.liftsTotal = liftsTotal; gotAny = true; }
  } catch { /* fail soft for this page */ }

  if (!gotAny) r.stale = true;
  return finalize(r);
}

// ⑤ Nevados de Chillán — https://www.nevadosdechillan.com/reporte-montana
const CHILLAN_URL = "https://www.nevadosdechillan.com/reporte-montana";
const CHILLAN_DIFF: Record<string, Difficulty> = {
  principiante: "beginner", intermedio: "intermediate", avanzado: "advanced", experto: "expert",
};
const CHILLAN_LIFTS = ["Refugio", "Tata"];

async function nevadosChillan(): Promise<SnowReport> {
  const r = emptyReport("nevados-chillan", CHILLAN_URL);
  const root = await fetchHtml(CHILLAN_URL);
  const fullText = root.text.replace(/\s+/g, " ");
  const nt = norm(fullText);

  // Runs: count by difficulty keyword paired with the nearest Abierta/Cerrada.
  const by: Partial<Record<Difficulty, DifficultyTally>> = {};
  const diffRe = /(principiante|intermedio|avanzado|experto)/g;
  let m: RegExpExecArray | null;
  while ((m = diffRe.exec(nt)) !== null) {
    const diff = CHILLAN_DIFF[m[1]];
    const after = nt.slice(m.index, m.index + 60);
    if (/\babierta\b/.test(after)) addRun(by, diff, true);
    else if (/\bcerrada\b/.test(after)) addRun(by, diff, false);
  }
  if (sumTotal(by) > 0) {
    r.runsByDifficulty = by; r.runsOpen = sumOpen(by); r.runsTotal = sumTotal(by);
  }

  // Lifts: the two named chairs (Refugio, Tata) read Abierto/Cerrado.
  let liftsOpen = 0;
  for (const name of CHILLAN_LIFTS) {
    const idx = nt.indexOf(norm(name));
    if (idx >= 0) {
      const after = nt.slice(idx, idx + name.length + 40);
      if (/\babierto\b/.test(after) && !/\bcerrado\b/.test(after)) liftsOpen++;
    }
  }
  r.liftsOpen = liftsOpen; r.liftsTotal = CHILLAN_LIFTS.length;

  // Prefer the table count, but cross-check the header "Pistas abiertas: N".
  const headerRuns = nt.match(/pistas abiertas[:\s]*(\d+)/);
  if (r.runsOpen == null && headerRuns) r.runsOpen = parseInt(headerRuns[1], 10);

  // Resort-provided freshness timestamp.
  const ts = fullText.match(/Últ\.?\s*actualizaci[oó]n[:\s]*([0-9/.\-: hms]+)/i);
  if (ts) r.updatedAt = ts[1].trim();

  if ((r.runsOpen ?? 0) === 0 && liftsOpen === 0) r.stale = true;
  return finalize(r);
}

// ═══════════════════════════ REGISTRY ════════════════════════════════════════════

const REGISTRY: Record<string, () => Promise<SnowReport>> = {
  "valle-nevado": valleNevado,
  "cerro-castor": cerroCastor,
  "portillo": portillo,
  "las-lenas": lasLenas,
  "nevados-chillan": nevadosChillan,
};

export const RESORT_IDS = Object.keys(REGISTRY);

const SOURCE: Record<string, string> = {
  "valle-nevado": VALLE_URL, "cerro-castor": CASTOR_URL, "portillo": PORTILLO_URL,
  "las-lenas": LENAS_RUNS_URL, "nevados-chillan": CHILLAN_URL,
};

/** Run one adapter with a hard fail-soft wrapper. Always resolves a SnowReport. */
export async function getSnowReport(resortId: string): Promise<SnowReport | null> {
  const adapter = REGISTRY[resortId];
  if (!adapter) return null;
  try {
    return await adapter();
  } catch {
    const r = emptyReport(resortId, SOURCE[resortId] ?? "");
    r.stale = true; // site down / layout changed / off-season — never throw
    return r;
  }
}

// ═══════════════════════════ HANDLER ═════════════════════════════════════════════

export default async function handler(req: Req, res: Res) {
  const q = req.query.resort;
  const resortId = Array.isArray(q) ? q[0] : q;

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  if (!resortId || !REGISTRY[resortId]) {
    res.status(400).json({ error: "unknown resort", validIds: RESORT_IDS });
    return;
  }

  const report = await getSnowReport(resortId);
  res.status(200).json(report);
}
