import { OFFICIAL_IDS, selectFolderCandidates, updateIsDue, validOfficialUrl, MAX_PDF_BYTES } from "./import-policy.mjs";
import { UPDATE_API_BASE } from "./update-config.mjs";

export async function initLibraryTools({ library, getRegistrations, importPdf, isReading }) {
  const root = document.querySelector("#library-tools");
  if (!root) return;
  let settings = { enabled: true, ...await library.getSetting("official-updates") };
  let folder = await library.getSetting("import-folder");
  let busy = false;
  let folderLastScan = 0;
  const supported = "showDirectoryPicker" in window;
  root.innerHTML = `
    <details class="library-panel" ${Object.keys(getRegistrations()).length ? "" : "open"}>
      <summary>PDFの更新・取り込み <span data-library-count></span></summary>
      <div class="library-sections">
        <section>
          <h2>公式PDFの自動更新</h2>
          <p>アプリを開いた際に1日1回、公開されている4資料を確認します。更新に失敗しても登録済みのPDFは使えます。</p>
          <label class="library-check"><input type="checkbox" data-auto-update ${settings.enabled ? "checked" : ""}>起動時に自動更新する</label>
          <div class="document-actions"><button type="button" data-sync-official ${UPDATE_API_BASE ? "" : "disabled"}>今すぐ確認・取得</button>
          <a class="button-link" href="https://www.pokemon-card.com/rules/" target="_blank" rel="noopener">公式配布ページ</a></div>
          <p class="library-status" role="status" data-official-status></p>
        </section>
        <section>
          <h2>選択フォルダから取り込み</h2>
          <p>ダウンロードフォルダなどを選ぶと、その直下の対象PDFを起動時と10分ごとに確認します。公式資料名・ジャッジ通信のファイル名を対象にし、無関係なファイルは登録しません。</p>
          <div class="document-actions">
            ${supported ? '<button type="button" data-choose-folder>フォルダを選択</button><button type="button" data-scan-folder>今すぐ取り込み</button><button type="button" data-forget-folder>連携解除</button>' : '<label class="file-upload-field"><span>端末のPDFを選択（複数可）</span><input type="file" accept="application/pdf,.pdf" multiple data-folder-files></label>'}
          </div>
          <p class="library-status" role="status" data-folder-status></p>
        </section>
        <section>
          <h2>ジャッジ通信</h2>
          <p>配布されたPDFを号ごとに追加できます。PDFと検索データはこの端末のブラウザに保存します。追加した全号を「ジャッジ通信」でまとめて検索できます。</p>
          <label class="file-upload-field"><span>ジャッジ通信を追加（複数可）</span><input type="file" accept="application/pdf,.pdf" multiple data-news-files></label>
          <p class="library-status" role="status" data-news-status></p>
        </section>
      </div>
    </details>`;
  const find = selector => root.querySelector(selector);
  const status = (area, message) => { find(`[data-${area}-status]`).textContent = message; };
  const stamp = value => value ? new Date(value).toLocaleString("ja-JP") : "未確認";
  const refreshCount = () => {
    const all = Object.values(getRegistrations());
    find("[data-library-count]").textContent = `${all.length}資料 / 通信${all.filter(doc => doc.kind === "judge-news").length}号`;
  };
  function refreshOfficialStatus() {
    status("official", !UPDATE_API_BASE ? "自動取得は公開準備中です。手動登録とフォルダ取り込みは利用できます。" :
      settings.lastError ? `確認できませんでした：${settings.lastError} 登録済みPDFを維持しています。` :
      `最終確認：${stamp(settings.lastSuccess)}${settings.summary ? ` / ${settings.summary}` : ""}`);
  }
  function refreshFolderStatus() {
    status("folder", supported ? folder ? `「${folder.name}」を連携中。アクセス許可が切れた場合は「今すぐ取り込み」で再許可できます。` : "最初に読み取り専用でフォルダを選択してください。" :
      "このブラウザでは継続的なフォルダ連携に対応していません。PDFを選択して取り込めます。PC版Chrome・Edgeではフォルダ連携を使えます。");
    if (supported) {
      find("[data-scan-folder]").disabled = !folder;
      find("[data-forget-folder]").disabled = !folder;
    }
  }
  async function run(area, task) {
    if (busy) return;
    busy = true;
    root.querySelectorAll("button,input").forEach(input => { input.disabled = true; });
    try { await task(); } catch (error) { status(area, error.message || "取り込みに失敗しました。"); }
    finally {
      busy = false;
      root.querySelectorAll("button,input").forEach(input => { input.disabled = false; });
      if (!UPDATE_API_BASE) find("[data-sync-official]").disabled = true;
      if (supported) {
        find("[data-scan-folder]").disabled = !folder;
        find("[data-forget-folder]").disabled = !folder;
      }
      refreshCount();
    }
  }

  async function syncOfficial() {
    if (!UPDATE_API_BASE || !navigator.onLine) { status("official", "オンラインになったら更新を確認します。"); return; }
    settings.lastAttempt = new Date().toISOString();
    settings.lastError = "";
    await library.setSetting("official-updates", settings);
    status("official", "公式ページの最新PDFを確認しています…");
    const errors = [];
    let imported = 0;
    let unchanged = 0;
    try {
      const response = await fetch(`${UPDATE_API_BASE}/v1/sources`, { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`公式ページを確認できませんでした (${response.status})。`);
      const manifest = await response.json();
      if (!Array.isArray(manifest.sources) || manifest.sources.length !== OFFICIAL_IDS.length ||
          new Set(manifest.sources.map(source => source.id)).size !== OFFICIAL_IDS.length ||
          manifest.sources.some(source => !OFFICIAL_IDS.includes(source.id) || !validOfficialUrl(source.url))) {
        throw new Error("公式PDFの一覧を確認できませんでした。");
      }
      for (const source of manifest.sources) {
        try {
          status("official", `${source.title} を確認しています…`);
          const previous = getRegistrations()[source.id];
          const validator = previous?.source?.url === source.url ? previous.source.etag : "";
          let response = await fetch(`${UPDATE_API_BASE}/v1/pdf/${source.id}`, {
            cache: "no-store", credentials: "omit", headers: validator ? { "If-None-Match": validator } : {},
            signal: AbortSignal.timeout(60000)
          });
          if (response.status === 304 && previous) {
            if (response.headers.get("X-Official-Source-URL") === previous.source?.url) { unchanged++; continue; }
            response = await fetch(`${UPDATE_API_BASE}/v1/pdf/${source.id}`, {
              cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000)
            });
          }
          if (!response.ok) throw new Error(`取得に失敗しました (${response.status})。`);
          if (Number(response.headers.get("content-length")) > MAX_PDF_BYTES) throw new Error("PDFが大きすぎます。");
          const blob = await response.blob();
          if (blob.size > MAX_PDF_BYTES) throw new Error("PDFが大きすぎます。");
          const url = response.headers.get("X-Official-Source-URL") || source.url;
          if (!validOfficialUrl(url)) throw new Error("公式PDFの取得元を確認できませんでした。");
          const file = new File([blob], decodeURIComponent(new URL(url).pathname.split("/").pop()), { type: "application/pdf" });
          const result = await importPdf(source.id, file, { automatic: true, source: {
            kind: "official", url, etag: response.headers.get("etag") || ""
          } });
          if (result.status === "imported") imported++; else unchanged++;
        } catch (error) { errors.push(`${source.title}：${error.message}`); }
      }
      if (errors.length) throw new Error(errors.join(" / "));
      settings.lastSuccess = new Date().toISOString();
      settings.summary = `${imported}資料を更新、${unchanged}資料は変更なし`;
      settings.lastError = "";
    } catch (error) { settings.lastError = error.message || "通信に失敗しました。"; }
    await library.setSetting("official-updates", settings);
    refreshOfficialStatus();
  }

  async function importCandidates(candidates, area, automatic) {
    let imported = 0;
    let unchanged = 0;
    const errors = [];
    for (const { id, file } of candidates) {
      status(area, `${file.name} を確認しています…`);
      try {
        const result = await importPdf(id, file, { automatic, source: { kind: area === "folder" ? "folder" : "manual" } });
        if (result.status === "imported") imported++; else if (result.status === "unchanged") unchanged++;
      } catch (error) { errors.push(`${file.name}：${error.message}`); }
    }
    status(area, `${imported}件を取り込み、${unchanged}件は登録済み。${candidates.length ? "" : "対象のファイル名のPDFがありません。"}${errors.length ? ` / 見送り：${errors.join(" / ")}` : ""}`);
  }

  async function scanFolder(requestPermission = false) {
    if (!folder) return;
    let permission = await folder.queryPermission({ mode: "read" });
    if (permission !== "granted" && requestPermission) permission = await folder.requestPermission({ mode: "read" });
    if (permission !== "granted") { status("folder", "フォルダの読み取り許可が必要です。「今すぐ取り込み」を押してください。"); return; }
    const files = [];
    let count = 0;
    for await (const entry of folder.values()) {
      if (++count > 1000) throw new Error("ファイルが多いため、PDF専用のフォルダを選んでください。");
      if (entry.kind === "file" && /\.pdf$/i.test(entry.name)) files.push(await entry.getFile());
    }
    await importCandidates(selectFolderCandidates(files), "folder", true);
    folderLastScan = Date.now();
  }

  find("[data-auto-update]").addEventListener("change", async event => {
    settings.enabled = event.target.checked;
    try {
      await library.setSetting("official-updates", settings);
      if (settings.enabled) void run("official", syncOfficial);
    } catch (error) { status("official", error.message); }
  });
  find("[data-sync-official]").addEventListener("click", () => run("official", syncOfficial));
  if (supported) {
    find("[data-choose-folder]").addEventListener("click", () => run("folder", async () => {
      try {
        const selected = await window.showDirectoryPicker({ mode: "read", startIn: "downloads", id: "judge-pdf-import" });
        await library.setSetting("import-folder", selected);
        folder = selected;
        refreshFolderStatus();
        await scanFolder();
      } catch (error) { if (error.name !== "AbortError") throw error; }
    }));
    find("[data-scan-folder]").addEventListener("click", () => run("folder", () => scanFolder(true)));
    find("[data-forget-folder]").addEventListener("click", () => run("folder", async () => {
      await library.setSetting("import-folder", null);
      folder = null;
      refreshFolderStatus();
    }));
  } else {
    find("[data-folder-files]").addEventListener("change", event => {
      const candidates = selectFolderCandidates(Array.from(event.target.files || []));
      event.target.value = "";
      void run("folder", () => importCandidates(candidates, "folder", false));
    });
  }
  find("[data-news-files]").addEventListener("change", event => {
    const candidates = Array.from(event.target.files || []).map(file => ({ id: "judge-news", file }));
    event.target.value = "";
    void run("news", () => importCandidates(candidates, "news", false));
  });
  async function tick() {
    if (busy || document.visibilityState === "hidden" || isReading()) return;
    if (UPDATE_API_BASE && navigator.onLine && updateIsDue(settings)) await run("official", syncOfficial);
    if (folder && supported && Date.now() - folderLastScan >= 10 * 60 * 1000) {
      // Permission checks never open a prompt on startup or on a timer.
      folderLastScan = Date.now();
      await run("folder", () => scanFolder(false));
    }
  }
  document.addEventListener("library-changed", refreshCount);
  window.addEventListener("online", () => { void tick(); });
  document.addEventListener("visibilitychange", () => { void tick(); });
  setInterval(() => { void tick(); }, 60 * 1000);
  refreshCount();
  refreshOfficialStatus();
  refreshFolderStatus();
  void tick();
}
