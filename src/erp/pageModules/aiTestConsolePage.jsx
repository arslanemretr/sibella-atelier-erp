import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Input,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  AudioOutlined,
  AudioMutedOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  SoundOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { requestJson } from "../apiClient";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Tarayici konusma tanima (Web Speech API) - Chrome/Edge destekler.
const SpeechRecognitionImpl =
  typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const VOICE_SUPPORTED = Boolean(SpeechRecognitionImpl);

// Tarayici sesli okuma (Text-to-Speech)
const TTS_SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

// Claude'un dondurdugu metinden ilk JSON nesnesini cikar (tolerant).
function parseClaudeReply(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Once Claude'un cevabini yapistirin.");
  // ```json ... ``` bloklarini temizle
  const stripped = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Cevap icinde gecerli bir JSON bulunamadi.");
    }
    return JSON.parse(stripped.slice(start, end + 1));
  }
}

function ResultTable({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <Alert type="info" showIcon message="Sorgu sonuc dondurmedi (0 satir)." />;
  }
  const columns = Object.keys(rows[0]).map((key) => ({
    title: key,
    dataIndex: key,
    key,
    render: (value) =>
      value === null || typeof value === "undefined"
        ? "-"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
  }));
  const data = rows.map((row, index) => ({ ...row, __key: index }));
  return (
    <Table
      size="small"
      rowKey="__key"
      columns={columns}
      dataSource={data}
      pagination={rows.length > 10 ? { pageSize: 10 } : false}
      scroll={{ x: "max-content" }}
    />
  );
}

function ResultView({ value }) {
  if (Array.isArray(value)) {
    return <ResultTable rows={value} />;
  }
  if (value && typeof value === "object") {
    return (
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <Text>{typeof value === "undefined" || value === null ? "-" : String(value)}</Text>;
}

function WritePreview({ pendingWrite, loading, onConfirm, onCancel }) {
  if (!pendingWrite) return null;
  const lines = Array.isArray(pendingWrite.preview?.lines) ? pendingWrite.preview.lines : [];
  return (
    <Card size="small" title={pendingWrite.preview?.title || "Kayit Onizleme"} style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {Array.isArray(pendingWrite.warnings) && pendingWrite.warnings.length ? (
          <Alert
            type="warning"
            showIcon
            message="Kontrol gerektiren noktalar"
            description={pendingWrite.warnings.join("\n")}
          />
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: "8px 12px" }}>
          {lines.map(([label, value], index) => (
            <React.Fragment key={`${label}-${index}`}>
              <Text type="secondary">{label}</Text>
              <Text strong>{value || "-"}</Text>
            </React.Fragment>
          ))}
        </div>
        <Alert type="info" showIcon message="Kayit otomatik yapilmaz; yalnizca onayladiginizda urun karti olusturulur." />
        <Space wrap>
          <Button onClick={onCancel} disabled={loading}>Vazgec</Button>
          <Button type="primary" danger onClick={onConfirm} loading={loading}>
            Onayla ve Kaydet
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

export function AiConsolePageBase({ mode = "read" } = {}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const activeMode = mode === "write" ? "write" : "read";
  const isWriteMode = activeMode === "write";
  const pageTitle = isWriteMode ? "AI Veri Giris Konsolu" : "AI Test Konsolu";
  const questionPlaceholder = isWriteMode
    ? "Orn: Mercan tasli yeni bir yuzuk olustur, satis fiyati 1200 TL"
    : "Orn: Ayse Yilmaz musterisinin toplam satisi kac adet?";

  const [question, setQuestion] = useState("");
  const [steps, setSteps] = useState([]); // {type:'user',question} | {type:'result',action,result,truncated,error}
  const [prompt, setPrompt] = useState("");
  const [claudeReply, setClaudeReply] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [clarifyQuestion, setClarifyQuestion] = useState("");
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [pendingWrite, setPendingWrite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listeningField, setListeningField] = useState(null); // "question" | "clarify" | null
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const setterRef = useRef(null);

  const started = steps.length > 0;

  // Bilesen kaldirilirken dinlemeyi ve okumayi durdur
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* yoksay */ }
      try { if (TTS_SUPPORTED) window.speechSynthesis.cancel(); } catch { /* yoksay */ }
    };
  }, []);

  const speakText = (text) => {
    if (!TTS_SUPPORTED || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = "tr-TR";
      const trVoice = window.speechSynthesis.getVoices().find((v) => /tr/i.test(v.lang));
      if (trVoice) utter.voice = trVoice;
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utter);
    } catch {
      setSpeaking(false);
    }
  };

  const stopSpeak = () => {
    try { if (TTS_SUPPORTED) window.speechSynthesis.cancel(); } catch { /* yoksay */ }
    setSpeaking(false);
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch { /* yoksay */ }
    recognitionRef.current = null;
    setterRef.current = null;
    setListeningField(null);
  };

  const startListening = (field, setter) => {
    if (!VOICE_SUPPORTED) {
      message.warning("Bu tarayici sesli girisi desteklemiyor (Chrome/Edge deneyin).");
      return;
    }
    if (listeningField) { stopListening(); return; }
    const rec = new SpeechRecognitionImpl();
    rec.lang = "tr-TR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    setterRef.current = setter;
    rec.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setterRef.current?.(transcript);
    };
    rec.onerror = (event) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        message.error("Mikrofon izni reddedildi. Tarayici ayarlarindan izin verin.");
      } else if (event?.error === "no-speech") {
        message.info("Ses algilanmadi.");
      }
      stopListening();
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setterRef.current = null;
      setListeningField(null);
    };
    recognitionRef.current = rec;
    setListeningField(field);
    try {
      rec.start();
    } catch {
      stopListening();
    }
  };

  const MicButton = ({ field, setter }) => {
    if (!VOICE_SUPPORTED) return null;
    const active = listeningField === field;
    return (
      <Tooltip title={active ? "Dinleniyor... durdurmak icin tiklayin" : "Sesli soru sor"}>
        <Button
          type={active ? "primary" : "default"}
          danger={active}
          icon={active ? <AudioMutedOutlined /> : <AudioOutlined />}
          onClick={() => startListening(field, setter)}
          disabled={loading}
        />
      </Tooltip>
    );
  };

  const buildPrompt = async (nextSteps) => {
    setLoading(true);
    try {
      const payload = await requestJson("POST", "/api/ai/build-prompt", { steps: nextSteps, mode: activeMode });
      setPrompt(payload?.prompt || "");
    } catch (error) {
      message.error(error?.message || "Prompt olusturulamadi.");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (listeningField) stopListening();
    const q = question.trim();
    if (!q) {
      message.warning("Once bir soru yazin.");
      return;
    }
    const nextSteps = [{ type: "user", question: q }];
    setSteps(nextSteps);
    setFinalAnswer("");
    setClarifyQuestion("");
    setClarifyAnswer("");
    setPendingWrite(null);
    setClaudeReply("");
    await buildPrompt(nextSteps);
  };

  const handleReset = () => {
    stopSpeak();
    setQuestion("");
    setSteps([]);
    setPrompt("");
    setClaudeReply("");
    setFinalAnswer("");
    setClarifyQuestion("");
    setClarifyAnswer("");
    setPendingWrite(null);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      message.success("Prompt kopyalandi. claude.ai'ye yapistirin.");
    } catch {
      message.info("Kopyalanamadi; metni elle secip kopyalayin.");
    }
  };

  const handleProcessReply = async () => {
    let action;
    try {
      action = parseClaudeReply(claudeReply);
    } catch (error) {
      message.error(error?.message || "Cevap ayristirilarmadi.");
      return;
    }

    if (!action?.action) {
      message.error("JSON icinde 'action' alani yok.");
      return;
    }

    if (action.action === "answer") {
      const text = String(action.text || "");
      setFinalAnswer(text);
      setClarifyQuestion("");
      setClarifyAnswer("");
      setPendingWrite(null);
      if (autoSpeak) speakText(text);
      return;
    }

    if (action.action === "clarify") {
      setClarifyQuestion(String(action.text || ""));
      setClarifyAnswer("");
      setFinalAnswer("");
      setPendingWrite(null);
      return;
    }

    if (action.action === "write") {
      if (!isWriteMode) {
        message.error("Bu ekranda yazma action'i calistirilmaz. AI Veri Giris Konsolu'nu kullanin.");
        return;
      }
      setLoading(true);
      try {
        const out = await requestJson("POST", "/api/ai/prepare-write", { action });
        setPendingWrite({ action, ...(out?.write || {}) });
        setClaudeReply("");
        setClarifyQuestion("");
        setClarifyAnswer("");
        setFinalAnswer("");
        message.info("Yazma onizlemesi hazir. Kontrol edip onaylayin.");
      } catch (error) {
        const errStep = { type: "result", action, error: error?.message || "Yazma onizlemesi hazirlanamadi." };
        const nextSteps = [...steps, errStep];
        setSteps(nextSteps);
        setClaudeReply("");
        await buildPrompt(nextSteps);
        message.error(error?.message || "Yazma onizlemesi hazirlanamadi. Hata Claude'a iletildi.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (action.action === "tool" || action.action === "sql") {
      setLoading(true);
      try {
        const out = await requestJson("POST", "/api/ai/execute-action", { action });
        const resultStep = {
          type: "result",
          action,
          result: out?.result ?? [],
          truncated: Boolean(out?.truncated),
          rowCount: out?.rowCount ?? (Array.isArray(out?.result) ? out.result.length : 0),
        };
        const nextSteps = [...steps, resultStep];
        setSteps(nextSteps);
        setClaudeReply("");
        setClarifyQuestion("");
        setClarifyAnswer("");
        setPendingWrite(null);
        await buildPrompt(nextSteps);
        message.success("Sorgu calistirildi. Yeni prompt hazir - tekrar claude.ai'ye yapistirin.");
      } catch (error) {
        // Hatayi da bir adim olarak ekle ki Claude duzeltebilsin
        const errStep = { type: "result", action, error: error?.message || "Calistirilamadi." };
        const nextSteps = [...steps, errStep];
        setSteps(nextSteps);
        setClaudeReply("");
        await buildPrompt(nextSteps);
        message.error(error?.message || "Calistirilamadi. Hata Claude'a iletildi, yeni promptu yapistirin.");
      } finally {
        setLoading(false);
      }
      return;
    }

    message.error(`Bilinmeyen action: ${action.action}`);
  };

  const handleConfirmWrite = async () => {
    if (!pendingWrite?.action) return;
    setLoading(true);
    try {
      const out = await requestJson("POST", "/api/ai/execute-write", {
        action: pendingWrite.action,
        confirmed: true,
      });
      const resultStep = {
        type: "result",
        action: pendingWrite.action,
        result: out?.result ?? {},
        preview: out?.preview || pendingWrite.preview || null,
        warnings: out?.warnings || pendingWrite.warnings || [],
      };
      const nextSteps = [...steps, resultStep];
      setSteps(nextSteps);
      setPendingWrite(null);
      setClaudeReply("");
      setClarifyQuestion("");
      setClarifyAnswer("");
      await buildPrompt(nextSteps);
      message.success("Kayit olusturuldu. Yeni prompt hazir - sonucu Claude'a iletin.");
    } catch (error) {
      const errStep = { type: "result", action: pendingWrite.action, error: error?.message || "Yazma islemi tamamlanamadi." };
      const nextSteps = [...steps, errStep];
      setSteps(nextSteps);
      setPendingWrite(null);
      setClaudeReply("");
      await buildPrompt(nextSteps);
      message.error(error?.message || "Yazma islemi tamamlanamadi. Hata Claude'a iletildi.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendClarify = async () => {
    const q = clarifyAnswer.trim();
    if (!q) return;
    const nextSteps = [...steps, { type: "user", question: q }];
    setSteps(nextSteps);
    setClarifyQuestion("");
    setClarifyAnswer("");
    setPendingWrite(null);
    setClaudeReply("");
    await buildPrompt(nextSteps);
  };

  const timeline = useMemo(() => {
    return steps.map((step, index) => {
      if (step.type === "user") {
        return (
          <Card key={index} size="small" style={{ marginBottom: 8 }}>
            <Tag color="blue">Kullanici</Tag> <Text>{step.question}</Text>
          </Card>
        );
      }
      const label =
        step.action?.action === "tool"
          ? `Arac: ${step.action.name}`
          : step.action?.action === "sql"
            ? "SQL"
            : step.action?.action === "write"
              ? `Yazma: ${step.action.tool || step.action.name || "-"}`
              : "Sonuc";
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }}>
          <Space direction="vertical" style={{ width: "100%" }} size={6}>
            <span>
              <Tag color="purple">{label}</Tag>
              {step.truncated ? <Tag color="orange">ilk 500 satir</Tag> : null}
              {typeof step.rowCount === "number" ? <Text type="secondary">{step.rowCount} satir</Text> : null}
            </span>
            {step.action?.action === "sql" ? (
              <Paragraph code style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                {step.action.query}
              </Paragraph>
            ) : null}
            {step.error ? (
              <Alert type="error" showIcon message={step.error} />
            ) : (
              <>
                {Array.isArray(step.warnings) && step.warnings.length ? (
                  <Alert type="warning" showIcon message={step.warnings.join("\n")} />
                ) : null}
                <ResultView value={step.result} />
              </>
            )}
          </Space>
        </Card>
      );
    });
  }, [steps]);

  return (
    <div style={{ padding: isMobile ? 12 : 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <Space align="center">
          <RobotOutlined style={{ fontSize: 22 }} />
          <Title level={3} style={{ margin: 0 }}>{pageTitle}</Title>
          <Tag color={isWriteMode ? "red" : "gold"}>{isWriteMode ? "Onayli Yazma" : "Manuel"}</Tag>
        </Space>
        {TTS_SUPPORTED ? (
          <Space align="center" size={6}>
            <SoundOutlined />
            <Text type="secondary">Cevabi sesli oku</Text>
            <Switch
              size="small"
              checked={autoSpeak}
              onChange={(v) => { setAutoSpeak(v); if (!v) stopSpeak(); }}
            />
          </Space>
        ) : null}
      </div>
      {isWriteMode ? (
        <Paragraph type="secondary">
          Urun olusturma istegini yazin, promptu claude.ai'ye yapistirin. Claude bir <b>write</b> onerirse
          once onizleme gosterilir; kayit sadece <b>Onayla ve Kaydet</b> ile yapilir. Urun olusturmada
          minimum zorunlu alanlar: <b>urun adi</b>, <b>tedarikci</b>, <b>kategori</b> ve <b>merkez satis fiyati</b>.
        </Paragraph>
      ) : (
        <Paragraph type="secondary">
          Soruyu yazip <b>Prompt Olustur</b>'a basin. Olusan promptu kopyalayip claude.ai'ye yapistirin.
          Claude'un dondurdugu JSON cevabini asagiya yapistirip <b>Cevabi Isle</b>'ye basin; sistem sorguyu
          veritabaninda (salt-okunur) calistirip sonucu gosterir ve gerekiyorsa bir sonraki promptu uretir.
        </Paragraph>
      )}

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: isMobile ? 12 : 16 } }}>
        {isMobile ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Input
              placeholder={questionPlaceholder}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={handleStart}
              disabled={loading}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <MicButton field="question" setter={setQuestion} />
              <Button type="primary" icon={<SendOutlined />} onClick={handleStart} loading={loading} style={{ flex: 1 }}>
                Prompt Olustur
              </Button>
              {started ? (
                <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={loading} />
              ) : null}
            </div>
          </Space>
        ) : (
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder={questionPlaceholder}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={handleStart}
              disabled={loading}
            />
            <MicButton field="question" setter={setQuestion} />
            <Button type="primary" icon={<SendOutlined />} onClick={handleStart} loading={loading}>
              Prompt Olustur
            </Button>
            {started ? (
              <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={loading}>
                Sifirla
              </Button>
            ) : null}
          </Space.Compact>
        )}
      </Card>

      {prompt ? (
        <Card
          size="small"
          title="1) Bu promptu kopyalayip claude.ai'ye yapistirin"
          extra={<Button size="small" icon={<CopyOutlined />} onClick={copyPrompt}>Kopyala</Button>}
          style={{ marginBottom: 16 }}
        >
          <TextArea value={prompt} readOnly autoSize={{ minRows: 6, maxRows: 16 }} style={{ fontFamily: "monospace", fontSize: 12 }} />
        </Card>
      ) : null}

      {started ? (
        <Card size="small" title="2) Claude'un cevabini (JSON) buraya yapistirin" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <TextArea
              placeholder={isWriteMode ? '{"action":"write","tool":"urun_olustur","args":{...}}' : '{"action":"sql","query":"SELECT ..."}'}
              value={claudeReply}
              onChange={(e) => setClaudeReply(e.target.value)}
              autoSize={{ minRows: 4, maxRows: 12 }}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleProcessReply} loading={loading}>
              Cevabi Isle
            </Button>
          </Space>
        </Card>
      ) : null}

      <WritePreview
        pendingWrite={pendingWrite}
        loading={loading}
        onConfirm={handleConfirmWrite}
        onCancel={() => setPendingWrite(null)}
      />

      {clarifyQuestion ? (
        <Card size="small" title="Claude bir soru sordu" style={{ marginBottom: 16 }}>
          <Alert type="warning" showIcon message={clarifyQuestion} style={{ marginBottom: 12 }} />
          {isMobile ? (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Input
                placeholder="Cevabinizi yazin..."
                onChange={(e) => setClarifyAnswer(e.target.value)}
                value={clarifyAnswer}
                onPressEnter={handleSendClarify}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <MicButton field="clarify" setter={setClarifyAnswer} />
                <Button type="primary" onClick={handleSendClarify} style={{ flex: 1 }}>Gonder</Button>
              </div>
            </Space>
          ) : (
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="Cevabinizi yazin..."
                onChange={(e) => setClarifyAnswer(e.target.value)}
                value={clarifyAnswer}
                onPressEnter={handleSendClarify}
              />
              <MicButton field="clarify" setter={setClarifyAnswer} />
              <Button type="primary" onClick={handleSendClarify}>Gonder</Button>
            </Space.Compact>
          )}
        </Card>
      ) : null}

      {finalAnswer ? (
        <Alert
          type="success"
          showIcon
          message="Cevap"
          description={<Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{finalAnswer}</Paragraph>}
          action={
            TTS_SUPPORTED ? (
              speaking ? (
                <Button size="small" icon={<StopOutlined />} onClick={stopSpeak}>Durdur</Button>
              ) : (
                <Button size="small" icon={<SoundOutlined />} onClick={() => speakText(finalAnswer)}>Oku</Button>
              )
            ) : null
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {steps.length > 0 ? (
        <Card size="small" title="Adim gecmisi">
          {timeline}
        </Card>
      ) : null}
    </div>
  );
}

export function AiEntryConsolePage() {
  return <AiConsolePageBase mode="write" />;
}

export default function AiTestConsolePage() {
  return <AiConsolePageBase mode="read" />;
}
