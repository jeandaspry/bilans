// Daty lokalne telefonu: klucz dnia RRRR-MM-DD, tydzień od poniedziałku, polskie nazwy.
const dwa = n => String(n).padStart(2, '0');

export const kluczDnia = (d = new Date()) => `${d.getFullYear()}-${dwa(d.getMonth() + 1)}-${dwa(d.getDate())}`;

// Południe zamiast północy, żeby zmiana czasu nie przesunęła daty.
export function dataZKlucza(k) {
  const [r, m, d] = k.split('-').map(Number);
  return new Date(r, m - 1, d, 12);
}

export function przesunDni(k, n) {
  const d = dataZKlucza(k);
  d.setDate(d.getDate() + n);
  return kluczDnia(d);
}

export const poczatekTygodnia = k => przesunDni(k, -((dataZKlucza(k).getDay() + 6) % 7));
export const dniTygodnia = k => Array.from({ length: 7 }, (_, i) => przesunDni(poczatekTygodnia(k), i));
export const SKROTY_DNI = ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'];

const formatDlugi = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
export const opisDnia = k => formatDlugi.format(dataZKlucza(k));

export function nazwaDnia(k, dzis = kluczDnia()) {
  if (k === dzis) return 'Dzisiaj';
  if (k === przesunDni(dzis, -1)) return 'Wczoraj';
  if (k === przesunDni(dzis, 1)) return 'Jutro';
  const dzien = opisDnia(k).split(',')[0];
  return dzien.charAt(0).toUpperCase() + dzien.slice(1);
}

export const godzina = (d = new Date()) => `${d.getHours()}:${dwa(d.getMinutes())}`;
