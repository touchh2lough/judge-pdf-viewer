import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const packages = process.argv[process.argv.indexOf("--node-modules") + 1];
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(packages, "playwright"));
const { PDFDocument, StandardFonts } = require(path.join(packages, "pdf-lib"));
const pdfs = {
  "advanced-manual": ["advanced_manual.pdf", "上級プレイヤー用ルールガイド"],
  "floor-rule": ["floor-rule_20260130.pdf", "競技向けフロアルール"],
  "penalty-guideline": ["penalty-guideline.pdf", "ペナルティガイドライン"],
  "ruling-case": ["ruling-case1_3.pdf", "裁定事例集"]
};
const sources = Object.entries(pdfs).map(([id, [name, title]]) => ({
  id, title, url: `https://www.pokemon-card.com/assets/document/${id === "floor-rule" ? "rules/" : ""}${name}`
}));
let failUpdates = false;
let pdfRequests = 0;
let nonGetRequests = 0;
const server = http.createServer(async (request, response) => {
  if (request.method !== "GET") nonGetRequests++;
  try {
    const url = new URL(request.url, "http://127.0.0.1:8793");
    const mime = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json" };
    if (url.pathname === "/js/update-config.mjs") {
      response.setHeader("content-type", "text/javascript");
      response.end('export const UPDATE_API_BASE = "http://127.0.0.1:8793/relay";');
      return;
    }
    if (url.pathname.startsWith("/relay")) {
      response.setHeader("cache-control", "no-store");
      if (failUpdates) { response.writeHead(502); response.end("upstream failed"); return; }
      if (url.pathname === "/relay/v1/sources") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ sources })); return;
      }
      const id = url.pathname.split("/").pop();
      if (!pdfs[id]) { response.writeHead(404); response.end(); return; }
      pdfRequests++;
      response.setHeader("etag", `"${id}-edition"`);
      response.setHeader("X-Official-Source-URL", sources.find(item => item.id === id).url);
      if (request.headers["if-none-match"] === `"${id}-edition"`) { response.writeHead(304); response.end(); return; }
      response.setHeader("content-type", "application/pdf");
      response.end(await fs.readFile(path.join(root, "tests/fixtures", pdfs[id][0])));
      return;
    }
    const target = path.resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!target.startsWith(root)) { response.writeHead(403); response.end(); return; }
    response.setHeader("content-type", mime[path.extname(target)] || "application/octet-stream");
    response.end(await fs.readFile(target));
  } catch (error) { response.writeHead(404); response.end(error.message); }
});
await fs.mkdir(path.join(root, ".artifacts"), { recursive: true });
await new Promise(resolve => server.listen(8793, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
async function metadata() {
  return page.evaluate(async () => { const { PdfLibrary } = await import("/js/pdf-library.mjs"); return new PdfLibrary().listDocuments(); });
}
async function waitDocuments(count) {
  await page.waitForFunction(async count => { const { PdfLibrary } = await import("/js/pdf-library.mjs"); return (await new PdfLibrary().listDocuments()).length === count; }, count, { timeout: 120000 });
}
async function newsletter(text) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText(text, { x: 40, y: 700, font, size: 14 });
  return Buffer.from(await pdf.save());
}
try {
  await page.goto("http://127.0.0.1:8793/");
  await waitDocuments(4);
  await page.locator("[data-official-status]").filter({ hasText: "最終確認" }).waitFor({ timeout: 120000 });
  let docs = await metadata();
  assert.equal(docs.find(item => item.documentId === "ruling-case").version, "Ver.1.5");
  assert.equal(docs.find(item => item.documentId === "penalty-guideline").version, "Ver.1.3");
  console.log("PASS automatic import of four real official PDFs; content-based edition detection");
  const firstHash = docs.find(item => item.documentId === "ruling-case").hash;
  await page.locator("[data-sync-official]").click();
  await page.waitForFunction(() => !document.querySelector("[data-sync-official]").disabled);
  assert.match(await page.locator("[data-official-status]").innerText(), /4資料は変更なし/);
  console.log("PASS conditional updates and no duplicate official registration");
  failUpdates = true;
  await page.locator("[data-sync-official]").click();
  await page.waitForFunction(() => !document.querySelector("[data-sync-official]").disabled);
  assert.equal((await metadata()).find(item => item.documentId === "ruling-case").hash, firstHash);
  assert.match(await page.locator("[data-official-status]").innerText(), /登録済みPDFを維持/);
  failUpdates = false;
  console.log("PASS failed update preserves previous PDF and index");
  const first = await newsletter("NEWSLETTER 10 - SHUFFLE handling");
  const second = await newsletter("NEWSLETTER 11 - SHUFFLE guidance");
  await page.locator("[data-news-files]").setInputFiles([
    { name: "judge_news_10.pdf", mimeType: "application/pdf", buffer: first },
    { name: "judge_news_11.pdf", mimeType: "application/pdf", buffer: second }
  ]);
  await waitDocuments(6);
  await page.waitForFunction(() => !document.querySelector("[data-news-files]").disabled);
  await page.locator("[data-news-files]").setInputFiles({ name: "renamed.pdf", mimeType: "application/pdf", buffer: first });
  await page.waitForFunction(() => document.querySelector("[data-news-status]").textContent.includes("1件は登録済み"));
  assert.equal((await metadata()).length, 6);
  console.log("PASS multiple newsletter issues, content deduplication even after rename");
  await page.reload();
  await page.locator("[data-news-files]").waitFor({ state: "attached" });
  await page.locator("#search-input").fill("SHUFFLE");
  await page.locator('[data-filter-chip="judge-news"]').click();
  await page.locator("#search-button").click();
  assert.equal(await page.locator("#results .result-card").count(), 2);
  await page.locator("#results [data-show-source]").first().click();
  await page.waitForFunction(() => document.querySelector("#viewer-page-label").textContent.includes("1"));
  console.log("PASS restart, newsletter filter search and PDF render");
  await page.locator("#close-pdf").click();
  // Browser-native directory handles can be stored and reopened without reading the OS downloads folder.
  await page.evaluate(async () => {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle("smoke-import", { create: true });
    const response = await fetch("/relay/v1/pdf/ruling-case");
    const file = await directory.getFileHandle("ruling-case1_3.pdf", { create: true });
    const writer = await file.createWritable(); await writer.write(await response.blob()); await writer.close();
    window.showDirectoryPicker = async () => directory;
  });
  await page.locator("#library-tools summary").click();
  await page.locator("[data-choose-folder]").click();
  await page.waitForFunction(() => !document.querySelector("[data-choose-folder]").disabled);
  assert.match(await page.locator("[data-folder-status]").innerText(), /1件は登録済み/);
  await page.locator("[data-forget-folder]").click();
  await page.waitForFunction(() => document.querySelector("[data-forget-folder]").disabled);
  assert.equal((await metadata()).length, 6);
  console.log("PASS stored folder handle, duplicate detection and disconnect preserving PDFs");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, ".artifacts/mobile.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  console.log("PASS mobile layout without horizontal overflow");
  await page.locator("#prepare-offline").click();
  await page.waitForFunction(() => document.querySelector("#offline-status").textContent === "保存済み", { timeout: 60000 });
  await context.setOffline(true);
  await page.reload();
  await page.locator("[data-news-files]").waitFor({ state: "attached" });
  await page.locator("#search-input").fill("SHUFFLE");
  await page.locator('[data-filter-chip="judge-news"]').click();
  await page.locator("#search-button").click();
  assert.equal(await page.locator("#results .result-card").count(), 2);
  console.log("PASS offline restart and newsletter search");
  await context.setOffline(false);
  const rollback = await page.evaluate(async () => {
    const { PdfLibrary } = await import("/js/pdf-library.mjs");
    const db = new PdfLibrary();
    const before = await db.getPdf("ruling-case");
    const metadata = (await db.listDocuments()).find(doc => doc.documentId === "ruling-case");
    let failed = false;
    try { await db.putDocument({ ...before, buffer: new ArrayBuffer(1) }, { ...metadata, invalidClone: () => {} }, []); }
    catch { failed = true; }
    return { failed, sizeBefore: before.buffer.byteLength, sizeAfter: (await db.getPdf("ruling-case")).buffer.byteLength,
      pages: (await db.getIndex("ruling-case")).pages.length };
  });
  assert.equal(rollback.failed, true);
  assert.equal(rollback.sizeBefore, rollback.sizeAfter);
  assert.equal(rollback.pages, 17);
  console.log("PASS failed IndexedDB replacement rolls back PDF, metadata and search index together");
  const legacyContext = await browser.newContext();
  const legacyPage = await legacyContext.newPage();
  await legacyPage.route("**/js/update-config.mjs", route => route.fulfill({ contentType: "text/javascript", body: 'export const UPDATE_API_BASE = "";' }));
  await legacyPage.goto("http://127.0.0.1:8793/not-found-seed.html");
  await legacyPage.evaluate(async bytes => {
    const buffer = new Uint8Array(bytes).buffer;
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("judgePdfStore", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("pdfs", { keyPath: "documentId" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction(["pdfs"], "readwrite");
        tx.objectStore("pdfs").put({ documentId: "advanced-manual", buffer, name: "legacy.pdf", type: "application/pdf" });
        tx.oncomplete = () => { request.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem("judgePdfRegistrations:v1", JSON.stringify({ "advanced-manual": {
      documentId: "advanced-manual", fileName: "legacy.pdf", pageCount: 1, version: "legacy", registeredAt: new Date().toISOString()
    } }));
    localStorage.setItem("judgeSourceIndex:v1", JSON.stringify([{ documentId: "advanced-manual", documentTitle: "Legacy", version: "legacy", page: 1, text: "LEGACY SHUFFLE", sourceFile: "legacy.pdf" }]));
  }, Array.from(first));
  await legacyPage.goto("http://127.0.0.1:8793/");
  await legacyPage.locator("[data-news-files]").waitFor({ state: "attached" });
  await legacyPage.locator("#search-input").fill("SHUFFLE");
  await legacyPage.locator("#search-button").click();
  assert.equal(await legacyPage.locator("#results .result-card").count(), 1);
  assert.equal(await legacyPage.evaluate(() => localStorage.getItem("judgeSourceIndex:v1")), null);
  await legacyPage.reload();
  await legacyPage.locator("[data-news-files]").waitFor({ state: "attached" });
  assert.match(await legacyPage.locator("[data-library-count]").innerText(), /^1資料/);
  await legacyContext.close();
  console.log("PASS migration from original PDF store and localStorage index, including restart");
  assert.equal(nonGetRequests, 0, "PDFs must never be uploaded");
  assert.deepEqual(errors, [], "Unexpected browser exception");
  console.log(`PASS no uploads or browser errors; ${pdfRequests} PDF GET requests`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
