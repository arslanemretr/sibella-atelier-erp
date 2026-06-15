// Telefon/masaüstü fotoğraflarını yüklemeden önce client tarafında küçültür.
// 3-4 MB'lık ham foto -> ~150-300 KB JPEG. Böylece base64 gövde küçük kalır,
// istek limitine takılmaz ve gönderim hızlanır.

export async function compressImageFile(file, options = {}) {
  const { maxDim = 1280, quality = 0.72 } = options;

  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Gecerli bir gorsel seciniz.");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gorsel okunamadi."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gorsel yuklenemedi."));
    image.src = dataUrl;
  });

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (!width || !height) {
    // Boyut okunamadıysa ham veriyi geri ver (yine de çalışsın)
    return dataUrl;
  }

  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }
  // PNG saydamlığı JPEG'de siyah olmasın diye beyaz zemin
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}
