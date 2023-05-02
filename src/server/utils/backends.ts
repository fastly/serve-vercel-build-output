import { BackendInfo, Backends } from "../server/types.js";

function findBackendInfo(backends: Backends, url: string) {
  for (const [backendName, backend] of Object.entries(backends)) {
    let backendUrl = backend.url;
    if(!backendUrl.endsWith('/')) {
      backendUrl += '/';
    }
    if(url.startsWith(backendUrl)) {
      return {
        name: backendName,
        url: backendUrl,
        target: '/' + url.slice(backendUrl.length),
      };
    }
  }
  return undefined;
}

export function getBackendInfo(backends: Backends, url: string) {
  let backendInfo: BackendInfo | undefined;

  const urlObj = new URL(url);
  if(urlObj.port === '') {
    // If port is not specified, try the default port
    if (urlObj.protocol === 'https:') {
      urlObj.port = '443';
    } else {
      urlObj.port = '80';
    }
    backendInfo = findBackendInfo(backends, String(urlObj));
  }
  if(backendInfo == null) {
    backendInfo = findBackendInfo(backends, url);
  }

  return backendInfo;
}
