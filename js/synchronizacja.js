// Logika synchronizacji bez Firebase (sprawdzana w testy.html): stan aplikacji ↔ dokumenty w chmurze
// i scalanie zmian z urządzenia i z chmury. Ścieżki są względne do uzytkownicy/{uid}; „.” to sam dokument konta.
export const SCIEZKA_KONTA = '.';
export const SCIEZKA_POSILKOW = 'dane/posilki';

// JSON z kluczami w stałej kolejności (Firestore zwraca pola w innej kolejności niż aplikacja je zapisuje).
export function kanoniczny(x) {
  if (Array.isArray(x)) return `[${x.map(kanoniczny).join(',')}]`;
  if (x && typeof x === 'object') {
    return `{${Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${kanoniczny(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x ?? null);
}

// Krótki odcisk treści (FNV-1a + długość), żeby pamiętać, co już jest w chmurze, bez trzymania kopii danych.
export function skrot(dane) {
  const s = kanoniczny(dane);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

export const skroty = dokumenty => new Map([...dokumenty].map(([s, d]) => [s, skrot(d)]));
export const takieSame = (a, b) => a.size === b.size && [...a].every(([s, d]) => b.has(s) && skrot(d) === skrot(b.get(s)));

export function dokumentyZeStanu(stan) {
  const d = new Map([[SCIEZKA_KONTA, { wersja: stan.wersja, ustawienia: stan.ustawienia }], [SCIEZKA_POSILKOW, { lista: stan.posilki }]]);
  for (const [k, dz] of Object.entries(stan.dni)) d.set(`dni/${k}`, dz);
  return d;
}

export function stanZDokumentow(d) {
  const konto = d.get(SCIEZKA_KONTA) || {};
  const dni = {};
  for (const [s, v] of d) if (s.startsWith('dni/')) dni[s.slice(4)] = v;
  return { wersja: konto.wersja ?? 1, ustawienia: konto.ustawienia || {}, posilki: d.get(SCIEZKA_POSILKOW)?.lista || [], dni };
}

// Scalanie trójstronne każdego dokumentu; baza to odciski treści ostatnio zsynchronizowanej.
// Zmiana tylko po jednej stronie wygrywa (także usunięcie). Zmiana po obu stronach jest rzadka
// (jedna osoba) — wtedy wygrywa urządzenie, bo to ostatnia czynność tej osoby.
export function scalDokumenty(lokalne, zdalne, baza) {
  const wynik = new Map(), konflikty = [];
  for (const s of new Set([...lokalne.keys(), ...zdalne.keys(), ...baza.keys()])) {
    const l = lokalne.has(s) ? skrot(lokalne.get(s)) : null;
    const z = zdalne.has(s) ? skrot(zdalne.get(s)) : null;
    const b = baza.get(s) ?? null;
    const zChmury = l === z || l === b;
    if (!zChmury && z !== b) konflikty.push(s);
    const zrodlo = zChmury ? zdalne : lokalne;
    if (zrodlo.has(s)) wynik.set(s, zrodlo.get(s));
  }
  return { wynik, konflikty };
}

// Do wysłania: dokumenty różne od tego, co jest w chmurze, i usunięte na urządzeniu.
export function planZapisow(lokalne, baza) {
  return {
    zapisy: [...lokalne].filter(([s, d]) => baza.get(s) !== skrot(d)).map(([s]) => s),
    usuniecia: [...baza.keys()].filter(s => !lokalne.has(s)),
  };
}

// Co z danych na urządzeniu (sprzed logowania) można przenieść na puste konto; null, gdy nic.
export function coPrzeniesc(stan) {
  const dni = Object.values(stan.dni).filter(d => d.wpisy?.length || d.treningi?.length).length;
  const ustawienia = stan.ustawienia?.sredniaDzienna > 0;
  return stan.posilki.length || dni || ustawienia ? { posilki: stan.posilki.length, dni, ustawienia } : null;
}
