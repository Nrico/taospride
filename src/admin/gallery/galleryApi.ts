// ============================================================
// Gallery admin API client — calls /api/gallery/* on THIS domain, handled
// natively by api/gallery.php. (The gallery used to be a separate
// gallery.taospride.org app/database, proxied through from here — it's
// since been merged into this site, so these same /api/gallery/* calls
// now hit the local database directly instead of forwarding out.)
// ============================================================

const BASE = '/api/gallery';

export const galleryApi = {
  get: async <T,>(path: string): Promise<T> => {
    const r = await fetch(`${BASE}${path}`, { credentials: 'include' });
    if (!r.ok) { const t = await r.text(); throw new Error(t || `HTTP ${r.status}`); }
    return r.json();
  },
  post: async <T,>(path: string, body: object): Promise<T> => {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const t = await r.text(); throw new Error(t || `HTTP ${r.status}`); }
    return r.json();
  },
  put: async <T,>(path: string, body: object): Promise<T> => {
    const r = await fetch(`${BASE}${path}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const t = await r.text(); throw new Error(t || `HTTP ${r.status}`); }
    return r.json();
  },
  del: async <T,>(path: string): Promise<T> => {
    const r = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
    if (!r.ok) { const t = await r.text(); throw new Error(t || `HTTP ${r.status}`); }
    return r.json();
  },
  upload: async <T,>(path: string, form: FormData): Promise<T> => {
    const r = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', body: form });
    if (!r.ok) { const t = await r.text(); throw new Error(t || `HTTP ${r.status}`); }
    return r.json();
  },
};

// Resize + recompress an image file client-side before upload — identical
// to gallery's own processPhoto(). PHP does zero server-side image
// processing on either end, so this step is load-bearing, not cosmetic.
export function processPhoto(
  file: File,
  maxW: number,
  maxH: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression failed')); return; }
        resolve({ blob, width: w, height: h });
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}
