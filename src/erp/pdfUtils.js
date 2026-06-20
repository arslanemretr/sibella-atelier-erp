import { jsPDF } from "jspdf";

export { jsPDF };

export function formatPdfNumber(value) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatPdfMoney(value, currency = "TRY") {
  const currencyLabel = currency === "TRY" ? "TL" : currency;
  return `${formatPdfNumber(value)} ${currencyLabel}`;
}

export function formatPdfDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

export async function ensurePdfFont(doc) {
  try {
    if (doc.getFontList()?.NotoSans) {
      doc.setFont("NotoSans", "normal");
      return;
    }

    const response = await fetch("/fonts/NotoSans-Regular.ttf");
    if (!response.ok) {
      throw new Error("Font bulunamadi");
    }

    const buffer = await response.arrayBuffer();
    const base64Font = arrayBufferToBase64(buffer);
    doc.addFileToVFS("NotoSans-Regular.ttf", base64Font);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans", "normal");
  } catch {
    doc.setFont("helvetica", "normal");
  }
}

export async function drawPdfLogo(doc) {
  try {
    const response = await fetch("/pdf-logo.png");
    if (!response.ok) {
      throw new Error("Logo yok");
    }

    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (typeof dataUrl === "string") {
      doc.addImage(dataUrl, "PNG", 168, 14, 24, 24);
      return;
    }
  } catch {
    // fallback below
  }

  doc.setDrawColor(214, 222, 232);
  doc.roundedRect(168, 14, 24, 24, 2, 2);
  doc.setFontSize(9);
  doc.text("LOGO", 180, 28, { align: "center" });
}

export function drawDeliveryTableHeader(doc, y) {
  doc.setFontSize(10);
  doc.setFillColor(246, 248, 251);
  doc.rect(14, y - 5, 182, 8, "F");
  doc.text("Gorsel", 16, y);
  doc.text("Kod", 38, y);
  doc.text("Urun Adi", 68, y);
  doc.text("Fiyat", 132, y);
  doc.text("Adet", 156, y);
  doc.text("Tutar", 174, y);
}

export function drawShipmentTableHeader(doc, y) {
  doc.setFontSize(10);
  doc.setFillColor(246, 248, 251);
  doc.rect(14, y - 5, 182, 8, "F");
  doc.text("Gorsel", 16, y);
  doc.text("Kod", 38, y);
  doc.text("Urun Adi", 68, y);
  doc.text("Birim Fiyat", 130, y);
  doc.text("Adet", 158, y);
  doc.text("Toplam", 174, y);
}

/* ══ Gorsel yardimcilari (PDF gomme) ══════════════════════════════════════
   jsPDF.addImage yalnizca JPEG/PNG cizebilir. webp vb. + buyuk/sorunlu gorseller
   canvas uzerinden standart JPEG'e cevrilir. Cizilemeyen formatlar JPEG'e indirilir. */
export function isDrawableDataUrl(s) {
  return typeof s === "string" && (s.startsWith("data:image/jpeg") || s.startsWith("data:image/jpg") || s.startsWith("data:image/png"));
}

export async function reencodeToJpeg(dataUrl) {
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("decode"));
      im.src = dataUrl;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    return out && out.startsWith("data:image/jpeg") && out.length > 100 ? out : null;
  } catch {
    return null;
  }
}

export async function toDrawableDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return null;
  // SVG kontrolu yalnizca MIME basliginda (base64 govdesinde tesadufen "svg" gecmesin)
  const header = dataUrl.slice(0, (dataUrl.indexOf(",") + 1) || 32);
  if (header.includes("svg")) return null;
  if (isDrawableDataUrl(dataUrl)) return dataUrl;
  return reencodeToJpeg(dataUrl);
}

export async function fetchImageDataUrl(url) {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "reload" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || !String(blob.type || "").startsWith("image/") || String(blob.type).includes("svg")) return null;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return toDrawableDataUrl(dataUrl);
  } catch {
    return null;
  }
}

// data:/url/path -> PDF'e gomulebilir JPEG/PNG data URL
export async function resolveImageData(src) {
  if (!src || typeof src !== "string") return null;
  if (src.startsWith("data:image")) return toDrawableDataUrl(src);
  return fetchImageDataUrl(src);
}

/* ══ Ortak "kalemli belge" PDF tasarimi (gonderi + teslimat ayni gorunum) ══
   cfg: { title, partyLabel, partyName, partyLogo, docNoLabel, docNo, dateText,
          summary:[[label,value]...], lines, lineImages, currency, brandingLogo,
          footer:{name,email,web} } */
export function renderItemsPdf(doc, cfg) {
  const CORAL = [232, 103, 78];
  const CORAL_SOFT = [253, 238, 233];
  const CORAL_HL = [250, 224, 215];
  const INK = [45, 45, 50];
  const GRAY = [148, 142, 134];
  const SEP = [238, 236, 240];
  const setFill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const M = 16, R = 194, W = R - M;
  const cur = cfg.currency || "TRY";
  const lines = cfg.lines || [];
  const lineImages = cfg.lineImages || [];

  // Baslik: sol marka logosu + sag baslik + ayrac
  if (cfg.brandingLogo) {
    try {
      const props = doc.getImageProperties(cfg.brandingLogo);
      const targetH = 22;
      const ratio = props?.width && props?.height ? props.width / props.height : 2.4;
      const w = Math.min(72, targetH * ratio);
      doc.addImage(cfg.brandingLogo, props?.fileType || (cfg.brandingLogo.includes("image/png") ? "PNG" : "JPEG"), M, 5, w, targetH);
    } catch { /* yoksay */ }
  }
  setText(INK);
  doc.setFontSize(16);
  doc.text(cfg.title || "FORM", R, 21, { align: "right" });
  setDraw(CORAL);
  doc.setLineWidth(0.4);
  doc.line(M, 30, R, 30);
  setFill(CORAL);
  doc.circle(105, 30, 1.4, "F");

  // Ust bilgi karti
  let y = 36;
  const cardH = 58;
  setFill([252, 248, 246]);
  setDraw([241, 232, 227]);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, W, cardH, 4, 4, "FD");

  // Parti ikon kutusu: gonderen logosu varsa onu, yoksa coral kutu + glyph
  if (cfg.partyLogo) {
    setFill([255, 255, 255]);
    setDraw([238, 236, 240]);
    doc.roundedRect(M + 6, y + 7, 20, 20, 4, 4, "FD");
    try {
      const lp = doc.getImageProperties(cfg.partyLogo);
      const ratio = lp?.width && lp?.height ? lp.width / lp.height : 1;
      let iw = 16, ih = 16;
      if (ratio >= 1) ih = 16 / ratio; else iw = 16 * ratio;
      doc.addImage(cfg.partyLogo, lp?.fileType || (cfg.partyLogo.includes("image/png") ? "PNG" : "JPEG"), M + 6 + (20 - iw) / 2, y + 7 + (20 - ih) / 2, iw, ih);
    } catch { /* yoksay */ }
  } else {
    setFill(CORAL);
    doc.roundedRect(M + 6, y + 7, 20, 20, 4, 4, "F");
    setFill([255, 255, 255]);
    doc.rect(M + 11, y + 15, 10, 7, "F");
    doc.triangle(M + 9, y + 15, M + 23, y + 15, M + 16, y + 11, "F");
  }
  setText(CORAL);
  doc.setFontSize(8);
  doc.text(cfg.partyLabel || "", M + 32, y + 13);
  setText(INK);
  doc.setFontSize(14);
  doc.text(String(cfg.partyName || "-"), M + 32, y + 22);

  // Belge no + tarih (sagda alt alta)
  const rx = M + W - 62;
  setText(GRAY); doc.setFontSize(7.5);
  doc.text(cfg.docNoLabel || "No", rx, y + 11);
  setText(INK); doc.setFontSize(10);
  doc.text(String(cfg.docNo || "-"), rx, y + 16);
  setText(GRAY); doc.setFontSize(7.5);
  doc.text("Tarih", rx, y + 23);
  setText(INK); doc.setFontSize(10);
  doc.text(String(cfg.dateText || "-"), rx, y + 28);

  // 3 ozet kutusu
  const innerPad = 7, boxGap = 5;
  const boxW = (W - 2 * innerPad - 2 * boxGap) / 3;
  const boxY = y + 33, boxH = 18;
  (cfg.summary || []).slice(0, 3).forEach(([label, value], i) => {
    const bx = M + innerPad + i * (boxW + boxGap);
    setFill(CORAL_HL);
    doc.roundedRect(bx, boxY, boxW, boxH, 3, 3, "F");
    setFill(CORAL);
    doc.circle(bx + 8, boxY + boxH / 2, 3, "F");
    setText(GRAY); doc.setFontSize(7.5);
    doc.text(String(label), bx + 14, boxY + 7);
    setText(CORAL); doc.setFontSize(11);
    doc.text(String(value), bx + 14, boxY + 14);
  });

  // Urunler basligi
  y += cardH + 12;
  setText(CORAL);
  doc.setFontSize(13);
  doc.text("ÜRÜNLER", M, y);
  y += 6;

  const PX = { thumb: 19, code: 40, name: 64, price: 150, qty: 166, total: R - 2 };
  const drawHeadBand = (top) => {
    setFill(CORAL);
    doc.roundedRect(M, top, W, 9, 2, 2, "F");
    setText([255, 255, 255]);
    doc.setFontSize(8.5);
    doc.text("Görsel", PX.thumb, top + 6);
    doc.text("Kod", PX.code, top + 6);
    doc.text("Ürün Adı", PX.name, top + 6);
    doc.text("Birim Fiyat", PX.price, top + 6, { align: "right" });
    doc.text("Adet", PX.qty, top + 6, { align: "center" });
    doc.text("Toplam", PX.total, top + 6, { align: "right" });
  };
  drawHeadBand(y);
  y += 9;

  const ROW_H = 16;
  lines.forEach((line, idx) => {
    if (y + ROW_H > 276) {
      doc.addPage();
      y = 16;
      drawHeadBand(y);
      y += 9;
    }
    const rowTop = y;
    const midY = rowTop + ROW_H / 2;
    const img = lineImages[idx];
    setFill([247, 245, 242]);
    setDraw(SEP);
    doc.roundedRect(PX.thumb - 1, rowTop + 2, 12, 12, 2, 2, "FD");
    if (img) {
      try { doc.addImage(img, "JPEG", PX.thumb - 1, rowTop + 2, 12, 12, `ln${idx}`); } catch { /* placeholder */ }
    }
    setText(INK);
    doc.setFontSize(9);
    doc.text(String(line.code || "-").slice(0, 16), PX.code, midY + 1);
    const nameLines = doc.splitTextToSize(String(line.name || "-"), 78).slice(0, 2);
    doc.text(nameLines, PX.name, nameLines.length > 1 ? midY - 1.5 : midY + 1);
    doc.text(formatPdfMoney(line.salePrice, cur), PX.price, midY + 1, { align: "right" });
    doc.text(String(line.quantity || 0), PX.qty, midY + 1, { align: "center" });
    setText(CORAL);
    doc.text(formatPdfMoney((line.quantity || 0) * (line.salePrice || 0), cur), PX.total, midY + 1, { align: "right" });
    setDraw(SEP);
    doc.setLineWidth(0.2);
    doc.line(M, rowTop + ROW_H, R, rowTop + ROW_H);
    y += ROW_H;
  });

  // Footer
  const f = cfg.footer || { name: "Sibella Atelier", email: "info@sibellaatelier.com", web: "www.sibellaatelier.com" };
  const fy = 280;
  setFill(CORAL_SOFT);
  doc.roundedRect(M, fy, W, 13, 3, 3, "F");
  doc.setFontSize(8.5);
  const footY = fy + 8;
  [[f.name, M + 14], [f.email, M + 70], [f.web, M + 128]].forEach(([txt, fx]) => {
    if (!txt) return;
    setFill(CORAL);
    doc.circle(fx - 5, footY - 1.5, 2, "F");
    setText(CORAL);
    doc.text(String(txt), fx, footY);
  });
}
