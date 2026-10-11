import test from "node:test";
import assert from "node:assert/strict";
import { classifyFileName, selectFolderCandidates, parseEdition, isOlderEdition, updateIsDue, DAY, checkPdfBytes, validOfficialUrl, fingerprint } from "../js/import-policy.mjs";
import { discoverSources, handleRequest, RULES_URL } from "../worker/official-updates.mjs";

const fixture = `<a href="/assets/document/rules/floor-rule_old.pdf">フロアルール</a>
<!-- <a href="/assets/document/rules/floor-rule_OLD.pdf">競技向けフロアルール</a> -->
<a href="/assets/document/advanced_manual.pdf">上級プレイヤー用ルールガイド</a>
<a href="/assets/document/rules/floor-rule_NEW.pdf"><span>競技向けフロアルール</span></a>
<a href="/assets/document/penalty-guideline.pdf">ペナルティガイドライン</a>
<a href="/assets/document/ruling-case1_3.pdf">裁定事例集</a>`;

test("official link discovery follows changed filenames and excludes ordinary rules and commented old editions", () => {
  const sources = discoverSources(fixture);
  assert.equal(sources.length, 4);
  assert.match(sources.find(source => source.id === "floor-rule").url, /NEW.pdf$/);
  assert.match(sources.find(source => source.id === "ruling-case").url, /1_3.pdf$/);
  assert.throws(() => discoverSources(fixture.replace("裁定事例集", "changed")));
  assert.throws(() => discoverSources(fixture + '<a href="/assets/document/other.pdf">裁定事例集</a>'));
  assert.throws(() => discoverSources(fixture.replace("/assets/document/advanced_manual.pdf", "https://evil.example/a.pdf")));
});
test("PDF content identifies the version independently of filename and prevents automatic rollback", () => {
  const edition = parseEdition("ジャッジ Ver. 1.5 最終更新日：2026 年 9 月 4 日");
  assert.deepEqual(edition, { version: "Ver.1.5", pdfUpdatedAt: "2026-09-04" });
  assert.equal(isOlderEdition({ version: "Ver.1.4" }, edition), true);
  assert.equal(isOlderEdition({ version: "Ver.1.10" }, edition), false);
  assert.equal(isOlderEdition({ version: "Ver.2.0", pdfUpdatedAt: "2025-01-01" }, edition), true);
});
test("folder import selects one newest candidate per official document while preserving newsletter issues", () => {
  const files = [
    { name: "ruling-case1_3.pdf", lastModified: 2 }, { name: "ruling-case1_3 (1).pdf", lastModified: 3 },
    { name: "ジャッジ通信10.pdf", lastModified: 1 }, { name: "ジャッジ通信11.pdf", lastModified: 4 },
    { name: "bank-statement.pdf", lastModified: 7 }, { name: "裁定事例集.txt", lastModified: 8 }
  ];
  assert.equal(selectFolderCandidates(files).length, 3);
  assert.equal(selectFolderCandidates(files)[0].file.lastModified, 3);
  assert.equal(classifyFileName("judge_news_12.PDF"), "judge-news");
  assert.equal(classifyFileName("private.pdf"), null);
});
test("daily update checks, retries and opt-out", () => {
  const now = Date.parse("2026-10-11T00:00:00Z");
  assert.equal(updateIsDue({ enabled: false }, now), false);
  assert.equal(updateIsDue({ enabled: true }, now), true);
  assert.equal(updateIsDue({ enabled: true, lastAttempt: new Date(now - DAY + 1).toISOString() }, now), false);
  assert.equal(updateIsDue({ enabled: true, lastError: "offline", lastAttempt: new Date(now - 3600000).toISOString() }, now), true);
});
test("reject HTML downloads and disallowed hosts; use content hashes to deduplicate", async () => {
  const buffer = new TextEncoder().encode("%PDF-1.7 test").buffer;
  checkPdfBytes(buffer);
  assert.throws(() => checkPdfBytes(new TextEncoder().encode("<html>login</html>").buffer));
  assert.equal(validOfficialUrl("https://www.pokemon-card.com/assets/document/a.pdf"), true);
  assert.equal(validOfficialUrl("https://www.pokemon-card.com@evil.example/assets/document/a.pdf"), false);
  assert.equal(validOfficialUrl("https://www.pokemon-card.com/assets/document/../../private/a.pdf"), false);
  assert.equal(await fingerprint(buffer), await fingerprint(buffer.slice(0)));
});
test("relay does not accept uploads, arbitrary URLs or other websites", async () => {
  const never = () => { throw new Error("must not fetch"); };
  for (const [request, status] of [
    [new Request("https://relay/v1/sources", { method: "POST" }), 405],
    [new Request("https://relay/v1/pdf/judge-news"), 404],
    [new Request("https://relay/v1/pdf/floor-rule?url=https://evil.example"), 404],
    [new Request("https://relay/v1/sources", { headers: { origin: "https://evil.example" } }), 403]
  ]) assert.equal((await handleRequest(request, never)).status, status);
});
test("relay returns current links, CORS headers and upstream conditional 304 without stale PDF", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url === RULES_URL) return new Response(fixture);
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers["If-None-Match"], '"edition1"');
    return new Response(null, { status: 304, headers: { etag: '"edition1"' } });
  };
  const response = await handleRequest(new Request("https://relay/v1/pdf/ruling-case", {
    headers: { origin: "https://touchh2lough.github.io", "if-none-match": '"edition1"' }
  }), fetcher);
  assert.equal(response.status, 304);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://touchh2lough.github.io");
  assert.match(response.headers.get("X-Official-Source-URL"), /ruling-case1_3.pdf$/);
  assert.equal(calls.length, 2);
});
test("relay failures do not return non-PDF bytes as a successful update", async () => {
  const response = await handleRequest(new Request("https://relay/v1/pdf/floor-rule"),
    async url => new Response(url === RULES_URL ? fixture : "<html>error</html>"));
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
