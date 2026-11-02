// Obliczenia Bilansu: limit kalorii, cele makro, sumy dnia. Bez DOM, sprawdzane w testy.html.

// Wartości osoby (średni limit z planu, białko, dane do wzoru) wpisuje się w Ustawieniach, nie w kodzie.
// Typowy trening to łączne kcal z zegarka i czas w minutach (aktywne liczy aplikacja).
export const DOMYSLNE_USTAWIENIA = {
  sredniaDzienna: null, treningiTydzien: 3.5, typowyTrening: 600, typowyCzas: 60, doliczanieTreningu: 75,
  bialko: null, udzialT: 36,
  plec: '', wiek: null, wzrost: null, masa: null, aktywnosc: 1.6,
};

const zaokr1 = x => Math.round(x * 10) / 10;

// Spoczynkowe spalanie (PPM), wzór Mifflina–St Jeora.
export function ppm({ plec, wiek, wzrost, masa }) {
  return 10 * masa + 6.25 * wzrost - 5 * wiek + (plec === 'K' ? -161 : 5);
}

export function maParametry(u) {
  return (u.plec === 'K' || u.plec === 'M') && u.wiek > 0 && u.wzrost > 0 && u.masa > 0;
}

// Metoda Respo (blog Centrum Respo): utrzymanie wagi = PPM × współczynnik aktywności z tabeli praca × czas wolny
// (treningi uśrednione na tydzień), odchudzanie = utrzymanie − 15%, dobre tempo 0,5–1 kg tygodniowo.
const KCAL_NA_KG = 7700;

export function zapotrzebowanie(u) {
  if (!maParametry(u) || !(u.aktywnosc > 0)) return null;
  const doZycia = ppm(u), utrzymanie = doZycia * u.aktywnosc;
  return { doZycia, utrzymanie, chudniecie: utrzymanie * 0.85 };
}

// kg tygodniowo przy danej średniej: dodatnie to chudnięcie, ujemne tycie.
export const tempoTygodniowe = (utrzymanie, srednia) => (utrzymanie - srednia) * 7 / KCAL_NA_KG;

// Nowa średnia, gdy po zmianie wagi albo aktywności plan wychodzi poza 0,5–1 kg tygodniowo (z zapasem 100 kcal,
// bo dietetyk Respo koryguje o 100–200 kcal). Nigdy poniżej spoczynkowego spalania; null, gdy plan pasuje.
export function propozycjaSredniej(u) {
  const z = zapotrzebowanie(u);
  if (!z || !(u.sredniaDzienna > 0)) return null;
  const deficyt = z.utrzymanie - u.sredniaDzienna, dzienneNaKg = KCAL_NA_KG / 7;
  const cel = deficyt < 0.5 * dzienneNaKg - 100 ? 0.5 : deficyt > dzienneNaKg + 100 ? 1 : null;
  if (cel === null) return null;
  const nowa = Math.max(Math.round(z.doZycia), Math.round((z.utrzymanie - cel * dzienneNaKg) / 10) * 10);
  return Math.abs(nowa - u.sredniaDzienna) >= 100 ? nowa : null;
}

export const dodatekTreningu =(doliczanie, trening) => Math.round((Number(trening.kcalAktywne) || 0) * doliczanie / 100);

// Każdy trening zaokrąglany osobno, żeby kwoty z kart treningów sumowały się do limitu.
export const dodatekZaTreningi = (doliczanie, treningi = []) => treningi.reduce((s, t) => s + dodatekTreningu(doliczanie, t), 0);

// Zegarek podaje łączne kcal: aktywne plus spoczynkowe z czasu treningu. Spoczynkowe są już w limicie,
// więc odejmujemy PPM przypadające na te minuty. Bez danych osoby nie da się ich policzyć: liczymy całość.
export const spoczynkoweWCzasie = (minuty, u) => ppm(u) * (Number(minuty) || 0) / 1440;

export function aktywneZLacznych(laczne, minuty, u) {
  const kcal = Number(laczne) || 0;
  if (!maParametry(u)) return Math.round(kcal);
  return Math.max(0, Math.round(kcal - spoczynkoweWCzasie(minuty, u)));
}

export const aktywneTypowego = u => aktywneZLacznych(u.typowyTrening, u.typowyCzas, u);

const przecietnyDodatek = u => u.treningiTydzien * dodatekTreningu(u.doliczanieTreningu, { kcalAktywne: aktywneTypowego(u) }) / 7;

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

// Bilans tygodnia od poniedziałku do wybranego dnia: dzień ponad limit (np. przekąska w dzień bez treningu)
// widać na tle dni z zapasem. Wcześniejsze dni bez wpisów (niezapisane) się nie liczą, wybrany dzień zawsze.
// dni: [{ k, limit, zjedzone, wpisy }]; null, gdy przed wybranym dniem nic się nie liczy (wynik byłby jak dnia).
export function bilansTygodnia(dni, wybrany) {
  const dzien = dni.find(d => d.k === wybrany);
  const wczesniej = dni.filter(d => d.k < wybrany && d.wpisy > 0 && d.limit > 0);
  if (!dzien || !wczesniej.length) return null;
  const liczone = [...wczesniej, dzien];
  return bilans(liczone.reduce((a, d) => a + d.zjedzone, 0), liczone.reduce((a, d) => a + d.limit, 0));
}

export const srednia = liczby => (liczby.length ? Math.round(liczby.reduce((a, x) => a + x, 0) / liczby.length) : 0);
