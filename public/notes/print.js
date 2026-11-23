import { validate, escape as e, richHTML } from "./model.js";
try {
  const key = "avilog-notes-print:" + location.hash.slice(1), notes = JSON.parse(sessionStorage.getItem(key) || "null");
  sessionStorage.removeItem(key);
  history.replaceState(null, "", "/notes/print.html");
  if (!Array.isArray(notes)) throw Error("Mở bản xuất từ My Notes.");
  document.querySelector("main").innerHTML = notes.map(validate).map((n) => `<article><h1>${e(n.title || "Ghi chú")}</h1><p>${e(n.tags.join(" · "))}</p>${n.source ? `<aside>Nguồn: ${e(n.source.title)} · ${e(n.source.section || "")}${n.source.page ? " · Trang " + n.source.page : ""}<br>Phiên bản: ${e(n.source.version)}${n.source.anchor?.quote ? "<blockquote>" + e(n.source.anchor.quote) + "</blockquote>" : ""}</aside>` : ""}<section>${richHTML(n.body)}</section><footer>Cập nhật ${new Date(n.updatedAt).toLocaleString("vi-VN")} · Ghi chú học tập cá nhân · AviLog Notes</footer></article>`).join("");
  document.querySelector("#print").onclick = () => window.print();
} catch (err) {
  document.querySelector("main").textContent = err.message;
}
