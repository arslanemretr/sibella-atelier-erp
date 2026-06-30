// AI istemci tercihleri (tarayici bazli - localStorage).
// Seslendirme (TTS) sesi/hizi ve otomatik okuma tercihi burada tutulur.
// Sesler tarayici/cihaza gore degistigi icin DB yerine localStorage uygundur.

const KEY = "sibella.ai.voicePrefs.v1";

export const TTS_SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

export function getAiVoicePrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      voiceURI: parsed.voiceURI || "",
      rate: typeof parsed.rate === "number" ? parsed.rate : 1,
      autoSpeak: parsed.autoSpeak !== false, // varsayilan acik
    };
  } catch {
    return { voiceURI: "", rate: 1, autoSpeak: true };
  }
}

export function setAiVoicePrefs(next) {
  const current = getAiVoicePrefs();
  const merged = { ...current, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* yoksay */ }
  return merged;
}

export function listVoices() {
  if (!TTS_SUPPORTED) return [];
  try { return window.speechSynthesis.getVoices() || []; } catch { return []; }
}

// Bir SpeechSynthesisUtterance'i tercihlere gore yapilandirir.
export function configureUtterance(utter) {
  if (!TTS_SUPPORTED || !utter) return utter;
  const prefs = getAiVoicePrefs();
  const voices = listVoices();
  let voice = null;
  if (prefs.voiceURI) voice = voices.find((v) => v.voiceURI === prefs.voiceURI) || null;
  if (!voice) voice = voices.find((v) => /tr/i.test(v.lang)) || null;
  utter.lang = voice?.lang || "tr-TR";
  if (voice) utter.voice = voice;
  utter.rate = Number(prefs.rate) || 1;
  return utter;
}
