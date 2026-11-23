const DAY = 864e5, TRASH_DAYS = 30, FORMAT = "avilog-notes-v1";
const clone = (value) => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const id = () => crypto.randomUUID();
const text = (body) => (body || []).map((b) => b.runs.map((r) => r.text).join("")).join("\n");
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function safeLink(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:", "mailto:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
function richHTML(body) {
  let number = 0;
  return body.map((b) => {
    number = b.type === "number" ? number + 1 : 0;
    const content = b.runs.map((r) => {
      let s = escape(r.text);
      if (r.bold) s = `<strong>${s}</strong>`;
      if (r.italic) s = `<em>${s}</em>`;
      if (r.href && safeLink(r.href)) s = `<a href="${escape(safeLink(r.href))}" target="_blank" rel="noopener noreferrer">${s}</a>`;
      return s;
    }).join("") || "<br>";
    return b.type === "check" ? `<div data-check="${b.checked ? "true" : "false"}"><input type="checkbox" ${b.checked ? "checked" : ""} aria-label="Hoàn thành"> <span>${content}</span></div>` : b.type === "bullet" ? `<ul><li>${content}</li></ul>` : b.type === "number" ? `<ol start="${number}"><li>${content}</li></ol>` : `<div>${content}</div>`;
  }).join("");
}
const paragraph = (value) => [{ type: "paragraph", runs: [{ text: String(value) }] }];
function validate(value) {
  if (!value || !["note", "folder", "source"].includes(value.kind) || !/^[-\w:]{1,128}$/.test(value.id) || typeof value.title !== "string" || value.title.length > 240) throw Error("Ghi chú không hợp lệ.");
  for (const k of ["createdAt", "updatedAt"]) if (!Number.isSafeInteger(value[k]) || value[k] < 0) throw Error("Thời gian ghi chú không hợp lệ.");
  if (value.kind === "note") {
    if (!Array.isArray(value.body) || JSON.stringify(value.body).length > 1e5 || !Array.isArray(value.tags) || value.tags.length > 30 || value.tags.some((t) => typeof t !== "string" || t.length > 80) || typeof value.pinned !== "boolean" || typeof value.folderId !== "string") throw Error("Nội dung hoặc nhãn vượt giới hạn.");
    for (const b of value.body) {
      if (!["paragraph", "bullet", "number", "check"].includes(b.type) || !Array.isArray(b.runs)) throw Error("Định dạng nội dung không hợp lệ.");
      for (const r of b.runs) if (typeof r.text !== "string" || r.href && !safeLink(r.href)) throw Error("Liên kết không hợp lệ.");
    }
    if (value.source) {
      const s = value.source;
      if (typeof s.key !== "string" || s.key.length > 240 || typeof s.title !== "string" || s.title.length > 240 || typeof s.version !== "string" || s.version.length > 128 || JSON.stringify(s).length > 2e4) throw Error("Nguồn không hợp lệ.");
      if (s.page !== undefined && (!Number.isSafeInteger(s.page) || s.page < 1)) throw Error("Trang nguồn không hợp lệ.");
      if (s.anchor?.rects && (!Array.isArray(s.anchor.rects) || s.anchor.rects.length > 200 || s.anchor.rects.some(r => [r.x,r.y,r.w,r.h].some(n => !Number.isFinite(n) || n < 0 || n > 1.03)))) throw Error("Vị trí highlight không hợp lệ.");
      if (s.url) {
        const u = new URL(s.url, "https://avilog.up.railway.app");
        if (u.origin !== "https://avilog.up.railway.app" || !/^\/(atpl\/|\?tab=)/.test(u.pathname + u.search)) throw Error("Đường dẫn nguồn không hợp lệ.");
      }
    }
    if (value.deletedAt === null ? value.expiresAt !== null : !Number.isSafeInteger(value.deletedAt) || value.deletedAt < 0 || value.expiresAt !== value.deletedAt + TRASH_DAYS * DAY) throw Error("Thời hạn Trash không hợp lệ.");
  }
  if (JSON.stringify(value).length > 15e4) throw Error("Ghi chú quá lớn (150 KB).");
  return clone(value);
}
function newNote({ title = "", source = null, body = paragraph(""), folderId = "" } = {}) {
  const now = Date.now();
  return validate({ id: id(), kind: "note", title, body, source, folderId, tags: [], pinned: false, createdAt: now, updatedAt: now, deletedAt: null, expiresAt: null });
}
function merge(base, mine, theirs) {
  if (equal(mine, theirs)) return { value: clone(mine) };
  if (equal(mine, base)) return { value: clone(theirs) };
  if (equal(theirs, base)) return { value: clone(mine) };
  if (!base || !mine || !theirs) return { conflict: true };
  const result = clone(theirs), keys = /* @__PURE__ */ new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  for (const key of keys) {
    if (key === "updatedAt") {
      result[key] = Math.max(mine[key], theirs[key]);
      continue;
    }
    const a = !equal(base[key], mine[key]), b = !equal(base[key], theirs[key]);
    if (a && b && !equal(mine[key], theirs[key])) return { conflict: true };
    if (a) result[key] = clone(mine[key]);
  }
  return { value: validate(result) };
}
function visible(entries, now = Date.now()) {
  return entries.filter((e) => e.value?.kind === "note" && !e.value.deletedAt && !expired(e.value, now));
}
const expired = (value, now = Date.now()) => value?.expiresAt != null && value.expiresAt <= now;
function queryNotes(entries, { search = "", folder, source, trash = false, pinned = false, conflicts = false } = {}) {
  const q = search.toLocaleLowerCase();
  return entries.filter((e) => {
    const n = e.value;
    if (conflicts && n?.kind !== "note") return Boolean(n && e.conflicts?.length);
    return n?.kind === "note" && !expired(n) && Boolean(n.deletedAt) === trash && (!pinned || n.pinned) && (!conflicts || e.conflicts?.length) && (!folder || n.folderId === folder) && (!source || n.source?.key === source || n.source?.documentKey === source) && (!q || [n.title, text(n.body), ...n.tags, n.source?.title || ""].join("\n").toLocaleLowerCase().includes(q));
  }).sort((a, b) => Number(b.value.pinned) - Number(a.value.pinned) || b.value.updatedAt - a.value.updatedAt);
}
function sourceCount(entries, key, anchor) {
  return new Set(visible(entries).filter((e) => e.value.source?.key === key && (!anchor || e.value.source.anchor?.block === anchor)).map((e) => e.id)).size;
}
function sourceState(note, current) {
  return !current ? "unavailable" : current.version !== note.source.version ? "updated" : "valid";
}
function backup(entries) {
  return { format: FORMAT, version: 1, createdAt: (/* @__PURE__ */ new Date()).toISOString(), records: entries.map((e) => ({ value: e.value, conflicts: e.conflicts || [], history: e.history || [] })).filter((e) => e.value && !expired(e.value)) };
}
function parseBackup(value) {
  if (value?.format !== FORMAT || value.version !== 1 || !Array.isArray(value.records) || value.records.length > 2e4) throw Error("Tệp sao lưu Notes không hợp lệ.");
  return value.records.map((e) => ({ value: validate(e.value), conflicts: (e.conflicts || []).map((c) => ({ ...c, value: c.value ? validate(c.value) : null })), history: (e.history || []).map((c) => ({ ...c, value: c.value ? validate(c.value) : null })) }));
}
export {
  DAY,
  FORMAT,
  TRASH_DAYS,
  backup,
  clone,
  equal,
  escape,
  expired,
  id,
  merge,
  newNote,
  paragraph,
  parseBackup,
  queryNotes,
  richHTML,
  safeLink,
  sourceCount,
  sourceState,
  text,
  validate,
  visible
};
