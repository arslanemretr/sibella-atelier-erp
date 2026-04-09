import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.smtpSettings.v1";

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
  return {
    ...defaultSmtpSettings,
    ...readPersistentStore(STORAGE_KEY, defaultSmtpSettings),
  };
}

export function updateSmtpSettings(values) {
  const nextValues = {
    ...getSmtpSettings(),
    ...values,
    port: Number(values?.port ?? 587),
  };
  writePersistentStore(STORAGE_KEY, nextValues);
  return nextValues;
}
