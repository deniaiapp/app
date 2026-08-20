export const appVersion = "7.7.1";
export const appCodename = "Stellar Shield";
export const appDate = "2026-08-21";

const appHashPayload = [appVersion, appDate].join(":");
export const appHash = globalThis.btoa(appHashPayload);

export const versions = {
  version: appVersion,
  codename: appCodename,
  date: appDate,
  hash: appHash,
};
