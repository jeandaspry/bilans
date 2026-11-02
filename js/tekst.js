// Pomocnicze funkcje tekstowe: bezpieczne wstawianie do HTML, wyszukiwanie bez polskich znaków, liczby z przecinkiem.
const ENCJE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, z => ENCJE[z]);

export const bezOgonkow = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

export function liczba(v) {
  const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const f = n => Math.round(n).toLocaleString('pl-PL');

const OPISY_PORCJI = { 0.75: '¾ porcji', 0.5: '½ porcji', 0.25: '¼ porcji' };
export const opisPorcji = u => OPISY_PORCJI[u] || `${Math.round(u * 100)}% porcji`;

export function odmianaPosilkow(n) {
  const j = n % 10, d = n % 100;
  const slowo = n === 1 ? 'posiłek' : j >= 2 && j <= 4 && (d < 12 || d > 14) ? 'posiłki' : 'posiłków';
  return `${n} ${slowo}`;
}
