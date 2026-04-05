import React from "react";
import { Alert, Button, Card, Form, Input, Space, Typography, message } from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { getAuthUser, loginUser } from "../auth";

const { Title, Text } = Typography;

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const authUser = getAuthUser();

  if (authUser) {
    return <Navigate to={authUser.role === "Tedarikci" ? "/supplier/deliveries" : "/dashboard"} replace />;
  }

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const user = loginUser(values.email, values.password);
      if (!user) {
        message.error("E-posta veya sifre hatali.");
        return;
      }

      const redirectTo = location.state?.from?.pathname || (user.role === "Tedarikci" ? "/supplier/deliveries" : "/dashboard");
      message.success(`Hos geldiniz, ${user.fullName}`);
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="erp-login-page">
      <Card className="erp-login-card" bordered={false}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>Sibella Atelier</Title>
            <Text type="secondary">Urun, satin alma, stok ve POS ekranlarina giris yapmak icin kullanici bilgilerinizi girin.</Text>
          </div>

          <Alert
            type="info"
            showIcon
            message="Ornek giris"
            description="Yonetici: sibel@sibella.com / Sibella123! | Tedarikci: mina.portal@sibella.com / Portal123!"
          />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="email" label="E-posta" rules={[{ required: true, message: "E-posta zorunludur." }]}>
              <Input placeholder="sibel@sibella.com" size="large" />
            </Form.Item>
            <Form.Item name="password" label="Sifre" rules={[{ required: true, message: "Sifre zorunludur." }]}>
              <Input.Password placeholder="Sifreniz" size="large" />
            </Form.Item>
            <Button type="primary" size="large" block htmlType="submit" loading={loading}>
              Giris Yap
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default LoginPage;
