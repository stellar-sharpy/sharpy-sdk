/** Build / release metadata — single source for SDK version. */
export const SDK_VERSION = "0.3.0";
export const SDK_NAME = "@stellar-sharpy/sdk";

export function buildTag(): string {
  return `${SDK_NAME}@${SDK_VERSION}`;
}
