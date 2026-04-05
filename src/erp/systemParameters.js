import { readPersistentStore, writePersistentStore } from "./serverStore";

const STORAGE_KEY = "sibella.erp.systemParameters.v1";

const defaultParameters = {
  productCodeControlEnabled: true,
};

export function getSystemParameters() {
  return {
    ...defaultParameters,
    ...readPersistentStore(STORAGE_KEY, defaultParameters),
  };
}

export function updateSystemParameters(values) {
  const nextValues = {
    ...getSystemParameters(),
    ...values,
  };

  writePersistentStore(STORAGE_KEY, nextValues);

  return nextValues;
}
