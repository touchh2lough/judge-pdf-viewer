import * as pdfjsLib from "../vendor/pdfjs/pdf.min.mjs";
import { PdfLibrary } from "./pdf-library.mjs";
import { checkPdfBytes, fingerprint, compactText, PRIMARY_TERMS, parseEdition, isOlderEdition, newsletterDocument, MAX_PDF_BYTES } from "./import-policy.mjs";
import { initLibraryTools } from "./sync-controller.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).toString();

const documents = window.JUDGE_DOCUMENTS;
const filters = window.JUDGE_FILTERS;
const shortcuts = window.JUDGE_SHORTCUTS;
let classificationGroups = {
  playErrors: [
    {
      id: "play-error-1-1",
      number: "1-1",
      title: "余分なカードを見た",
      query: "余分なカードを見た",
      description: "山札・サイド・手札など、本来見るべきでないカードを見た可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-2",
      number: "1-2",
      title: "余分なカードを手札に加えた",
      query: "余分なカードを手札に加えた",
      description: "本来加える枚数より多くカードを手札に加えた、または加えたカードが混ざった可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-3",
      number: "1-3",
      title: "非公開のカードを混ぜてしまった",
      query: "非公開のカードを混ぜてしまった",
      description: "非公開領域のカードが混ざり、どのカードか区別できない可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-4",
      number: "1-4",
      title: "本来できない行動",
      query: "本来できない行動",
      description: "ルール上できない行動を行った可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-5",
      number: "1-5",
      title: "処理忘れ",
      query: "処理忘れ",
      description: "本来行うべき処理を忘れた、または処理順に不備があった可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-6",
      number: "1-6",
      title: "ダメージの誤り",
      query: "ダメージの誤り",
      description: "ダメージ計算、ダメカン、HPに関する処理に誤りがあった可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-7",
      number: "1-7",
      title: "対戦準備の誤り",
      query: "対戦準備の誤り",
      description: "対戦開始前の準備、サイド、手札、先攻後攻などに誤りがあった可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-8",
      number: "1-8",
      title: "不十分なシャッフル",
      query: "不十分なシャッフル",
      description: "山札が十分に無作為化されていない可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-9",
      number: "1-9",
      title: "カードを落とした",
      query: "カードを落とした",
      description: "カードを落とした、見えてしまった、状態が変わった可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-10",
      number: "1-10",
      title: "遅いプレイ",
      query: "遅いプレイ",
      description: "プレイ速度や判断時間が適切か確認したい場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "play-error-1-11",
      number: "1-11",
      title: "対戦相手のプレイエラーの見逃し",
      query: "対戦相手のプレイエラーの見逃し",
      description: "対戦相手の誤りに気づけたか、見逃しに関係する状況を確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    }
  ],
  eventErrors: [
    {
      id: "event-error-2-1",
      number: "2-1",
      title: "区別がつくカード / デッキシールド",
      query: "区別がつくカード デッキシールド",
      description: "カードやデッキシールドの状態によって区別がつく可能性がある場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "event-error-2-2",
      number: "2-2",
      title: "デッキ / デッキリストの問題",
      query: "デッキ デッキリスト",
      description: "デッキ内容やデッキリストに関する不備を確認する項目です。",
      targetDocuments: ["penalty-guideline", "ruling-case"]
    },
    {
      id: "event-error-2-3",
      number: "2-3",
      title: "遅刻",
      query: "遅刻",
      description: "対戦開始や集合に遅れた場合の資料箇所を確認する項目です。",
      targetDocuments: ["penalty-guideline", "floor-rule"]
    },
    {
      id: "event-error-2-4",
      number: "2-4",
      title: "アドバイス行為",
      query: "アドバイス行為",
      description: "対戦中の助言や外部からの関与が疑われる場合に確認する項目です。",
      targetDocuments: ["penalty-guideline", "floor-rule", "ruling-case"]
    }
  ],
  conductErrors: [
    {
      id: "conduct-error-3",
      number: "3",
      title: "悪質な行為",
      query: "悪質な行為",
      description: "故意性やイベント運営上の重大な問題が疑われる場合に、該当する資料箇所を確認するための入口です。",
      targetDocuments: ["penalty-guideline", "floor-rule"]
    }
  ]
};
let entryItems = [
  {
    id: "entry-extra-to-hand",
    group: "play",
    label: "山札・サイドを多く手札に加えた",
    primaryId: "play-error-1-2",
    relatedIds: ["play-error-1-3", "play-error-1-5"]
  },
  {
    id: "entry-extra-look",
    group: "play",
    label: "本来見るべきでないカードを見た",
    primaryId: "play-error-1-1",
    relatedIds: ["play-error-1-9"]
  },
  {
    id: "entry-mixed-hidden",
    group: "play",
    label: "カードを混ぜてしまった",
    primaryId: "play-error-1-3",
    relatedIds: ["play-error-1-2", "play-error-1-4"]
  },
  {
    id: "entry-illegal-action",
    group: "play",
    label: "本来できない行動をした",
    primaryId: "play-error-1-4",
    relatedIds: ["play-error-1-5", "play-error-1-11"]
  },
  {
    id: "entry-missed-action",
    group: "play",
    label: "やるべき処理を忘れた",
    primaryId: "play-error-1-5",
    relatedIds: ["play-error-1-4", "play-error-1-11"]
  },
  {
    id: "entry-damage-error",
    group: "play",
    label: "ダメージ計算を間違えた",
    primaryId: "play-error-1-6",
    relatedIds: ["play-error-1-5", "play-error-1-11"]
  },
  {
    id: "entry-setup-error",
    group: "play",
    label: "対戦準備を間違えた",
    primaryId: "play-error-1-7",
    relatedIds: ["play-error-1-5"]
  },
  {
    id: "entry-shuffle-error",
    group: "play",
    label: "シャッフルが不十分だった",
    primaryId: "play-error-1-8",
    relatedIds: []
  },
  {
    id: "entry-dropped-card",
    group: "play",
    label: "カードを落とした",
    primaryId: "play-error-1-9",
    relatedIds: ["play-error-1-1"]
  },
  {
    id: "entry-slow-play",
    group: "play",
    label: "プレイが遅い",
    primaryId: "play-error-1-10",
    relatedIds: []
  },
  {
    id: "entry-missed-opponent-error",
    group: "play",
    label: "相手のミスを見逃した",
    primaryId: "play-error-1-11",
    relatedIds: ["play-error-1-4", "play-error-1-5"]
  },
  {
    id: "entry-marked-card",
    group: "event",
    label: "デッキ・シールドに問題がある",
    primaryId: "event-error-2-1",
    relatedIds: []
  },
  {
    id: "entry-deck-list",
    group: "event",
    label: "デッキリストに問題がある",
    primaryId: "event-error-2-2",
    relatedIds: []
  },
  {
    id: "entry-late",
    group: "event",
    label: "遅刻",
    primaryId: "event-error-2-3",
    relatedIds: []
  },
  {
    id: "entry-advice",
    group: "event",
    label: "アドバイス行為",
    primaryId: "event-error-2-4",
    relatedIds: []
  },
  {
    id: "entry-conduct",
    group: "conduct",
    label: "悪質な行為",
    primaryId: "conduct-error-3",
    relatedIds: []
  }
];
const storageKeys = {
  index: "judgeSourceIndex:v1",
  favorites: "judgeFavorites:v1",
  offlinePreparedAt: "judgeOfflinePreparedAt:v1",
  history: "judgeSourceHistory:v1",
  pdfRegistrations: "judgePdfRegistrations:v1",
  classificationOverride: "judgeClassificationOverride:v1"
};

const library = new PdfLibrary();
let registrations = {};
let libraryQueue = Promise.resolve();
function queueLibraryTask(task) {
  const result = libraryQueue.then(task);
  libraryQueue = result.catch(() => {});
  return result;
}

let sourceIndex = [];
let activePdf = null;
let activePage = 1;
let activeDoc = null;
let activeHighlightTerms = [];
let activeMatchIndex = 0;
let activeEntryId = "";
let activeUnitEndPage = null;
let activeObjectUrl = "";
let detectedClassificationItems = [];
let shortcutsExpanded = false;
const expandedGroups = new Set();

const els = {
  searchInput: document.querySelector("#search-input"),
  searchButton: document.querySelector("#search-button"),
  documentFilter: document.querySelector("#document-filter"),
  filterChips: document.querySelector("#filter-chips"),
  indexStatus: document.querySelector("#index-status"),
  offlineStatus: document.querySelector("#offline-status"),
  prepareOffline: document.querySelector("#prepare-offline"),
  refreshIndex: document.querySelector("#refresh-index"),
  setupScreen: document.querySelector("#setup-screen"),
  setupDocuments: document.querySelector("#setup-documents"),
  playErrorCards: document.querySelector("#play-error-cards"),
  eventErrorCards: document.querySelector("#event-error-cards"),
  detectedSection: document.querySelector("#detected-section"),
  detectedCards: document.querySelector("#detected-cards"),
  conductErrorCards: document.querySelector("#conduct-error-cards"),
  entryDetail: document.querySelector("#entry-detail"),
  shortcuts: document.querySelector("#shortcuts"),
  toggleShortcuts: document.querySelector("#toggle-shortcuts"),
  results: document.querySelector("#results"),
  favorites: document.querySelector("#favorites"),
  historyItems: document.querySelector("#history-items"),
  quickRecent: document.querySelector("#quick-recent"),
  documents: document.querySelector("#documents"),
  tabs: document.querySelectorAll(".tab"),
  views: {
    prep: document.querySelector("#prep-view"),
    results: document.querySelector("#results-view"),
    favorites: document.querySelector("#favorites-view"),
    documents: document.querySelector("#documents-view"),
    history: document.querySelector("#history-view")
  },
  prepRun: document.querySelector("#prep-run"),
  prepChecks: document.querySelector("#prep-checks"),
  pdfDialog: document.querySelector("#pdf-dialog"),
  pdfTitle: document.querySelector("#pdf-title"),
  pdfPageLabel: document.querySelector("#pdf-page-label"),
  pdfCanvas: document.querySelector("#pdf-canvas"),
  pdfPageWrap: document.querySelector("#pdf-page-wrap"),
  pdfTextLayer: document.querySelector("#pdf-text-layer"),
  pdfContext: document.querySelector("#pdf-context"),
  matchStatus: document.querySelector("#match-status"),
  prevMatch: document.querySelector("#prev-match"),
  nextMatch: document.querySelector("#next-match"),
  closePdf: document.querySelector("#close-pdf"),
  prevPage: document.querySelector("#prev-page"),
  nextPage: document.querySelector("#next-page"),
  toggleMarkers: document.querySelector("#toggle-markers"),
  openNativePdf: document.querySelector("#open-native-pdf"),
  viewerTitle: document.querySelector("#viewer-title"),
  viewerPageLabel: document.querySelector("#viewer-page-label"),
  viewerCanvas: document.querySelector("#viewer-canvas"),
  viewerEmpty: document.querySelector("#viewer-empty"),
  viewerPrevPage: document.querySelector("#viewer-prev-page"),
  viewerNextPage: document.querySelector("#viewer-next-page"),
  presentPdf: document.querySelector("#present-pdf")
};

els.floatingCaseButton = document.querySelector("#floating-case-button");
els.dialogCaseButton = document.querySelector("#dialog-case-button");

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function uniqueTerms(terms) {
  const seen = new Set();
  return terms
    .map((term) => normalizeText(String(term || "")))
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)
    .filter((term) => {
      const key = term.toLocaleLowerCase("ja-JP");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function splitJapanesePhrase(value) {
  const normalized = normalizeText(value);
  const particles = /[をにへがはでとやのも、。・／/（）()「」\s]+/g;
  return normalized.split(particles).filter((term) => term.length >= 3);
}

function buildHighlightTerms(query, item = null) {
  const terms = [
    query,
    item?.number,
    item?.title,
    ...splitJapanesePhrase(query),
    ...splitJapanesePhrase(item?.title || "")
  ];
  return uniqueTerms(terms);
}

function getDocument(id) {
  return documents.find((doc) => doc.id === id);
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function loadClassificationData() {
  try {
    const override = loadJson(storageKeys.classificationOverride, null);
    if (override) {
      applyClassificationData(override);
      return;
    }
    const response = await fetch("data/classifications.json?v=core10", { cache: "no-cache" });
    if (!response.ok) throw new Error(`classification json: ${response.status}`);
    applyClassificationData(await response.json());
  } catch (error) {
    console.warn("Using bundled fallback classification data.", error);
    if (els.indexStatus) {
      els.indexStatus.textContent = "分類データを読み込めませんでした。内蔵データで起動します。";
    }
  }
}

function applyClassificationData(data) {
  if (!data.classificationGroups || !Array.isArray(data.entryItems)) {
    throw new Error("classification json format is invalid");
  }
  classificationGroups = data.classificationGroups;
  entryItems = data.entryItems;
}

async function importClassificationFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    applyClassificationData(data);
    saveJson(storageKeys.classificationOverride, data);
    renderClassificationCards();
    renderDocuments();
    els.indexStatus.textContent = "分類データを更新しました";
  } catch (error) {
    console.error(error);
    window.alert("分類JSONを読み込めませんでした。ファイル形式を確認してください。");
  }
}

async function resetClassificationOverride() {
  localStorage.removeItem(storageKeys.classificationOverride);
  await loadClassificationData();
  renderClassificationCards();
  renderDocuments();
  els.indexStatus.textContent = "標準の分類データに戻しました";
}

function isServiceWorkerAllowed() {
  return window.isSecureContext || ["localhost", "127.0.0.1"].includes(location.hostname);
}

function getFavorites() {
  return loadJson(storageKeys.favorites, []);
}

async function getStoredPdfRecord(documentId) {
  return library.getPdf(documentId);
}

function getRegistrations() {
  return registrations;
}

async function reloadRegistrations() {
  registrations = Object.fromEntries((await library.listDocuments()).map(item => [item.documentId, item]));
  applyRegistrations();
}

function applyRegistrations() {
  const registrations = getRegistrations();
  for (let index = documents.length - 1; index >= 0; index--) {
    if (documents[index].kind === "judge-news") documents.splice(index, 1);
  }
  Object.values(registrations).filter(item => item.kind === "judge-news").forEach(item => {
    documents.push(newsletterDocument(item.documentId, item.title));
  });
  const newsFilter = filters.find(filter => filter.id === "judge-news");
  if (newsFilter) newsFilter.documentIds = documents.filter(doc => doc.kind === "judge-news").map(doc => doc.id);
  documents.forEach((doc) => {
    const registration = registrations[doc.id];
    doc.registration = registration || null;
    doc.fileName = registration?.fileName || "";
    doc.version = registration?.version || "未設定";
    doc.updatedAt = registration?.registeredAt ? formatDateTime(registration.registeredAt) : "未設定";
    doc.pageCount = registration?.pageCount || null;
  });
}

function getMissingRequiredDocuments() {
  return documents.filter((doc) => doc.required && !doc.registration);
}

function updateSetupState() {
  const missing = getMissingRequiredDocuments();
  const setupRequired = missing.length > 0;
  if (els.setupScreen) els.setupScreen.hidden = !setupRequired;
  document.body.classList.toggle("setup-required", setupRequired);
  if (setupRequired) {
    els.indexStatus.textContent = "必須PDFを登録してください";
  }
}

function pdfBytesFromBuffer(buffer) {
  return new Uint8Array(buffer.slice(0));
}

async function loadPdfDocument(source) {
  const baseSource = { ...source };
  const originalData = baseSource.data ? new Uint8Array(baseSource.data) : null;
  const firstSource = originalData ? { ...baseSource, data: new Uint8Array(originalData) } : baseSource;

  try {
    return await pdfjsLib.getDocument(firstSource).promise;
  } catch (error) {
    console.warn("PDF worker loading failed. Retrying without worker.", error);
    const retrySource = originalData
      ? { ...baseSource, data: new Uint8Array(originalData), disableWorker: true }
      : { ...baseSource, disableWorker: true };
    return pdfjsLib.getDocument(retrySource).promise;
  }
}

function validatePdfSample(doc, file, textSample, pageCount) {
  const warnings = [];
  if (!file.name.toLocaleLowerCase("ja-JP").endsWith(".pdf")) {
    warnings.push("PDFファイルではない可能性があります。");
  }
  const matchedTerms = (doc.expectedTerms || []).filter((term) => textSample.includes(term));
  if (matchedTerms.length === 0) {
    warnings.push("想定している資料名や特徴語を確認できませんでした。");
  }
  if (!pageCount || pageCount < 1) {
    warnings.push("ページ数を確認できませんでした。");
  }
  return {
    ok: warnings.length === 0,
    matchedTerms,
    warnings
  };
}

async function inspectPdfFile(doc, file, buffer = null) {
  buffer ||= await file.arrayBuffer();
  checkPdfBytes(buffer);
  const pdf = await loadPdfDocument({ data: pdfBytesFromBuffer(buffer) });
  try {
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push({ page: number, text: normalizeText(content.items.map(item => item.str).join(" ")) });
      page.cleanup();
    }
    const textSample = pages.slice(0, 5).map(page => page.text).join(" ");
    const validation = validatePdfSample(doc, file, compactText(textSample), pdf.numPages);
    return { buffer, pages, pageCount: pdf.numPages, textSample, validation, ...parseEdition(textSample) };
  } finally { await pdf.destroy(); }
}

function registerPdf(documentId, file, options = {}) {
  return queueLibraryTask(() => registerPdfInternal(documentId, file, options));
}

async function registerPdfInternal(documentId, file, options = {}) {
  if (!file) return { status: "cancelled" };
  if (typeof options === "boolean") options = { force: options };
  if (file.size > MAX_PDF_BYTES) throw new Error("PDFは40MB以内のファイルを選んでください。");
  const buffer = await file.arrayBuffer();
  checkPdfBytes(buffer);
  const hash = await fingerprint(buffer);
  const isNews = documentId === "judge-news";
  if (isNews || getDocument(documentId)?.kind === "judge-news") {
    const duplicate = Object.values(registrations).find(item => item.kind === "judge-news" && item.hash === hash);
    if (duplicate) return { status: "unchanged", documentId: duplicate.documentId };
  }
  if (isNews) documentId = `judge-news-${hash}`;
  const previous = registrations[documentId];
  const doc = getDocument(documentId) || (isNews ? newsletterDocument(documentId, file.name.replace(/\.pdf$/i, "")) : null);
  if (!doc) throw new Error("登録先の資料が見つかりません。");
  if (previous?.hash === hash) return { status: "unchanged", documentId };
  els.indexStatus.textContent = `${doc.shortTitle || doc.title} を確認しています...`;

  try {
    const inspection = await inspectPdfFile(doc, file, buffer);
    if (options.automatic) {
      const primary = PRIMARY_TERMS[documentId] || "ジャッジ通信";
      if (!compactText(inspection.textSample).includes(primary)) throw new Error("資料名を確認できないため、自動登録を見送りました。手動で内容を確認してください。");
      if (isOlderEdition(inspection, previous)) throw new Error("登録済みより古い版のため、自動更新を見送りました。");
    }
    if (!inspection.validation.ok && !options.force && !options.automatic) {
      const message = [
        `${doc.shortTitle || doc.title} として登録する前に確認してください。`,
        ...inspection.validation.warnings,
        "内容を確認した上で登録しますか？"
      ].join("\n");
      if (!window.confirm(message)) {
        els.indexStatus.textContent = "PDF登録を取り消しました";
        return { status: "cancelled" };
      }
    }

    const metadata = {
      documentId,
      kind: doc.kind || "official",
      title: doc.title,
      fileName: file.name,
      size: file.size,
      pageCount: inspection.pageCount,
      registeredAt: new Date().toISOString(),
      checkStatus: inspection.validation.ok ? "ok" : "warning",
      matchedTerms: inspection.validation.matchedTerms,
      warnings: inspection.validation.warnings,
      version: inspection.version,
      pdfUpdatedAt: inspection.pdfUpdatedAt,
      hash,
      source: options.source || { kind: "manual" }
    };
    const pages = inspection.pages.map(page => ({
      ...page, text: page.text || "このページはテキスト抽出できませんでした。PDFページ表示で確認してください。",
      documentId, documentTitle: doc.title, version: metadata.version,
      updatedAt: metadata.pdfUpdatedAt || formatDateTime(metadata.registeredAt), sourceFile: file.name
    }));
    await library.putDocument({ documentId, name: file.name, type: "application/pdf", size: file.size, buffer }, metadata, pages);
    await clearActiveDocument(documentId);
    await reloadRegistrations();
    await buildIndex(false);
    renderDocuments();
    renderSetupDocuments();
    renderFiltersPreservingSelection();
    updateSetupState();
    if (els.searchInput.value.trim()) renderResults(searchSources(els.searchInput.value), els.searchInput.value);
    els.indexStatus.textContent = `${doc.shortTitle || doc.title} を登録しました`;
    document.dispatchEvent(new Event("library-changed"));
    return { status: "imported", documentId };
  } catch (error) {
    console.error(error);
    els.indexStatus.textContent = "PDFを登録できませんでした";
    const detail = error?.message || error?.name || String(error);
    if (!options.automatic) window.alert(`PDFを登録できませんでした。\n${detail}`);
    throw error;
  }
}

function removeRegisteredPdf(documentId) {
  return queueLibraryTask(() => removeRegisteredPdfInternal(documentId));
}

async function removeRegisteredPdfInternal(documentId) {
  const doc = getDocument(documentId);
  if (!doc) return;
  if (!window.confirm(`${doc.shortTitle || doc.title} の登録を削除しますか？`)) return;
  await library.deleteDocument(documentId);
  await clearActiveDocument(documentId);
  await reloadRegistrations();
  await buildIndex(false);
  saveJson(storageKeys.favorites, getFavorites().filter(item => item.documentId !== documentId));
  saveJson(storageKeys.history, loadJson(storageKeys.history, []).filter(item => item.documentId !== documentId));
  renderFavorites();
  renderHistoryItems();
  renderFiltersPreservingSelection();
  renderDocuments();
  renderSetupDocuments();
  renderResults([], "");
  updateSetupState();
  document.dispatchEvent(new Event("library-changed"));
}

async function getDocumentPdfSource(doc) {
  const record = await getStoredPdfRecord(doc.id);
  if (!record?.buffer) {
    throw new Error(`${doc.title} is not registered.`);
  }
  return { data: pdfBytesFromBuffer(record.buffer) };
}

async function getDocumentPdfObjectUrl(doc) {
  const record = await getStoredPdfRecord(doc.id);
  if (!record?.buffer) return "";
  const blob = new Blob([record.buffer], { type: record.type || "application/pdf" });
  return URL.createObjectURL(blob);
}

function renderFilters() {
  els.documentFilter.innerHTML = filters.map((filter) => (
    `<option value="${filter.id}">${escapeHtml(filter.label)}</option>`
  )).join("");
  renderFilterChips();
}

function registeredDocuments() {
  return documents.filter((doc) => doc.registration);
}

function renderFilterChips() {
  els.filterChips.innerHTML = filters.map((filter) => `
    <button class="chip ${filter.id === els.documentFilter.value ? "active" : ""}" type="button" data-filter-chip="${filter.id}" aria-pressed="${filter.id === els.documentFilter.value}">
      ${escapeHtml(filter.label)}
    </button>
  `).join("");
}

function renderShortcuts() {
  if (!els.shortcuts || !els.toggleShortcuts) return;
  const visibleShortcuts = shortcutsExpanded ? shortcuts : shortcuts.slice(0, 8);
  els.shortcuts.innerHTML = visibleShortcuts.map((shortcut, index) => (
    `<button class="shortcut-tile" type="button" data-shortcut="${index}">
      <span>${escapeHtml(shortcut.label)}</span>
      <small>検索</small>
    </button>`
  )).join("");
  els.toggleShortcuts.textContent = shortcutsExpanded ? "少なく表示" : "もっと見る";
}

function renderClassificationCards() {
  els.playErrorCards.innerHTML = sortedEntries("play").map(classificationCard).join("");
  els.eventErrorCards.innerHTML = renderGroupedEntryTiles();
  renderDetectedClassificationCards();
  if (els.conductErrorCards) els.conductErrorCards.innerHTML = "";
}

function renderGroupedEntryTiles() {
  return [
    groupTile("event", "2", "イベント上のエラー", "区別がつくカード、デッキリスト、遅刻、アドバイス行為"),
    expandedGroups.has("event") ? sortedEntries("event").map(classificationCard).join("") : "",
    groupTile("conduct", "3", "悪質な行為", "3系統の原文を確認"),
    expandedGroups.has("conduct") ? sortedEntries("conduct").map(classificationCard).join("") : ""
  ].join("");
}

function groupTile(group, number, title, caption) {
  return `
    <button class="classification-card entry-tile group-tile" type="button" data-group-toggle="${group}">
      <span class="tile-number">${escapeHtml(number)}</span>
      <span class="tile-title">${escapeHtml(title)}</span>
      <span class="tile-caption">${escapeHtml(caption)}</span>
    </button>
  `;
}

function sortedEntries(group) {
  return entryItems
    .filter((entry) => entry.group === group)
    .sort((a, b) => classificationSortNumber(a.primaryId) - classificationSortNumber(b.primaryId));
}

function classificationSortNumber(id) {
  const item = findClassification(id);
  const parts = item.number.split("-").map(Number);
  return (parts[0] || 0) * 100 + (parts[1] || 0);
}

function classificationCard(entry) {
  const item = findClassification(entry.primaryId);
  const displayNumber = item.number;
  return `
    <button class="classification-card entry-tile" type="button" data-entry-id="${entry.id}">
      <span class="tile-number">${escapeHtml(displayNumber)}</span>
      <span class="tile-title">${escapeHtml(item.title)}</span>
    </button>
  `;
}

function detectedClassificationCard(item) {
  return `
    <button class="classification-card entry-tile detected-tile" type="button" data-detected-classification-id="${item.id}">
      <span class="tile-number">${escapeHtml(item.number)}</span>
      <span class="tile-title">${escapeHtml(item.title)}</span>
    </button>
  `;
}

function renderDetectedClassificationCards() {
  if (!els.detectedSection || !els.detectedCards) return;
  els.detectedSection.hidden = detectedClassificationItems.length === 0;
  if (detectedClassificationItems.length === 0) {
    els.detectedCards.innerHTML = "";
    return;
  }
  els.detectedCards.innerHTML = detectedClassificationItems
    .sort((a, b) => classificationOrderValue(a) - classificationOrderValue(b))
    .map(detectedClassificationCard)
    .join("");
}

function findEntry(id) {
  return entryItems.find((item) => item.id === id);
}

function findClassification(id) {
  return [
    ...classificationGroups.playErrors,
    ...classificationGroups.eventErrors,
    ...classificationGroups.conductErrors,
    ...detectedClassificationItems
  ].find((item) => item.id === id);
}

function renderEntryDetail(entry) {
  if (!entry) {
    els.entryDetail.innerHTML = "";
    return;
  }

  const item = findClassification(entry.primaryId);
  const related = entry.relatedIds.map(findClassification).filter(Boolean);
  const terms = escapeAttribute(buildHighlightTerms(item.query, item).join("|"));

  document.querySelectorAll("[data-entry-id]").forEach((tile) => {
    tile.classList.toggle("is-selected", tile.dataset.entryId === entry.id);
  });
  updateFloatingCaseButton(entry);

  els.entryDetail.innerHTML = `
    <article class="entry-detail-card">
      <div class="entry-detail-block">
        <p class="kicker">選択した入口</p>
        <h2>${escapeHtml(entry.label)}</h2>
      </div>
      <div class="entry-detail-block">
        <p class="kicker">確認する資料項目</p>
        <p class="entry-main-item">${escapeHtml(item.number)} ${escapeHtml(item.title)}</p>
      </div>
      <div class="entry-detail-block">
        <p class="kicker">近い原文リンク</p>
        ${related.length > 0
          ? `<div class="related-link-list">${related.map((relatedItem) => `<button type="button" data-classification-action="penalty" data-classification-id="${relatedItem.id}">${escapeHtml(relatedItem.number)} ${escapeHtml(relatedItem.title)}</button>`).join("")}</div>`
          : '<p class="muted-text">なし</p>'}
      </div>
      <div class="entry-actions">
        <button type="button" data-entry-search-cases="${entry.id}">裁定事例集で「${escapeHtml(item.title)}」を検索</button>
      </div>
    </article>
  `;

}

function updateFloatingCaseButton(entry) {
  const buttons = [els.floatingCaseButton, els.dialogCaseButton].filter(Boolean);
  if (buttons.length === 0) return;
  if (!entry) {
    buttons.forEach((button) => {
      button.hidden = true;
      button.removeAttribute("data-floating-cases");
      button.removeAttribute("data-floating-document");
    });
    return;
  }
  const item = findClassification(entry.primaryId);
  const targetDocument = activeDoc?.id === "ruling-case" ? "penalty-guideline" : "ruling-case";
  const label = targetDocument === "ruling-case" ? "裁定事例集" : "ペナルティガイドライン";
  buttons.forEach((button) => {
    button.hidden = false;
    button.dataset.floatingCases = entry.id;
    button.dataset.floatingDocument = targetDocument;
    button.textContent = `${label} ${item.number} を開く`;
  });
}

function renderPdfContext() {
  if (!els.pdfContext) return;
  const entry = findEntry(activeEntryId);
  if (!entry) {
    els.pdfContext.innerHTML = "";
    return;
  }

  const item = findClassification(entry.primaryId);
  const related = entry.relatedIds.map(findClassification).filter(Boolean);
  els.pdfContext.innerHTML = `
    <div class="pdf-current-unit">
      <span>${escapeHtml(item.number)}</span>
      <strong>${escapeHtml(item.title)}</strong>
    </div>
    ${related.length > 0 ? `
      <details class="pdf-related">
        <summary>近い原文</summary>
        <div class="pdf-related-links">
          ${related.map((relatedItem) => `
            <button type="button" data-classification-action="penalty" data-classification-id="${relatedItem.id}">
              ${escapeHtml(relatedItem.number)} ${escapeHtml(relatedItem.title)}
            </button>
          `).join("")}
        </div>
      </details>
    ` : ""}
  `;
}

function scoreEntryForClassification(entry, item) {
  const text = normalizeText(entry.text).toLocaleLowerCase("ja-JP");
  const number = item.number.toLocaleLowerCase("ja-JP");
  const title = item.title.toLocaleLowerCase("ja-JP");
  const query = item.query.toLocaleLowerCase("ja-JP");
  const headingWithDot = `${number}.`;
  const headingWithSpace = `${number} `;
  const isSectionOnlyNumber = !number.includes("-");
  let score = 0;

  if (text.includes(`${headingWithDot} 「${title}」`)) score += 1200;
  if (text.includes(`${headingWithDot} ${title}`)) score += 1100;
  if (text.includes(`${headingWithDot}${title}`)) score += 1100;
  if (text.includes(`${number} ${title}`)) score += 900;
  if (text.includes(`${number}${title}`)) score += 900;
  if (text.includes(`${headingWithDot}`)) score += isSectionOnlyNumber ? 80 : 650;
  if (text.includes(headingWithSpace)) score += isSectionOnlyNumber ? 60 : 500;
  if (text.includes(number)) score += isSectionOnlyNumber ? 0 : 350;
  if (text.includes(title)) score += 450;
  if (text.includes(query)) score += 350;

  buildHighlightTerms(item.query, item).forEach((term) => {
    if (text.includes(term.toLocaleLowerCase("ja-JP"))) score += 80;
  });

  if (text.includes("第 6 章") && text.includes("1-1.") && text.includes("1-2.") && text.includes("1-3.")) {
    score -= 700;
  }

  const headingCount = allClassifications().filter((candidate) => (
    text.includes(`${candidate.number}.`) || text.includes(`${candidate.number} ${candidate.title}`) || text.includes(`${candidate.number}${candidate.title}`)
  )).length;
  if (headingCount >= 6) score -= 900;
  if (text.includes("目次") && headingCount >= 3) score -= 1200;

  return score;
}

function normalizeDetectedTitle(value) {
  return normalizeText(String(value || ""))
    .replace(/^[「『\s　]+|[」』\s　]+$/g, "")
    .replace(/[。,:：]+$/g, "")
    .slice(0, 40);
}

function detectAdditionalClassificationsFromIndex() {
  detectedClassificationItems = [];
  const knownNumbers = new Set(allClassifications().map((item) => item.number));
  const detectedByNumber = new Map();
  const penaltyPages = sourceIndex.filter((entry) => entry.documentId === "penalty-guideline");
  const patterns = [
    /([1-3]-\d{1,2})\.\s*「([^」]{2,40})」/g,
    /([1-3]-\d{1,2})\s+「([^」]{2,40})」/g,
    /([1-3]-\d{1,2})\.\s*([^。\n]{2,32})/g
  ];

  penaltyPages.forEach((entry) => {
    const text = entry.text || "";
    patterns.forEach((pattern) => {
      for (const match of text.matchAll(pattern)) {
        const number = match[1];
        const title = normalizeDetectedTitle(match[2]);
        if (!number || !title || knownNumbers.has(number)) continue;
        if (/^\d+$/.test(title) || title.includes("ページ")) continue;
        if (!detectedByNumber.has(number)) {
          detectedByNumber.set(number, {
            id: `detected-${number.replace(/[^a-zA-Z0-9]/g, "-")}`,
            number,
            title,
            query: title,
            description: "登録PDFから検出した未登録項目です。",
            targetDocuments: ["penalty-guideline", "ruling-case"],
            detected: true,
            detectedPage: entry.page
          });
        }
      }
    });
  });

  detectedClassificationItems = [...detectedByNumber.values()]
    .sort((a, b) => classificationOrderValue(a) - classificationOrderValue(b));
}

function findBestClassificationPage(item, documentId) {
  return sourceIndex
    .filter((entry) => entry.documentId === documentId)
    .map((entry) => ({ entry, score: scoreEntryForClassification(entry, item) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.page - b.entry.page)[0]?.entry;
}

function allClassifications() {
  return [
    ...classificationGroups.playErrors,
    ...classificationGroups.eventErrors,
    ...classificationGroups.conductErrors,
    ...detectedClassificationItems
  ];
}

function classificationOrderValue(item) {
  const parts = item.number.split("-").map(Number);
  return (parts[0] || 0) * 100 + (parts[1] || 0);
}

function findNextClassification(item) {
  const current = classificationOrderValue(item);
  return allClassifications()
    .filter((candidate) => classificationOrderValue(candidate) > current)
    .sort((a, b) => classificationOrderValue(a) - classificationOrderValue(b))[0];
}

function findUnitPageRange(item, documentId) {
  const start = findBestClassificationPage(item, documentId);
  if (!start) return null;

  const nextItem = findNextClassification(item);
  const nextStart = nextItem ? findBestClassificationPage(nextItem, documentId) : null;
  const endPage = nextStart && nextStart.page > start.page
    ? nextStart.page
    : Math.min(start.page + 1, getDocument(documentId)?.pageCount || start.page + 1);
  return { startPage: start.page, endPage };
}

async function openClassificationSource(item, documentId) {
  if (!item) return;
  if (getMissingRequiredDocuments().length > 0) {
    updateSetupState();
    activateTab("documents");
    els.setupScreen?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const doc = getDocument(documentId);
  if (!doc?.registration) {
    els.indexStatus.textContent = `${doc?.shortTitle || doc?.title || "資料"} は未登録です`;
    activateTab("documents");
    document.querySelector("#documents-view").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const range = findUnitPageRange(item, documentId);
  if (!range) {
    els.searchInput.value = item.query;
    renderResults(searchSources(item.query, [documentId]), item.query, buildHighlightTerms(item.query, item));
    activateTab("results");
    document.querySelector("#results-view").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  els.searchInput.value = item.query;
  await showSource(documentId, range.startPage, buildHighlightTerms(item.query, item), range.endPage);
}

function runClassificationSearch(item, mode) {
  if (!item) return;
  if (mode === "penalty") {
    queueReader(() => openClassificationSource(item, "penalty-guideline"));
    return;
  }
  if (mode === "cases") {
    queueReader(() => openClassificationSource(item, "ruling-case"));
    return;
  }

  els.searchInput.value = item.query;
  const targetDocumentIds = item.targetDocuments;
  const filter = filters.find((candidate) => {
    if (candidate.documentIds.length !== targetDocumentIds.length) return false;
    return targetDocumentIds.every((id) => candidate.documentIds.includes(id));
  });
  els.documentFilter.value = filter?.id || "all";
  renderFilterChips();
  renderResults(searchSources(item.query, targetDocumentIds), item.query, buildHighlightTerms(item.query, item));
  activateTab("results");
  document.querySelector("#results-view").scrollIntoView({ behavior: "smooth", block: "start" });

  if (mode === "record") {
    activateTab("history");
  }
}

async function openEntryDocument(entry, documentId) {
  if (!entry) return;
  const item = findClassification(entry.primaryId);
  if (!item) return;
  await openClassificationSource(item, documentId);
}

function searchEntryCases(entry) {
  if (!entry) return;
  const item = findClassification(entry.primaryId);
  if (!item) return;
  els.searchInput.value = item.query;
  els.documentFilter.value = "ruling-case";
  renderFilterChips();
  renderResults(searchSources(item.query, ["ruling-case"]), item.query, buildHighlightTerms(item.query, item));
  activateTab("results");
  document.querySelector("#results-view").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDocuments() {
  els.documents.innerHTML = `

    <details class="document-admin-panel"><summary>入口設定を変更</summary>
      <div class="section-heading compact">
        <p class="kicker">分類データ</p>
        <h2>入口設定</h2>
      </div>
      <p class="muted-text">入口タイルや関連項目はJSONで更新できます。PDF原文とは別の設定データです。</p>
      <div class="document-actions">
        <label class="file-upload-field compact">
          <span>分類JSONをインポート</span>
          <input type="file" accept="application/json,.json" data-classification-import>
        </label>
        <button type="button" data-reset-classification>標準に戻す</button>
      </div>
    </details>
    ${documentManagerHtml(false)}
  `;
}

function renderSetupDocuments() {
  if (!els.setupDocuments) return;
  els.setupDocuments.innerHTML = documentManagerHtml(true);
}

function documentManagerHtml(setupOnly) {
    const docs = setupOnly ? documents.filter((doc) => doc.required) : documents;
  return docs.map((doc) => {
    const registration = doc.registration;
    const warnings = registration?.warnings || [];
    const statusLabel = registration
      ? registration.checkStatus === "ok" ? "登録済み" : "要確認"
      : doc.required ? "必須" : "任意";
    return `
    <article class="document-card ${registration ? "is-registered" : "is-missing"}">
      <div class="document-card-head">
        <div>
          <p class="kicker">${doc.kind === "judge-news" ? "ジャッジ限定・端末内保存" : doc.required ? "必須PDF" : "任意PDF"}</p>
          <h2>${escapeHtml(doc.shortTitle || doc.title)}</h2>
        </div>
        <span class="doc-status ${registration ? "is-ok" : ""}">${escapeHtml(statusLabel)}</span>
      </div>
      <p class="document-title-full">${escapeHtml(doc.title)}</p>
      ${registration ? `
        <dl class="document-meta">
          <div><dt>ファイル</dt><dd>${escapeHtml(registration.fileName)}</dd></div>
          <div><dt>ページ数</dt><dd>${registration.pageCount || "未確認"}</dd></div>
          <div><dt>登録日</dt><dd>${escapeHtml(formatDateTime(registration.registeredAt))}</dd></div>
          <div><dt>版</dt><dd>${escapeHtml(registration.version)}${registration.pdfUpdatedAt ? ` / ${escapeHtml(registration.pdfUpdatedAt)}` : ""}</dd></div>
          <div><dt>取り込み元</dt><dd>${registration.source?.kind === "official" ? "公式サイト" : registration.source?.kind === "folder" ? "選択フォルダ" : "手動登録"}</dd></div>
          <div><dt>確認</dt><dd>${registration.checkStatus === "ok" ? "特徴語を確認済み" : "確認警告あり"}</dd></div>
        </dl>
        ${warnings.length > 0 ? `<div class="document-warning">${warnings.map(escapeHtml).join("<br>")}</div>` : ""}
      ` : `
        <p class="muted-text">各自で用意した公式PDFを登録してください。</p>
      `}
      <div class="document-actions">
        <label class="file-upload-field">
          <span>${registration ? "PDFを差し替え" : "PDFを登録"}</span>
          <input type="file" accept="application/pdf,.pdf" data-pdf-upload="${doc.id}">
        </label>
        ${registration ? `<button type="button" class="primary-button" data-open-pdf="${doc.id}" data-page="1">PDFを開く</button><button type="button" data-remove-pdf="${doc.id}">削除</button>` : ""}
      </div>
    </article>
  `;
  }).join("");
}

function formatDateTime(value) {
  if (!value) return "未実行";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "未実行";
  }
}

function prepItem(label, ok, detail) {
  return `
    <div class="prep-item ${ok ? "is-ok" : "is-warn"}">
      <strong>${ok ? "OK" : "注意"}</strong>
      <div>
        <span>${escapeHtml(label)}</span>
        <small>${escapeHtml(detail)}</small>
      </div>
    </div>
  `;
}

function renderPrepChecks() {
  if (!els.prepChecks) return;

  const preparedAt = localStorage.getItem(storageKeys.offlinePreparedAt);
  const cachedIndex = sourceIndex;
  const favoriteCount = getFavorites().length;
  const serviceWorkerReady = "serviceWorker" in navigator && isServiceWorkerAllowed();
  const documentCount = registeredDocuments().length;
  const requiredCount = documents.filter((doc) => doc.required).length;
  const registeredRequiredCount = documents.filter((doc) => doc.required && doc.registration).length;
  const indexedDocs = new Set(cachedIndex.map((entry) => entry.documentId)).size;
  const pageCount = cachedIndex.length || sourceIndex.length;

  els.prepChecks.innerHTML = [
    prepItem("必須PDF", registeredRequiredCount === requiredCount, `${registeredRequiredCount} / ${requiredCount}資料を登録済み`),
    prepItem("登録PDF", documentCount > 0, `${documentCount}資料を登録済み`),
    prepItem("検索用原文", pageCount > 0 && indexedDocs >= registeredRequiredCount, `${pageCount}ページ / ${indexedDocs || 0}資料`),
    prepItem("事前保存", Boolean(preparedAt), preparedAt ? `最終保存 ${formatDateTime(preparedAt)}` : "イベント前に事前保存を押す"),
    prepItem("オフライン機能", serviceWorkerReady, serviceWorkerReady ? "このURLでは保存機能を使えます" : "HTTPS公開URLで保存が安定します"),
    prepItem("お気に入り", favoriteCount > 0, favoriteCount > 0 ? `${favoriteCount}件登録済み` : "よく見るページを登録すると早いです")
  ].join("");
}

async function extractDocument(doc) {
  const pdf = await loadPdfDocument(await getDocumentPdfSource(doc));
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = normalizeText(content.items.map((item) => item.str).join(" "));
      pages.push({
        documentId: doc.id,
        documentTitle: doc.title,
        version: doc.version,
        updatedAt: doc.updatedAt,
        page: pageNumber,
        text: text || "このページはテキスト抽出できませんでした。PDFページ表示で確認してください。",
        sourceFile: doc.fileName
      });
      page.cleanup();
    }
    return pages;
  } finally { await pdf.destroy(); }
}

async function clearActiveDocument(documentId) {
  if (activeDoc?.id !== documentId) return;
  closePdfView();
  const oldPdf = activePdf;
  activePdf = null;
  activeDoc = null;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = "";
  els.openNativePdf.href = "#";
  els.viewerCanvas.getContext("2d").clearRect(0, 0, els.viewerCanvas.width, els.viewerCanvas.height);
  els.viewerEmpty.hidden = false;
  els.viewerTitle.textContent = "検索結果からページを選択";
  els.viewerPageLabel.textContent = "資料を更新しました。ページを選び直してください";
  els.presentPdf.disabled = els.viewerPrevPage.disabled = els.viewerNextPage.disabled = true;
  if (oldPdf) await oldPdf.destroy();
}

async function buildIndex(force = false) {
  applyRegistrations();
  const availableDocuments = registeredDocuments();
  const nextIndex = [];
  for (const doc of availableDocuments) {
    const cached = force ? null : await library.getIndex(doc.id);
    let pages = cached?.hash === doc.registration.hash && cached?.pages?.length ? cached.pages : null;
    if (!pages) {
      els.indexStatus.textContent = `${doc.title} を読み込み中...`;
      pages = await extractDocument(doc);
      await library.putIndex(doc.id, doc.registration.hash, pages);
    }
    nextIndex.push(...pages);
  }
  sourceIndex = nextIndex;
  detectAdditionalClassificationsFromIndex();
  renderClassificationCards();
  els.indexStatus.textContent = sourceIndex.length ? `PDF原文 ${sourceIndex.length} ページを読み込み済み` : "PDFを登録してください";
  renderPrepChecks();
}

function getActiveDocumentIds() {
  const filter = filters.find((item) => item.id === els.documentFilter.value);
  // An empty newsletter collection must not match all official documents.
  if (filter?.id === "judge-news" && !filter.documentIds.length) return ["no-judge-news-registered"];
  return filter?.documentIds || [];
}

function highlight(text, query, terms = null) {
  const escaped = escapeHtml(text);
  const highlightTerms = terms || buildHighlightTerms(query);
  if (highlightTerms.length === 0) return escaped;
  const pattern = highlightTerms.map(escapeRegExp).join("|");
  return escaped.replace(new RegExp(pattern, "gi"), (match) => `<mark class="pdf-highlight">${match}</mark>`);
}

function makeSnippet(text, query) {
  const trimmedQuery = query.trim();
  const normalized = normalizeText(text);
  if (!trimmedQuery) return normalized.slice(0, 90);

  const lowerText = normalized.toLocaleLowerCase("ja-JP");
  const lowerQuery = trimmedQuery.toLocaleLowerCase("ja-JP");
  const fallbackTerm = buildHighlightTerms(query).find((term) => lowerText.includes(term.toLocaleLowerCase("ja-JP")));
  const needle = lowerText.includes(lowerQuery) ? trimmedQuery : fallbackTerm;
  if (!needle) return normalized.slice(0, 90);

  const lowerNeedle = needle.toLocaleLowerCase("ja-JP");
  const index = lowerText.indexOf(lowerNeedle);
  if (index < 0) return normalized.slice(0, 90);

  const start = Math.max(0, index - 34);
  const end = Math.min(normalized.length, index + needle.length + 56);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

function searchSources(query, forcedDocumentIds = null) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const activeIds = forcedDocumentIds || getActiveDocumentIds();
  const lowerQuery = trimmed.toLocaleLowerCase("ja-JP");
  const queryTerms = buildHighlightTerms(trimmed).map((term) => term.toLocaleLowerCase("ja-JP"));

  return sourceIndex.map((entry) => {
    const inScope = activeIds.length === 0 || activeIds.includes(entry.documentId);
    const haystack = [
      entry.text,
      entry.documentTitle,
      entry.version,
      String(entry.page),
      entry.sourceFile
    ].join(" ").toLocaleLowerCase("ja-JP");
    const exactMatch = haystack.includes(lowerQuery);
    const termMatch = queryTerms.length > 0 && queryTerms.every((term) => haystack.includes(term));
    let score = 0;
    if (exactMatch) score += 500;
    queryTerms.forEach((term) => {
      if (haystack.includes(term)) score += 120;
    });
    if (entry.text.toLocaleLowerCase("ja-JP").includes(lowerQuery)) score += 250;
    if (haystack.includes("第 6 章") && haystack.includes("1-1.") && haystack.includes("1-2.") && haystack.includes("1-3.")) {
      score -= 350;
    }
    return { entry, matched: inScope && (exactMatch || termMatch), score };
  })
    .filter((candidate) => candidate.matched)
    .sort((a, b) => b.score - a.score || a.entry.page - b.entry.page)
    .map((candidate) => candidate.entry);
}

function resultCard(entry, query, highlightTerms = buildHighlightTerms(query)) {
  const encodedTerms = escapeAttribute(highlightTerms.join("|"));
  return `
    <article class="result-card candidate-card">
      <div class="source-meta">
        <div>
          <p class="doc-name">${escapeHtml(entry.documentTitle)}</p>
          <p class="candidate-meta">${escapeHtml(entry.version)} / ${escapeHtml(entry.sourceFile)}</p>
        </div>
        <span class="page-badge">${entry.page}ページ</span>
      </div>
      <div class="result-text official-source">
        <p class="source-label">PDF原文 抜粋</p>
        <div class="official-text">${highlight(makeSnippet(entry.text, query), query, highlightTerms)}</div>
      </div>
      <details class="source-preview">
        <summary>PDF原文を広げる</summary>
        <div class="source-text">${highlight(entry.text, query, highlightTerms)}</div>
      </details>
      <div class="result-actions card-actions">
        <button class="primary-button" type="button" data-show-source="${entry.documentId}" data-page="${entry.page}" data-highlight-terms="${encodedTerms}">該当箇所を表示</button>
        <button type="button" data-favorite="${entry.documentId}" data-page="${entry.page}">お気に入りに追加</button>

      </div>
    </article>
  `;
}

function groupedResults(results, query, highlightTerms) {
  return documents.map((doc) => {
    const entries = results.filter((entry) => entry.documentId === doc.id);
    if (entries.length === 0) return "";

    return `
      <section class="result-group">
        <div class="result-group-header">
          <h3>${escapeHtml(doc.title)}</h3>
          <span>${entries.length}ページ</span>
        </div>
        ${entries.map((entry) => resultCard(entry, query, highlightTerms)).join("")}
      </section>
    `;
  }).join("");
}

function renderResults(results, query, highlightTerms = buildHighlightTerms(query)) {
  if (!query.trim()) {
    els.results.innerHTML = '<div class="empty-state">検索語を入力してください。</div>';
    return;
  }
  if (results.length === 0) {
    els.results.innerHTML = '<div class="empty-state">該当する原文は見つかりませんでした。検索語を変えて再検索してください。</div>';
    return;
  }
  els.results.innerHTML = `
    <div class="result-summary">
      <div>
        <small>検索語</small>
        <strong>${escapeHtml(query)}</strong>
      </div>
      <span>${results.length}件 / 資料情報と原文抜粋</span>
    </div>
    ${groupedResults(results, query, highlightTerms)}
  `;
}

function runSearch() {
  const query = els.searchInput.value;
  renderResults(searchSources(query), query);
  activateTab("results");
  els.searchInput.blur();
  window.scrollTo({ top: 0 });
}

function addFavorite(documentId, page) {
  const entry = sourceIndex.find((item) => item.documentId === documentId && item.page === Number(page));
  if (!entry) return;

  const favorites = getFavorites();
  const exists = favorites.some((item) => item.documentId === documentId && item.page === Number(page));
  if (!exists) {
    favorites.unshift({
      id: `favorite-${Date.now()}`,
      documentId,
      documentTitle: entry.documentTitle,
      version: entry.version,
      page: Number(page),
      label: `${entry.documentTitle} ${page}ページ`,
      createdAt: new Date().toISOString()
    });
    saveJson(storageKeys.favorites, favorites);
  }
  renderFavorites();
  renderPrepChecks();
  announce(exists ? "このページはお気に入りに登録済みです" : "お気に入りに追加しました");
}

function renderFavorites() {
  const favorites = getFavorites();
  if (favorites.length === 0) {
    els.favorites.innerHTML = '<div class="empty-state">お気に入りはまだありません。検索結果から「お気に入りに追加」を押すと、よく見るページに戻りやすくなります。</div>';
    return;
  }

  els.favorites.innerHTML = favorites.map((favorite, index) => `
    <article class="field-card">
      <div class="field-number">${index + 1}</div>
      <div class="field-body">
        <h3>${escapeHtml(favorite.label || favorite.documentTitle)}</h3>
        <div class="result-meta">
          <span>${escapeHtml(favorite.documentTitle)}</span>
          <span>${escapeHtml(favorite.version)}</span>
          <span>${favorite.page}ページ</span>
        </div>
        <div class="card-actions">
          <button class="primary-button" type="button" data-show-source="${favorite.documentId}" data-page="${favorite.page}">PDFを開く</button>
          <button type="button" data-open-pdf="${favorite.documentId}" data-page="${favorite.page}">別表示</button>
          <button type="button" data-move-favorite="${favorite.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>上へ</button>
          <button type="button" data-move-favorite="${favorite.id}" data-direction="1" ${index === favorites.length - 1 ? "disabled" : ""}>下へ</button>
          <button type="button" data-remove-favorite="${favorite.id}">外す</button>
        </div>
      </div>
    </article>
  `).join("");
}

function removeFavorite(id) {
  saveJson(storageKeys.favorites, getFavorites().filter((favorite) => favorite.id !== id));
  renderFavorites();
  renderPrepChecks();
}

function moveFavorite(id, direction) {
  const favorites = getFavorites();
  const index = favorites.findIndex((favorite) => favorite.id === id);
  const nextIndex = index + Number(direction);

  if (index < 0 || nextIndex < 0 || nextIndex >= favorites.length) return;

  const nextFavorites = [...favorites];
  const [item] = nextFavorites.splice(index, 1);
  nextFavorites.splice(nextIndex, 0, item);
  saveJson(storageKeys.favorites, nextFavorites);
  renderFavorites();
}

function parseHighlightTerms(value) {
  return uniqueTerms(String(value || "").split("|"));
}

function setActiveHighlightTerms(terms) {
  const fallbackTerms = buildHighlightTerms(els.searchInput.value);
  activeHighlightTerms = uniqueTerms(terms.length > 0 ? terms : fallbackTerms);
  activeMatchIndex = 0;
}

async function openPdf(documentId, pageNumber, terms = [], endPage = null) {
  setActiveHighlightTerms(terms);
  await setActivePdf(documentId, pageNumber, endPage);
  openPdfView();
  await renderPdfPage(els.pdfCanvas, 1.65);
}

let readerFocus = null;
let readerScroll = 0;
function openPdfView() {
  if (els.pdfDialog.open) return;
  readerFocus = document.activeElement;
  readerScroll = window.scrollY;
  els.pdfDialog.showModal();
  document.body.classList.add("pdf-view-active");
  history.pushState({ ...history.state, judgePdfOpen: true }, "");
}

function closePdfView(fromHistory = false) {
  if (!els.pdfDialog.open) return;
  els.pdfDialog.close();
  document.body.classList.remove("pdf-view-active");
  readerFocus?.focus({ preventScroll: true });
  window.scrollTo(0, readerScroll);
  if (!fromHistory && history.state?.judgePdfOpen) history.back();
}

function isCompactViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function getPdfDisplayWidth(viewport) {
  const availableWidth = window.innerWidth;
  const dialogWidth = Math.min(els.pdfDialog.clientWidth || availableWidth, availableWidth);
  return Math.min(viewport.width, dialogWidth);
}

async function setActivePdf(documentId, pageNumber, endPage = null) {
  const doc = getDocument(documentId);
  if (!doc) return;
  activeDoc = doc;
  const nextPdf = await loadPdfDocument(await getDocumentPdfSource(doc));
  if (activePdf) await activePdf.destroy();
  activePdf = nextPdf;
  activePage = Math.max(1, Math.min(activePdf.numPages, Number(pageNumber) || 1));
  activeUnitEndPage = endPage ? Math.max(activePage, Number(endPage)) : null;
  els.pdfTitle.textContent = doc.title;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = await getDocumentPdfObjectUrl(doc);
  els.openNativePdf.href = activeObjectUrl ? `${activeObjectUrl}#page=${activePage}` : "#";
  els.viewerTitle.textContent = doc.title;
  els.presentPdf.disabled = false;
  updateFloatingCaseButton(findEntry(activeEntryId));
  renderPdfContext();
  addHistoryItem(doc, activePage);
}

function currentHistoryContext() {
  const entry = findEntry(activeEntryId);
  const item = entry ? findClassification(entry.primaryId) : null;
  return {
    entryId: entry?.id || "",
    entryLabel: entry?.label || "",
    itemNumber: item?.number || "",
    itemTitle: item?.title || ""
  };
}

function addHistoryItem(doc, page) {
  const current = loadJson(storageKeys.history, []);
  const context = currentHistoryContext();
  const first = current[0];
  const isSameAsFirst = first
    && first.documentId === doc.id
    && first.page === page
    && first.entryId === context.entryId;
  if (isSameAsFirst) return;

  const next = [
    {
      id: `history-${Date.now()}`,
      documentId: doc.id,
      documentTitle: doc.title,
      version: doc.version,
      page,
      note: "",
      ...context,
      createdAt: new Date().toISOString()
    },
    ...current
  ].slice(0, 50);
  saveJson(storageKeys.history, next);
  renderHistoryItems();
}

function renderHistoryItems() {
  if (!els.historyItems) return;
  const history = loadJson(storageKeys.history, []);
  renderQuickRecent(history);
  if (history.length === 0) {
    els.historyItems.innerHTML = '<div class="empty-state">PDFを開くと、ここに確認履歴が残ります。</div>';
    return;
  }
  els.historyItems.innerHTML = history.map((item) => {
    const title = item.itemNumber
      ? `${item.itemNumber} ${item.itemTitle}`
      : item.documentTitle;
    const entryLabel = item.entryLabel ? `${item.entryLabel} / ` : "";
    return `
    <article class="history-card">
      <header>
        <strong>${escapeHtml(title)}</strong>
        <span class="history-meta">${escapeHtml(entryLabel)}${escapeHtml(item.documentTitle)} / ${escapeHtml(item.version)} / ${item.page}ページ / ${escapeHtml(formatDateTime(item.createdAt))}</span>
      </header>
      <div class="history-actions">
        <button class="primary-button" type="button" data-history-open="${item.id}">原文を開く</button>
        <button type="button" data-remove-history="${item.id}">削除</button>
      </div>
      <label class="history-note">
        <span>振り返りメモ</span>
        <textarea data-history-note="${item.id}" placeholder="大会後に確認したいこと">${escapeHtml(item.note || "")}</textarea>
      </label>
    </article>
  `;
  }).join("");
}

function renderFiltersPreservingSelection() {
  const selected = els.documentFilter.value;
  renderFilters();
  els.documentFilter.value = filters.some(filter => filter.id === selected) ? selected : "all";
  renderFilterChips();
}

function renderQuickRecent(history = loadJson(storageKeys.history, [])) {
  if (!els.quickRecent) return;
  const recent = history.slice(0, 5);
  if (recent.length === 0) {
    els.quickRecent.innerHTML = '<p class="quick-recent-empty">原文を開くと、ここからすぐ戻れます。</p>';
    return;
  }
  els.quickRecent.innerHTML = recent.map((item) => {
    const title = item.itemNumber
      ? `${item.itemNumber} ${item.itemTitle}`
      : item.documentTitle;
    return `
      <button class="quick-recent-button" type="button" data-history-open="${item.id}">
        <span class="quick-recent-title">${escapeHtml(title)}</span>
        <span class="quick-recent-meta">${escapeHtml(item.documentTitle)}・${item.page}p</span>
      </button>
    `;
  }).join("");
}

async function openHistoryItem(id) {
  const item = loadJson(storageKeys.history, []).find((historyItem) => historyItem.id === id);
  if (!item) return;
  if (item.entryId) {
    activeEntryId = item.entryId;
    await openEntryDocument(findEntry(item.entryId), item.documentId);
    return;
  }
  activeEntryId = "";
  await showSource(item.documentId, item.page);
}

function updateHistoryNote(id, value) {
  const history = loadJson(storageKeys.history, []);
  const next = history.map((item) => item.id === id ? { ...item, note: value } : item);
  saveJson(storageKeys.history, next);
}

function removeHistoryItem(id) {
  saveJson(storageKeys.history, loadJson(storageKeys.history, []).filter((item) => item.id !== id));
  renderHistoryItems();
}

async function showSource(documentId, pageNumber, terms = [], endPage = null) {
  setActiveHighlightTerms(terms);
  await setActivePdf(documentId, pageNumber, endPage);
  openPdfView();
  await renderPdfPage(els.pdfCanvas, 1.65);
}

async function renderPdfPage(canvas, scale) {
  if (!activePdf) return;
  if (canvas === els.pdfCanvas && activeUnitEndPage && activeUnitEndPage >= activePage) {
    await renderPdfPageRange(scale);
    return;
  }

  if (canvas === els.pdfCanvas && !els.pdfPageWrap.contains(els.pdfCanvas)) {
    els.pdfPageWrap.innerHTML = "";
    els.pdfPageWrap.append(els.pdfCanvas, els.pdfTextLayer);
  }

  const page = await activePdf.getPage(activePage);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  updatePageControls();
  if (canvas === els.pdfCanvas) {
    const displayWidth = getPdfDisplayWidth(viewport);
    const displayScale = displayWidth / viewport.width;
    els.pdfPageWrap.style.width = `${displayWidth}px`;
    els.pdfPageWrap.style.height = `${viewport.height * displayScale}px`;
    els.pdfPageWrap.style.maxWidth = "100%";
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${viewport.height * displayScale}px`;
    await renderPdfTextLayer(page, viewport);
  }
  if (canvas === els.viewerCanvas) {
    els.viewerCanvas.style.display = "block";
    els.viewerEmpty.style.display = "none";
  }
  await page.render({ canvasContext: context, viewport }).promise;
  if (canvas === els.pdfCanvas) {
    scrollPdfToTop();
  }
}

async function renderPdfPageRange(scale) {
  els.pdfPageWrap.innerHTML = "";
  els.pdfPageWrap.style.width = "";
  els.pdfPageWrap.style.height = "";
  els.pdfPageWrap.style.maxWidth = "100%";
  updatePageControls();

  const endPage = Math.min(activePdf.numPages, activeUnitEndPage || activePage);
  els.pdfPageLabel.textContent = `${activePage}-${endPage} / ${activePdf.numPages}ページ`;
  const renderQueue = [];

  for (let pageNumber = activePage; pageNumber <= endPage; pageNumber += 1) {
    const page = await activePdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const displayWidth = getPdfDisplayWidth(viewport);
    const displayScale = displayWidth / viewport.width;
    const pageWrap = document.createElement("div");
    const canvas = document.createElement("canvas");
    const textLayer = document.createElement("div");
    const context = canvas.getContext("2d");

    pageWrap.className = "pdf-unit-page";
    pageWrap.style.width = `${displayWidth}px`;
    pageWrap.style.height = `${viewport.height * displayScale}px`;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${viewport.height * displayScale}px`;
    textLayer.className = "pdf-text-layer";
    textLayer.setAttribute("aria-hidden", "true");

    pageWrap.append(canvas, textLayer);
    els.pdfPageWrap.appendChild(pageWrap);
    renderQueue.push({ page, viewport, textLayer, context });
  }

  for (const item of renderQueue) {
    await renderPdfTextLayer(item.page, item.viewport, item.textLayer);
    await item.page.render({ canvasContext: item.context, viewport: item.viewport }).promise;
  }

  scrollPdfToTop();
}

function scrollPdfToTop() {
  requestAnimationFrame(() => {
    els.pdfDialog.scrollTop = 0;
  });
}

async function renderPdfTextLayer(page, viewport, layer = els.pdfTextLayer) {
  layer.innerHTML = "";
  layer.style.width = `${viewport.width}px`;
  layer.style.height = `${viewport.height}px`;
  const displayWidth = getPdfDisplayWidth(viewport);
  const displayScale = displayWidth / viewport.width;
  layer.style.transform = `scale(${displayScale})`;

  if (activeHighlightTerms.length === 0) {
    updateMatchControls();
    return;
  }

  const textContent = await page.getTextContent();
  const fragment = document.createDocumentFragment();

  textContent.items.forEach((item) => {
    const value = normalizeText(item.str || "");
    if (!value) return;

    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(transform[2], transform[3]);
    const span = document.createElement("span");
    span.className = "pdf-text-item";
    span.style.left = `${transform[4]}px`;
    span.style.top = `${transform[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.innerHTML = highlight(value, "", activeHighlightTerms);
    fragment.appendChild(span);
  });

  layer.appendChild(fragment);
  updateMatchControls();
}

function getPdfMatches() {
  return [...els.pdfPageWrap.querySelectorAll("mark.pdf-highlight")];
}

function updateMatchControls() {
  const matches = getPdfMatches();
  const hasMatches = matches.length > 0;
  els.prevMatch.disabled = !hasMatches;
  els.nextMatch.disabled = !hasMatches;
  els.matchStatus.textContent = hasMatches
    ? `該当箇所を表示 ${activeMatchIndex + 1} / ${matches.length}`
    : "該当箇所を表示";
}

function scrollToActiveMatch() {
  const matches = getPdfMatches();
  if (matches.length === 0) {
    updateMatchControls();
    return;
  }
  const numberIndex = matches.findIndex((match) => /^\d+-\d+$/.test(match.textContent.trim()));
  if (activeMatchIndex === 0 && numberIndex >= 0) activeMatchIndex = numberIndex;
  activeMatchIndex = Math.min(activeMatchIndex, matches.length - 1);
  matches.forEach((match, index) => match.classList.toggle("is-current", index === activeMatchIndex));
  matches[activeMatchIndex].scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  updateMatchControls();
}

function moveMatch(delta) {
  const matches = getPdfMatches();
  if (matches.length === 0) return;
  activeMatchIndex = (activeMatchIndex + delta + matches.length) % matches.length;
  scrollToActiveMatch();
}

function updatePageControls() {
  const jump = document.querySelector("#pdf-page-input");
  jump.value = String(activePage);
  jump.max = String(activePdf?.numPages || 1);
  const pageLabel = activePdf ? `${activePage} / ${activePdf.numPages}ページ` : "原本ページをここに表示します";
  els.pdfPageLabel.textContent = pageLabel;
  els.viewerPageLabel.textContent = activeDoc ? `${activeDoc.version} / ${pageLabel}` : pageLabel;
  const isFirst = !activePdf || activePage <= 1;
  const isLast = !activePdf || activePage >= activePdf.numPages;
  els.prevPage.disabled = isFirst;
  els.nextPage.disabled = isLast;
  els.viewerPrevPage.disabled = isFirst;
  els.viewerNextPage.disabled = isLast;
  if (activeDoc) {
    els.openNativePdf.href = activeObjectUrl ? `${activeObjectUrl}#page=${activePage}` : "#";
  }
}

async function movePage(delta, canvas, scale) {
  if (!activePdf) return;
  activePage = Math.min(activePdf.numPages, Math.max(1, activePage + delta));
  activeUnitEndPage = null;
  activeMatchIndex = 0;
  await renderPdfPage(canvas, scale);
}

function updateOfflineStatus(message, state = "neutral") {
  els.offlineStatus.textContent = message;
  els.offlineStatus.dataset.state = state;
  renderPrepChecks();
}

async function prepareOffline() {
  els.prepareOffline.disabled = true;
  updateOfflineStatus("保存中", "neutral");

  try {
    await queueLibraryTask(() => buildIndex(false));
    if ("serviceWorker" in navigator && isServiceWorkerAllowed()) {
      const registration = await navigator.serviceWorker.register("service-worker.js");
      await navigator.serviceWorker.ready;
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
      localStorage.setItem(storageKeys.offlinePreparedAt, new Date().toISOString());
      updateOfflineStatus("保存済み", "ready");
      renderPrepChecks();
    } else {
      updateOfflineStatus("HTTPS公開で保存可", "warning");
    }
  } catch (error) {
    console.error(error);
    updateOfflineStatus("保存失敗", "warning");
  } finally {
    els.prepareOffline.disabled = false;
  }
}

function initOfflineStatus() {
  if (!navigator.onLine) {
    updateOfflineStatus("オフライン", "ready");
    return;
  }

  const preparedAt = localStorage.getItem(storageKeys.offlinePreparedAt);
  if (preparedAt) {
    updateOfflineStatus("保存済み", "ready");
    return;
  }

  if (!isServiceWorkerAllowed()) {
    updateOfflineStatus("LAN確認中", "warning");
    return;
  }

  updateOfflineStatus("未保存", "neutral");
}

const routeScroll = new Map();
let feedbackTimer;
function announce(message) {
  const feedback = document.querySelector("#action-feedback");
  feedback.textContent = message;
  feedback.classList.add("is-visible");
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => feedback.classList.remove("is-visible"), 3000);
}

function activateTab(id) {
  const previous = document.body.dataset.route;
  routeScroll.set(previous, window.scrollY);
  document.body.dataset.route = id;
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === id));
  Object.entries(els.views).forEach(([viewId, view]) => {
    view.classList.toggle("is-active", viewId === id);
  });
  document.querySelectorAll(".bottom-nav button").forEach(button => {
    if (button.dataset.navTab === id) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (previous !== id) window.scrollTo(0, routeScroll.get(id) || 0);
}

let readerTask = Promise.resolve();
function queueReader(task) {
  readerTask = readerTask.then(task).catch(error => {
    console.error(error);
    announce("PDFを表示できませんでした。資料の登録状況を確認してください。");
  });
  return readerTask;
}

function handleDelegatedClick(event) {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.entryId) {
    const entry = findEntry(target.dataset.entryId);
    activeEntryId = entry?.id || "";
    renderEntryDetail(entry);
    queueReader(() => openEntryDocument(entry, "penalty-guideline"));
  }

  if (target.dataset.groupToggle) {
    const group = target.dataset.groupToggle;
    if (expandedGroups.has(group)) {
      expandedGroups.delete(group);
    } else {
      expandedGroups.add(group);
    }
    renderClassificationCards();
  }

  if (target.dataset.entryOpen) {
    queueReader(() => openEntryDocument(findEntry(target.dataset.entryOpen), target.dataset.documentId));
  }

  if (target.dataset.floatingCases) {
    queueReader(() => openEntryDocument(findEntry(target.dataset.floatingCases), target.dataset.floatingDocument || "ruling-case"));
  }

  if (target.dataset.entrySearchCases) {
    searchEntryCases(findEntry(target.dataset.entrySearchCases));
  }

  if (target.dataset.shortcut) {
    const shortcut = shortcuts[Number(target.dataset.shortcut)];
    els.searchInput.value = shortcut.query;
    els.documentFilter.value = "penalty-and-ruling";
    runSearch();
  }

  if (target.dataset.classificationAction) {
    const item = findClassification(target.dataset.classificationId);
    const entry = entryItems.find((candidate) => candidate.primaryId === item?.id);
    if (entry) activeEntryId = entry.id;
    runClassificationSearch(
      item,
      target.dataset.classificationAction
    );
  }

  if (target.dataset.detectedClassificationId) {
    const item = findClassification(target.dataset.detectedClassificationId);
    activeEntryId = "";
    queueReader(() => openClassificationSource(item, "penalty-guideline"));
  }

  if (target.dataset.filterChip) {
    els.documentFilter.value = target.dataset.filterChip;
    renderFilterChips();
    if (els.searchInput.value.trim()) runSearch();
  }

  if (target.dataset.openPdf) {
    activeEntryId = "";
    queueReader(() => openPdf(target.dataset.openPdf, target.dataset.page, parseHighlightTerms(target.dataset.highlightTerms)));
  }

  if (target.dataset.showSource) {
    activeEntryId = "";
    queueReader(() => showSource(target.dataset.showSource, target.dataset.page, parseHighlightTerms(target.dataset.highlightTerms)));
  }

  if (target.dataset.favorite) {
    addFavorite(target.dataset.favorite, target.dataset.page);
  }

  if (target.dataset.removeFavorite) {
    removeFavorite(target.dataset.removeFavorite);
  }

  if (target.dataset.moveFavorite) {
    moveFavorite(target.dataset.moveFavorite, target.dataset.direction);
  }

  if (target.dataset.quoteSource) {
    activateTab("history");
  }

  if (target.dataset.historyOpen) {
    queueReader(() => openHistoryItem(target.dataset.historyOpen));
  }

  if (target.dataset.removeHistory) {
    removeHistoryItem(target.dataset.removeHistory);
  }

  if (target.dataset.removePdf) {
    removeRegisteredPdf(target.dataset.removePdf).catch(reportLibraryError);
  }

  if (target.dataset.resetClassification !== undefined) {
    resetClassificationOverride();
  }

  if (target.dataset.navTab) {
    activateTab(target.dataset.navTab);
    if (target.dataset.navTab === "results") window.scrollTo(0, 0);
  }

  if (target.dataset.navSection) {
    document.querySelector(`#${target.dataset.navSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function init() {
  await library.migrate(loadJson(storageKeys.pdfRegistrations, {}), loadJson(storageKeys.index, []));
  await reloadRegistrations();
  localStorage.removeItem(storageKeys.index);
  localStorage.removeItem(storageKeys.pdfRegistrations);
  await loadClassificationData();
  renderFilters();
  renderShortcuts();
  renderClassificationCards();
  renderDocuments();
  renderSetupDocuments();
  renderFavorites();
  renderHistoryItems();
  renderResults([], "");
  renderPrepChecks();
  updateSetupState();
  document.addEventListener("click", handleDelegatedClick);
  document.addEventListener("input", (event) => {
    if (event.target.dataset.historyNote) {
      updateHistoryNote(event.target.dataset.historyNote, event.target.value);
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.dataset.pdfUpload) {
      const file = event.target.files?.[0];
      event.target.disabled = true;
      registerPdf(event.target.dataset.pdfUpload, file)
        .catch(reportLibraryError)
        .finally(() => {
          event.target.disabled = false;
          event.target.value = "";
        });
    }
    if (event.target.dataset.classificationImport !== undefined) {
      const file = event.target.files?.[0];
      event.target.disabled = true;
      importClassificationFile(file)
        .finally(() => {
          event.target.disabled = false;
          event.target.value = "";
        });
    }
  });
  els.searchButton.addEventListener("click", runSearch);
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); runSearch(); }
  });
  els.refreshIndex.addEventListener("click", () => queueLibraryTask(() => buildIndex(true)).catch(reportLibraryError));
  els.prepareOffline.addEventListener("click", prepareOffline);
  if (els.toggleShortcuts) {
    els.toggleShortcuts.addEventListener("click", () => {
      shortcutsExpanded = !shortcutsExpanded;
      renderShortcuts();
    });
  }
  els.prepRun.addEventListener("click", () => {
    initOfflineStatus();
    activateTab("prep");
  });
  window.addEventListener("online", initOfflineStatus);
  window.addEventListener("offline", initOfflineStatus);
  els.tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
  activateTab("home");
  if (history.state?.judgePdfOpen) history.replaceState({ ...history.state, judgePdfOpen: false }, "");
  window.addEventListener("popstate", () => closePdfView(true));
  els.closePdf.addEventListener("click", () => closePdfView());
  els.pdfDialog.addEventListener("cancel", event => { event.preventDefault(); closePdfView(); });
  document.querySelector("#pdf-page-jump").addEventListener("submit", event => {
    event.preventDefault();
    const input = document.querySelector("#pdf-page-input");
    const requested = Number(input.value);
    queueReader(async () => {
      if (!activePdf || requested < 1 || requested > activePdf.numPages || !Number.isInteger(requested)) return;
      activePage = requested;
      activeUnitEndPage = null;
      await renderPdfPage(els.pdfCanvas, 1.65);
      addHistoryItem(activeDoc, activePage);
    });
  });
  els.presentPdf.addEventListener("click", async () => {
    if (!activePdf) return;
    openPdfView();
    await renderPdfPage(els.pdfCanvas, 1.65);
  });
  els.prevPage.addEventListener("click", async () => {
    await queueReader(() => movePage(-1, els.pdfCanvas, 1.65));
  });
  els.nextPage.addEventListener("click", async () => {
    await queueReader(() => movePage(1, els.pdfCanvas, 1.65));
  });
  els.prevMatch.addEventListener("click", () => moveMatch(-1));
  els.nextMatch.addEventListener("click", () => moveMatch(1));
  els.toggleMarkers.addEventListener("click", () => {
    const nextValue = !document.body.classList.contains("pdf-markers-visible");
    document.body.classList.toggle("pdf-markers-visible", nextValue);
    els.toggleMarkers.setAttribute("aria-pressed", String(nextValue));
  });
  els.viewerPrevPage.addEventListener("click", async () => {
    await movePage(-1, els.viewerCanvas, 1.25);
  });
  els.viewerNextPage.addEventListener("click", async () => {
    await movePage(1, els.viewerCanvas, 1.25);
  });

  try {
    await buildIndex(false);
  } catch (error) {
    els.indexStatus.textContent = "PDFを読み込めませんでした。ファイル形式またはブラウザの対応状況を確認してください。";
    console.error(error);
  }

  initOfflineStatus();
  await initLibraryTools({
    library, getRegistrations, importPdf: registerPdf,
    isReading: () => document.body.classList.contains("pdf-view-active")
  });

  if ("serviceWorker" in navigator && isServiceWorkerAllowed()) {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.info("Service worker registration skipped.", error);
    });
  }
}

function reportLibraryError(error) {
  console.error(error);
  els.indexStatus.textContent = error.message || "資料を処理できませんでした。";
}

init().catch(reportLibraryError);
