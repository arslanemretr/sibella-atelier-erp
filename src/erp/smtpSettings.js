import { mutateResourceSync, requestJson, requestJsonSync } from "./apiClient";

const defaultSmtpSettings = {
  enabled: false,
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromName: "Sibella Atelier",
  fromEmail: "",
};

export function getSmtpSettings() {
  const response = requestJsonSync("GET", "/api/settings/smtp");
  return {
    ...defaultSmtpSettings,
    ...(response.ok ? response.data?.item : null),
  };
}

export async function getSmtpSettingsFresh() {
  try {
    const payload = await requestJson("GET", "/api/settings/smtp");
    return {
      ...defaultSmtpSettings,
      ...(payload?.item || null),
    };
  } catch {
    return { ...defaultSmtpSettings };
  }
}

export function updateSmtpSettings(values) {
  const nextValues = {
    ...getSmtpSettings(),
    ...values,
    port: Number(values?.port ?? 587),
  };
  return mutateResourceSync("PUT", "/api/settings/smtp", nextValues);
}
