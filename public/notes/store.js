import { clone, equal, id, merge, validate, expired, backup, parseBackup } from "./model.js";
const DB = "avilog-notes-v1";
const request = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
async function openNotes({ uid = "@guest", indexedDB = globalThis.indexedDB, channel = true } = {}) {
  const opening = indexedDB.open(DB, 1);
  opening.onupgradeneeded = () => {
    const db2 = opening.result;
    const records = db2.createObjectStore("records", { keyPath: "key" });
    records.createIndex("uid", "uid");
    db2.createObjectStore("meta", { keyPath: "key" });
    db2.createObjectStore("documents", { keyPath: "key" });
  };
  const db = await request(opening);
  db.onversionchange = () => db.close();
  const listeners = /* @__PURE__ */ new Set(), bc = channel && globalThis.BroadcastChannel ? new BroadcastChannel(DB) : null, key = (n) => uid + "\0" + n;
  const emit = () => {
    for (const f of listeners) f();
    bc?.postMessage({ uid });
  };
  if (bc) bc.onmessage = (e) => {
    if (e.data?.uid === uid) for (const f of listeners) f();
  };
  function tx(stores, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode), s = Object.fromEntries(stores.map((n) => [n, t.objectStore(n)]));
      let result, failure;
      const fail = (e) => {
        failure = e;
        t.abort();
      };
      try {
        fn(s, (v) => {
          result = v;
        }, fail);
      } catch (e) {
        t.abort();
        reject(e);
        return;
      }
      t.oncomplete = () => resolve(clone(result));
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(failure || t.error || Error("Không thể lưu Notes."));
    });
  }
  async function all() {
    const rows = await tx(["records"], "readonly", (s, out) => {
      const r = s.records.index("uid").getAll(uid);
      r.onsuccess = () => out(r.result);
    });
    return rows;
  }
  async function mutate(noteId, fn) {
    const result = await tx(["records"], "readwrite", (s, out, fail) => {
      const r = s.records.get(key(noteId));
      r.onsuccess = () => {
        try {
          const previous = r.result;
          const next = fn(previous ? clone(previous) : null);
          if (next) {
            next.key = key(noteId);
            next.uid = uid;
            next.id = noteId;
            s.records.put(next);
          }
          out(next);
        } catch (e) {
          fail(e);
        }
      };
    });
    emit();
    return result;
  }
  const addVersion = (list, value, label) => {
    if (!list.some((v) => equal(v.value, value))) list.push({ id: id(), at: Date.now(), label, value: clone(value) });
  };
  async function save(value, { expected, base, resolve = false } = {}) {
    value = validate(value);
    return mutate(value.id, (old) => {
      if (!old) return { value, base: null, revision: 0, localRevision: 1, dirty: true, conflicts: [], history: [] };
      if (old.expired) throw Error("Ghi chú đã hết thời hạn khôi phục. Hãy tạo ghi chú mới từ bản sao.");
      let next = value;
      if (expected !== void 0 && expected !== old.localRevision) {
        const merged = merge(base, value, old.value);
        if (merged.conflict) {
          addVersion(old.conflicts, value, "Chỉnh sửa đồng thời trên máy");
          old.localRevision++;
          return old;
        }
        next = merged.value;
      }
      if (resolve) {
        for (const version of old.conflicts) addVersion(old.history, version.value, "Bản trước khi giải quyết xung đột");
        old.conflicts = [];
      }
      old.value = next;
      old.localRevision++;
      old.dirty = !equal(old.value, old.base);
      return old;
    });
  }
  async function receive(remote) {
    return mutate(remote.id, (old) => {
      if (old && remote.revision < old.revision) return old;
      const value = remote.value && !expired(remote.value) ? validate(remote.value) : null;
      if (!old) return { value, base: value, revision: remote.revision, localRevision: 1, dirty: false, conflicts: [], history: [], expired: !value };
      if (remote.revision === old.revision && equal(value, old.base)) return old;
      if (old.sentOperation && old.sentOperation.operationId === remote.operationId) {
        if (old.localRevision === old.sentOperation.localRevision) old.value = value;
        old.base = value;
        old.revision = remote.revision;
        old.dirty = !equal(old.value, value);
        old.expired = !value && !old.dirty;
        return old;
      }
      const result = merge(old.base, old.value, value);
      if (result.conflict) {
        addVersion(old.conflicts, old.value, "Bản trên máy");
        addVersion(old.conflicts, value, "Bản trên Cloud");
      } else old.value = result.value;
      old.base = value;
      old.revision = remote.revision;
      old.localRevision++;
      old.dirty = !equal(old.value, value);
      old.expired = !value && !old.dirty;
      return old;
    });
  }
  async function nextOperation() {
    return tx(["records", "meta"], "readwrite", (s, out) => {
      const r = s.meta.get(key("inflight"));
      r.onsuccess = () => {
        if (r.result?.operation) {
          out(r.result.operation);
          return;
        }
        const q = s.records.index("uid").getAll(uid);
        q.onsuccess = () => {
          const e = q.result.find((e2) => e2.dirty && !e2.conflicts.length && !e2.expired);
          if (!e) {
            out(null);
            return;
          }
          const operation = { operationId: id(), id: e.id, baseRevision: e.revision, localRevision: e.localRevision, value: clone(e.value) };
          e.sentOperation = clone(operation);
          s.records.put(e);
          s.meta.put({ key: key("inflight"), operation });
          out(operation);
        };
      };
    });
  }
  async function acknowledge(operation, remote) {
    await receive(remote);
    await mutate(operation.id, (old) => {
      if (old?.sentOperation?.operationId === operation.operationId) old.sentOperation = null;
      return old;
    });
    await tx(["meta"], "readwrite", (s) => {
      const r = s.meta.get(key("inflight"));
      r.onsuccess = () => {
        if (r.result?.operation?.operationId === operation.operationId) s.meta.delete(key("inflight"));
      };
    });
  }
  async function snapshot() {
    const value = backup(await all());
    await tx(["meta"], "readwrite", (s) => s.meta.put({ key: key("recovery-backup"), value }));
    return value;
  }
  async function restore(input) {
    const rows = parseBackup(input);
    await snapshot();
    for (const row of rows) {
      await mutate(row.value.id, (old) => {
        if (!old) return { value: row.value, base: null, revision: 0, localRevision: 1, dirty: true, conflicts: row.conflicts, history: row.history };
        for (const c of [...row.conflicts, ...row.history]) addVersion(old.history, c.value, "Bản sao lưu");
        if (!equal(old.value, row.value)) addVersion(old.conflicts, row.value, "Khôi phục bản sao lưu");
        return old;
      });
    }
    return rows.length;
  }
  async function sweep(now = Date.now()) {
    await tx(["meta"], "readwrite", (s) => {
      const r = s.meta.get(key("inflight"));
      r.onsuccess = () => {
        if (expired(r.result?.operation?.value, now)) s.meta.delete(key("inflight"));
      };
    });
    for (const e of await all()) if (expired(e.value, now)) await mutate(e.id, (old) => ({ ...old, value: null, base: null, sentOperation: null, conflicts: [], history: [], dirty: false, expired: true, localRevision: old.localRevision + 1 }));
  }
  return {
    uid,
    all,
    save,
    receive,
    nextOperation,
    acknowledge,
    snapshot,
    restore,
    sweep,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async get(noteId) {
      return tx(["records"], "readonly", (s, out) => {
        const r = s.records.get(key(noteId));
        r.onsuccess = () => out(r.result || null);
      });
    },
    async putDocument(sourceId, file) {
      await tx(["documents"], "readwrite", (s) => s.documents.put({ key: key(sourceId), file }));
    },
    async getDocument(sourceId) {
      return tx(["documents"], "readonly", (s, out) => {
        const r = s.documents.get(key(sourceId));
        r.onsuccess = () => out(r.result?.file || null);
      });
    },
    async recoveryBackup() {
      return tx(["meta"], "readonly", (s, out) => {
        const r = s.meta.get(key("recovery-backup"));
        r.onsuccess = () => out(r.result?.value || null);
      });
    },
    close() {
      bc?.close();
      listeners.clear();
      db.close();
    }
  };
}
export {
  openNotes
};
