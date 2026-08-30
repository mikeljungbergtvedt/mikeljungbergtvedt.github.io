'use strict';

const { CHEFS, clipRationale, numOrNull, normalizeChef } = require('./schema');

const DEFAULT_MODELS = {
  claude: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  grok: process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-4.6',
  gemini: process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-2.5-pro',
};

function anthropicKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').trim();
}
function xaiKey() {
  return String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.GROK || '').trim();
}
function geminiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI || '').trim();
}

function keyFor(chef) {
  if (chef === 'claude') return anthropicKey();
  if (chef === 'grok') return xaiKey();
  if (chef === 'gemini') return geminiKey();
  return '';
}

function chefSystemPrompt() {
  return [
    'Du er bruktbilsjef (chef) for Peasy loop2.',
    'Sett Finn-utpris: prisen en forhandler setter når origin legges på Finn etter klargjøring.',
    'JR har samlet origin-CV og en RAW mappe. Ingen km- eller årskutt er låst.',
    'Du velger selv tvillinger. Ikke bruk ±n km eller ±n år som fast regel.',
    'Skriv aldri ERP. Ikke foreslå send/lagre.',
    'Svar KUN JSON med feltene finn_utpris (tall), rationale (maks 3 linjer), twins (array).',
    'I rationale: kort hvorfor, og hvilke twins du brukte. Ikke bruk feltene finn_pris, at eller why.',
  ].join(' ');
}

function chefUserPrompt(dossier) {
  const d = dossier || {};
  return [
    'Origin-CV:',
    JSON.stringify(d.origin || {}, null, 2),
    '',
    'RAW mappe (ingen twin-regler låst av JR):',
    JSON.stringify(d.listings || {}, null, 2),
    '',
    'Søk-policy:',
    JSON.stringify(d.search || {}, null, 2),
    '',
    'Returner JSON: {"finn_utpris": number, "rationale": "maks 3 linjer", "twins": [{"regnr":"","pris":0,"km":0,"aar":0,"kilde":"","url":""}]}',
  ].join('\n');
}

function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end < 0) return { ok: false, error: 'Ingen JSON i chef-svar', raw: s.slice(0, 400) };
  try {
    return { ok: true, value: JSON.parse(s.slice(start, end + 1)) };
  } catch (e) {
    return { ok: false, error: 'JSON parse: ' + e.message, raw: s.slice(0, 400) };
  }
}

function normalizeChefPayload(parsed) {
  const v = parsed || {};
  const twins = Array.isArray(v.twins) ? v.twins : [];
  return {
    finn_utpris: numOrNull(v.finn_utpris),
    rationale: clipRationale(v.rationale || ''),
    twins,
    n_comps: twins.length,
  };
}

async function httpJson(url, init, timeoutMs) {
  const ms = timeoutMs || 60000;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, Object.assign({}, init, { signal: ac.signal }));
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_e) { json = null; }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(t);
  }
}

async function callClaude(dossier, opts) {
  const key = anthropicKey();
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY mangler' };
  const model = (opts && opts.model) || DEFAULT_MODELS.claude;
  const res = await httpJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: chefSystemPrompt(),
      messages: [{ role: 'user', content: chefUserPrompt(dossier) }],
    }),
  });
  if (!res.ok) return { ok: false, error: 'Anthropic HTTP ' + res.status + ': ' + String(res.text || '').slice(0, 240) };
  const text = (((res.json || {}).content || [])[0] || {}).text || '';
  const parsed = extractJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, payload: normalizeChefPayload(parsed.value), model };
}

async function callGrok(dossier, opts) {
  const key = xaiKey();
  if (!key) return { ok: false, error: 'XAI_API_KEY (eller GROK) mangler' };
  const model = (opts && opts.model) || DEFAULT_MODELS.grok;
  const res = await httpJson('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: chefSystemPrompt() },
        { role: 'user', content: chefUserPrompt(dossier) },
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: 'xAI HTTP ' + res.status + ': ' + String(res.text || '').slice(0, 240) };
  const text = ((((res.json || {}).choices || [])[0] || {}).message || {}).content || '';
  const parsed = extractJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, payload: normalizeChefPayload(parsed.value), model };
}

async function callGemini(dossier, opts) {
  const key = geminiKey();
  if (!key) return { ok: false, error: 'GEMINI_API_KEY (eller GOOGLE_API_KEY) mangler' };
  const model = (opts && opts.model) || DEFAULT_MODELS.gemini;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const res = await httpJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: chefSystemPrompt() }] },
      contents: [{ role: 'user', parts: [{ text: chefUserPrompt(dossier) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
  });
  if (!res.ok) return { ok: false, error: 'Gemini HTTP ' + res.status + ': ' + String(res.text || '').slice(0, 240) };
  const parts = (((((res.json || {}).candidates || [])[0] || {}).content || {}).parts) || [];
  const text = parts.map((p) => p.text || '').join('');
  const parsed = extractJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, payload: normalizeChefPayload(parsed.value), model };
}

const CALLERS = { claude: callClaude, grok: callGrok, gemini: callGemini };

/**
 * Always Claude + Grok 4.6 + Gemini. internnr even/odd must not pick chefs.
 * Cursor Auto-route is not used — each name is its own API call.
 */
async function runAllChefs(dossier, opts) {
  const o = opts || {};
  if (o.pickByInternnr) throw new Error('internnr must not pick chefs');
  const names = CHEFS.slice();
  const out = [];
  for (const name of names) {
    if (!normalizeChef(name)) continue;
    try {
      const fn = CALLERS[name];
      out.push({ evaluator: name, result: await fn(dossier, o) });
    } catch (e) {
      out.push({ evaluator: name, result: { ok: false, error: String(e && e.message || e) } });
    }
  }
  return out;
}

function dryChefResults(reason) {
  const msg = reason || 'dry-run';
  return CHEFS.map((name) => ({
    evaluator: name,
    result: { ok: false, error: msg },
  }));
}

module.exports = {
  CHEFS,
  DEFAULT_MODELS,
  anthropicKey,
  xaiKey,
  geminiKey,
  keyFor,
  chefSystemPrompt,
  chefUserPrompt,
  extractJson,
  normalizeChefPayload,
  callClaude,
  callGrok,
  callGemini,
  runAllChefs,
  dryChefResults,
};
