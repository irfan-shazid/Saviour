// Small pure formatting helpers shared across screens.

/** "Jane Q. Doe" → "JD". Falls back to the first visible glyph. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Light touch: collapse whitespace, keep a single leading +. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed.startsWith('+') ? '+' + trimmed.slice(1).replace(/\+/g, '') : trimmed;
}

/** Very permissive check — we only reject obviously-not-a-number input. */
export function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}

/** `tel:` URI with everything but digits and a leading + stripped. */
export function telUri(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

/** Google Maps link for a coordinate pair. */
export function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/** "just now" / "4 min ago" / "3 h ago" / "Tue, 14:02". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = now - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Full timestamp for detail rows. */
export function fullTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}
