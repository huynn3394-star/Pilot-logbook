const DB = "avilog-preview-v1";
let db;
export async function connect() {
  return (db ||= await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("workspace");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function readState() {
  const d = await connect();
  return new Promise((resolve, reject) => {
    const r = d.transaction("workspace").objectStore("workspace").get("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function writeState(state) {
  const d = await connect();
  return new Promise((resolve, reject) => {
    const t = d.transaction("workspace", "readwrite");
    t.objectStore("workspace").put(state, "state");
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || Error("Không thể lưu dữ liệu"));
  });
}
