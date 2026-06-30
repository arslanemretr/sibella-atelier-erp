import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Grid, Input, Space, Tag, Tooltip, Typography, message } from "antd";
import {
  AudioOutlined,
  AudioMutedOutlined,
  CheckOutlined,
  CloseOutlined,
  RobotOutlined,
  SendOutlined,
  SoundOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { requestJson } from "../apiClient";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const VOICE_SUPPORTED = Boolean(SpeechRecognitionImpl);
const TTS_SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

let messageSeq = 0;
function nextId() { messageSeq += 1; return `m${messageSeq}`; }

export default function AiAssistantPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  // Gosterim mesajlari: {id, role:'user'|'assistant', kind?:'text'|'write'|'error'|'info', text?, write?, action?, done?}
  const [messages, setMessages] = useState([]);
  // Sozlesme adimlari (backend ile ayni format): {type:'user',question} | {type:'result',...}
  const [steps, setSteps] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingId, setSpeakingId] = useState(null);

  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* yoksay */ }
      try { if (TTS_SUPPORTED) window.speechSynthesis.cancel(); } catch { /* yoksay */ }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const pushMessage = (msg) => setMessages((prev) => [...prev, { id: nextId(), ...msg }]);

  // ─── Sesli okuma ───
  const speak = (text, id) => {
    if (!TTS_SUPPORTED || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = "tr-TR";
      const trVoice = window.speechSynthesis.getVoices().find((v) => /tr/i.test(v.lang));
      if (trVoice) utter.voice = trVoice;
      utter.onend = () => setSpeakingId(null);
      utter.onerror = () => setSpeakingId(null);
      setSpeakingId(id || "x");
      window.speechSynthesis.speak(utter);
    } catch { setSpeakingId(null); }
  };
  const stopSpeak = () => { try { if (TTS_SUPPORTED) window.speechSynthesis.cancel(); } catch { /* yoksay */ } setSpeakingId(null); };

  // ─── Sesli giris ───
  const toggleListen = () => {
    if (!VOICE_SUPPORTED) { message.warning("Bu tarayici sesli girisi desteklemiyor (Chrome/Edge)."); return; }
    if (listening) { try { recognitionRef.current?.stop(); } catch { /* yoksay */ } return; }
    const rec = new SpeechRecognitionImpl();
    rec.lang = "tr-TR"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (event) => {
      let t = "";
      for (let i = 0; i < event.results.length; i += 1) t += event.results[i][0].transcript;
      setInput(t);
    };
    rec.onerror = (e) => {
      if (e?.error === "not-allowed") message.error("Mikrofon izni reddedildi.");
      setListening(false); recognitionRef.current = null;
    };
    rec.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); recognitionRef.current = null; }
  };

  // ─── Backend dongusu ───
  const runChat = async (nextSteps) => {
    setLoading(true);
    try {
      const payload = await requestJson("POST", "/api/ai/chat", { steps: nextSteps, mode: "write" });
      const returnedSteps = Array.isArray(payload?.steps) ? payload.steps : nextSteps;
      setSteps(returnedSteps);

      if (payload?.status === "answer") {
        const text = String(payload.text || "");
        const id = nextId();
        setMessages((prev) => [...prev, { id, role: "assistant", kind: "text", text }]);
        if (autoSpeak) speak(text, id);
        return returnedSteps;
      }
      if (payload?.status === "clarify") {
        const text = String(payload.text || "");
        const id = nextId();
        setMessages((prev) => [...prev, { id, role: "assistant", kind: "text", text }]);
        if (autoSpeak) speak(text, id);
        return returnedSteps;
      }
      if (payload?.status === "write") {
        pushMessage({ role: "assistant", kind: "write", write: payload.write, action: payload.action });
        return returnedSteps;
      }
      // maxiter / diger
      pushMessage({ role: "assistant", kind: "info", text: String(payload?.text || "Islem tamamlanamadi.") });
      return returnedSteps;
    } catch (error) {
      pushMessage({ role: "assistant", kind: "error", text: error?.message || "AI cagrisi basarisiz oldu." });
      return nextSteps;
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (listening) { try { recognitionRef.current?.stop(); } catch { /* yoksay */ } }
    pushMessage({ role: "user", kind: "text", text: q });
    setInput("");
    const nextSteps = [...steps, { type: "user", question: q }];
    setSteps(nextSteps);
    await runChat(nextSteps);
  };

  const handleConfirmWrite = async (msgId, action) => {
    setLoading(true);
    try {
      const out = await requestJson("POST", "/api/ai/execute-write", { action, confirmed: true });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, done: "confirmed" } : m)));
      const resultStep = { type: "result", action, result: out?.result || out };
      const nextSteps = [...steps, resultStep];
      setSteps(nextSteps);
      await runChat(nextSteps);
    } catch (error) {
      message.error(error?.message || "Kayit basarisiz.");
      pushMessage({ role: "assistant", kind: "error", text: error?.message || "Kayit basarisiz." });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelWrite = (msgId, action) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, done: "cancelled" } : m)));
    const nextSteps = [...steps, { type: "result", action, error: "Kullanici islemi iptal etti." }];
    setSteps(nextSteps);
    pushMessage({ role: "assistant", kind: "info", text: "Islem iptal edildi." });
  };

  const bubbleStyle = (role) => ({
    maxWidth: isMobile ? "90%" : "75%",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    background: role === "user" ? "var(--erp-coral, #e8674e)" : "#f4f4f5",
    color: role === "user" ? "#fff" : "inherit",
    borderRadius: 14,
    padding: "8px 12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });

  const renderMessage = (m) => {
    if (m.kind === "write") {
      const w = m.write || {};
      const lines = w.preview?.lines || [];
      const warnings = w.warnings || [];
      return (
        <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: isMobile ? "95%" : "80%" }}>
          <Card size="small" title={w.preview?.title || "Onay bekleyen islem"} style={{ borderColor: "#e8674e" }}>
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              {lines.map(([label, value], i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <Text type="secondary" style={{ minWidth: 110 }}>{label}</Text>
                  <Text strong>{value}</Text>
                </div>
              ))}
              {warnings.length ? <Alert type="warning" showIcon message={warnings.join(" · ")} /> : null}
              {m.done === "confirmed" ? (
                <Tag color="green">Kaydedildi</Tag>
              ) : m.done === "cancelled" ? (
                <Tag>Iptal edildi</Tag>
              ) : (
                <Space>
                  <Button type="primary" icon={<CheckOutlined />} loading={loading} onClick={() => handleConfirmWrite(m.id, m.action)}>
                    Onayla ve Kaydet
                  </Button>
                  <Button icon={<CloseOutlined />} onClick={() => handleCancelWrite(m.id, m.action)}>Vazgec</Button>
                </Space>
              )}
            </Space>
          </Card>
        </div>
      );
    }
    if (m.kind === "error") {
      return <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: isMobile ? "90%" : "75%" }}><Alert type="error" showIcon message={m.text} /></div>;
    }
    if (m.kind === "info") {
      return <div key={m.id} style={{ alignSelf: "center" }}><Text type="secondary" style={{ fontSize: 12 }}>{m.text}</Text></div>;
    }
    return (
      <div key={m.id} style={bubbleStyle(m.role)}>
        {m.text}
        {m.role === "assistant" && TTS_SUPPORTED ? (
          <div style={{ marginTop: 4 }}>
            {speakingId === m.id ? (
              <Button size="small" type="text" icon={<StopOutlined />} onClick={stopSpeak}>Durdur</Button>
            ) : (
              <Button size="small" type="text" icon={<SoundOutlined />} onClick={() => speak(m.text, m.id)}>Oku</Button>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const emptyState = useMemo(() => (
    <div style={{ textAlign: "center", color: "#999", marginTop: 40 }}>
      <RobotOutlined style={{ fontSize: 40 }} />
      <Paragraph type="secondary" style={{ marginTop: 12 }}>
        Sorununuzu yazin ya da mikrofonla soyleyin. Ornek:<br />
        "Bu ay en cok satan 5 urun hangisi?"<br />
        "Yeni urun ekle: ... (ad, tedarikci, kategori, fiyat)"
      </Paragraph>
    </div>
  ), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, padding: isMobile ? "0 8px" : "0 16px" }}>
      {TTS_SUPPORTED ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "6px 0 0" }}>
          <Tooltip title="Cevabi otomatik sesli oku">
            <Button
              size="small"
              type={autoSpeak ? "primary" : "default"}
              icon={<SoundOutlined />}
              onClick={() => { setAutoSpeak((v) => !v); if (autoSpeak) stopSpeak(); }}
            >
              {autoSpeak ? "Sesli: Acik" : "Sesli: Kapali"}
            </Button>
          </Tooltip>
        </div>
      ) : null}

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "12px 4px" }}>
        {messages.length === 0 ? emptyState : messages.map(renderMessage)}
        {loading ? <div style={{ alignSelf: "flex-start" }}><Tag color="processing">AI calisiyor…</Tag></div> : null}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 0", borderTop: "1px solid #f0f0f0" }}>
        {VOICE_SUPPORTED ? (
          <Tooltip title={listening ? "Dinleniyor… durdur" : "Sesli sor"}>
            <Button danger={listening} type={listening ? "primary" : "default"} icon={listening ? <AudioMutedOutlined /> : <AudioOutlined />} onClick={toggleListen} disabled={loading} />
          </Tooltip>
        ) : null}
        <TextArea
          placeholder="Mesajinizi yazin…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}>Gonder</Button>
      </div>
    </div>
  );
}
