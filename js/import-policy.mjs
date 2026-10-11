export const DAY = 24 * 60 * 60 * 1000;
export const MAX_PDF_BYTES = 40 * 1024 * 1024;
export const OFFICIAL_IDS = ["advanced-manual", "floor-rule", "penalty-guideline", "ruling-case"];
export const PRIMARY_TERMS = {
  "advanced-manual": "上級プレイヤー用ルールガイド",
  "floor-rule": "競技向けフロアルール",
  "penalty-guideline": "ペナルティガイドライン",
  "ruling-case": "裁定事例集"
};

export function compactText(text) { return String(text).normalize("NFKC").replace(/\s+/g, ""); }
export async function fingerprint(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export function checkPdfBytes(buffer) {
  if (!buffer.byteLength || buffer.byteLength > MAX_PDF_BYTES) throw new Error("PDFは40MB以内のファイルを選んでください。");
  if (!new TextDecoder("ascii").decode(buffer.slice(0, 1024)).includes("%PDF-")) throw new Error("PDF形式を確認できませんでした。");
}
export function parseEdition(text) {
  const compact = compactText(text);
  const version = compact.match(/(?:Ver\.?|バージョン)(\d+(?:\.\d+)+)/i)?.[1];
  const date = compact.match(/最終更新日[:：]?(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return { version: version ? `Ver.${version}` : "登録PDF", pdfUpdatedAt: date ? `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}` : "" };
}
export function isOlderEdition(next, previous) {
  if (next.pdfUpdatedAt && previous?.pdfUpdatedAt && next.pdfUpdatedAt !== previous.pdfUpdatedAt) return next.pdfUpdatedAt < previous.pdfUpdatedAt;
  const a = next.version?.match(/\d+(?:\.\d+)+/)?.[0].split(".").map(Number);
  const b = previous?.version?.match(/\d+(?:\.\d+)+/)?.[0].split(".").map(Number);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  }
  return false;
}
export function classifyFileName(name) {
  const text = compactText(name).toLowerCase();
  if (!text.endsWith(".pdf")) return null;
  if (/ジャッジ通信|judge[-_ ]?(?:news|newsletter|bulletin)/i.test(text)) return "judge-news";
  if (/advanced[_-]?manual|上級プレイヤー/.test(text)) return "advanced-manual";
  if (/penalty[_-]?guideline|ペナルティガイドライン/.test(text)) return "penalty-guideline";
  if (/ruling[_-]?case|裁定事例集/.test(text)) return "ruling-case";
  if (/floor[_-]?rule|競技向けフロアルール/.test(text)) return "floor-rule";
  return null;
}
export function selectFolderCandidates(files) {
  const official = new Map();
  const newsletters = [];
  for (const file of files) {
    const id = classifyFileName(file.name);
    if (!id) continue;
    if (id === "judge-news") { newsletters.push({ id, file }); continue; }
    const previous = official.get(id);
    if (!previous || file.lastModified > previous.file.lastModified) official.set(id, { id, file });
  }
  return [...official.values(), ...newsletters];
}
export function updateIsDue(settings, now = Date.now()) {
  if (!settings.enabled) return false;
  const last = Date.parse(settings.lastAttempt || "");
  return !Number.isFinite(last) || now - last >= (settings.lastError ? 60 * 60 * 1000 : DAY);
}
export function newsletterDocument(id, title) {
  return { id, title, shortTitle: title, kind: "judge-news", required: false, expectedTerms: ["ジャッジ通信"] };
}
export function validOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://www.pokemon-card.com" && !url.username && !url.password &&
      url.pathname.startsWith("/assets/document/") && url.pathname.endsWith(".pdf");
  } catch { return false; }
}
