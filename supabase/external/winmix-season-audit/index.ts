// Install in the external Supabase project as Edge Function "winmix-season-audit" (Verify JWT: off).
// Secrets: WINMIX_ADMIN_TOKEN (same as winmix-ingest), LOVABLE_API_KEY (Lovable AI Gateway key).
// Read-only: never writes to the database, only returns suggestions.
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const MAX_CHARS = 120_000;
const RUN_HEADER = "X-Lovable-AIG-Run-ID";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey, x-admin-token, x-lovable-aig-run-id",
  "Access-Control-Expose-Headers": RUN_HEADER,
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...extra, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function sameToken(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(async (v) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(v)))));
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

function runIdFetch(initial?: string) {
  let runId = initial?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_HEADER)) headers.set(RUN_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_HEADER)?.trim() || undefined;
      return res;
    },
  };
}

const SYSTEM = `You audit football season files for the WinMix app (virtual English "angol" and Spanish "spanyol" leagues).
Team names are VIRTUAL domain entities (e.g. "London Ágyúk", "Vörös Ördögök", "Madrid Fehér"). Never rename them to real-world clubs or "correct" them toward real clubs.
Find malformed or inconsistent match records: missing/non-numeric scores, scores above 20, half-time goals greater than full-time goals, only one half-time value present, same team home and away, a team playing twice in the same round/date, empty or truncated team names, a team name appearing only once that looks like a typo of another name IN THIS FILE, unparseable or impossible dates, duplicated rows, wrong column count.
Answer ONLY with JSON, no prose:
{"summary": string (Hungarian, 1-3 sentences), "rowsChecked": number, "issues": [{"row": number|null, "match": string, "field": string, "severity": "error"|"warning", "problem": string (Hungarian), "suggestion": string (Hungarian, concrete corrected value or action)}]}
At most 100 issues, most severe first. "row" is the 1-based data row number (header excluded) when known.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Csak POST támogatott" }, 405);

  const expected = Deno.env.get("WINMIX_ADMIN_TOKEN");
  if (!expected || expected.length < 16) return json({ error: "A szerveren nincs beállítva admin kód (WINMIX_ADMIN_TOKEN)." }, 500);
  const received = req.headers.get("x-admin-token") ?? "";
  if (!received || received.length > 512 || !(await sameToken(received, expected))) {
    return json({ error: "Érvénytelen vagy hiányzó admin kód." }, 401);
  }
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Az AI kulcs (LOVABLE_API_KEY) nincs beállítva a szerveren." }, 500);

  let body: { fileName?: unknown; content?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Érvénytelen JSON." }, 400); }
  if (typeof body.content !== "string" || !body.content.trim()) return json({ error: "Üres fájl." }, 400);
  if (body.content.length > MAX_CHARS) return json({ error: `A fájl túl nagy (max. ${MAX_CHARS} karakter).` }, 413);
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "season";

  const gw = runIdFetch(req.headers.get(RUN_HEADER) ?? undefined);
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: gw.fetch,
  });

  try {
    let upstreamError: unknown = null;
    const result = streamText({
      model: provider.responses(MODEL),
      system: SYSTEM,
      prompt: `File name: ${fileName}\n\n${body.content}`,
      abortSignal: req.signal,
      onError: ({ error }) => { upstreamError = error; },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = await result.text;
    const extra: Record<string, string> = {};
    const runId = gw.getRunId();
    if (runId) extra[RUN_HEADER] = runId;
    if (upstreamError) throw upstreamError;
    if (!text.trim()) return json({ error: "Az AI nem adott választ erre a fájlra." }, 502, extra);

    let parsed: { summary?: unknown; rowsChecked?: unknown; issues?: unknown };
    try { parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
    catch { return json({ error: "Az AI válasza nem volt értelmezhető." }, 502, extra); }
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .slice(0, 100)
      .map((i) => ({
        row: typeof i.row === "number" ? i.row : null,
        match: String(i.match ?? ""),
        field: String(i.field ?? ""),
        severity: i.severity === "error" ? "error" : "warning",
        problem: String(i.problem ?? ""),
        suggestion: String(i.suggestion ?? ""),
      }));
    return json({
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      rowsChecked: typeof parsed.rowsChecked === "number" ? parsed.rowsChecked : null,
      issues,
    }, 200, extra);
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: cors });
    const status = (error as { statusCode?: number })?.statusCode;
    console.error(JSON.stringify({ stage: "ai", status, message: error instanceof Error ? error.message : String(error) }));
    if (status === 401) return json({ error: "Az AI kulcs érvénytelen." }, 500);
    if (status === 402) return json({ error: "Elfogyott az AI keret; kreditet a munkaterület beállításaiban lehet hozzáadni." }, 402);
    if (status === 403) return json({ error: "Az AI kérést a szolgáltató elutasította." }, 403);
    if (status === 429) return json({ error: "Túl sok kérés, várj egy kicsit és próbáld újra." }, 429);
    return json({ error: "Az AI elemzés nem sikerült." }, 502);
  }
});
