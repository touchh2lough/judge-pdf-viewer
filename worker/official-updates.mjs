// This endpoint only reads the four public PDFs linked on the official rules page.
// It accepts no uploads, credentials or arbitrary target URLs.
import { MAX_PDF_BYTES, OFFICIAL_IDS, checkPdfBytes, validOfficialUrl } from "../js/import-policy.mjs";

export const RULES_URL = "https://www.pokemon-card.com/rules/";
const LABELS = {
  "advanced-manual": "上級プレイヤー用ルールガイド",
  "floor-rule": "競技向けフロアルール",
  "penalty-guideline": "ペナルティガイドライン",
  "ruling-case": "裁定事例集"
};
const ALLOWED_ORIGINS = new Set(["https://touchh2lough.github.io", "http://localhost:8793", "http://127.0.0.1:8793"]);

export function discoverSources(html) {
  // Ignore commented-out previous versions; reject duplicates rather than picking an old link.
  const sources = new Map();
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = match[2].replace(/<[^>]*>/g, "").replace(/\s|&nbsp;/g, "");
    const id = OFFICIAL_IDS.find(id => label === LABELS[id]);
    if (!id) continue;
    const url = new URL(match[1].replace(/&amp;/g, "&"), RULES_URL).href;
    if (!validOfficialUrl(url)) throw new Error("公式PDFのリンク形式が変わりました。");
    if (sources.has(id) && sources.get(id).url !== url) throw new Error("公式PDFのリンクを一意に確認できませんでした。");
    sources.set(id, { id, title: LABELS[id], url });
  }
  if (sources.size !== OFFICIAL_IDS.length) throw new Error("公式ページのPDFリンクを確認できませんでした。");
  return OFFICIAL_IDS.map(id => sources.get(id));
}

async function readLimited(response, limit) {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("取得ファイルが大きすぎます。");
  if (!response.body) throw new Error("取得データが空です。");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new Error("取得ファイルが大きすぎます。"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function getOfficial(url, fetcher, headers = {}) {
  const response = await fetcher(url, {
    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { "User-Agent": "JudgePdfViewer/2 (public-rule-document-updates)", ...headers }
  });
  if (!response.ok && response.status !== 304) throw new Error(`公式サイトの取得に失敗しました (${response.status})。`);
  return response;
}

export async function handleRequest(request, fetcher = fetch) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });
  const headers = new Headers({
    "Cache-Control": "no-store", "Vary": "Origin", "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "If-None-Match",
    "Access-Control-Expose-Headers": "ETag, X-Official-Source-URL"
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers });
  if (url.pathname === "/health") return Response.json({ ok: true, service: "judge-pdf-updates" }, { headers });
  const pdfId = url.pathname.match(/^\/v1\/pdf\/([a-z-]+)$/)?.[1];
  if (url.search || (url.pathname !== "/v1/sources" && !OFFICIAL_IDS.includes(pdfId))) return new Response("Not found", { status: 404, headers });
  try {
    const page = await getOfficial(RULES_URL, fetcher);
    const html = new TextDecoder().decode(await readLimited(page, 2 * 1024 * 1024));
    const sources = discoverSources(html);
    if (!pdfId) return Response.json({ checkedAt: new Date().toISOString(), sources }, { headers });
    const source = sources.find(item => item.id === pdfId);
    // Only reuse a validator when the browser supplies the current source via its manifest check.
    const etag = request.headers.get("if-none-match");
    const upstream = await getOfficial(source.url, fetcher, etag ? { "If-None-Match": etag } : {});
    headers.set("X-Official-Source-URL", source.url);
    if (upstream.headers.has("etag")) headers.set("ETag", upstream.headers.get("etag"));
    if (upstream.status === 304) return new Response(null, { status: 304, headers });
    const bytes = await readLimited(upstream, MAX_PDF_BYTES);
    checkPdfBytes(bytes.buffer);
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Length", String(bytes.length));
    return new Response(bytes, { headers });
  } catch (error) {
    return Response.json({ error: error.message || "公式PDFを取得できませんでした。" }, { status: 502, headers });
  }
}

export default { fetch: request => handleRequest(request) };
