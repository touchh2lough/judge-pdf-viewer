// PDF, metadata and extracted text are committed in one IndexedDB transaction.
export class PdfLibrary {
  constructor(indexedDB = globalThis.indexedDB) { this.indexedDB = indexedDB; }

  open() {
    return new Promise((resolve, reject) => {
      const request = this.indexedDB.open("judgePdfStore", 2);
      let blocked = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["pdfs", "documents", "indexes"]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "documentId" });
        }
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      };
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error("他のタブを閉じてから再読み込みしてください。")); };
    });
  }

  async transaction(names, mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result;
      try { result = callback(tx); } catch (error) { tx.abort(); db.close(); reject(error); return; }
      tx.oncomplete = () => { db.close(); resolve(result?.result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("保存に失敗しました。")); };
    });
  }

  getPdf(id) { return this.transaction(["pdfs"], "readonly", tx => tx.objectStore("pdfs").get(id)); }
  listDocuments() { return this.transaction(["documents"], "readonly", tx => tx.objectStore("documents").getAll()); }
  getIndex(id) { return this.transaction(["indexes"], "readonly", tx => tx.objectStore("indexes").get(id)); }
  getSetting(key) { return this.transaction(["settings"], "readonly", tx => tx.objectStore("settings").get(key)); }
  setSetting(key, value) { return this.transaction(["settings"], "readwrite", tx => tx.objectStore("settings").put(value, key)); }

  putDocument(record, metadata, pages) {
    return this.transaction(["pdfs", "documents", "indexes"], "readwrite", tx => {
      tx.objectStore("pdfs").put(record);
      tx.objectStore("documents").put(metadata);
      tx.objectStore("indexes").put({ documentId: record.documentId, hash: metadata.hash, pages });
    });
  }

  putIndex(id, hash, pages) {
    return this.transaction(["indexes"], "readwrite", tx => tx.objectStore("indexes").put({ documentId: id, hash, pages }));
  }

  deleteDocument(id) {
    return this.transaction(["pdfs", "documents", "indexes"], "readwrite", tx => {
      for (const name of ["pdfs", "documents", "indexes"]) tx.objectStore(name).delete(id);
    });
  }

  async migrate(registrations, oldIndex) {
    const existing = new Set((await this.listDocuments()).map(item => item.documentId));
    for (const [id, metadata] of Object.entries(registrations)) {
      if (existing.has(id)) continue;
      const record = await this.getPdf(id);
      if (!record?.buffer) continue;
      await this.putDocument(record, { ...metadata, documentId: id, source: { kind: "manual" } },
        Array.isArray(oldIndex) ? oldIndex.filter(page => page.documentId === id) : []);
    }
  }
}
