export function imageSource(uri?: string | null) {
  if (!uri || uri.startsWith("blob:")) return undefined;
  return { uri };
}
