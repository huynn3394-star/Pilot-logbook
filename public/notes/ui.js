import { notesService } from "./service.js";
import { backup, clone, escape as e, expired, newNote, paragraph, queryNotes, richHTML, sourceState, text, TRASH_DAYS, DAY, validate, id } from "./model.js";
import { mountEditor, readEditor } from "./editor.js";
let instance;
function notesUI() {
  return instance || (instance = createUI());
}
function createUI() {
  const service = notesService();
  let host = null, rows = [], filter = {}, search = "", selected = null, editor = null, queue = Promise.resolve(), lastError = "", recoveredScope = "", scope = service.scope, mountVersion = 0, refreshTimer, lastHost = null, renderedSignature = "";
  const sheet = document.createElement("dialog");
  sheet.className = "notes-sheet";
  sheet.setAttribute("aria-label", "Ghi chú");
  document.body.append(sheet);
  if (!document.querySelector('[href="/notes/notes.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/notes/notes.css";
    document.head.append(css);
  }
  const draftKey = (uid, n) => "avilog_notes_draft_v1:" + uid + ":" + n;
  const message = (err) => {
    lastError = err.message || String(err);
    const line = sheet.querySelector("[data-save-state]");
    if (line) line.textContent = "Chưa lưu · " + lastError;
    else alert(lastError);
  };
  async function refresh() {
    if (service.scope !== scope) {
      scope = service.scope;
      selected = null;
      sheet.close();
      sheet.replaceChildren();
      rows = [];
    }
    if (!service.store) {
      if (host?.isConnected) host.textContent = "Đang mở Notes…";
      return;
    }
    const target = service.store, g = service.generation;
    if (recoveredScope !== target.uid) {
      recoveredScope = target.uid;
      await recoverDrafts();
    }
    const nextRows = await target.all();
    if (g !== service.generation || target !== service.store) return;
    rows = nextRows;
    if (host?.isConnected) {
      render();
      const status = await service.status(), line = host.querySelector("[data-notes-status]");
      if (line) line.textContent = lastError || status.text;
    }
    if (selected) {
      const current = rows.find((r) => r.id === selected.id);
      const conflict = sheet.querySelector("[data-conflict]");
      if (conflict && current) {
        conflict.hidden = !current.conflicts.length;
        conflict.textContent = current.conflicts.length ? "Có phiên bản xung đột. Mở mục Xung đột để chọn hoặc gộp." : "";
      }
      if (lastError) return;
      const state = await service.status(), line = sheet.querySelector("[data-save-state]");
      if (line) line.textContent = state.text;
    }
  }
  service.subscribe(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch(message), 80);
  });
  async function recoverDrafts() {
    await service.ready;
    if (!service.store) return;
    const target = service.store, uid = target.uid, prefix = "avilog_notes_draft_v1:" + uid + ":";
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
      try {
        const draft = JSON.parse(localStorage.getItem(key));
        validate(draft.value);
        await target.save(draft.value, { expected: draft.expected, base: draft.base });
        if (localStorage.getItem(key) === JSON.stringify(draft)) localStorage.removeItem(key);
      } catch (err) {
        lastError = "Có bản nháp chưa phục hồi: " + err.message;
      }
    }
  }
  recoverDrafts().then(refresh).catch(message);
  function render() {
    const current = host;
    if (!current?.isConnected) return;
    const signature = JSON.stringify([rows.map((r) => ({ value: r.value, conflicts: r.conflicts.length })), filter, search]);
    if (lastHost === current && signature === renderedSignature) return;
    lastHost = current;
    renderedSignature = signature;
    const items = queryNotes(rows, { ...filter, search }), folders = rows.filter((r) => r.value?.kind === "folder"), sources = /* @__PURE__ */ new Map();
    for (const r of rows) if (r.value?.kind === "note" && r.value.source && !r.value.deletedAt && !expired(r.value)) sources.set(r.value.source.documentKey || r.value.source.key, r.value.source.title);
    const sourcesList = [...sources];
    current.innerHTML = `<section class="notes-home"><div class="notes-actions"><button data-note-action="new" class="primary">＋ Ghi chú mới</button><button data-note-action="pdf-source">Mở tài liệu PDF</button><button data-note-action="folder">＋ Thư mục</button><button data-note-action="export">Xuất PDF / In</button><button data-note-action="backup">Sao lưu JSON</button><button data-note-action="restore">Khôi phục JSON</button><button data-note-action="recovery">Bản sao trước khôi phục</button></div><p data-notes-status role="status"></p><div class="notes-layout"><aside class="notes-filters" aria-label="Lọc ghi chú"><button data-note-filter="all" ${!Object.keys(filter).length ? 'aria-current="true"' : ""}>Tất cả ghi chú</button><button data-note-filter="pinned">☆ Đã ghim</button><button data-note-filter="conflicts">Phiên bản xung đột (${rows.filter((r) => r.conflicts?.length).length})</button><button data-note-filter="trash">Trash · 30 ngày</button><h3>Thư mục cá nhân</h3>${folders.map((r) => `<div><button data-note-folder="${e(r.id)}">${e(r.value.title)}</button><button data-rename-folder="${e(r.id)}" aria-label="Đổi tên ${e(r.value.title)}">✎</button></div>`).join("")}<h3>Theo tài liệu nguồn</h3>${sourcesList.map(([key, title]) => `<button data-note-source="${e(key)}">${e(title)}</button>`).join("") || "<small>Ghi chú liên kết sẽ xuất hiện tại đây.</small>"}</aside><section class="notes-list"><label>Tìm tiêu đề, nội dung, tags hoặc tài liệu<input type="search" data-note-search value="${e(search)}" placeholder="Tìm ghi chú…"></label><p>${items.length} ghi chú${filter.trash ? " trong Trash" : ""}</p>${items.map((r) => `<article class="notes-card"><button class="notes-card-open" data-open-note="${e(r.id)}"><strong>${r.value.pinned ? "☆ " : ""}${e(r.value.title || "Ghi chú chưa đặt tên")}</strong><p>${e(text(r.value.body).slice(0, 210))}</p><small>${e(r.value.source?.title || "Ghi chú cá nhân")} · ${new Date(r.value.updatedAt).toLocaleString("vi-VN")}</small><small>${e((r.value.tags || []).join(" · "))}${r.conflicts.length ? " · Có xung đột" : ""}${r.value.deletedAt ? " · Còn " + Math.max(0, Math.ceil((r.value.expiresAt - Date.now()) / DAY)) + " ngày" : ""}</small></button></article>`).join("") || '<p class="notes-empty">Chưa có ghi chú ở mục này. Bấm ＋ để bắt đầu.</p>'}</section></div><p class="notes-footnote">Notes cá nhân phục vụ học tập. Tài liệu nguồn có thể cần mở/tải trên từng thiết bị. Tệp PDF nguồn chỉ lưu trên thiết bị này; ghi chú và thông tin liên kết đồng bộ theo tài khoản. Trash được khôi phục trong 30 ngày.</p></section>`;
    service.status().then((s) => {
      if (host === current && current.isConnected) current.querySelector("[data-notes-status]").textContent = lastError || s.text;
    });
    current.querySelector("[data-note-search]").oninput = (event) => {
      search = event.target.value;
      const start = event.target.selectionStart;
      render();
      const input = current.querySelector("[data-note-search]");
      input.focus();
      input.setSelectionRange(start, start);
    };
    current.onclick = (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      event.preventDefault();
      handle(b).catch(message);
    };
  }
  async function handle(b) {
    if (b.dataset.openNote) return open(b.dataset.openNote);
    if (b.dataset.noteFilter) {
      filter = b.dataset.noteFilter === "all" ? {} : { [b.dataset.noteFilter]: true };
      render();
      return;
    }
    if (b.dataset.noteFolder) {
      filter = { folder: b.dataset.noteFolder };
      render();
      return;
    }
    if (b.dataset.noteSource) {
      filter = { source: b.dataset.noteSource };
      render();
      return;
    }
    if (b.dataset.renameFolder) {
      const old = rows.find((r) => r.id === b.dataset.renameFolder), title = prompt("Tên thư mục", old.value.title);
      if (title?.trim()) await service.store.save({ ...old.value, title: title.trim(), updatedAt: Date.now() }, { expected: old.localRevision, base: old.value });
      return;
    }
    const action = b.dataset.noteAction;
    if (action === "new") return create({ folderId: filter.folder || "" });
    if (action === "folder") {
      const title = prompt("Tên thư mục cá nhân");
      if (title?.trim()) {
        const now = Date.now();
        await service.store.save({ kind: "folder", id: id(), title: title.trim(), createdAt: now, updatedAt: now });
      }
      return;
    }
    if (action === "pdf-source") {
      const reader = await import("./sources.js");
      return reader.choosePDF();
    }
    if (action === "backup") return download("AviLog_Notes_" + Date.now() + ".json", backup(await service.store.all()));
    if (action === "recovery") {
      const value = await service.store.recoveryBackup();
      if (!value) throw Error("Chưa có bản sao trước khôi phục.");
      return download("AviLog_Notes_recovery.json", value);
    }
    if (action === "restore") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.onchange = async () => {
        try {
          const file = input.files[0];
          if (!file) return;
          if (file.size > 30 * 1024 * 1024) throw Error("Tệp sao lưu vượt 30 MB.");
          const count = await service.store.restore(JSON.parse(await file.text()));
          alert(`Đã khôi phục ${count} bản ghi. Nội dung khác nhau được giữ trong Xung đột; bản sao trước khôi phục đã được lưu.`);
        } catch (err) {
          message(err);
        }
      };
      input.click();
      return;
    }
    if (action === "export") return exportPDF(queryNotes(rows, { ...filter, search }).map((r) => r.value));
  }
  async function create(options = {}) {
    await service.ready;
    if (!service.store) throw Error("Chưa mở được Notes.");
    const note = newNote(options);
    await service.store.save(note);
    return open(note.id);
  }
  async function open(noteId) {
    await close();
    await service.ready;
    const target = service.store, g = service.generation, entry = await target.get(noteId);
    if (g !== service.generation || !entry?.value) return;
    if (entry.value.kind !== "note") return openMeta(entry, target, g);
    if (expired(entry.value)) throw Error("Ghi chú đã quá 30 ngày trong Trash.");
    selected = { ...clone(entry), target, scope: service.scope, generation: g };
    lastError = "";
    const n = entry.value, folders = (await target.all()).filter((r) => r.value?.kind === "folder");
    sheet.innerHTML = `<div class="notes-sheet-head"><strong>My Notes</strong><div><button data-sheet-action="expand" aria-label="Mở rộng ghi chú">⛶</button><button data-sheet-action="done">Done ✓</button></div></div><p data-save-state role="status">Đang mở…</p><p data-conflict ${entry.conflicts.length ? "" : "hidden"}>Có các phiên bản xung đột, chọn hoặc gộp ở dưới.</p><div class="notes-editor-content"><label>Tiêu đề<input data-note-title maxlength="240" value="${e(n.title)}" placeholder="Ghi chú chưa đặt tên" ${n.deletedAt ? "disabled" : ""}></label><div class="notes-editor-meta"><label>Thư mục<select data-note-folder-select ${n.deletedAt ? "disabled" : ""}><option value="">Không có thư mục</option>${folders.map((r) => `<option value="${e(r.id)}" ${n.folderId === r.id ? "selected" : ""}>${e(r.value.title)}</option>`).join("")}</select></label><label>Tags (ngăn bằng dấu phẩy)<input data-note-tags value="${e(n.tags.join(", "))}" ${n.deletedAt ? "disabled" : ""}></label><label><input type="checkbox" data-note-pin ${n.pinned ? "checked" : ""} ${n.deletedAt ? "disabled" : ""}> Ghim</label></div>${n.source ? `<section class="notes-source"><strong>${e(n.source.title)}</strong><small>${e(n.source.section || "")}${n.source.page ? " · Trang " + n.source.page : ""} · Phiên bản ${e(n.source.version.slice(0, 16))}</small>${n.source.anchor?.quote ? `<blockquote>${e(n.source.anchor.quote)}</blockquote>` : ""}<p data-source-state></p><button data-sheet-action="source">Mở nguồn</button></section>` : ""}<div class="notes-format" role="toolbar" aria-label="Định dạng ghi chú">${[["bold", "B"], ["italic", "I"], ["insertUnorderedList", "• List"], ["insertOrderedList", "1. List"], ["check", "☑ Checklist"], ["link", "Link"], ["undo", "↶"], ["redo", "↷"]].map(([cmd, label]) => `<button data-note-command="${cmd}" ${n.deletedAt ? "disabled" : ""}>${label}</button>`).join("")}</div><div data-note-editor contenteditable="${!n.deletedAt}" role="textbox" aria-multiline="true" aria-label="Nội dung ghi chú"></div><div class="notes-editor-actions"><button data-sheet-action="export">Xuất PDF / In</button>${n.deletedAt ? '<button data-sheet-action="restore">Khôi phục ghi chú</button>' : '<button data-sheet-action="delete">Chuyển vào Trash</button>'}</div><section data-note-versions></section></div>`;
    editor = mountEditor(sheet.querySelector("[data-note-editor]"), n.body, changed);
    for (const field of sheet.querySelectorAll("[data-note-title],[data-note-tags],[data-note-folder-select],[data-note-pin]")) field.addEventListener("input", changed);
    sheet.onclick = (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      event.preventDefault();
      if (b.dataset.noteCommand) {
        try {
          editor.command(b.dataset.noteCommand);
        } catch (err) {
          message(err);
        }
        return;
      }
      sheetAction(b.dataset.sheetAction, b).catch(message);
    };
    for (const b of sheet.querySelectorAll("[data-note-command]")) b.onmousedown = (event) => event.preventDefault();
    sheet.oncancel = (event) => {
      event.preventDefault();
      close().catch(message);
    };
    sheet.showModal();
    sheet.querySelector("[data-note-title]").focus();
    renderVersions(entry);
    if (n.source) {
      const current = (await target.all()).find((r) => r.value?.kind === "source" && r.value.key === n.source.key)?.value;
      sheet.querySelector("[data-source-state]").textContent = { valid: "Nguồn còn đúng phiên bản", updated: "Nguồn đã cập nhật · nên đối chiếu lại. Nội dung ghi chú được giữ nguyên.", unavailable: "Nguồn chưa có trên thiết bị · ghi chú vẫn được giữ." }[sourceState(n, current)];
    }
    await refresh();
  }
  async function openMeta(entry, target, g) {
    selected = { ...clone(entry), target, scope: service.scope, generation: g };
    sheet.innerHTML = `<div class="notes-sheet-head"><strong>${e(entry.value.title)}</strong><button data-sheet-action="done">Done ✓</button></div><p data-save-state role="status"></p><div class="notes-editor-content"><p>Xung đột ${entry.value.kind === "folder" ? "thư mục" : "thông tin nguồn"}. Chọn phiên bản giữ lại; liên kết ghi chú không bị xóa.</p><section data-note-versions></section></div>`;
    sheet.onclick = (event) => {
      const b = event.target.closest("button");
      if (b) {
        event.preventDefault();
        sheetAction(b.dataset.sheetAction, b).catch(message);
      }
    };
    sheet.oncancel = (event) => {
      event.preventDefault();
      close().catch(message);
    };
    renderVersions(entry);
    sheet.querySelector('[data-sheet-action="merge-versions"]')?.remove();
    sheet.showModal();
  }
  function changed() {
    if (!selected || selected.generation !== service.generation || selected.value.deletedAt) return;
    const value = { ...selected.value, title: sheet.querySelector("[data-note-title]").value, body: readEditor(sheet.querySelector("[data-note-editor]")), folderId: sheet.querySelector("[data-note-folder-select]").value, tags: [...new Set(sheet.querySelector("[data-note-tags]").value.split(",").map((t) => t.trim()).filter(Boolean))], pinned: sheet.querySelector("[data-note-pin]").checked, updatedAt: Date.now() };
    enqueue(value);
  }
  function enqueue(value) {
    const captured = selected, base = clone(captured.value), expected = captured.localRevision, draft = { value, base, expected }, draftText = JSON.stringify(draft), key = draftKey(captured.scope, value.id);
    captured.value = value;
    lastError = "";
    try {
      localStorage.setItem(key, draftText);
    } catch (err) {
      lastError = "Không lưu được bản nháp dự phòng: " + err.message;
    }
    const line = sheet.querySelector("[data-save-state]");
    if (line) line.textContent = "Đang lưu trên máy…";
    queue = queue.catch(() => {
    }).then(async () => {
      const saved = await captured.target.save(value, { expected: captured.savedRevision ?? expected, base: captured.savedValue ?? base });
      captured.savedRevision = saved.localRevision;
      captured.savedValue = clone(saved.value);
      captured.localRevision = saved.localRevision;
      if (localStorage.getItem(key) === draftText) localStorage.removeItem(key);
      if (selected === captured) {
        lastError = "";
        const status = await service.status();
        sheet.querySelector("[data-save-state]").textContent = status.text;
      }
    }).catch((err) => {
      if (selected === captured) message(err);
      throw err;
    });
    queue.catch(() => {
    });
  }
  async function close() {
    try {
      await queue;
    } catch {
      throw Error("Chưa lưu được bản nháp. Hãy sao chép nội dung hoặc thử lại trước khi đóng.");
    }
    selected = null;
    if (sheet.open) sheet.close();
    sheet.replaceChildren();
  }
  async function sheetAction(action, b) {
    if (action === "done") return close();
    if (action === "expand") {
      sheet.classList.toggle("notes-expanded");
      return;
    }
    if (!selected) return;
    await queue;
    const captured = selected, n = clone(captured.value);
    if (action === "export") return exportPDF([n]);
    if (action === "source") {
      const source = await import("./sources.js");
      return source.openSource(n.source);
    }
    if (action === "delete" || action === "restore") {
      const now = Date.now();
      if (action === "delete") {
        n.deletedAt = now;
        n.expiresAt = now + TRASH_DAYS * DAY;
      } else {
        if (expired(n)) throw Error("Đã hết thời hạn khôi phục.");
        n.deletedAt = null;
        n.expiresAt = null;
      }
      n.updatedAt = now;
      await captured.target.snapshot();
      await captured.target.save(n, { expected: captured.localRevision, base: captured.value });
      await close();
      await refresh();
      return;
    }
    if (action === "choose-version" || action === "merge-versions") {
      const entry = await captured.target.get(n.id);
      let value;
      if (action === "merge-versions") {
        const versions = [entry.value, ...entry.conflicts.map((c) => c.value)].filter(Boolean);
        value = { ...n, body: versions.flatMap((v, i) => [...paragraph("— Phiên bản " + (i + 1) + " —"), ...v.body]), updatedAt: Date.now() };
      } else value = b.dataset.version === "mine" ? entry.value : entry.conflicts.find((c) => c.id === b.dataset.version)?.value;
      if (!value) throw Error("Bản này đã bị xóa vĩnh viễn trên Cloud. Xuất bản sao hoặc tạo ghi chú mới nếu cần.");
      await captured.target.snapshot();
      await captured.target.save({ ...value, updatedAt: Date.now() }, { expected: entry.localRevision, base: entry.value, resolve: true });
      await open(n.id);
    }
  }
  function renderVersions(entry) {
    if (!entry.conflicts.length) return;
    const box = sheet.querySelector("[data-note-versions]");
    box.innerHTML = `<h3>Giữ đủ phiên bản</h3><p>Chọn một bản hoặc gộp rồi chỉnh sửa. Bản còn lại được giữ trong sao lưu lịch sử.</p><button data-sheet-action="choose-version" data-version="mine">Dùng bản trên máy</button><button data-sheet-action="merge-versions">Gộp nội dung các bản</button>${entry.conflicts.map((c) => `<details><summary>${e(c.label)} · ${new Date(c.at).toLocaleString("vi-VN")}</summary><div>${c.value ? richHTML(c.value.body || paragraph(c.value.title)) : "Bản trên Cloud đã hết hạn / không còn nội dung."}</div><button data-sheet-action="choose-version" data-version="${e(c.id)}">Dùng bản này</button></details>`).join("")}`;
  }
  async function related(source, anchor) {
    const g = service.generation;
    await service.ready;
    await close();
    await refresh();
    if (g !== service.generation) return;
    const list = rows.filter((r) => r.value?.source?.key === source.key && !r.value.deletedAt && (!anchor || r.value.source.anchor?.block === anchor) && !expired(r.value));
    sheet.innerHTML = `<div class="notes-sheet-head"><strong>${e(source.title)}</strong><button data-related-done>Done ✓</button></div><div class="notes-editor-content"><button data-related-add>＋ Ghi chú tại đây</button><h3>Notes (${new Set(list.map((r) => r.id)).size})</h3>${list.map((r) => `<button class="notes-related" data-related-open="${e(r.id)}"><strong>${e(r.value.title || "Ghi chú")}</strong><p>${e(text(r.value.body).slice(0, 160))}</p></button>`).join("") || "<p>Chưa có ghi chú liên kết.</p>"}</div>`;
    sheet.onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-related-done")) close().catch(message);
      if (b.hasAttribute("data-related-add")) create({ source }).catch(message);
      if (b.dataset.relatedOpen) open(b.dataset.relatedOpen).catch(message);
    };
    sheet.oncancel = (ev) => {
      ev.preventDefault();
      close().catch(message);
    };
    sheet.showModal();
  }
  return { service, create, open, related, close, async mount(element) {
    host = element;
    const version = ++mountVersion;
    await service.ready;
    if (version !== mountVersion || !element.isConnected) return;
    await refresh();
  }, get selected() {
    return selected;
  } };
}
function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })), a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function exportPDF(notes) {
  if (!notes.length) throw Error("Chưa có ghi chú để xuất.");
  const token = crypto.randomUUID();
  sessionStorage.setItem("avilog-notes-print:" + token, JSON.stringify(notes));
  const opened = window.open("/notes/print.html#" + token, "_blank");
  if (!opened) {
    sessionStorage.removeItem("avilog-notes-print:" + token);
    throw Error("Cho phép mở cửa sổ xuất PDF rồi thử lại.");
  }
}
export {
  download,
  exportPDF,
  notesUI
};
