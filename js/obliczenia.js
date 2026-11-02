// Obliczenia Bilansu: limit kalorii, cele makro, sumy dnia. Bez DOM, sprawdzane w testy.html.

// Wartości osoby (średni limit z planu, białko, dane do wzoru) wpisuje się w Ustawieniach, nie w kodzie.
export const DOMYSLNE_USTAWIENIA = {
  sredniaDzienna: null, treningiTydzien: 3.5, typowyTrening: 600, doliczanieTreningu: 75,
  bialko: null, udzialT: 36,
  plec: '', wiek: null, wzrost: null, masa: null,
};

const zaokr1 = x => Math.round(x * 10) / 10;

// Spoczynkowe spalanie (PPM), wzór Mifflina–St Jeora.
export function ppm({ plec, wiek, wzrost, masa }) {
  return 10 * masa + 6.25 * wzrost - 5 * wiek + (plec === 'K' ? -161 : 5);
}

export function maParametry(u) {
  return (u.plec === 'K' || u.plec === 'M') && u.wiek > 0 && u.wzrost > 0 && u.masa > 0;
}

export const dodatekTreningu = (doliczanie, trening) => Math.round((Number(trening.kcalAktywne) || 0) * doliczanie / 100);

// Każdy trening zaokrąglany osobno, żeby kwoty z kart treningów sumowały się do limitu.
export const dodatekZaTreningi = (doliczanie, treningi = []) => treningi.reduce((s, t) => s + dodatekTreningu(doliczanie, t), 0);

const przecietnyDodatek = u => u.treningiTydzien * dodatekTreningu(u.doliczanieTreningu, { kcalAktywne: u.typowyTrening }) / 7;

// Dzień bez treningu: średnia z planu minus przeciętny dodatek za treningi rozłożony na tydzień,
// więc tydzień trzyma średnią z planu. Nigdy mniej niż PPM. Bez średniej z planu: null.
export function limitBazowy(u) {
  if (!(u.sredniaDzienna > 0)) return null;
  const baza = Math.round(u.sredniaDzienna - przecietnyDodatek(u));
  return maParametry(u) ? Math.max(baza, Math.round(ppm(u))) : baza;
}

export function podniesionyDoPPM(u) {
  return u.sredniaDzienna > 0 && maParametry(u) && Math.round(u.sredniaDzienna - przecietnyDodatek(u)) < Math.round(ppm(u));
}

// Średni limit tygodnia przy typowych treningach: równy średniej z planu, chyba że zadziałała dolna granica.
export function sredniaTygodnia(u) {
  if (!(u.sredniaDzienna > 0)) return null;
  return podniesionyDoPPM(u) ? Math.round(limitBazowy(u) + przecietnyDodatek(u)) : Math.round(u.sredniaDzienna);
}

export function limitDnia(baza, doliczanie, treningi = []) {
  const dodatek = dodatekZaTreningi(doliczanie, treningi);
  return { baza, dodatek, razem: baza + dodatek };
}

// Białko stałe (z planu; bez wpisu 21% kcal), tłuszcze jako udział kcal dnia bez treningu,
// węglowodany to reszta, także dodatek za trening.
export function celeMakro(bialko, udzialT, limit) {
  const b = bialko > 0 ? Math.round(bialko) : Math.round(limit.baza * 0.21 / 4);
  const t = Math.round(limit.baza * udzialT / 100 / 9);
  const w = Math.max(0, Math.round((limit.razem - 4 * b - 9 * t) / 4));
  return { b, t, w };
}

// Wartości dla części posiłku (0.5 = połowa): kcal w całości, makro z dokładnością 0,1 g.
export function porcja(p, ulamek) {
  return { kcal: Math.round(p.kcal * ulamek), b: zaokr1(p.b * ulamek), t: zaokr1(p.t * ulamek), w: zaokr1(p.w * ulamek) };
}

export function sumaDnia(wpisy = []) {
  const s = wpisy.reduce((a, x) => ({ kcal: a.kcal + x.kcal, b: a.b + x.b, t: a.t + x.t, w: a.w + x.w }), { kcal: 0, b: 0, t: 0, w: 0 });
  return { kcal: Math.round(s.kcal), b: zaokr1(s.b), t: zaokr1(s.t), w: zaokr1(s.w) };
}

export const kcalZMakro = ({ b, t, w }) => 4 * b + 4 * w + 9 * t;

// Względny rozjazd kcal od 4B + 4W + 9T; powyżej 0,1 posiłek warto sprawdzić.
export const rozjazdAtwater = p => (p.kcal > 0 ? Math.abs(p.kcal - kcalZMakro(p)) / p.kcal : 0);

export function bilans(zjedzone, limit) {
  const r = limit - zjedzone;
  return r >= 0 ? { stan: 'zostalo', kcal: r } : { stan: 'ponad', kcal: -r };
}

export const srednia = liczby => (liczby.length ? Math.round(liczby.reduce((a, x) => a + x, 0) / liczby.length) : 0);
