const TOKEN_KEY = "jungle.token";

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

export class ApiError extends Error {
  constructor(public status: number, public messageHe: string) { super(messageHe); }
}

export let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { "content-type": "application/json", ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "אין חיבור לאינטרנט. בדקו את הרשת ונסו שוב.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/")) { setToken(null); onUnauthorized(); }
  if (!res.ok) throw new ApiError(res.status, data?.error?.message_he ?? "משהו השתבש. נסו שוב.");
  return data as T;
}

const urlCache = new Map<string, Promise<string>>();
/** תמונות מוגנות באימות, לכן נטענות עם הטוקן והופכות ל-blob URL. */
export function photoUrl(id: string): Promise<string> {
  let p = urlCache.get(id);
  if (!p) {
    p = fetch(`/api/photos/${id}`, { headers: { authorization: `Bearer ${getToken()}` } })
      .then((r) => { if (!r.ok) throw new Error("photo"); return r.blob(); })
      .then((b) => URL.createObjectURL(b));
    urlCache.set(id, p);
    p.catch(() => urlCache.delete(id));
  }
  return p;
}

export async function hydratePhotos(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>("img[data-photo]").forEach(async (img) => {
    try { img.src = await photoUrl(img.dataset.photo!); } catch { img.alt = "התמונה לא נטענה"; }
  });
}
