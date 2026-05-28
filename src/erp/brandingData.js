import { requestJson } from "./apiClient";

export const DEFAULT_BRANDING = {
  appName: "App",
  appTagline: "",
  primaryColor: "#1677ff",
  logoUrl: null,
  mobileLogoUrl: null,
  supportEmail: "",
  storagePrefix: "app",
};

export async function getBrandingFresh() {
  try {
    const payload = await requestJson("GET", "/api/settings/branding");
    return { ...DEFAULT_BRANDING, ...(payload?.item || {}) };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

export async function updateBranding(values) {
  const payload = await requestJson("PUT", "/api/settings/branding", values);
  return { ...DEFAULT_BRANDING, ...(payload?.item || {}) };
}

export async function uploadBrandingAsset(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result;
        const safeFilename = `branding-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const payload = await requestJson("POST", "/api/assets/upload", { base64, filename: safeFilename });
        resolve(payload?.url || null);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadi."));
    reader.readAsDataURL(file);
  });
}
