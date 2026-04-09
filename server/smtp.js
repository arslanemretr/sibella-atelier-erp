import { sendSmtpTestEmail } from "./mailer.js";

export async function handleSmtpTestEmail(req, res) {
  const toEmail = String(req.body?.toEmail || "").trim();

  if (!toEmail) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Test e-posta adresi zorunludur.",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    return res.status(400).json({
      ok: false,
      code: "INVALID_EMAIL",
      message: "Gecerli bir e-posta adresi girin.",
    });
  }

  try {
    const result = await sendSmtpTestEmail({ toEmail });
    if (!result?.sent) {
      return res.status(400).json({
        ok: false,
        code: "SMTP_NOT_CONFIGURED_OR_REJECTED",
        message: "Test maili kabul edilmedi. SMTP ayarlarinizi kontrol edin.",
        rejected: result?.rejected || [],
      });
    }

    return res.json({
      ok: true,
      message: "Test maili basariyla gonderildi.",
      messageId: result.messageId,
      accepted: result.accepted,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: "SMTP_TEST_FAILED",
      message: error?.message || "Test maili gonderilemedi. SMTP ayarlarinizi kontrol edin.",
    });
  }
}
