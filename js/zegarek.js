// Wynik skrótu „Bilans trening” wklejony ze schowka: godziny treningu z automatyzacji
// i dzisiejsze próbki Energii aktywnej z zegarka. Aktywne kcal treningu to suma próbek z jego okna.
import { liczba } from './tekst.js';

export const NAGLOWEK_ZEGARKA = 'BILANS-TRENING';

export function parsujZegarek(tekst) {
  const linie = String(tekst ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (linie[0] !== NAGLOWEK_ZEGARKA) return { blad: 'W schowku nie ma wyniku skrótu „Bilans trening”.' };
  const pole = nazwa => linie.find(l => l.startsWith(nazwa + ':'))?.slice(nazwa.length + 1).trim();
  const start = new Date(pole('START')), koniec = new Date(pole('KONIEC'));
  if (isNaN(start) || isNaN(koniec)) return { blad: 'Brak godziny startu albo końca treningu. Czy obie automatyzacje są włączone?' };
  if (koniec <= start) return { blad: 'Trening jeszcze trwa albo zapisane godziny są z różnych treningów.' };
  const iDaty = linie.indexOf('DATY:'), iKcal = linie.indexOf('KCAL:');
  if (iDaty < 0 || iKcal < iDaty) return { blad: 'Wynik skrótu jest niepełny.' };
  const daty = linie.slice(iDaty + 1, iKcal).map(d => new Date(d));
  const kcal = linie.slice(iKcal + 1).map(liczba);
  if (daty.length !== kcal.length || daty.some(d => isNaN(d))) return { blad: 'Daty i kcal z zegarka się nie zgadzają. Sprawdź format daty (ISO 8601) w skrócie.' };
  let suma = 0;
  daty.forEach((d, i) => { if (d >= start && d <= koniec && kcal[i] > 0) suma += kcal[i]; });
  return { start, koniec, kcalAktywne: Math.round(suma) };
}
