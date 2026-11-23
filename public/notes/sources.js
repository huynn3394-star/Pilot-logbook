import { notesUI } from "./ui.js";
import { digest, rememberSource, bindContext, initContexts } from "./context.js";
import { escape as e, sourceCount, visible } from "./model.js";
let reader;
function dialog(title) {
  reader?.close();
  reader?.remove();
  reader = document.createElement("dialog");
  reader.className = "notes-reader";
  reader.innerHTML = `<div class="notes-reader-toolbar"><strong>${e(title)}</strong><button data-reader-close>Đóng</button></div><section class="notes-preview-content" role="status">Đang mở nguồn…</section>`;
  reader.querySelector("[data-reader-close]").onclick = () => reader.close();
  const captured = reader, g = notesUI().service.generation, stop = notesUI().service.subscribe(() => {
    if (g !== notesUI().service.generation) captured.close();
  });
  reader.onclose = () => {
    stop();
    captured.remove();
  };
  document.body.append(reader);
  reader.showModal();
  return reader;
}
function choosePDF() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,application/pdf";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 150 * 1024 * 1024) throw Error("Tài liệu PDF vượt 150 MB.");
      const ui = notesUI();
      await ui.service.ready;
      const target = ui.service.store, g = ui.service.generation, bytes = await file.arrayBuffer(), version = await digest(bytes), key = "pdf:" + await digest(file.name.normalize("NFC").toLowerCase()), category = prompt("Loại tài liệu (FCOM, FCTM, SOP, MEL hoặc PDF)", /FCOM|FCTM|SOP|MEL/i.exec(file.name)?.[0].toUpperCase() || "PDF");
      if (category === null) return;
      const source = { key, title: file.name.slice(0, 240), section: category.slice(0, 60), category: category.slice(0, 60), type: "pdf", version, fileName: file.name.slice(0, 240) };
      await target.putDocument(key + "@" + version, new Blob([bytes], { type: "application/pdf" }));
      if (g !== ui.service.generation) return;
      await rememberSource(source);
      await showPDF(source, bytes);
    } catch (err) {
      alert(err.message);
    }
  };
  input.click();
}
async function openSource(source) {
  if (!source) throw Error("Ghi chú này không liên kết nguồn.");
  const ui = notesUI();
  await ui.service.ready;
  const records = await ui.service.store.all(), current = records.find((r) => r.value?.kind === "source" && r.value.key === source.key)?.value;
  if (source.type === "pdf") {
    const selected = current || source, file = await ui.service.store.getDocument(selected.key + "@" + selected.version);
    if (!file) {
      const d2 = dialog(source.title);
      d2.querySelector("section").innerHTML = "<p>Tài liệu nguồn chưa có trên thiết bị này. Ghi chú vẫn đầy đủ. Mở lại đúng tệp PDF trong My Notes; app sẽ kiểm tra phiên bản và chỉ highlight khi khớp.</p><button data-choose-source>Mở PDF từ thiết bị</button>";
      d2.querySelector("[data-choose-source]").onclick = choosePDF;
      return;
    }
    return showPDF({ ...selected, page: source.page, anchor: source.version === selected.version ? source.anchor : null }, await file.arrayBuffer(), source.version !== selected.version);
  }
  if (source.type === "atpl") return previewATPL(source);
  const d = dialog(source.title);
  const content = d.querySelector("section");
  content.innerHTML = `<p>${current?.version !== source.version ? "Nguồn hiện tại có thể đã thay đổi. Ghi chú và đoạn trích gốc được giữ nguyên." : "Liên kết ở cấp mục; không tự suy đoán vị trí đoạn văn."}</p>${source.anchor?.quote ? "<blockquote>" + e(source.anchor.quote) + "</blockquote>" : ""}${source.url ? '<a href="' + e(source.url) + '">Mở mục hiện tại trong AviLog</a>' : "<p>Nguồn hiện chưa khả dụng trên thiết bị.</p>"}`;
}
async function previewATPL(source) {
  const d = dialog(source.title), body = d.querySelector("section");
  try {
    const response = await fetch(source.url);
    if (!response.ok) throw Error("Môn này chưa có offline trên thiết bị. Kết nối mạng hoặc tải môn trước.");
    const doc = new DOMParser().parseFromString(await response.text(), "text/html"), payload = JSON.parse(doc.querySelector("#bank-data").textContent), bank = Object.values(payload)[0], q = bank.questions.find((q2) => (q2.uid || String(q2.id)) === source.questionId);
    if (!q) throw Error("Câu nguồn không còn trong phiên bản hiện tại. Ghi chú được giữ nguyên.");
    if (!d.isConnected) return;
    body.innerHTML = `<p>Bản xem nguồn · không thay đổi phiên Ôn thi đang học. Mở đúng câu nguồn; nếu đoạn chữ không còn khớp duy nhất, chỉ định vị ở cấp câu để bạn đối chiếu.</p><h2>${e(q.uid || "Câu " + q.id)}</h2><p>${e(q.question || q.text || "")}</p>${Object.entries(q.options || {}).map(([key, value]) => "<p>" + e(key) + ". " + e(value) + "</p>").join("")}<h3>Giải thích</h3><p>${e(q.review?.vi || q.explanation || "Mở môn để xem đầy đủ nội dung và hình nguồn.")}</p><a href="${e(source.url)}">Mở môn trong Ôn thi</a>`;
    initContexts();
    bindContext(body, source);
  } catch (err) {
    body.textContent = err.message;
  }
}
async function showPDF(source, bytes, updated = false) {
  const d = dialog(source.title), ui = notesUI(), target = ui.service.store, g = ui.service.generation;
  const view = d.querySelector("section");
  view.className = "notes-pdf-viewport";
  const toolbar = d.querySelector(".notes-reader-toolbar");
  toolbar.insertAdjacentHTML("beforeend", '<button data-pdf-prev aria-label="Trang trước">←</button><label>Trang <input type="number" min="1" data-pdf-page value="1"></label><span data-pdf-total></span><button data-pdf-next aria-label="Trang tiếp">→</button><button data-pdf-add>＋ Note</button><button data-pdf-notes>Notes (0)</button>');
  let task, pdf, page = Math.max(1, Number(source.page) || 1), rendering, sequence = 0, textLayer, refreshMarks=async()=>{},stopChanges=()=>{};
  try {
    view.textContent = "Đang mở PDF trên thiết bị…";
    const lib = await import("/vendor/pdfjs/build/pdf.mjs");
    lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/build/pdf.worker.mjs";
    task = lib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, enableScripting: false });
    pdf = await task.promise;
    if (!d.isConnected) {
      await task.destroy();
      return;
    }
    toolbar.querySelector("[data-pdf-total]").textContent = "/ " + pdf.numPages;
    toolbar.querySelector("[data-pdf-page]").max = pdf.numPages;
    async function show() {
      const seq = ++sequence;
      rendering?.cancel();
      textLayer?.cancel();
      page = Math.min(pdf.numPages, Math.max(1, page));
      toolbar.querySelector("[data-pdf-page]").value = page;
      const p = await pdf.getPage(page);
      if (seq !== sequence || !d.isConnected || g !== ui.service.generation) return;
      view.replaceChildren();
      const notice = document.createElement("p");
      notice.textContent = updated ? "Nguồn đã cập nhật · chỉ mở tới trang, không gán lại highlight cũ." : "Tệp chỉ lưu trên thiết bị này. Chọn chữ để Add Note; nếu không chọn được, dùng ＋ Note để ghi chú cấp trang.";
      notice.style.fontSize = "12px";
      view.append(notice);
      const canvas = document.createElement("canvas"), wrapper = document.createElement("div");
      wrapper.className = "notes-pdf-page";
      const base = p.getViewport({ scale: 1 }), scale = Math.max(0.4, Math.min(1.5, (view.clientWidth - 32) / base.width)), viewport = p.getViewport({ scale }), ratio = Math.min(devicePixelRatio || 1, 2);
      wrapper.style.width = viewport.width + "px";
      wrapper.style.height = viewport.height + "px";
      wrapper.style.setProperty("--scale-factor", String(scale));
      wrapper.style.setProperty("--total-scale-factor", String(scale));
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      wrapper.append(canvas);
      view.append(wrapper);
      rendering = p.render({ canvasContext: canvas.getContext("2d"), viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
      await rendering.promise;
      if (seq !== sequence) return;
      const layer = document.createElement("div");
      layer.className = "textLayer";
      wrapper.append(layer);
      textLayer = new lib.TextLayer({ textContentSource: await p.getTextContent(), container: layer, viewport });
      await textLayer.render();
      if (seq !== sequence) return;
      const pageSource = { ...source, page, section: (source.category || source.section || "PDF") + " · Trang " + page };
      initContexts();
      bindContext(layer, pageSource, { before: wrapper });
      refreshMarks=async()=>{
       const rows = await target.all();
       if(seq!==sequence||!d.isConnected||g!==ui.service.generation)return;
       toolbar.querySelector("[data-pdf-notes]").textContent = "Notes (" + sourceCount(rows, source.key) + ")";
       wrapper.querySelectorAll('.notes-pdf-mark').forEach(mark=>mark.remove());
       for (const entry of visible(rows)) {
        const s = entry.value.source;
        if (s?.key !== source.key || s.version !== source.version || s.page !== page) continue;
        for (const rect of s.anchor?.rects || []) {
          const mark = document.createElement("button");
          mark.className = "notes-pdf-mark";
          mark.setAttribute("aria-label", "Mở ghi chú đoạn này");
          Object.assign(mark.style, { left: rect.x * 100 + "%", top: rect.y * 100 + "%", width: rect.w * 100 + "%", height: rect.h * 100 + "%" });
          mark.onclick = () => ui.related(pageSource, s.anchor.block);
          wrapper.append(mark);
        }
       }
      };
      await refreshMarks();
      layer.addEventListener("mouseup", () => {
        const selection = getSelection();
        if (!selection?.rangeCount || !layer.contains(selection.anchorNode) || !String(selection).trim()) return;
        const r = selection.getRangeAt(0), box = wrapper.getBoundingClientRect(), rects = [...r.getClientRects()].map((v) => ({ x: (v.x - box.x) / box.width, y: (v.y - box.y) / box.height, w: v.width / box.width, h: v.height / box.height })).filter((v) => v.x >= 0 && v.y >= 0 && v.w > 0 && v.h > 0).slice(0, 200);
        const quote = String(selection).slice(0, 4e3);
        toolbar.querySelector("[data-pdf-add]").onclick = () => ui.create({ source: { ...pageSource, anchor: { quote, block: "page:" + page, rects } }, title: quote.slice(0, 80) });
      });
      toolbar.querySelector("[data-pdf-add]").onclick = () => ui.create({ source: pageSource, title: source.title + " · " + page });
      toolbar.querySelector("[data-pdf-notes]").onclick = () => ui.related({...source,page:undefined});
    }
    const safeShow = () => show().catch((err) => {
      if (err.name !== "RenderingCancelledException" && err.name !== "AbortException") view.textContent = err.message;
    });
    toolbar.querySelector("[data-pdf-prev]").onclick = () => {
      page--;
      safeShow();
    };
    toolbar.querySelector("[data-pdf-next]").onclick = () => {
      page++;
      safeShow();
    };
    toolbar.querySelector("[data-pdf-page]").onchange = (event) => {
      page = Number(event.target.value) || 1;
      safeShow();
    };
    d.addEventListener("close", () => {
      sequence++;
      rendering?.cancel();
      textLayer?.cancel();
      task?.destroy();
      stopChanges();
    }, { once: true });
    stopChanges=ui.service.subscribe(() => {
      if (g !== ui.service.generation && d.isConnected) d.close();
      else refreshMarks().catch(()=>{});
    });
    await safeShow();
  } catch (err) {
    view.textContent = "Nguồn chưa mở được: " + err.message + " · Ghi chú vẫn được giữ.";
    task?.destroy();
  }
}
export {
  choosePDF,
  openSource
};
