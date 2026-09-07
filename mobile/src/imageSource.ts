const cache = new Map<string, { uri: string }>();

export function imageSource(uri?: string | null) {
  if (!uri) return undefined;
  if (uri.startsWith("blob:")) return undefined;
  const existing = cache.get(uri);
  if (existing) return existing;
  if (uri.startsWith("data:")) {
    try {
      const objectUrl = URL.createObjectURL(dataUrlToBlob(uri));
      const next = { uri: objectUrl };
      cache.set(uri, next);
      return next;
    } catch {
      /* use the data URL directly */
    }
  }
  const next = { uri };
  cache.set(uri, next);
  return next;
}

export function forgetImage(uri?: string | null) {
  if (!uri) return;
  const cached = cache.get(uri);
  if (cached?.uri.startsWith("blob:")) URL.revokeObjectURL(cached.uri);
  cache.delete(uri);
}

function dataUrlToBlob(dataUrl: string) {
  const [header, body] = dataUrl.split(",", 2);
  const mime = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const bytes = atob(body || "");
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}
