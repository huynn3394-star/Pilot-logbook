import { richHTML, safeLink } from "./model.js";
function readEditor(root) {
  const blocks = [];
  function runs(node, style = {}) {
    if (node.nodeType === 3) return [{ text: node.textContent, ...style }];
    if (node.nodeType !== 1 || ["SCRIPT", "STYLE", "INPUT", "BUTTON"].includes(node.tagName)) return [];
    const next = { ...style };
    if (["B", "STRONG"].includes(node.tagName)) next.bold = true;
    if (["I", "EM"].includes(node.tagName)) next.italic = true;
    if (node.tagName === "A" && safeLink(node.getAttribute("href"))) next.href = safeLink(node.getAttribute("href"));
    if (node.tagName === "BR") return [{ text: "\n", ...next }];
    return [...node.childNodes].flatMap((c) => runs(c, next));
  }
  function visit(node) {
    if (node.nodeType === 3) {
      if (node.textContent) blocks.push({ type: "paragraph", runs: runs(node) });
      return;
    }
    if (node.nodeType !== 1) return;
    if (["UL", "OL"].includes(node.tagName)) {
      for (const child of node.children) blocks.push({ type: node.tagName === "OL" ? "number" : "bullet", runs: runs(child) });
      return;
    }
    if (node.hasAttribute("data-check")) {
      blocks.push({ type: "check", checked: node.querySelector("input")?.checked || node.dataset.check === "true", runs: runs(node) });
      return;
    }
    if ([...node.children].some((c) => ["DIV", "P", "UL", "OL"].includes(c.tagName))) {
      for (const c of node.childNodes) visit(c);
    } else blocks.push({ type: "paragraph", runs: runs(node) });
  }
  for (const c of root.childNodes) visit(c);
  return blocks.length ? blocks : [{ type: "paragraph", runs: [{ text: "" }] }];
}
function mountEditor(root, body, onChange) {
  root.innerHTML = richHTML(body);
  root.addEventListener("input", onChange);
  root.addEventListener("change", onChange);
  root.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    onChange();
  });
  root.addEventListener("drop", (event) => event.preventDefault());
  return { command(name) {
    root.focus();
    if (name === "check") {
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      document.execCommand("insertHTML", false, '<div><br></div><div data-check="false"><input type="checkbox" aria-label="Hoàn thành"> <span>Việc cần làm</span></div><div><br></div>');
    } else if (name === "link") {
      const url = prompt("Đường dẫn https://, http:// hoặc mailto:");
      if (url) {
        const link = safeLink(url);
        if (!link) throw Error("Liên kết không hợp lệ.");
        document.execCommand("createLink", false, link);
      }
    } else document.execCommand(name, false);
    onChange();
  } };
}
export {
  mountEditor,
  readEditor
};
