import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Col, Form, InputNumber, Row, Select, Slider, Space, Switch, Typography, message } from "antd";
import { SoundOutlined } from "@ant-design/icons";
import { AiAssistantSettingsCard } from "./settingsPages";
import { TTS_SUPPORTED, getAiVoicePrefs, listVoices, setAiVoicePrefs, configureUtterance } from "../aiClientPrefs";

const { Title, Text, Paragraph } = Typography;

function VoiceSettingsCard() {
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!TTS_SUPPORTED) return undefined;
    const prefs = getAiVoicePrefs();
    setVoiceURI(prefs.voiceURI || "");
    setRate(prefs.rate || 1);
    setAutoSpeak(prefs.autoSpeak !== false);

    const refresh = () => {
      const list = listVoices();
      if (list.length) { setVoices(list); loadedRef.current = true; }
    };
    refresh();
    // Bazi tarayicilarda sesler asenkron yuklenir
    window.speechSynthesis.onvoiceschanged = refresh;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch { /* yoksay */ } };
  }, []);

  const options = useMemo(() => {
    const sorted = [...voices].sort((a, b) => {
      const at = /tr/i.test(a.lang) ? 0 : 1;
      const bt = /tr/i.test(b.lang) ? 0 : 1;
      if (at !== bt) return at - bt;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((v) => ({
      value: v.voiceURI,
      label: `${v.name} — ${v.lang}${/tr/i.test(v.lang) ? " ✓" : ""}`,
    }));
  }, [voices]);

  const persist = (next) => {
    const merged = setAiVoicePrefs(next);
    setVoiceURI(merged.voiceURI);
    setRate(merged.rate);
    setAutoSpeak(merged.autoSpeak);
  };

  const handleTest = () => {
    if (!TTS_SUPPORTED) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance("Merhaba, ben Sibella yapay zeka asistaniyim. Sesim boyle duyuluyor.");
      configureUtterance(utter);
      window.speechSynthesis.speak(utter);
    } catch {
      message.error("Ses calinamadi.");
    }
  };

  if (!TTS_SUPPORTED) {
    return (
      <Card title="Seslendirme">
        <Text type="secondary">Bu tarayici sesli okumayi desteklemiyor (Chrome/Edge onerilir).</Text>
      </Card>
    );
  }

  return (
    <Card
      title="Seslendirme"
      extra={<Button icon={<SoundOutlined />} onClick={handleTest}>Sesi Dene</Button>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={16} xl={12}>
          <Form layout="vertical" style={{ marginBottom: 0 }}>
            <Form.Item label="Seslendiren ses" style={{ marginBottom: 12 }}>
              <Select
                showSearch
                placeholder="Varsayilan (otomatik Turkce ses)"
                value={voiceURI || undefined}
                options={options}
                optionFilterProp="label"
                onChange={(val) => persist({ voiceURI: val || "" })}
                allowClear
                onClear={() => persist({ voiceURI: "" })}
              />
            </Form.Item>
            <Form.Item label={`Konusma hizi (${rate.toFixed(2)}x)`} style={{ marginBottom: 12 }}>
              <Row gutter={12} align="middle">
                <Col flex="auto">
                  <Slider min={0.5} max={1.5} step={0.05} value={rate} onChange={(v) => setRate(v)} onChangeComplete={(v) => persist({ rate: v })} />
                </Col>
                <Col>
                  <InputNumber min={0.5} max={1.5} step={0.05} value={rate} onChange={(v) => persist({ rate: Number(v) || 1 })} />
                </Col>
              </Row>
            </Form.Item>
            <Form.Item label="Cevaplari otomatik sesli oku" style={{ marginBottom: 0 }}>
              <Switch
                checked={autoSpeak}
                checkedChildren="Acik"
                unCheckedChildren="Kapali"
                onChange={(v) => persist({ autoSpeak: v })}
              />
            </Form.Item>
          </Form>
          <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            Bu tercihler bu tarayiciya ozeldir. Kullanilabilir sesler isletim sistemine/tarayiciya gore degisir.
          </Paragraph>
        </Col>
      </Row>
    </Card>
  );
}

export default function AiSettingsPage() {
  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>AI Ayarlari</Title>
        <Text type="secondary">Yapay zeka asistani ile ilgili tum ayarlar burada toplanir.</Text>
      </div>

      <AiAssistantSettingsCard />
      <VoiceSettingsCard />
    </Space>
  );
}
