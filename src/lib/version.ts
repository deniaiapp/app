export const appVersion = "7.8";
export const appCodename = "Golden Arrow";
export const appDate = "2026-08-27";

const appHashPayload = [appVersion, appDate].join(":");
export const appHash = globalThis.btoa(appHashPayload);

export const versions = {
  version: appVersion,
  codename: appCodename,
  date: appDate,
  hash: appHash,
};
