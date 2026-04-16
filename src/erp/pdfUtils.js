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
