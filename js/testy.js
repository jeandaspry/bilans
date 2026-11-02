// Testy obliczeń Bilansu. Oczekiwane wartości policzone ręcznie (w komentarzach); dane osób są zmyślone.
import * as O from './obliczenia.js';
import * as D from './daty.js';
import { liczba, bezOgonkow, esc, odmianaPosilkow } from './tekst.js';
import * as R from './import-respo.js';
import * as S from './synchronizacja.js';

const wyniki = [];
const test = (nazwa, fn) => {
  try { fn(); wyniki.push({ ok: true, nazwa }); } catch (e) { wyniki.push({ ok: false, nazwa, blad: e.message }); }
};
const rowne = (jest, ma) => {
  if (JSON.stringify(jest) !== JSON.stringify(ma)) throw new Error(`oczekiwano ${JSON.stringify(ma)}, jest ${JSON.stringify(jest)}`);
};

const plan = { ...O.DOMYSLNE_USTAWIENIA, sredniaDzienna: 2500, treningiTydzien: 3.5, typowyTrening: 700, doliczanieTreningu: 75 };
const osoba = { plec: 'M', wiek: 30, wzrost: 180, masa: 80 };

// PPM: 10·80 + 6,25·180 − 5·30 + 5 = 800 + 1125 − 150 + 5 = 1780
test('PPM mężczyzny', () => rowne(O.ppm(osoba), 1780));
test('PPM kobiety (−161 zamiast +5)', () => rowne(O.ppm({ ...osoba, plec: 'K' }), 1614));
// Zegarek podaje łączne kcal. Spoczynkowe w 60 min: 1780 · 60 / 1440 = 74,17; 700 − 74,17 = 625,83 → 626
test('trening: aktywne = łączne − spoczynkowe z czasu', () => rowne(O.aktywneZLacznych(700, 60, osoba), 626));
// 1780 · 90 / 1440 = 111,25; 700 − 111,25 = 588,75 → 589
test('trening: dłuższy trening, więcej spoczynkowych', () => rowne(O.aktywneZLacznych(700, 90, osoba), 589));
test('trening: łączne poniżej spoczynkowych daje 0', () => rowne(O.aktywneZLacznych(50, 60, osoba), 0));
test('trening: bez danych osoby liczy całość', () => rowne([O.aktywneZLacznych(700, 60, {}), O.aktywneZLacznych('', 60, osoba)], [700, 0]));
test('trening: typowy z ustawień (domyślnie 60 min)', () => rowne([O.DOMYSLNE_USTAWIENIA.typowyCzas, O.aktywneTypowego({ ...plan, ...osoba })], [60, 626]));
// stary zapis bez czasu w ustawieniach dostaje domyślne 60 min (jak przy wczytaniu w magazyn.js)
test('trening: stare ustawienia bez czasu', () => rowne(O.aktywneTypowego({ ...O.DOMYSLNE_USTAWIENIA, ...{ typowyTrening: 700, plec: 'M', wiek: 30, wzrost: 180, masa: 80 } }), 626));
test('trening sprzed wersji 0.6 (same aktywne kcal) liczy się jak dotąd', () => rowne(O.dodatekTreningu(75, { kcalAktywne: 700, start: '18:00', koniec: '19:10' }), 525));
// bez danych osoby: dodatek typowego treningu 700 · 75% = 525; tygodniowo 3,5 · 525 / 7 = 262,5; 2500 − 262,5 = 2237,5 → 2238
test('dzień bez treningu', () => rowne(O.limitBazowy(plan), 2238));
test('dzień z treningiem 700 kcal', () => rowne(O.limitDnia(2238, 75, [{ kcalAktywne: 700 }]), { baza: 2238, dodatek: 525, razem: 2763 }));
test('tydzień trzyma średnią z planu', () => rowne(O.sredniaTygodnia(plan), 2500));
// (3,5 · 2238 + 3,5 · 2763) / 7 = 2500,5
test('ręczne sprawdzenie średniej tygodnia', () => rowne(Math.abs((3.5 * 2238 + 3.5 * 2763) / 7 - 2500) <= 1, true));
// z danymi osoby typowy trening to 626 aktywnych: 626 · 75% = 469,5 → 470; tygodniowo 3,5 · 470 / 7 = 235
// 1900 − 235 = 1665 < PPM 1780 → 1780; średnio 1780 + 235 = 2015
test('dolna granica: spoczynkowe spalanie', () => rowne(O.limitBazowy({ ...plan, ...osoba, sredniaDzienna: 1900 }), 1780));
test('dolna granica: oznaczenie i średnia', () => rowne([O.podniesionyDoPPM({ ...plan, ...osoba, sredniaDzienna: 1900 }), O.sredniaTygodnia({ ...plan, ...osoba, sredniaDzienna: 1900 })], [true, 2015]));
test('bez danych osoby nie ma dolnej granicy', () => rowne(O.limitBazowy({ ...plan, sredniaDzienna: 1900 }), 1638));
// 2500 − 235 = 2265; po typowym treningu 2265 + 470 = 2735; tydzień (3,5 · 2265 + 3,5 · 2735) / 7 = 2500
test('dane osoby ponad granicą: dzień bez treningu i z treningiem', () => rowne([O.limitBazowy({ ...plan, ...osoba }), O.limitDnia(2265, 75, [{ kcalAktywne: 626 }]).razem, O.sredniaTygodnia({ ...plan, ...osoba })], [2265, 2735, 2500]));
test('bez średniej z planu nie ma limitu', () => rowne([O.limitBazowy(O.DOMYSLNE_USTAWIENIA), O.sredniaTygodnia(O.DOMYSLNE_USTAWIENIA)], [null, null]));
test('niepełne dane osoby: bez dolnej granicy', () => rowne(O.maParametry({ ...osoba, masa: null }), false));
// 333 · 0,75 = 249,75 → 250 dla każdego treningu osobno
test('dwa treningi zaokrąglane osobno', () => rowne(O.dodatekZaTreningi(75, [{ kcalAktywne: 333 }, { kcalAktywne: 333 }]), 500));
test('trening bez kcal nie zmienia limitu', () => rowne(O.dodatekZaTreningi(75, [{ kcalAktywne: '' }]), 0));
// B 140; T = 2238 · 0,36 / 9 = 89,52 → 90; W = (2238 − 560 − 810) / 4 = 217
test('makro w dzień bez treningu', () => rowne(O.celeMakro(140, 36, { baza: 2238, dodatek: 0, razem: 2238 }), { b: 140, t: 90, w: 217 }));
// W = (2763 − 560 − 810) / 4 = 348,25 → 348
test('dodatek za trening idzie w węglowodany', () => rowne(O.celeMakro(140, 36, { baza: 2238, dodatek: 525, razem: 2763 }), { b: 140, t: 90, w: 348 }));
// B = 2700 · 0,21 / 4 = 141,75 → 142; T = 108; W = (2700 − 568 − 972) / 4 = 290
test('makro bez wpisanego białka', () => rowne(O.celeMakro(null, 36, { baza: 2700, dodatek: 0, razem: 2700 }), { b: 142, t: 108, w: 290 }));
// ½ z 701 kcal: 350,5 → 351; 41 → 20,5; 23 → 11,5; 83 → 41,5
test('połowa porcji', () => rowne(O.porcja({ kcal: 701, b: 41, t: 23, w: 83 }, 0.5), { kcal: 351, b: 20.5, t: 11.5, w: 41.5 }));
// ¾ z 590: 442,5 → 443; 38 → 28,5; 14 → 10,5; 78 → 58,5
test('¾ porcji', () => rowne(O.porcja({ kcal: 590, b: 38, t: 14, w: 78 }, 0.75), { kcal: 443, b: 28.5, t: 10.5, w: 58.5 }));
test('suma dnia', () => rowne(O.sumaDnia([{ kcal: 351, b: 20.5, t: 11.5, w: 41.5 }, { kcal: 690, b: 52, t: 16, w: 85 }]), { kcal: 1041, b: 72.5, t: 27.5, w: 126.5 }));
test('suma bez błędów zmiennoprzecinkowych', () => rowne(O.sumaDnia([{ kcal: 1, b: 0.1, t: 0.2, w: 0.7 }, { kcal: 2, b: 0.2, t: 0.1, w: 0.6 }]), { kcal: 3, b: 0.3, t: 0.3, w: 1.3 }));
test('pusty dzień', () => rowne(O.sumaDnia([]), { kcal: 0, b: 0, t: 0, w: 0 }));
// 4·40 + 4·60 + 9·20 = 580; |600 − 580| / 600 = 0,0333
test('rozjazd Atwatera', () => rowne(O.rozjazdAtwater({ kcal: 600, b: 40, t: 20, w: 60 }).toFixed(4), '0.0333'));
test('bilans: zostało', () => rowne(O.bilans(1645, 2763), { stan: 'zostalo', kcal: 1118 }));
test('bilans: równo w limicie', () => rowne(O.bilans(2238, 2238), { stan: 'zostalo', kcal: 0 }));
test('bilans: ponad limit', () => rowne(O.bilans(2300, 2238), { stan: 'ponad', kcal: 62 }));
// Zapotrzebowanie metodą Respo, osoba zmyślona (PPM 1780), aktywność 1,6: utrzymanie 2848, chudnięcie 2420,8
const zAktywnoscia = { ...plan, ...osoba, aktywnosc: 1.6 };
test('Respo: do życia, utrzymanie, chudnięcie (−15%)', () => rowne(Object.values(O.zapotrzebowanie(zAktywnoscia)).map(Math.round), [1780, 2848, 2421]));
test('Respo: bez danych osoby nie ma zapotrzebowania', () => rowne(O.zapotrzebowanie({ ...plan, aktywnosc: 1.6 }), null));
// (2848 − 2500) · 7 / 7700 = 0,316 kg tygodniowo
test('Respo: tempo przy średniej z planu', () => rowne(O.tempoTygodniowe(2848, 2500).toFixed(3), '0.316'));
// deficyt 348 < 450 → średnia na 0,5 kg: 2848 − 550 = 2298 → 2300
test('Respo: za wolno → propozycja na 0,5 kg tygodniowo', () => rowne(O.propozycjaSredniej(zAktywnoscia), 2300));
test('Respo: plan w normie → bez propozycji', () => rowne(O.propozycjaSredniej({ ...zAktywnoscia, sredniaDzienna: 2300 }), null));
// deficyt 2848 − 1600 = 1248 > 1200 → na 1 kg: 2848 − 1100 = 1748 → 1750, ale to mniej niż PPM 1780 → 1780
test('Respo: za szybko → propozycja, nigdy poniżej spoczynkowego', () => rowne(O.propozycjaSredniej({ ...zAktywnoscia, sredniaDzienna: 1600 }), 1780));
// Tydzień: pn z treningiem 2931, zjedzone 2700 (zapas 231); wt bez treningu 2470, zjedzone 2700 (230 ponad) → zapas 1
const pn = { k: '2026-11-02', limit: 2931, zjedzone: 2700, wpisy: 4 }, wt = { k: '2026-11-03', limit: 2470, zjedzone: 2700, wpisy: 4 };
test('bilans tygodnia: przekąska w dzień bez treningu mieści się w tygodniu', () => rowne(O.bilansTygodnia([pn, wt], wt.k), { stan: 'zostalo', kcal: 1 }));
test('bilans tygodnia: w pierwszym dniu tygodnia go nie ma (byłby jak dnia)', () => rowne(O.bilansTygodnia([pn, wt], pn.k), null));
test('bilans tygodnia: dzień bez wpisów albo bez limitu się nie liczy', () => rowne([O.bilansTygodnia([{ ...pn, zjedzone: 0, wpisy: 0 }, wt], wt.k), O.bilansTygodnia([{ ...pn, limit: null }, wt], wt.k)], [null, null]));
// (2470 − 2700) + (2470 − 2700) = −460
test('bilans tygodnia: nadwyżki się sumują', () => rowne(O.bilansTygodnia([{ ...pn, limit: 2470 }, wt], wt.k), { stan: 'ponad', kcal: 460 }));
test('bilans tygodnia: dni po wybranym się nie liczą', () => rowne(O.bilansTygodnia([pn, wt, { k: '2026-11-04', limit: 2470, zjedzone: 3500, wpisy: 5 }], wt.k), { stan: 'zostalo', kcal: 1 }));
// rano przed śniadaniem: zapas z poniedziałku 231 + cały limit wtorku 2470
test('bilans tygodnia: wybrany dzień bez wpisów liczy się całym limitem', () => rowne(O.bilansTygodnia([pn, { ...wt, zjedzone: 0, wpisy: 0 }], wt.k), { stan: 'zostalo', kcal: 2701 }));
// 8101 / 3 = 2700,33 → 2700
test('średnia', () => rowne([O.srednia([2600, 2700, 2801]), O.srednia([])], [2700, 0]));

test('klucz dnia z czasu lokalnego (00:30 to już nowy dzień)', () => rowne(D.kluczDnia(new Date(2026, 10, 1, 0, 30)), '2026-11-01'));
test('tydzień przez zmianę czasu (25.10)', () => rowne(D.przesunDni('2026-10-24', 7), '2026-10-31'));
test('przejście przez koniec miesiąca', () => rowne(D.przesunDni('2026-10-31', 1), '2026-11-01'));
test('tydzień od poniedziałku', () => rowne(D.dniTygodnia('2026-11-01'), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']));
test('poniedziałek zaczyna tydzień', () => rowne(D.poczatekTygodnia('2026-10-26'), '2026-10-26'));
test('opis dnia po polsku', () => rowne(D.opisDnia('2026-11-01'), 'niedziela, 1 listopada'));
test('Dzisiaj / Wczoraj / Jutro / dzień tygodnia', () => rowne(['2026-11-01', '2026-10-31', '2026-11-02', '2026-10-29'].map(k => D.nazwaDnia(k, '2026-11-01')), ['Dzisiaj', 'Wczoraj', 'Jutro', 'Czwartek']));
test('godzina', () => rowne(D.godzina(new Date(2026, 10, 1, 8, 5)), '8:05'));

test('liczba z przecinkiem', () => rowne([liczba('92,5'), liczba(' 600 '), liczba(''), liczba('abc')], [92.5, 600, null, null]));
test('wyszukiwanie bez polskich znaków', () => rowne(bezOgonkow('Łosoś z ŻÓŁTYM serem'), 'losos z zoltym serem'));
test('bezpieczny HTML', () => rowne(esc('<b>"Tost" & dżem</b>'), '&lt;b&gt;&quot;Tost&quot; &amp; dżem&lt;/b&gt;'));
test('odmiana: posiłek, posiłki, posiłków', () => rowne([1, 2, 5, 12, 22, 165].map(odmianaPosilkow), ['1 posiłek', '2 posiłki', '5 posiłków', '12 posiłków', '22 posiłki', '165 posiłków']));

// Import planów z Respo: linie zmyślone, w tym samym układzie co w PDF-ach.
const LINIE_PLANU = [
  '=== strona 1 ===',
  'Dzień 1 | B: 70 g | T: 30 g | W: 115 g | 1000 kcal | > 3 l wody',
  'Posiłek 1 / 600 kcalPosiłek 1 / 600 kcal | Przekąska / 400 kcalPrzekąska / 400 kcal',
  '=== strona 2 ===',
  'Dzień 1 | (20 g błonnika)',
  'Posiłek 1 / 7:00-10:00 | 600 | 40 g | 60 g | 20 g',
  'Kcal | B | W | T',
  'Testowa owsianka z jabłkiem',
  'i cynamonem',
  'Płatki owsiane – 80 g | 1. Gotujemy płatki.',
  'Przekąska / dowolna pora dnia | 400 | 30 g | 55 g | 10 g',
  'Kcal | B | W | T',
  'Testowy koktajl (liczba porcji: 2)',
  '1. Miksujemy.',
];
const plan1 = R.parsujPlan(LINIE_PLANU);
test('import: posiłki z planu (kolumny B, W, T)', () => rowne(plan1.posilki, [
  { dzien: 1, kategoria: 'Posiłek 1', pora: '7:00-10:00', kcal: 600, b: 40, t: 20, w: 60, nazwa: 'Testowa owsianka z jabłkiem i cynamonem', porcje: null },
  { dzien: 1, kategoria: 'Przekąska', pora: 'dowolna pora dnia', kcal: 400, b: 30, t: 10, w: 55, nazwa: 'Testowy koktajl', porcje: 2 },
]));
// 600 + 400 = 1000 kcal; B 40 + 30 = 70; T 20 + 10 = 30; W 60 + 55 = 115
test('import: suma dnia zgodna z podsumowaniem', () => rowne([plan1.podsumowania, R.sprawdzDni(plan1.posilki, plan1.podsumowania)], [[{ dzien: 1, kcal: 1000, b: 70, t: 30, w: 115 }], [{ dzien: 1, zgodny: true }]]));
test('import: brakujący posiłek wykryty w sumie dnia', () => rowne(R.sprawdzDni(plan1.posilki.slice(0, 1), plan1.podsumowania), [{ dzien: 1, zgodny: false }]));
test('import: Posiłek 4 to przekąska; kolejność kolumn z opisu', () => rowne(
  R.parsujPlan(['Dzień 2 | (x)', 'Posiłek 4 / dowolna pora dnia | 300 | 10 g | 20 g | 40 g', 'Kcal | B | T | W', 'Testowy jogurt', 'Jogurt – 150 g']).posilki[0],
  { dzien: 2, kategoria: 'Przekąska', pora: 'dowolna pora dnia', kcal: 300, b: 10, t: 20, w: 40, nazwa: 'Testowy jogurt', porcje: null }));
test('import: przegląd tygodnia to nie przepis', () => rowne(R.parsujPlan(['Posiłek 1 / 600 kcalPosiłek 1 / 600 kcal | Posiłek 2 / 700 kcal']).posilki, []));
test('import: składanie linii strony z PDF-a', () => rowne(R.linieStrony([
  { str: 'Posiłek 1 / 7:00-10:00', transform: [1, 0, 0, 1, 40, 700], width: 130 },
  { str: '600', transform: [1, 0, 0, 1, 300, 701], width: 20 },
  { str: 'Testowa', transform: [1, 0, 0, 1, 40, 680], width: 45 },
  { str: 'owsianka', transform: [1, 0, 0, 1, 88, 680], width: 50 },
  { str: ' ', transform: [1, 0, 0, 1, 140, 680], width: 3 },
]), ['Posiłek 1 / 7:00-10:00 | 600', 'Testowa owsianka']));
test('import: data planu z PDF-a, z nazwy pliku, z daty pliku', () => rowne(
  [R.dataPlanu("D:20260317073401Z00'00'", 'dieta.pdf'), R.dataPlanu('', '2025-01-11_dieta.pdf'), R.dataPlanu(undefined, 'dieta.pdf', new Date(2026, 2, 1, 12).getTime()), R.dataPlanu('', 'dieta.pdf')],
  ['2026-03-17', '2025-01-11', '2026-03-01', null]));
// 4·40 + 4·60 + 9·20 = 580: przy 600 kcal 3%, przy 400 kcal 45%
test('import: znacznik „do sprawdzenia” powyżej 10%', () => rowne(R.oznacz([{ kcal: 600, b: 40, t: 20, w: 60 }, { kcal: 400, b: 40, t: 20, w: 60 }], '2026-01-01').map(p => p.sprawdz), [false, true]));
test('import: powtórki z kilku planów — zostaje najnowsza wersja', () => {
  const d = R.deduplikuj([
    { nazwa: 'Testowy gulasz', kcal: 700, b: 40, t: 25, w: 80, plan: '2025-01-01' },
    { nazwa: 'Testowy gulasz', kcal: 800, b: 60, t: 26, w: 86, plan: '2026-01-01' },
    { nazwa: 'testowy  GULASZ', kcal: 800, b: 60, t: 26, w: 86, plan: '2025-06-01' },
    { nazwa: 'Testowa sałatka', kcal: 500, b: 30, t: 20, w: 50, plan: '2025-01-01' },
  ]);
  rowne([d.unikalne.length, d.unikalne[0].kcal, d.zRoznymiPorcjami], [2, 800, 1]);
});
const gulasz = { nazwa: 'Testowy gulasz', kategoria: 'Posiłek 2', pora: '12:00-15:00', kcal: 800, b: 60, t: 26, w: 86, porcje: null };
const salatka = { nazwa: 'Testowa sałatka', kategoria: 'Posiłek 3', pora: '17:00-20:00', kcal: 500, b: 30, t: 20, w: 50, porcje: null };
test('import: scalanie z listą (nowe, aktualizacja z ulubionymi, własne bez zmian)', () => {
  let n = 0;
  const lista = [
    { id: 'a', nazwa: 'Testowy gulasz', zrodlo: 'respo', ulubiony: true, kategoria: 'Posiłek 2', pora: null, kcal: 700, b: 40, t: 25, w: 80, porcje: null, plan: '2025-01-01', sprawdz: false },
    { id: 'b', nazwa: 'Moja kanapka', kategoria: 'Własne', kcal: 300, b: 15, t: 10, w: 35, ulubiony: false },
  ];
  const w = R.scalPosilki(lista, R.oznacz([gulasz, salatka], '2026-01-01'), () => 'nowe' + ++n);
  const g = w.posilki.find(p => p.id === 'a');
  rowne([w.dodane, w.zaktualizowane, w.bezZmian, w.posilki.length, g.kcal, g.ulubiony, w.posilki[1], w.posilki[2].id], [1, 1, 0, 3, 800, true, lista[1], 'nowe1']);
});
test('import: starszy plan nie nadpisuje nowszej wersji', () => {
  const lista = R.scalPosilki([], R.oznacz([gulasz], '2026-01-01'), () => 'a').posilki;
  const w = R.scalPosilki(lista, R.oznacz([{ ...gulasz, kcal: 700 }], '2025-01-01'), () => 'b');
  rowne([w.bezZmian, w.posilki[0].kcal], [1, 800]);
});
test('import: ponowny import tego samego planu nic nie zmienia', () => {
  const nowe = R.oznacz([salatka], '2026-01-01');
  const raz = R.scalPosilki([], nowe, () => 'id1');
  const dwa = R.scalPosilki(raz.posilki, nowe, () => 'id2');
  rowne([dwa.dodane, dwa.zaktualizowane, dwa.bezZmian, dwa.posilki.length], [0, 0, 1, 1]);
});

// Synchronizacja: dokumenty i scalanie trójstronne (urządzenie, chmura, ostatnio zsynchronizowane).
test('sync: kolejność pól nie zmienia odcisku', () => rowne([S.kanoniczny({ b: 1, a: { d: 2, c: 3 } }), S.skrot({ a: 1, b: [1, 2] }) === S.skrot({ b: [1, 2], a: 1 }), S.skrot({ a: 1 }) === S.skrot({ a: 2 })], ['{"a":{"c":3,"d":2},"b":1}', true, false]));
test('sync: pola undefined pomijane jak w Firestore', () => rowne(S.kanoniczny({ a: 1, b: undefined }), '{"a":1}'));
test('sync: odcisk z pamięci zmienia się razem z treścią', () => {
  const d = { wpisy: [{ id: 'a', kcal: 500 }] }, przed = S.skrot(d);
  d.wpisy.push({ id: 'b', kcal: 300 });
  rowne([S.skrot(d) !== przed, S.skrot({ wpisy: [{ kcal: 500, id: 'a' }] }) === przed, S.skrot(undefined) === S.skrot(null)], [true, true, true]);
});
const stanTestowy = { wersja: 1, ustawienia: { sredniaDzienna: 2500 }, posilki: [{ id: 'p1', nazwa: 'Testowy gulasz' }], dni: { '2026-11-01': { wpisy: [{ id: 'w1', kcal: 500 }], treningi: [] } } };
test('sync: stan → dokumenty → stan', () => {
  const d = S.dokumentyZeStanu(stanTestowy);
  rowne([[...d.keys()], S.stanZDokumentow(d)], [['.', 'dane/posilki', 'dni/2026-11-01'], stanTestowy]);
});
const dok = (...pary) => new Map(pary);
const A = { wpisy: [{ id: 'a' }] }, B = { wpisy: [{ id: 'b' }] }, C = { wpisy: [{ id: 'c' }] };
const scal = (l, z, b) => { const w = S.scalDokumenty(l, z, S.skroty(b)); return [Object.fromEntries(w.wynik), w.konflikty]; };
test('sync: zmiana tylko w chmurze wygrywa', () => rowne(scal(dok(['dni/x', A]), dok(['dni/x', B]), dok(['dni/x', A])), [{ 'dni/x': B }, []]));
test('sync: zmiana tylko na urządzeniu wygrywa', () => rowne(scal(dok(['dni/x', B]), dok(['dni/x', A]), dok(['dni/x', A])), [{ 'dni/x': B }, []]));
test('sync: zmiana po obu stronach — wygrywa urządzenie', () => rowne(scal(dok(['dni/x', B]), dok(['dni/x', C]), dok(['dni/x', A])), [{ 'dni/x': B }, ['dni/x']]));
test('sync: usunięcie w chmurze i na urządzeniu', () => rowne([scal(dok(['dni/x', A]), dok(), dok(['dni/x', A])), scal(dok(), dok(['dni/x', A]), dok(['dni/x', A]))], [[{}, []], [{}, []]]));
test('sync: nowe dokumenty z obu stron', () => rowne(scal(dok(['dni/l', A]), dok(['dni/z', B]), dok()), [{ 'dni/l': A, 'dni/z': B }, []]));
test('sync: plan zapisów (zmienione i usunięte)', () => rowne(S.planZapisow(dok(['dni/x', B], ['dni/y', A]), S.skroty(dok(['dni/x', A], ['dni/y', A], ['dni/z', C]))), { zapisy: ['dni/x'], usuniecia: ['dni/z'] }));
test('sync: po zsynchronizowaniu nic do wysłania', () => rowne(S.planZapisow(S.dokumentyZeStanu(stanTestowy), S.skroty(S.dokumentyZeStanu(stanTestowy))), { zapisy: [], usuniecia: [] }));
test('sync: echo własnego zapisu niczego nie zmienia', () => {
  const lokalne = S.dokumentyZeStanu(stanTestowy), zChmury = new Map([...lokalne].map(([s, d]) => [s, JSON.parse(S.kanoniczny(d))]));
  rowne([S.takieSame(S.scalDokumenty(lokalne, zChmury, S.skroty(zChmury)).wynik, lokalne), S.takieSame(lokalne, dok(['.', {}]))], [true, false]);
});
test('sync: co przenieść na puste konto', () => rowne([S.coPrzeniesc(stanTestowy), S.coPrzeniesc({ ustawienia: {}, posilki: [], dni: { '2026-11-01': { wpisy: [], treningi: [] } } })], [{ posilki: 1, dni: 1, ustawienia: true }, null]));
// pusta kopia z pamięci telefonu (bez zasięgu) nie może udawać pustego konta
const zSerwera = { fromCache: false }, zPamieci = { fromCache: true };
test('sync: pierwsze scalenie dopiero na danych z serwera', () => rowne([
  S.potwierdzonePrzezSerwer({ konto: null, posilki: null, dni: new Map(), meta: { konto: zPamieci, posilki: zPamieci, dni: zPamieci } }),
  S.potwierdzonePrzezSerwer({ konto: null, posilki: null, dni: new Map(), meta: { konto: zSerwera, posilki: zSerwera, dni: zPamieci } }),
  S.potwierdzonePrzezSerwer({ konto: null, posilki: undefined, dni: new Map(), meta: { konto: zSerwera, dni: zSerwera } }),
  S.potwierdzonePrzezSerwer({ konto: null, posilki: null, dni: new Map(), meta: { konto: zSerwera, posilki: zSerwera, dni: zSerwera } }),
], [false, false, false, true]));

const zle = wyniki.filter(w => !w.ok);
document.getElementById('podsumowanie').innerHTML = `<b class="${zle.length ? 'zle' : 'ok'}">Wynik: ${wyniki.length - zle.length}/${wyniki.length} zaliczonych</b>`;
document.getElementById('wyniki').innerHTML = wyniki.map(w => `<li class="${w.ok ? 'ok' : 'zle'}">${w.ok ? '✓' : '✗'} ${esc(w.nazwa)}${w.ok ? '' : ' — ' + esc(w.blad)}</li>`).join('');
