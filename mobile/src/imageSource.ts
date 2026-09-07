const cache = new Map<string, { uri: string }>();

export function imageSource(uri?: string | null) {
  if (!uri || uri.startsWith("blob:")) return undefined;
  const existing = cache.get(uri);
  if (existing) return existing;
  const next = { uri };
  cache.set(uri, next);
  return next;
}

export function forgetImage(uri?: string | null) {
  if (uri) cache.delete(uri);
}
