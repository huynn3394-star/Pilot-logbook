export async function extractPDF(file, onProgress = () => {}) {
  if (file.size > 20 * 1024 * 1024) throw Error("PDF tối đa 20 MB");
  const pdfjs = await import("/vendor/pdfjs/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/build/pdf.worker.mjs";
  const doc = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    isEvalSupported: false,
  }).promise;
  if (doc.numPages > 60) {
    await doc.destroy();
    throw Error("PDF tối đa 60 trang. Chọn roster theo tháng.");
  }
  let text = "";
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Đang đọc trang ${n}/${doc.numPages}`);
      const p = await doc.getPage(n),
        c = await p.getTextContent();
      let y = null;
      for (const i of c.items) {
        if (!("str" in i)) continue;
        if (y !== null && Math.abs(i.transform[5] - y) > 3) text += "\n";
        text += i.str + " ";
        y = i.transform[5];
      }
      text += "\n";
    }
  } finally {
    await doc.destroy();
  }
  if (!text.trim())
    throw Error("PDF dạng scan chưa có chữ. Hãy nhập văn bản roster thủ công.");
  return text;
}
let script;
export async function extractImage(file, onProgress = () => {}) {
  if (file.size > 6 * 1024 * 1024) throw Error("Ảnh tối đa 6 MB");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Dùng ảnh JPG, PNG hoặc WebP (HEIC cần đổi sang JPG).");
  script ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vendor/tesseract/tesseract.min.js";
    s.onload = resolve;
    s.onerror = () => {
      script = null;
      reject(Error("Không tải được OCR"));
    };
    document.head.append(s);
  });
  await script;
  const w = await window.Tesseract.createWorker("eng", 1, {
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract-core",
    logger: (m) =>
      onProgress(m.status + " " + Math.round((m.progress || 0) * 100) + "%"),
  });
  try {
    return (await w.recognize(file)).data.text;
  } finally {
    await w.terminate();
  }
}
export function asDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
