// Dane aplikacji w pamięci urządzenia (localStorage). Po zalogowaniu to kopia danych z konta:
// otwiera się od razu, także bez internetu, a chmura.js wysyła zmiany i podmienia stan danymi z konta.
import { DOMYSLNE_USTAWIENIA } from './obliczenia.js';

const KLUCZ = 'bilans.v1';
const sluchacze = new Set();
const poZmianieLokalnej = new Set();
let trwaly = true;
let stan = wczytaj();

function pusty() {
  return { wersja: 1, ustawienia: { ...DOMYSLNE_USTAWIENIA }, posilki: [], dni: {} };
}

function normalizuj(s) {
  return { ...pusty(), ...s, ustawienia: { ...DOMYSLNE_USTAWIENIA, ...s.ustawienia } };
}

function wczytaj() {
  let surowe = null;
  try { surowe = localStorage.getItem(KLUCZ); } catch { trwaly = false; return pusty(); }
  if (!surowe) return pusty();
  let dane;
  try {
    dane = JSON.parse(surowe);
  } catch {
    // uszkodzonych danych nie nadpisujemy bez kopii
    try { localStorage.setItem(`${KLUCZ}.uszkodzone.${Date.now()}`, surowe); } catch {}
    return pusty();
  }
  return normalizuj(dane);
}

function zapisz() {
  try { localStorage.setItem(KLUCZ, JSON.stringify(stan)); trwaly = true; } catch { trwaly = false; }
}

export const pobierz = () => stan;
export const czyTrwaly = () => trwaly;

// fn zmienia stan; powiadom = false przy wpisywaniu w formularz, żeby nie przerysować pola pod palcem.
export function zmien(fn, powiadom = true) {
  fn(stan);
  zapisz();
  poZmianieLokalnej.forEach(f => f(stan));
  if (powiadom) sluchacze.forEach(s => s(stan));
}

// Stan z konta zastępuje dane na urządzeniu (to nie jest zmiana do wysłania).
export function zastap(nowy) {
  stan = normalizuj(nowy);
  zapisz();
  sluchacze.forEach(s => s(stan));
}

// Po wylogowaniu dane osoby nie zostają na urządzeniu.
export function wyczysc() {
  stan = pusty();
  try { localStorage.removeItem(KLUCZ); } catch {}
  sluchacze.forEach(s => s(stan));
}

export function subskrybuj(fn) {
  sluchacze.add(fn);
  return () => sluchacze.delete(fn);
}

export function naZmianeLokalna(fn) {
  poZmianieLokalnej.add(fn);
  return () => poZmianieLokalnej.delete(fn);
}

export const dzien = (s, klucz) => s.dni[klucz] || { wpisy: [], treningi: [] };
export const zapewnijDzien = (s, klucz) => (s.dni[klucz] ||= { wpisy: [], treningi: [] });
export const noweId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
