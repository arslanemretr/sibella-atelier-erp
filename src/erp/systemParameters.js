import { mutateResourceSync, requestJson, requestJsonSync } from "./apiClient";

const defaultParameters = {
  productCodeControlEnabled: true,
};

export function getSystemParameters() {
  const response = requestJsonSync("GET", "/api/settings/system-parameters");
  if (!response.ok) {
    return { ...defaultParameters };
  }
  return {
    ...defaultParameters,
    ...(response.data?.item || {}),
  };
}

export async function getSystemParametersFresh() {
  try {
    const payload = await requestJson("GET", "/api/settings/system-parameters");
    return {
      ...defaultParameters,
      ...(payload?.item || {}),
    };
  } catch {
    return { ...defaultParameters };
  }
}

export function updateSystemParameters(values) {
  const nextValues = {
    ...getSystemParameters(),
    ...values,
  };

  return mutateResourceSync("PUT", "/api/settings/system-parameters", nextValues);
}
