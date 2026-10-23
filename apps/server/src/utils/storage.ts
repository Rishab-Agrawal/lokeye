/** Parse a Supabase public URL into bucket + path for the storage API. */
export function extractStoragePath(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}
