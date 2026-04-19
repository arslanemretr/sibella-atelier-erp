import React from "react";
import { Alert, Button, Card, Form, Input, Modal, Space, Spin, Typography, message } from "antd";
import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  confirmPasswordReset,
  getAuthUser,
  hasAuthLoaded,
  loginUser,
  onAuthChange,
  requestPasswordReset,
  restoreAuthSession,
} from "../../auth";
import logo from "../../assets/logo.png";

const { Text } = Typography;

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [forgotForm] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [authUser, setAuthUser] = React.useState(() => getAuthUser());
  const [authReady, setAuthReady] = React.useState(() => hasAuthLoaded());
  const [errorMessage, setErrorMessage] = React.useState("");
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [resetStep, setResetStep] = React.useState("request");
  const [resetMeta, setResetMeta] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    void restoreAuthSession().finally(() => {
      if (!active) {
        return;
      }
      setAuthUser(getAuthUser());
      setAuthReady(true);
    });

    const unsubscribe = onAuthChange(() => {
      if (!active) {
        return;
      }
      setAuthUser(getAuthUser());
      setAuthReady(hasAuthLoaded());
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <div className="erp-login-page">
        <Card className="erp-login-card" bordered={false}>
          <div className="erp-auth-loading">
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  if (authUser) {
    return <Navigate to={authUser.role === "Tedarikci" ? "/supplier/dashboard" : "/dashboard"} replace />;
  }

  const openForgotPassword = () => {
    const emailValue = form.getFieldValue("email");
    forgotForm.resetFields();
    forgotForm.setFieldsValue({
      email: emailValue || "",
      resetCode: "",
      nextPassword: "",
      nextPasswordConfirm: "",
    });
    setResetStep("request");
    setResetMeta(null);
    setForgotOpen(true);
  };

  const closeForgotPassword = () => {
    setForgotOpen(false);
    setForgotLoading(false);
    setResetStep("request");
    setResetMeta(null);
    forgotForm.resetFields();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const values = await form.validateFields();
      const user = await loginUser(values.email, values.password);
      const redirectTo = location.state?.from?.pathname || (user.role === "Tedarikci" ? "/supplier/dashboard" : "/dashboard");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(error?.message || "Giris sirasinda bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async () => {
    try {
      setForgotLoading(true);
      const values = await forgotForm.validateFields(["email"]);
      const payload = await requestPasswordReset(values.email);
      setResetMeta(payload);
      setResetStep("confirm");
      forgotForm.setFieldsValue({ resetCode: payload?.resetCode || "" });
      message.success(payload?.message || "Sifre yenileme islemi tamamlandi.");
    } catch (error) {
      message.error(error?.message || "Sifre yenileme kodu olusturulamadi.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotPasswordConfirm = async () => {
    try {
      setForgotLoading(true);
      const values = await forgotForm.validateFields(["email", "resetCode", "nextPassword", "nextPasswordConfirm"]);
      await confirmPasswordReset(values.email, values.resetCode, values.nextPassword);
      closeForgotPassword();
      form.setFieldValue("email", values.email);
      message.success("Sifreniz yenilendi. Yeni sifreniz ile giris yapabilirsiniz.");
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || "Sifre yenilenemedi.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="erp-login-page">
      <Card className="erp-login-card" bordered={false}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div className="erp-login-header">
            <div className="erp-login-logo-wrap">
              <img src={logo} alt="Sibella Atelier" className="erp-login-logo" />
            </div>
            <div className="erp-login-badge">
              <SafetyCertificateOutlined />
              <span>Guvenli Giris</span>
            </div>
          </div>

          {errorMessage ? (
            <Alert
              type="error"
              showIcon
              message="Giris basarisiz"
              description={errorMessage}
            />
          ) : null}

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="email"
              label="E-posta"
              rules={[
                { required: true, message: "E-posta zorunludur." },
                { type: "email", message: "Gecerli bir e-posta adresi girin." },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: "#94a3b8" }} />}
                placeholder="ornek@sibella.com"
                size="large"
                autoComplete="username"
                onChange={() => errorMessage && setErrorMessage("")}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Sifre"
              rules={[
                { required: true, message: "Sifre zorunludur." },
                { min: 8, message: "Sifre en az 8 karakter olmali." },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
                placeholder="Sifreniz"
                size="large"
                autoComplete="current-password"
                onChange={() => errorMessage && setErrorMessage("")}
              />
            </Form.Item>
            <div className="erp-login-actions">
              <Button className="erp-login-forgot-btn" type="link" onClick={openForgotPassword}>
                Sifremi Unuttum
              </Button>
              <Button type="primary" size="large" htmlType="submit" loading={loading}>
                Giris Yap
              </Button>
            </div>
          </Form>
        </Space>
      </Card>

      <Modal
        title="Sifremi Unuttum"
        open={forgotOpen}
        onCancel={closeForgotPassword}
        okText={resetStep === "request" ? "Kod Olustur" : "Sifreyi Yenile"}
        cancelText="Vazgec"
        confirmLoading={forgotLoading}
        onOk={resetStep === "request" ? handleForgotPasswordRequest : handleForgotPasswordConfirm}
      >
        <Form form={forgotForm} layout="vertical">
          <Form.Item
            name="email"
            label="E-posta"
            rules={[
              { required: true, message: "E-posta zorunludur." },
              { type: "email", message: "Gecerli bir e-posta adresi girin." },
            ]}
          >
            <Input placeholder="ornek@sibella.com" />
          </Form.Item>

          {resetStep === "confirm" ? (
            <>
              <Alert
                type="success"
                showIcon
                message={resetMeta?.delivery === "email" ? "Yenileme kodu e-posta adresinize gonderildi" : "Yenileme kodu olusturuldu"}
                description={(
                  <Space direction="vertical" size={4}>
                    {resetMeta?.delivery === "email" ? (
                      <Text>Kodu e-posta kutunuzdan alip asagidaki alana girin.</Text>
                    ) : (
                      <Text>Kod: <Text strong>{resetMeta?.resetCode || "-"}</Text></Text>
                    )}
                    <Text type="secondary">
                      Bu kod {resetMeta?.expiresAt ? new Date(resetMeta.expiresAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "-"} saatine kadar gecerlidir.
                    </Text>
                  </Space>
                )}
              />
              <Form.Item
                name="resetCode"
                label="Sifre Yenileme Kodu"
                rules={[{ required: true, message: "Kod zorunludur." }]}
              >
                <Input placeholder="Ornek: A1B2C3D4" />
              </Form.Item>
              <Form.Item
                name="nextPassword"
                label="Yeni Sifre"
                rules={[
                  { required: true, message: "Yeni sifre zorunludur." },
                  { min: 8, message: "Yeni sifre en az 8 karakter olmali." },
                ]}
              >
                <Input.Password placeholder="Yeni sifreniz" />
              </Form.Item>
              <Form.Item
                name="nextPasswordConfirm"
                label="Yeni Sifre Tekrar"
                dependencies={["nextPassword"]}
                rules={[
                  { required: true, message: "Yeni sifre tekrari zorunludur." },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("nextPassword") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Sifre tekrar alani uyusmuyor."));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Yeni sifrenizi tekrar girin" />
              </Form.Item>
            </>
          ) : (
            <Alert
              type="info"
              showIcon
              message="Sifre yenileme"
              description="E-posta adresinizi girin. Sistem bu hesaba ait tek kullanımlik bir sifre yenileme kodu olusturacak."
            />
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default LoginPage;
