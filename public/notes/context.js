import { notesUI } from "./ui.js";
import { sourceCount, visible } from "./model.js";
const digest = async (value) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? new TextEncoder().encode(value) : value))].map((v) => v.toString(16).padStart(2, "0")).join("");
async function rememberSource(source) {
  const ui = notesUI();
  await ui.service.ready;
  if (!ui.service.store) return;
  const target = ui.service.store, sourceId = "src-" + await digest(source.key), prior = await target.get(sourceId), now = Date.now();
  if (prior?.value?.version === source.version) return;
  await target.save({ ...source, id: sourceId, kind: "source", createdAt: prior?.value?.createdAt || now, updatedAt: now }, { expected: prior?.localRevision, base: prior?.value });
}
function textNodes(root) {
  const nodes = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n2) => n2.parentElement?.closest("[data-notes-ui],script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n;
  while (n = walk.nextNode()) nodes.push(n);
  return nodes;
}
function quoteRange(root, anchor) {
  if (!anchor?.quote) return null;
  const nodes = textNodes(root), full = nodes.map((n) => n.textContent).join(""), quote = anchor.quote;
  let at = -1, found = [], start = 0;
  while ((at = full.indexOf(quote, start)) >= 0) {
    if ((!anchor.prefix || full.slice(Math.max(0, at - anchor.prefix.length), at) === anchor.prefix) && (!anchor.suffix || full.slice(at + quote.length, at + quote.length + anchor.suffix.length) === anchor.suffix)) found.push(at);
    start = at + Math.max(1, quote.length);
  }
  if (found.length !== 1) return null;
  let offset = 0, range = document.createRange(), began = false;
  for (const node of nodes) {
    const end = offset + node.length;
    if (!began && end > found[0]) {
      range.setStart(node, found[0] - offset);
      began = true;
    }
    if (began && end >= found[0] + quote.length) {
      range.setEnd(node, found[0] + quote.length - offset);
      return range;
    }
    offset = end;
  }
  return null;
}
const appBindings = /* @__PURE__ */ new WeakMap();
const contexts = /* @__PURE__ */ new Map();
let activePopup, highlightRanges = [];
function bindContext(root, source, { before = root } = {}) {
  if (!root?.isConnected) return () => {
  };
  const existing = contexts.get(root);
  if (existing?.source.version === source.version && existing.source.key === source.key) return existing.dispose;
  existing?.dispose();
  const ui = notesUI(), bar = document.createElement("div");
  bar.className = "notes-quick";
  bar.dataset.notesUi = "";
  bar.innerHTML = '<button type="button" data-quick-add aria-label="Thêm ghi chú tại đây">＋ Note</button><button type="button" data-quick-list>Notes (0)</button>';
  before.before(bar);
  bar.querySelector("[data-quick-add]").onclick = () => ui.create({ source, title: source.section || source.title }).catch(report);
  bar.querySelector("[data-quick-list]").onclick = () => ui.related(source).catch(report);
  const state = { root, source, bar, dispose: () => {
    bar.remove();
    root.classList.remove("notes-highlight-section");
    contexts.delete(root);
  } };
  contexts.set(root, state);
  rememberSource(source).catch(report);
  updateContexts();
  return state.dispose;
}
function report(err) {
  console.error("Notes:", err);
  const ui = notesUI();
  if (ui.service.store) alert(err.message);
}
async function updateContexts() {
  const ui = notesUI();
  await ui.service.ready;
  if (!ui.service.store) return;
  const rows = await ui.service.store.all();
  highlightRanges = [];
  for (const [root, context] of contexts) {
    if (!root.isConnected) {
      context.dispose();
      continue;
    }
    const count = sourceCount(rows, context.source.key);
    context.bar.querySelector("[data-quick-list]").textContent = `Notes (${count})`;
    root.classList.toggle("notes-highlight-section", count > 0);
    for (const entry of visible(rows)) {
      const s = entry.value.source;
      if (s?.key !== context.source.key || s.version !== context.source.version || s.page !== context.source.page) continue;
      const range = quoteRange(root, s.anchor);
      if (range) highlightRanges.push({ range, source: context.source, block: s.anchor.block });
    }
  }
  if (globalThis.CSS?.highlights && globalThis.Highlight) CSS.highlights.set("avilog-notes", new Highlight(...highlightRanges.map((h) => h.range)));
}
let subscribed = false;
function initContexts() {
  if (subscribed) return;
  subscribed = true;
  const ui = notesUI();
  let timer;
  ui.service.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => updateContexts().catch(() => {
    }), 120);
  });
  document.addEventListener("mouseup", (event) => {
    if (event.target.closest("[data-notes-ui],.notes-sheet,.notes-selection")) return;
    setTimeout(() => selectionPopup(event.clientX, event.clientY), 0);
  });
  document.addEventListener("touchend", (event) => {
    const p = event.changedTouches[0];
    setTimeout(() => selectionPopup(p.clientX, p.clientY), 200);
  }, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest("button,a,.notes-sheet,.notes-reader-toolbar,[data-notes-ui]") || String(getSelection() || "").trim()) return;
    for (const h of highlightRanges) {
      if ([...h.range.getClientRects()].some((r) => event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom)) {
        ui.related(h.source, h.block).catch(report);
        break;
      }
    }
  });
  document.addEventListener("selectionchange", () => {
    if (!String(getSelection() || "").trim()) activePopup?.remove();
  });
}
function selectionPopup(x, y) {
  activePopup?.remove();
  const selection = getSelection();
  if (!selection?.rangeCount || !selection.toString().trim()) return;
  const range = selection.getRangeAt(0);
  for (const [root, { source }] of contexts) {
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) continue;
    const quote = range.toString().slice(0, 4e3), nodes = textNodes(root), full = nodes.map((n) => n.textContent).join("");
    let offset = 0, start = -1;
    for (const n of nodes) {
      if (n === range.startContainer) {
        start = offset + range.startOffset;
        break;
      }
      offset += n.length;
    }
    const block = range.startContainer.parentElement?.closest("p,h2,h3,li,pre")?.textContent || quote;
    const anchor = { quote, prefix: start >= 0 ? full.slice(Math.max(0, start - 80), start) : "", suffix: start >= 0 ? full.slice(start + quote.length, start + quote.length + 80) : "", block };
    if (block.length > 500) anchor.block = block.slice(0, 500);
    const pdf = root.closest(".notes-pdf-page");
    if (pdf) {
      const box = pdf.getBoundingClientRect();
      anchor.block = "page:" + source.page;
      anchor.rects = [...range.getClientRects()].map((v) => ({ x: (v.x - box.x) / box.width, y: (v.y - box.y) / box.height, w: v.width / box.width, h: v.height / box.height })).filter((v) => v.x >= 0 && v.y >= 0 && v.w > 0 && v.h > 0).slice(0, 200);
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "notes-selection";
    b.textContent = "＋ Add Note";
    b.style.left = Math.max(8, Math.min(innerWidth - 160, x)) + "px";
    b.style.top = Math.max(8, Math.min(innerHeight - 60, y + 15)) + "px";
    b.onpointerdown = (ev) => ev.preventDefault();
    b.onclick = () => {
      b.remove();
      getSelection()?.removeAllRanges();
      notesUI().create({ source: { ...source, anchor }, title: quote.slice(0, 80) }).catch(report);
    };
    document.body.append(b);
    activePopup = b;
    break;
  }
}
function mountAppNotes(app) {
  initContexts();
  const ui = notesUI();
  if (app.querySelector("[data-notes-host]")) ui.mount(app.querySelector("[data-notes-host]")).catch(report);
  if (appBindings.has(app)) return appBindings.get(app);
  let pending;
  const scan = async () => {
    for (const old of contexts.keys()) if (!old.isConnected) contexts.get(old).dispose();
    const root = app.querySelector("main");
    if (!root || root.querySelector("[data-notes-host]")) return;
    const title = app.querySelector(".page-heading h1")?.textContent || "AviLog", tab = app.querySelector("[data-screen]")?.dataset.screen;
    if (!tab) return;
    if (tab === "weather") {
      for (const pre of root.querySelectorAll(".weather-station-detail .weather-product pre")) {
        const station = pre.closest("[data-weather-station]")?.dataset.weatherStation, product = pre.closest(".weather-product").querySelector("h3").textContent, source2 = { key: "weather:" + station + ":" + product, title: station + " · " + product, section: product, type: "weather", url: "/?tab=weather", version: await digest(pre.textContent) };
        if (pre.isConnected) bindContext(pre, source2);
      }
      return;
    }
    let content = root.querySelector(".page-heading")?.nextElementSibling;
    while (content?.matches("[data-notes-ui]")) content = content.nextElementSibling;
    if (!content || content.tagName === "FOOTER" || content.matches("[data-weather-watch]")) return;
    const source = { key: "app:" + tab, title: "AviLog · " + title, section: title, type: "app", url: "/?tab=" + tab, version: await digest(content.textContent) };
    if (content.isConnected) bindContext(content, source);
  };
  const observer = new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(() => scan().catch(() => {
    }), 300);
  });
  observer.observe(app, { childList: true, subtree: true });
  scan();
  const dispose = () => {
    observer.disconnect();
    clearTimeout(pending);
    appBindings.delete(app);
  };
  appBindings.set(app, dispose);
  return dispose;
}
function mountStudyNotes() {
  initContexts();
  let bank;
  const scan = () => {
    const qtext = document.querySelector(".qtext"), qhead = document.querySelector(".qhead");
    if (!qtext || !qhead) return;
    const root = qtext.closest("section.card") || qtext.parentElement;
    if (contexts.has(root)) return;
    bank ||= JSON.parse(document.querySelector("#bank-data").textContent)[globalThis.ATPL_SUBJECT];
    const number = Number([...qhead.querySelectorAll(".pill")].find((n) => /^STT /.test(n.textContent))?.textContent.replace("STT ", "")), q = bank.questions.find((q2) => q2.id === number) || bank.questions.find((q2) => q2.uid === qhead.querySelector(".qid")?.textContent);
    if (!q) return;
    const identity = globalThis.ATPLBankStore?.identity;
    const source = { key: "atpl:" + globalThis.ATPL_SUBJECT + ":" + (q.uid || q.id), documentKey: "atpl:" + globalThis.ATPL_SUBJECT, title: "ATPL · " + (bank.info.title || bank.info.name || globalThis.ATPL_SUBJECT), section: q.uid || "Câu " + q.id, questionId: q.uid || String(q.id), type: "atpl", url: location.pathname, version: identity?.bankSHA256 || location.pathname.split("/").at(-1), anchor: null };
    bindContext(root, source);
  };
  const observer = new MutationObserver(() => {
    queueMicrotask(scan);
  });
  observer.observe(document.querySelector("#view"), { childList: true });
  scan();
}
export {
  bindContext,
  digest,
  initContexts,
  mountAppNotes,
  mountStudyNotes,
  quoteRange,
  rememberSource,
  textNodes
};
