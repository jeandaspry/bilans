// Interfejs Bilansu: ekrany Dzisiaj, Historia, Posiłki i Ustawienia oraz dodawanie posiłku i treningu.
import * as M from './magazyn.js';
import * as O from './obliczenia.js';
import * as D from './daty.js';
import { IKONY } from './ikony.js';
import { esc, bezOgonkow, liczba, f, opisPorcji, odmianaPosilkow } from './tekst.js';
import { POSILKI_TESTOWE } from './dane-testowe.js';
import * as R from './import-respo.js';
import * as C from './chmura.js';
import { parsujZegarek } from './zegarek.js';

const WERSJA = '0.5';
const SKROT_ZEGARKA = 'Bilans trening';
const KATEGORIE = ['Posiłek 1', 'Posiłek 2', 'Posiłek 3', 'Przekąska'];
const ZNAKI = { 'Posiłek 1': '1', 'Posiłek 2': '2', 'Posiłek 3': '3', 'Przekąska': 'P', 'Własne': 'W' };
const ZAKLADKI = [['dzisiaj', 'Dzisiaj'], ['historia', 'Historia'], ['posilki', 'Posiłki'], ['ustawienia', 'Ustawienia']];
const PORCJE = [[1, 'Całość'], [0.75, '¾'], [0.5, '½'], [0.25, '¼']];
// Dopuszczalne wartości ustawień; puste pole z listy OPCJONALNE znaczy „nie wpisano”.
const ZAKRESY = {
  sredniaDzienna: [1000, 6000], treningiTydzien: [0, 14], typowyTrening: [0, 3000], doliczanieTreningu: [0, 100],
  bialko: [20, 400], udzialT: [10, 60], wiek: [14, 100], wzrost: [120, 230], masa: [35, 350],
};
const OPCJONALNE = ['sredniaDzienna', 'bialko', 'wiek', 'wzrost', 'masa'];

const ui = {
  ekran: 'dzisiaj', dzien: D.kluczDnia(), dzisPrzyRysowaniu: D.kluczDnia(), filtr: 'Wszystkie', szukaj: '', cofnij: null, import: null,
  logowanie: false, chmura: { tryb: 'lokalnie' }, przeniesienie: null,
};
const $ = s => document.querySelector(s);
const dataPL = k => k.split('-').reverse().join('.');
let zegarKomunikatu;

// --- limit dnia

function parametryBiezace(u) {
  return { baza: O.limitBazowy(u), doliczanie: u.doliczanieTreningu, bialko: u.bialko, udzialT: u.udzialT };
}

// Dziś i dni przyszłe liczymy z bieżących ustawień, minione z zapisu z tamtego dnia.
function parametryDnia(s, k) {
  const dz = s.dni[k];
  return dz?.snap && k < D.kluczDnia() ? dz.snap : parametryBiezace(s.ustawienia);
}

function obliczDzien(s, k) {
  const dz = M.dzien(s, k), p = parametryDnia(s, k), suma = O.sumaDnia(dz.wpisy);
  if (p.baza === null) return { dz, p, suma, limit: null, cele: null };
  const limit = O.limitDnia(p.baza, p.doliczanie, dz.treningi);
  return { dz, p, suma, limit, cele: O.celeMakro(p.bialko, p.udzialT, limit) };
}

// Każda zmiana dnia zapamiętuje ustawienia, z jakimi go liczono; dzisiejszy zapis zawsze się odświeża.
function zmienDzien(k, fn) {
  M.zmien(s => {
    const dz = M.zapewnijDzien(s, k);
    fn(dz);
    if (!dz.snap || k >= D.kluczDnia()) dz.snap = parametryBiezace(s.ustawienia);
  });
}

function odswiezDzisiejszyZapis(s) {
  const dz = s.dni[D.kluczDnia()];
  if (dz) dz.snap = parametryBiezace(s.ustawienia);
}

// Dalej niż bieżący tydzień nie przechodzimy.
function ustawDzien(k) {
  const dzis = D.kluczDnia();
  ui.dzien = D.poczatekTygodnia(k) > D.poczatekTygodnia(dzis) ? dzis : k;
}

// --- rysowanie

const EKRANY = { dzisiaj: ekranDzisiaj, historia: ekranHistoria, posilki: ekranPosilki, ustawienia: ekranUstawienia };

function render() {
  const s = M.pobierz();
  ui.dzisPrzyRysowaniu = D.kluczDnia();
  const el = $('#ekran');
  $('#zakladki').hidden = ui.logowanie;
  if (ui.logowanie) {
    el.className = 'ekran';
    el.innerHTML = ekranLogowania();
    return;
  }
  el.className = 'ekran' + (ui.ekran === 'dzisiaj' ? ' z-przyciskiem' : '');
  el.innerHTML = EKRANY[ui.ekran](s);
  $('#zakladki').innerHTML = ZAKLADKI.map(([id, nazwa]) =>
    `<button class="${ui.ekran === id ? 'on' : ''}" data-akcja="ekran" data-ekran="${id}"${ui.ekran === id ? ' aria-current="page"' : ''}>${IKONY[id]}<span>${nazwa}</span></button>`).join('');
  if (ui.ekran === 'posilki' && $('#lista-posilkow')) {
    $('#szukaj').value = ui.szukaj;
    odswiezListe('przeglad');
  }
}

const linijkaMakro = x => `${f(x.kcal)} kcal · B ${f(x.b)} · T ${f(x.t)} · W ${f(x.w)}`;

// --- ekran Dzisiaj

function ekranDzisiaj(s) {
  const dzis = D.kluczDnia(), k = ui.dzien;
  const { dz, p, suma, limit, cele } = obliczDzien(s, k);
  return `
    <header class="naglowek"><h1 class="serif">${esc(D.nazwaDnia(k, dzis))}</h1><p class="podtytul">${esc(D.opisDnia(k))}</p></header>
    ${pasekTygodnia(s, k, dzis)}
    ${limit ? kartaLimitu(suma, limit, cele) : kartaBezLimitu(suma)}
    <section class="sekcja">
      <div class="sekcja-tytul"><h2>Trening</h2><button class="maly" data-akcja="dodaj-trening">${IKONY.plus}Dodaj</button></div>
      ${dz.treningi.length ? `<div class="lista">${dz.treningi.map(t => kartaTreningu(t, p.doliczanie)).join('')}</div>` : '<p class="pusto">Brak treningu w tym dniu.</p>'}
      <div class="pola-2">
        <button class="drugi" data-akcja="pobierz-z-zegarka">${IKONY.hantla}Z zegarka</button>
        <button class="drugi" data-akcja="wklej-z-zegarka">Wklej wynik</button>
      </div>
    </section>
    <section class="sekcja">
      <h2>Zjedzone</h2>
      ${dz.wpisy.length ? `<div class="lista">${dz.wpisy.map(kartaWpisu).join('')}</div>` : '<p class="pusto">Nic jeszcze nie dodano.</p>'}
    </section>
    <button class="glowny plywajacy" data-akcja="otworz-dodawanie">${IKONY.plus}Dodaj posiłek</button>`;
}

function pasekTygodnia(s, wybrany, dzis) {
  const nastepnyZablokowany = D.poczatekTygodnia(wybrany) >= D.poczatekTygodnia(dzis);
  const dni = D.dniTygodnia(wybrany).map((k, i) => {
    const dz = s.dni[k], ma = dz && (dz.wpisy.length || dz.treningi.length);
    return `<button class="dzien${k === wybrany ? ' wybrany' : ''}${k === dzis ? ' dzis' : ''}" data-akcja="wybierz-dzien" data-dzien="${k}" aria-label="${esc(D.opisDnia(k))}"><span>${D.SKROTY_DNI[i]}</span><b>${D.dataZKlucza(k).getDate()}</b><i class="${ma ? 'kropka' : ''}"></i></button>`;
  }).join('');
  return `<nav class="tydzien" aria-label="Tydzień">
    <button class="strzalka" data-akcja="tydzien" data-o="-7" aria-label="Poprzedni tydzień">${IKONY.lewo}</button>${dni}
    <button class="strzalka" data-akcja="tydzien" data-o="7" aria-label="Następny tydzień"${nastepnyZablokowany ? ' disabled' : ''}>${IKONY.prawo}</button>
  </nav>`;
}

function wskaznik(zjedzone, limit) {
  const czesc = limit > 0 ? Math.min(zjedzone / limit, 1) : 0;
  const luk = 'M16 104 A84 84 0 0 1 184 104';
  const postep = czesc > 0 ? `<path class="postep${zjedzone > limit ? ' ponad' : ''}" d="${luk}" pathLength="100" stroke-dasharray="${(czesc * 100).toFixed(2)} 100"/>` : '';
  return `<svg class="wskaznik" viewBox="0 0 200 116" aria-hidden="true"><path class="tor" d="${luk}" pathLength="100"/>${postep}</svg>`;
}

function kartaLimitu(suma, limit, cele) {
  const bil = O.bilans(suma.kcal, limit.razem);
  return `<section class="karta wskaznik-karta">
    <div class="wskaznik-kontener">${wskaznik(suma.kcal, limit.razem)}
      <div class="wynik"><b class="serif liczby">${f(suma.kcal)}</b><span>z ${f(limit.razem)} kcal</span></div></div>
    <p class="pigulka ${bil.stan}">${bil.stan === 'zostalo' ? 'Zostało' : 'Ponad limit o'} ${f(bil.kcal)} kcal</p>
    ${limit.dodatek ? `<p class="rozbicie">Limit ${f(limit.baza)} + ${f(limit.dodatek)} kcal za trening</p>` : ''}
    <div class="makra">${pasekMakro('Białko', 'b', suma.b, cele.b)}${pasekMakro('Tłuszcze', 't', suma.t, cele.t)}${pasekMakro('Węglowodany', 'w', suma.w, cele.w)}</div>
  </section>`;
}

function kartaBezLimitu(suma) {
  return `<section class="karta wskaznik-karta">
    <div class="wynik-prosty"><b class="serif liczby">${f(suma.kcal)}</b><span>kcal zjedzone</span></div>
    <button class="podpowiedz" data-akcja="ekran" data-ekran="ustawienia">Limit nie jest ustawiony. Wpisz w Ustawieniach średni limit dzienny z planu dietetyka.</button>
  </section>`;
}

function pasekMakro(nazwa, klasa, ile, cel) {
  const proc = cel > 0 ? Math.min(ile / cel, 1) * 100 : 0;
  return `<div class="makro"><div class="makro-opis"><span>${nazwa}</span><span class="liczby"><b>${f(ile)}</b> / ${f(cel)} g</span></div><div class="makro-tor"><i class="${klasa}" style="width:${proc.toFixed(1)}%"></i></div></div>`;
}

function kartaWpisu(w) {
  const opis = [w.kategoria || 'Spoza listy', w.godzina, w.ulamek !== 1 ? opisPorcji(w.ulamek) : ''].filter(Boolean).join(' · ');
  return `<div class="wpis karta"><div class="znak">${ZNAKI[w.kategoria] || '+'}</div>
    <div class="tresc"><b>${esc(w.nazwa)}</b><span>${esc(opis)}</span><span class="liczby">${linijkaMakro(w)}</span></div>
    <button class="ikona-przycisk" data-akcja="usun-wpis" data-id="${esc(w.id)}" aria-label="Usuń: ${esc(w.nazwa)}">${IKONY.kosz}</button></div>`;
}

function kartaTreningu(t, doliczanie) {
  const czas = t.start ? `${t.start}${t.koniec ? '–' + t.koniec : ''} · ` : '';
  return `<div class="wpis karta"><div class="znak">${IKONY.hantla}</div>
    <div class="tresc"><b>${esc(t.nazwa)}</b><span>${esc(czas)}${f(t.kcalAktywne)} kcal aktywnych</span><span>+${f(O.dodatekTreningu(doliczanie, t))} kcal do limitu</span></div>
    <button class="ikona-przycisk" data-akcja="usun-trening" data-id="${esc(t.id)}" aria-label="Usuń trening">${IKONY.kosz}</button></div>`;
}

// --- dodawanie posiłku

function otworzDodawanie() {
  const s = M.pobierz();
  ui.szukaj = '';
  ui.filtr = domyslnyFiltr(s);
  arkusz(`<header class="arkusz-naglowek"><h1 class="serif">Dodaj posiłek</h1><button class="ikona-przycisk" data-akcja="zamknij" aria-label="Zamknij">${IKONY.x}</button></header>
    <p class="podtytul">${esc(D.nazwaDnia(ui.dzien))}, ${esc(D.opisDnia(ui.dzien))}</p>
    <label class="szukaj">${IKONY.szukaj}<input id="szukaj" type="search" placeholder="Szukaj posiłku" autocomplete="off" enterkeyhint="search"></label>
    <div id="chipy" class="chipy"></div>
    <div id="lista-posilkow" class="lista"></div>
    <button class="drugi" data-akcja="spoza-listy">${IKONY.plus}Posiłek spoza listy</button>`);
  odswiezListe('dodawanie');
}

function kategorie(s) {
  const sa = new Set(s.posilki.map(p => p.kategoria));
  return [...KATEGORIE.filter(k => sa.has(k)), ...[...sa].filter(k => k && !KATEGORIE.includes(k)).sort()];
}

// Dziś podpowiadamy posiłek pasujący do pory dnia, jak w planie (7–10, 12–15, 17–20).
function domyslnyFiltr(s) {
  if (ui.dzien !== D.kluczDnia()) return 'Wszystkie';
  const h = new Date().getHours();
  const k = h < 11 ? 'Posiłek 1' : h < 16 ? 'Posiłek 2' : h < 21 ? 'Posiłek 3' : 'Wszystkie';
  return s.posilki.some(p => p.kategoria === k) ? k : 'Wszystkie';
}

function wybranePosilki(s) {
  const q = bezOgonkow(ui.szukaj.trim());
  return s.posilki
    .filter(p => ui.filtr === 'Wszystkie' || (ui.filtr === 'Ulubione' ? p.ulubiony : p.kategoria === ui.filtr))
    .filter(p => !q || bezOgonkow(p.nazwa).includes(q))
    .sort((a, b) => (b.ulubiony ? 1 : 0) - (a.ulubiony ? 1 : 0) || a.nazwa.localeCompare(b.nazwa, 'pl'));
}

function odswiezListe(tryb) {
  const s = M.pobierz();
  $('#chipy').innerHTML = ['Wszystkie', 'Ulubione', ...kategorie(s)].map(c =>
    `<button class="chip${c === ui.filtr ? ' on' : ''}" data-akcja="filtr" data-filtr="${esc(c)}" data-tryb="${tryb}">${esc(c)}</button>`).join('');
  $('#chipy .chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const lista = wybranePosilki(s);
  $('#lista-posilkow').innerHTML = lista.length ? lista.map(p => wierszPosilku(p, tryb)).join('')
    : `<p class="pusto">${s.posilki.length ? 'Nic tu nie pasuje.' : 'Lista posiłków jest pusta. Wgraj ją w zakładce Posiłki.'}</p>`;
}

function wierszPosilku(p, tryb) {
  const dodawanie = tryb === 'dodawanie';
  const wiersz = dodawanie ? ` role="button" data-akcja="porcja" data-id="${esc(p.id)}"` : '';
  return `<div class="wpis karta${dodawanie ? ' posilek' : ''}"${wiersz}>
    <div class="tresc"><b>${esc(p.nazwa)}</b><span>${esc(p.kategoria)}</span><span class="liczby">${linijkaMakro(p)}</span></div>
    <button class="ikona-przycisk serce${p.ulubiony ? ' on' : ''}" data-akcja="ulubiony" data-id="${esc(p.id)}" data-tryb="${tryb}" aria-pressed="${!!p.ulubiony}" aria-label="Ulubione: ${esc(p.nazwa)}">${IKONY.serce}</button>
    ${dodawanie ? `<button class="dodaj" data-akcja="dodaj-posilek" data-id="${esc(p.id)}" aria-label="Dodaj cały posiłek: ${esc(p.nazwa)}">${IKONY.plus}</button>` : ''}
  </div>`;
}

function oknoPorcji(p) {
  okno(`<h2>${esc(p.nazwa)}</h2>
    <p class="opis liczby">Cały posiłek: ${linijkaMakro(p)}</p>
    <div class="porcje">${PORCJE.map(([u, o]) => `<button data-akcja="dodaj-porcje" data-id="${esc(p.id)}" data-ulamek="${u}"><span${u === 1 ? ' class="slowo"' : ''}>${o}</span><small>${f(p.kcal * u)} kcal</small></button>`).join('')}</div>
    <label class="pole">Inna część posiłku (%)<input id="inna-czesc" type="text" inputmode="numeric" placeholder="np. 60" autocomplete="off"></label>
    <button class="glowny" data-akcja="dodaj-inna" data-id="${esc(p.id)}">Dodaj tę część</button>`);
}

function dodajWpis(p, ulamek) {
  const k = ui.dzien;
  const wpis = { id: M.noweId(), posilekId: p.id || null, nazwa: p.nazwa, kategoria: p.kategoria || '', ulamek, ...O.porcja(p, ulamek), godzina: D.godzina(), dodano: new Date().toISOString() };
  zmienDzien(k, dz => dz.wpisy.push(wpis));
  zamknijOkno();
  zamknijArkusz();
  komunikat(`Dodano: ${p.nazwa}`, () => zmienDzien(k, dz => { dz.wpisy = dz.wpisy.filter(x => x.id !== wpis.id); }));
}

function oknoSpozaListy() {
  okno(`<h2>Posiłek spoza listy</h2>
    <label class="pole">Nazwa<input id="r-nazwa" type="text" autocomplete="off" placeholder="np. Kanapka z serem"></label>
    <div class="pola-4">
      <label class="pole">kcal<input id="r-kcal" type="text" inputmode="decimal" autocomplete="off"></label>
      <label class="pole">B (g)<input id="r-b" type="text" inputmode="decimal" autocomplete="off"></label>
      <label class="pole">T (g)<input id="r-t" type="text" inputmode="decimal" autocomplete="off"></label>
      <label class="pole">W (g)<input id="r-w" type="text" inputmode="decimal" autocomplete="off"></label>
    </div>
    <p id="r-uwaga" class="uwaga" hidden></p>
    <label class="checkbox"><input id="r-zapisz" type="checkbox">Zapisz na liście posiłków</label>
    <button class="glowny" data-akcja="dodaj-reczny">Dodaj</button>`);
}

const wartosciRecznie = () => ['kcal', 'b', 't', 'w'].map(x => liczba($('#r-' + x)?.value));

// Podpowiedź, gdy kcal nie pasują do makro (literówka); nie blokuje dodania.
function sprawdzReczny() {
  const [kcal, b, t, w] = wartosciRecznie(), uwaga = $('#r-uwaga');
  const pelne = [kcal, b, t, w].every(x => x !== null);
  uwaga.hidden = !(pelne && O.rozjazdAtwater({ kcal, b, t, w }) > 0.1);
  if (!uwaga.hidden) uwaga.textContent = `Kcal nie pasują do makro: 4·B + 4·W + 9·T = ${f(O.kcalZMakro({ b, t, w }))} kcal. Sprawdź liczby.`;
}

function dodajReczny() {
  const nazwa = $('#r-nazwa').value.trim(), [kcal, b, t, w] = wartosciRecznie(), uwaga = $('#r-uwaga');
  if (!nazwa || !(kcal > 0) || [b, t, w].some(x => x !== null && x < 0)) {
    uwaga.textContent = 'Podaj nazwę i kcal; makro może zostać puste.';
    uwaga.hidden = false;
    return;
  }
  const p = { nazwa, kategoria: '', kcal: Math.round(kcal), b: b ?? 0, t: t ?? 0, w: w ?? 0 };
  if ($('#r-zapisz').checked) {
    Object.assign(p, { id: M.noweId(), kategoria: 'Własne' });
    M.zmien(s => s.posilki.push({ ...p, ulubiony: false }), false);
  }
  dodajWpis(p, 1);
}

// --- treningi

function oknoTreningu() {
  const doliczanie = parametryDnia(M.pobierz(), ui.dzien).doliczanie;
  okno(`<h2>Trening</h2>
    <label class="pole">Nazwa<input id="tr-nazwa" type="text" value="Trening siłowy" autocomplete="off"></label>
    <label class="pole">Aktywne kcal z podsumowania w zegarku<input id="tr-kcal" type="text" inputmode="numeric" placeholder="np. 600" autocomplete="off"></label>
    <div class="pola-2"><label class="pole">Początek<input id="tr-start" type="time"></label><label class="pole">Koniec<input id="tr-koniec" type="time"></label></div>
    <p class="opis">Wpisz aktywne kcal, nie łączne. Do limitu dochodzi ${f(doliczanie)}% tej liczby. Automatyczny odczyt z Apple Watch dojdzie w kolejnym kroku.</p>
    <p id="tr-uwaga" class="uwaga" hidden></p>
    <button class="glowny" data-akcja="zapisz-trening">Dodaj trening</button>`);
}

function zapiszTrening() {
  const kcal = liczba($('#tr-kcal').value), uwaga = $('#tr-uwaga');
  if (!(kcal > 0 && kcal < 5000)) {
    uwaga.textContent = 'Podaj aktywne kcal z zegarka, np. 600.';
    uwaga.hidden = false;
    return;
  }
  const k = ui.dzien;
  const trening = { id: M.noweId(), nazwa: $('#tr-nazwa').value.trim() || 'Trening', kcalAktywne: Math.round(kcal), start: $('#tr-start').value, koniec: $('#tr-koniec').value, zrodlo: 'recznie' };
  zmienDzien(k, dz => dz.treningi.push(trening));
  zamknijOkno();
  const dodatek = O.dodatekTreningu(parametryDnia(M.pobierz(), k).doliczanie, trening);
  komunikat(`Trening dodany: +${f(dodatek)} kcal do limitu`, () => zmienDzien(k, dz => { dz.treningi = dz.treningi.filter(x => x.id !== trening.id); }));
}

async function wklejZZegarka() {
  let tekst;
  try { tekst = await navigator.clipboard.readText(); } catch { return komunikat('Nie udało się odczytać schowka. Zezwól na wklejenie i spróbuj ponownie.'); }
  const w = parsujZegarek(tekst);
  if (w.blad) return komunikat(w.blad);
  const k = D.kluczDnia(w.start), start = D.godzina(w.start), koniec = D.godzina(w.koniec);
  const trening = { id: M.noweId(), nazwa: 'Trening (Apple Watch)', kcalAktywne: w.kcalAktywne, start, koniec, zrodlo: 'zegarek' };
  // ponowne wklejenie tego samego treningu go zastępuje, a nie dubluje
  zmienDzien(k, dz => { dz.treningi = dz.treningi.filter(t => !(t.zrodlo === 'zegarek' && t.start === start)).concat(trening); });
  ui.dzien = k;
  render();
  komunikat(`Trening ${start}–${koniec}: ${f(w.kcalAktywne)} kcal aktywnych`);
}

// --- usuwanie z możliwością cofnięcia

function usunZDnia(lista, id, opis) {
  const k = ui.dzien;
  let usuniety = null, gdzie = -1;
  zmienDzien(k, dz => {
    gdzie = dz[lista].findIndex(x => x.id === id);
    if (gdzie >= 0) [usuniety] = dz[lista].splice(gdzie, 1);
  });
  if (usuniety) komunikat(`Usunięto: ${opis(usuniety)}`, () => zmienDzien(k, dz => dz[lista].splice(Math.min(gdzie, dz[lista].length), 0, usuniety)));
}

// --- ekran Historia

function ekranHistoria(s) {
  const dzis = D.kluczDnia();
  const tydzien = D.dniTygodnia(dzis).map(k => ({ k, ...obliczDzien(s, k) }));
  const minione = tydzien.filter(d => d.k <= dzis);
  const zWpisami = minione.filter(d => d.dz.wpisy.length), zLimitem = zWpisami.filter(d => d.limit);
  const max = Math.max(1, ...minione.map(d => Math.max(d.suma.kcal, d.limit?.razem || 0)));
  // klucze dni przychodzą z danych konta; zły klucz nie może zablokować ekranu
  const klucze = Object.keys(s.dni).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= dzis && (s.dni[k].wpisy?.length || s.dni[k].treningi?.length)).sort().reverse();
  const opisTygodnia = zWpisami.length
    ? `Średnio ${f(O.srednia(zWpisami.map(d => d.suma.kcal)))} kcal dziennie${zLimitem.length ? `, limit średnio ${f(O.srednia(zLimitem.map(d => d.limit.razem)))} kcal` : ''}. Dni z wpisami: ${zWpisami.length}.`
    : 'Brak wpisów w tym tygodniu.';
  return `<header class="naglowek"><h1 class="serif">Historia</h1><p class="podtytul">Ten tydzień i poprzednie dni</p></header>
    <section class="karta">
      <h2>Ten tydzień</h2>
      <p class="opis">${opisTygodnia}</p>
      <div class="wykres">${tydzien.map(d => slupek(d, max, dzis)).join('')}</div>
      <div class="podpisy">${D.SKROTY_DNI.map(x => `<span>${x}</span>`).join('')}</div>
    </section>
    <section class="sekcja"><h2>Dni</h2>
      ${klucze.length ? `<div class="lista">${klucze.map(k => wierszHistorii(s, k, dzis)).join('')}</div>` : '<p class="pusto">Tu pojawią się dni z wpisami.</p>'}
    </section>`;
}

function slupek(d, max, dzis) {
  if (d.k > dzis || !(d.dz.wpisy.length || d.dz.treningi.length)) return '<div class="slupek"></div>';
  const wysokosc = d.suma.kcal / max * 100;
  const kreska = d.limit ? `<span class="kreska" style="bottom:${(d.limit.razem / max * 100).toFixed(1)}%"></span>` : '';
  return `<div class="slupek"><i class="${d.limit && d.suma.kcal > d.limit.razem ? 'ponad' : ''}" style="height:${wysokosc.toFixed(1)}%"></i>${kreska}</div>`;
}

function wierszHistorii(s, k, dzis) {
  const { dz, limit, suma } = obliczDzien(s, k);
  const ponad = limit && suma.kcal > limit.razem;
  const kcal = limit ? `${f(suma.kcal)} / ${f(limit.razem)} kcal` : `${f(suma.kcal)} kcal`;
  const roznica = limit ? `<span class="roznica liczby${ponad ? ' ponad' : ''}">${ponad ? '+' : '−'}${f(Math.abs(limit.razem - suma.kcal))}</span>` : '';
  return `<button class="dzien-historii karta" data-akcja="pokaz-dzien" data-dzien="${esc(k)}">
    <span class="status${ponad ? ' ponad' : ''}"></span>
    <span class="tresc"><b>${esc(D.nazwaDnia(k, dzis))}, ${esc(D.opisDnia(k).split(', ')[1])}</b><span class="liczby">${kcal}${dz.treningi.length ? ' · trening' : ''}</span></span>
    ${roznica}</button>`;
}

// --- ekran Posiłki

function ekranPosilki(s) {
  const testowe = s.posilki.filter(p => p.testowy).length;
  const plany = [...new Set(s.posilki.map(p => p.plan).filter(Boolean))].sort();
  return `<header class="naglowek"><h1 class="serif">Posiłki</h1><p class="podtytul">${s.posilki.length ? `Na liście: ${odmianaPosilkow(s.posilki.length)}` : 'Lista jest pusta'}</p></header>
    <section class="karta sekcja">
      <h2>Import z PDF-ów z Respo</h2>
      <p class="opis">Wybierz plik dieta.pdf z maila od Respo, można kilka naraz. Na listę trafiają nazwy dań z kcal i makro, a suma każdego dnia jest sprawdzana z planem. Import wymaga internetu.</p>
      ${plany.length ? `<p class="opis">Wgrane plany: ${plany.map(dataPL).join(', ')}</p>` : ''}
      <label class="glowny">${IKONY.plus}Wybierz PDF-y<input id="plik-pdf" type="file" accept="application/pdf,.pdf" multiple hidden></label>
      ${testowe ? `<button class="drugi" data-akcja="usun-testowe">Usuń przykładowe posiłki (${testowe})</button>` : s.posilki.length ? '' : '<button class="drugi" data-akcja="zaladuj-testowe">Załaduj przykładowe posiłki</button>'}
    </section>
    ${s.posilki.length ? `<label class="szukaj">${IKONY.szukaj}<input id="szukaj" type="search" placeholder="Szukaj posiłku" autocomplete="off" enterkeyhint="search"></label><div id="chipy" class="chipy"></div><div id="lista-posilkow" class="lista"></div>` : ''}`;
}

function zaladujTestowe() {
  M.zmien(s => { s.posilki.push(...POSILKI_TESTOWE.map(p => ({ ...p, id: M.noweId(), testowy: true, ulubiony: false }))); });
  komunikat(`Załadowano przykładowe posiłki (${POSILKI_TESTOWE.length})`);
}

function usunTestowe() {
  M.zmien(s => { s.posilki = s.posilki.filter(p => !p.testowy); });
  komunikat('Usunięto przykładowe posiłki');
}

// --- import z PDF-ów

const naglowekImportu = () => `<header class="arkusz-naglowek"><h1 class="serif">Import z PDF-ów</h1><button class="ikona-przycisk" data-akcja="zamknij" aria-label="Zamknij">${IKONY.x}</button></header>`;

async function importujPliki(pliki) {
  arkusz(`${naglowekImportu()}<p id="postep-importu" class="opis">Wczytuję czytnik PDF…</p>`);
  const raporty = [];
  for (const plik of pliki) {
    const postep = $('#postep-importu');
    if (!postep) return; // arkusz zamknięty w trakcie importu
    postep.textContent = `Czytam ${plik.name} (${raporty.length + 1} z ${pliki.length})…`;
    try {
      const { linie, plan } = await R.czytajPdf(plik);
      const { posilki, podsumowania, uwagi } = R.parsujPlan(linie);
      const dni = R.sprawdzDni(posilki, podsumowania);
      raporty.push({ plik: plik.name, plan, posilki: R.oznacz(posilki, plan), dni, uwagi, ok: posilki.length > 0 && dni.length > 0 && dni.every(d => d.zgodny) });
    } catch (e) {
      raporty.push({ plik: plik.name, blad: e.message || String(e), posilki: [], dni: [], uwagi: [], ok: false });
    }
  }
  if ($('#postep-importu')) pokazPodgladImportu(raporty);
}

// Na listę trafiają tylko plany, w których suma posiłków każdego dnia zgadza się z planem.
function pokazPodgladImportu(raporty) {
  const s = M.pobierz();
  const { unikalne, zRoznymiPorcjami } = R.deduplikuj(raporty.filter(r => r.ok).flatMap(r => r.posilki));
  const wynik = R.scalPosilki(s.posilki, unikalne, () => '');
  const testowe = s.posilki.filter(p => p.testowy).length;
  const doSprawdzenia = unikalne.filter(p => p.sprawdz);
  const wKategoriach = kategorie({ posilki: unikalne }).map(k => `${k}: ${unikalne.filter(p => p.kategoria === k).length}`).join(' · ');
  ui.import = unikalne;
  arkusz(`${naglowekImportu()}
    ${raporty.map(kartaRaportu).join('')}
    ${unikalne.length ? `<section class="karta sekcja">
      <h2>Na listę posiłków</h2>
      ${[['Dania z planów, bez powtórek', unikalne.length], ['Nowe', wynik.dodane], ['Zaktualizowane', wynik.zaktualizowane], ['Bez zmian', wynik.bezZmian]].map(([n, v]) => `<div class="wiersz-wyniku"><span>${n}</span><b>${v}</b></div>`).join('')}
      <p class="opis">${esc(wKategoriach)}</p>
      ${zRoznymiPorcjami ? `<p class="opis">${zRoznymiPorcjami} dań było w kilku planach z inną porcją; zostaje wersja z najnowszego planu.</p>` : ''}
      ${doSprawdzenia.length ? `<p class="opis">Kcal różnią się od makro o ponad 10% w: ${doSprawdzenia.map(p => esc(p.nazwa)).join(', ')}. Wartości są przepisane z PDF-a bez zmian.</p>` : ''}
      ${testowe ? `<label class="checkbox"><input id="usun-testowe" type="checkbox" checked>Usuń przykładowe posiłki (${testowe})</label>` : ''}
      <button class="glowny" data-akcja="zapisz-import">Zapisz na liście</button>
    </section>` : ''}
    <button class="drugi" data-akcja="zamknij">${unikalne.length ? 'Anuluj' : 'Zamknij'}</button>`);
}

function kartaRaportu(r) {
  const zle = r.dni.filter(d => !d.zgodny).map(d => d.dzien);
  const problem = r.blad ? `Nie udało się odczytać pliku: ${r.blad}.`
    : !r.posilki.length ? 'Nie znaleziono posiłków. Czy to plik dieta.pdf z Respo?'
    : !r.dni.length ? 'Brak podsumowań dni, więc nie da się sprawdzić sum. Pomijam ten plik.'
    : `Suma posiłków nie zgadza się z planem w dniach: ${zle.join(', ')}. Pomijam ten plik, żeby nie wgrać błędnych liczb.`;
  const dni = r.dni.length === 1 ? '1 dzień' : `${r.dni.length} dni`;
  return `<section class="karta sekcja">
    <h2>${esc(r.plik)}</h2>
    ${r.posilki.length ? `<p class="opis">Plan z ${r.plan ? dataPL(r.plan) : 'nieznanej daty'} · ${dni} · ${odmianaPosilkow(r.posilki.length)}</p>` : ''}
    ${r.ok ? `<p class="zgodne">Sumy wszystkich dni zgodne z planem (${r.dni.length}/${r.dni.length})</p>` : `<p class="uwaga">${esc(problem)}</p>`}
    ${r.uwagi.length ? `<p class="opis">Uwagi: ${esc(r.uwagi.join('; '))}</p>` : ''}
  </section>`;
}

function zapiszImport() {
  const nowe = ui.import;
  if (!nowe) return;
  const bezTestowych = $('#usun-testowe')?.checked;
  let wynik;
  M.zmien(s => {
    wynik = R.scalPosilki(bezTestowych ? s.posilki.filter(p => !p.testowy) : s.posilki, nowe, M.noweId);
    s.posilki = wynik.posilki;
  });
  ui.import = null;
  zamknijArkusz();
  komunikat(`Zapisano na liście: nowe ${wynik.dodane}, zaktualizowane ${wynik.zaktualizowane}`);
}

// --- ekran Ustawienia

function ekranUstawienia(s) {
  const u = s.ustawienia;
  return `<header class="naglowek"><h1 class="serif">Ustawienia</h1><p class="podtytul">Limit z planu dietetyka i dane osoby</p></header>
    <section class="karta sekcja">
      <h2>Limit z planu dietetyka</h2>
      ${pole('sredniaDzienna', 'Średni limit dzienny (kcal)', u.sredniaDzienna, 'numeric', 'np. 2700')}
      <div class="pola-2">
        ${pole('treningiTydzien', 'Treningi w tygodniu', u.treningiTydzien, 'decimal')}
        ${pole('typowyTrening', 'Typowy trening (kcal)', u.typowyTrening, 'numeric')}
      </div>
      ${pole('doliczanieTreningu', 'Doliczanie kcal z treningu (%)', u.doliczanieTreningu, 'numeric')}
      <p class="opis">Tydzień trzyma średnią z planu: w dni bez treningu limit jest niższy, a po treningu rośnie o podany procent aktywnych kcal z zegarka.</p>
    </section>
    <section class="karta sekcja">
      <h2>Makro</h2>
      <div class="pola-2">
        ${pole('bialko', 'Białko (g dziennie)', u.bialko, 'numeric', 'np. 145')}
        ${pole('udzialT', 'Tłuszcze (% kcal)', u.udzialT, 'numeric')}
      </div>
      <p class="opis">Węglowodany to reszta limitu, razem z dodatkiem za trening.</p>
    </section>
    <section class="karta sekcja">
      <h2>Dane osoby</h2>
      <p class="opis">Służą do spoczynkowego spalania: limit nigdy nie spadnie poniżej tej wartości.</p>
      <div class="segment" role="group" aria-label="Płeć">
        <button class="${u.plec === 'K' ? 'on' : ''}" data-akcja="plec" data-plec="K" aria-pressed="${u.plec === 'K'}">Kobieta</button>
        <button class="${u.plec === 'M' ? 'on' : ''}" data-akcja="plec" data-plec="M" aria-pressed="${u.plec === 'M'}">Mężczyzna</button>
      </div>
      <div class="pola-2">
        ${pole('wiek', 'Wiek (lata)', u.wiek, 'numeric')}
        ${pole('wzrost', 'Wzrost (cm)', u.wzrost, 'numeric')}
        ${pole('masa', 'Masa ciała (kg)', u.masa, 'decimal')}
      </div>
    </section>
    <section class="karta sekcja" id="wynik-ustawien">${wynikUstawien(u)}</section>
    <section class="karta sekcja">
      <h2>Dane i konto</h2>
      <p id="status-sync" class="opis">${esc(opisSynchronizacji(ui.chmura))}</p>
      ${M.czyTrwaly() ? '' : '<p class="uwaga">To urządzenie nie pozwala zapisać danych (tryb prywatny?). Po zamknięciu aplikacji wpisy mogą zniknąć.</p>'}
      ${C.zalogowany() && C.kopiaSprzedLogowania() ? `<p class="opis">Na tym urządzeniu jest kopia danych sprzed logowania (${odmianaPosilkow(C.kopiaSprzedLogowania().posilki.length)}).</p>
        <button class="drugi" data-akcja="przywroc-kopie">Dodaj je do konta</button><button class="maly" data-akcja="usun-kopie">Usuń kopię</button>` : ''}
      ${C.zalogowany() ? `<button class="drugi" data-akcja="wyloguj">Wyloguj (${esc(C.zalogowany())})</button>` : ''}
      <p class="opis">Bilans, wersja ${WERSJA}</p>
    </section>`;
}

// --- konto i synchronizacja

function opisSynchronizacji(c) {
  const konto = c.email ? `Konto ${c.email}. ` : '';
  switch (c.tryb) {
    case 'lokalnie': return 'Dane są tylko na tym urządzeniu; synchronizacja nie jest jeszcze ustawiona.';
    case 'laczenie': return `${konto}Łączę z kontem…`;
    case 'brak-biblioteki': return 'Brak internetu przy uruchomieniu: zmiany zapisują się na urządzeniu i wyślą się po połączeniu.';
    case 'offline': return `${konto}Bez połączenia: zmiany są na urządzeniu i wyślą się same.`;
    case 'wysylanie': return `${konto}Wysyłam zmiany…`;
    case 'zsynchronizowano': return `${konto}Wszystko zsynchronizowane.`;
    case 'blad': return `${konto}Błąd synchronizacji (${c.kod}). Zmiany są na urządzeniu.`;
    default: return '';
  }
}

function ustawStatus(c) {
  ui.chmura = c;
  const el = $('#status-sync');
  if (el) el.textContent = opisSynchronizacji(c);
}

function ekranLogowania() {
  return `<div class="logowanie">
    <h1 class="serif">Bilans</h1>
    <p class="podtytul">Zaloguj się kontem z Firebase. Dane widzi tylko to konto.</p>
    <label class="pole">E-mail<input id="log-email" type="email" inputmode="email" autocomplete="username" autocapitalize="off"></label>
    <label class="pole">Hasło<input id="log-haslo" type="password" autocomplete="current-password"></label>
    <p id="log-blad" class="uwaga" hidden></p>
    <button class="glowny" data-akcja="zaloguj">Zaloguj się</button>
    <button class="maly" data-akcja="reset-hasla">Nie pamiętasz hasła?</button>
  </div>`;
}

function pokazBladLogowania(tekst) {
  const el = $('#log-blad');
  el.textContent = tekst;
  el.hidden = false;
}

async function zalogujSie() {
  const email = $('#log-email').value, haslo = $('#log-haslo').value, przycisk = $('[data-akcja="zaloguj"]');
  if (!email.trim() || !haslo) return pokazBladLogowania('Podaj e-mail i hasło.');
  przycisk.disabled = true;
  przycisk.textContent = 'Loguję…';
  try {
    await C.zaloguj(email, haslo);
  } catch (e) {
    pokazBladLogowania(C.opisBledu(e));
    przycisk.disabled = false;
    przycisk.textContent = 'Zaloguj się';
  }
}

async function przypomnijHaslo() {
  const email = $('#log-email').value.trim();
  if (!email) return pokazBladLogowania('Wpisz e-mail, a wyślę na niego link do zmiany hasła.');
  try {
    await C.resetujHaslo(email);
    komunikat(`Link do zmiany hasła wysłano na ${email}`);
  } catch (e) {
    pokazBladLogowania(C.opisBledu(e));
  }
}

async function wylogujSie() {
  const ostrzezenia = [
    ['offline', 'wysylanie', 'blad'].includes(ui.chmura.tryb) && 'Część zmian nie dotarła jeszcze do konta i po wylogowaniu zniknie.',
    C.kopiaSprzedLogowania() && 'Kopia danych sprzed logowania zostanie usunięta z urządzenia.',
  ].filter(Boolean);
  if (ostrzezenia.length && !confirm(`${ostrzezenia.join(' ')} Wylogować mimo to?`)) return;
  await C.wyloguj();
}

// Pierwsze logowanie na urządzeniu z danymi sprzed logowania, gdy konto jest puste.
function zapytajOPrzeniesienie(co) {
  return new Promise(gotowe => {
    ui.przeniesienie = gotowe;
    okno(`<h2>Konto jest puste</h2>
      <p class="opis">Na tym urządzeniu są dane zapisane przed logowaniem. Co przenieść na konto?</p>
      ${co.posilki ? `<label class="checkbox"><input id="przen-posilki" type="checkbox" checked>Lista posiłków (${co.posilki})</label>` : ''}
      ${co.ustawienia ? '<label class="checkbox"><input id="przen-ustawienia" type="checkbox" checked>Ustawienia: limit, makro, dane osoby</label>' : ''}
      ${co.dni ? `<label class="checkbox"><input id="przen-dni" type="checkbox">Wpisy z dni (${co.dni})</label>` : ''}
      <button class="glowny" data-akcja="przenies-dane">Przenieś zaznaczone</button>
      <button class="drugi" data-akcja="nie-przenos">Zacznij od pustego konta</button>`, false);
  });
}

function zakonczPrzeniesienie(wybor) {
  const gotowe = ui.przeniesienie;
  ui.przeniesienie = null;
  zamknijOkno();
  if (gotowe) gotowe(wybor);
}

function pole(klucz, etykieta, wartosc, tryb, podpowiedz = '') {
  const v = wartosc === null || wartosc === undefined ? '' : String(wartosc).replace('.', ',');
  return `<label class="pole">${etykieta}<input data-pole="${klucz}" type="text" inputmode="${tryb}" value="${esc(v)}" placeholder="${esc(podpowiedz)}" autocomplete="off"></label>`;
}

function wynikUstawien(u) {
  const baza = O.limitBazowy(u);
  if (baza === null) return '<h2>Wynik</h2><p class="opis">Wpisz średni limit dzienny z planu dietetyka, żeby policzyć limity.</p>';
  const typowy = O.limitDnia(baza, u.doliczanieTreningu, [{ kcalAktywne: u.typowyTrening }]);
  const cele = O.celeMakro(u.bialko, u.udzialT, { baza, dodatek: 0, razem: baza });
  const wiersze = [
    ['Dzień bez treningu', `${f(baza)} kcal`],
    [`Dzień z typowym treningiem (+${f(typowy.dodatek)})`, `${f(typowy.razem)} kcal`],
    ['Średnio w tygodniu', `${f(O.sredniaTygodnia(u))} kcal`],
  ];
  if (O.maParametry(u)) wiersze.push(['Spoczynkowe spalanie (dolna granica)', `${f(O.ppm(u))} kcal`]);
  wiersze.push(['Makro w dzień bez treningu', `B ${cele.b} · T ${cele.t} · W ${cele.w} g`]);
  return `<h2>Wynik</h2>${wiersze.map(([n, v]) => `<div class="wiersz-wyniku"><span>${n}</span><b>${v}</b></div>`).join('')}
    ${O.podniesionyDoPPM(u) ? '<p class="uwaga">Limit dnia bez treningu podniesiono do spoczynkowego spalania.</p>' : ''}`;
}

function zmienUstawienie(el) {
  const klucz = el.dataset.pole, [min, max] = ZAKRESY[klucz];
  const tekst = el.value.trim(), v = liczba(tekst);
  const ok = v !== null && v >= min && v <= max;
  const pusty = tekst === '' && OPCJONALNE.includes(klucz);
  el.classList.toggle('blad', !ok && !pusty);
  if (!ok && !pusty) return;
  M.zmien(s => { s.ustawienia[klucz] = ok ? v : null; odswiezDzisiejszyZapis(s); }, false);
  $('#wynik-ustawien').innerHTML = wynikUstawien(M.pobierz().ustawienia);
}

// --- arkusz, okno, komunikat

function arkusz(html) {
  const a = $('#arkusz');
  a.innerHTML = `<div class="arkusz-tresc">${html}</div>`;
  a.hidden = false;
  a.scrollTop = 0;
  document.body.classList.add('zablokowany');
}

function zamknijArkusz() {
  const a = $('#arkusz');
  a.hidden = true;
  a.innerHTML = '';
  document.body.classList.remove('zablokowany');
}

function okno(html, zamykane = true) {
  const o = $('#okno');
  o.innerHTML = `<div class="okno-tlo"${zamykane ? ' data-akcja="zamknij-okno"' : ''}></div><div class="okno-panel" role="dialog" aria-modal="true">${html}</div>`;
  o.hidden = false;
}

function zamknijOkno() {
  const o = $('#okno');
  o.hidden = true;
  o.innerHTML = '';
}

function komunikat(tekst, cofnij) {
  const k = $('#komunikat');
  ui.cofnij = cofnij || null;
  k.innerHTML = `<span>${esc(tekst)}</span>${cofnij ? '<button data-akcja="cofnij">Cofnij</button>' : ''}`;
  k.hidden = false;
  clearTimeout(zegarKomunikatu);
  zegarKomunikatu = setTimeout(() => { k.hidden = true; ui.cofnij = null; }, 7000);
}

// --- zdarzenia

const AKCJE = {
  'ekran': el => { ui.ekran = el.dataset.ekran; ui.filtr = 'Wszystkie'; ui.szukaj = ''; zamknijOkno(); zamknijArkusz(); render(); window.scrollTo(0, 0); },
  'wybierz-dzien': el => { ustawDzien(el.dataset.dzien); render(); },
  'pokaz-dzien': el => { ustawDzien(el.dataset.dzien); ui.ekran = 'dzisiaj'; render(); window.scrollTo(0, 0); },
  'tydzien': el => { ustawDzien(D.przesunDni(ui.dzien, Number(el.dataset.o))); render(); },
  'otworz-dodawanie': () => otworzDodawanie(),
  'zamknij': () => { ui.import = null; zamknijArkusz(); },
  'zapisz-import': () => zapiszImport(),
  'zamknij-okno': () => zamknijOkno(),
  'filtr': el => { ui.filtr = el.dataset.filtr; odswiezListe(el.dataset.tryb); },
  'ulubiony': (el, p) => { if (!p) return; M.zmien(() => { p.ulubiony = !p.ulubiony; }, false); odswiezListe(el.dataset.tryb); },
  'dodaj-posilek': (el, p) => p && dodajWpis(p, 1),
  'porcja': (el, p) => p && oknoPorcji(p),
  'dodaj-porcje': (el, p) => p && dodajWpis(p, Number(el.dataset.ulamek)),
  'dodaj-inna': (el, p) => {
    const pole = $('#inna-czesc'), v = liczba(pole.value);
    if (p && v > 0 && v <= 300) dodajWpis(p, Math.round(v) / 100); else pole.classList.add('blad');
  },
  'spoza-listy': () => oknoSpozaListy(),
  'dodaj-reczny': () => dodajReczny(),
  'dodaj-trening': () => oknoTreningu(),
  // skrót odczytuje Zdrowie (telefon jest wtedy odblokowany) i kładzie wynik do schowka; hasło nie jest mu potrzebne
  'pobierz-z-zegarka': () => { location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SKROT_ZEGARKA)}`; },
  'wklej-z-zegarka': () => wklejZZegarka(),
  'zapisz-trening': () => zapiszTrening(),
  'usun-wpis': el => usunZDnia('wpisy', el.dataset.id, x => x.nazwa),
  'usun-trening': el => usunZDnia('treningi', el.dataset.id, x => x.nazwa),
  'plec': el => M.zmien(s => { s.ustawienia.plec = el.dataset.plec; odswiezDzisiejszyZapis(s); }),
  'zaloguj': () => zalogujSie(),
  'reset-hasla': () => przypomnijHaslo(),
  'wyloguj': () => wylogujSie(),
  'przenies-dane': () => zakonczPrzeniesienie({
    posilki: !!$('#przen-posilki')?.checked, ustawienia: !!$('#przen-ustawienia')?.checked, dni: !!$('#przen-dni')?.checked,
  }),
  'nie-przenos': () => { if (confirm('Konto zostanie puste. Kopia danych z tego urządzenia zostanie w Ustawieniach. Kontynuować?')) zakonczPrzeniesienie(null); },
  // kopia sprzed logowania: lista posiłków dochodzi do konta (bez dubli), ustawienia tylko gdy na koncie ich brak
  'przywroc-kopie': () => {
    const k = C.kopiaSprzedLogowania();
    if (!k) return;
    M.zmien(s => {
      const nazwy = new Set(s.posilki.map(p => R.kluczNazwy(p.nazwa)));
      s.posilki.push(...k.posilki.filter(p => !nazwy.has(R.kluczNazwy(p.nazwa))));
      if (!(s.ustawienia.sredniaDzienna > 0)) s.ustawienia = { ...s.ustawienia, ...k.ustawienia };
      for (const [d, dz] of Object.entries(k.dni || {})) if (!s.dni[d]) s.dni[d] = dz;
    });
    C.usunKopie();
    render();
    komunikat('Dane sprzed logowania dodane do konta');
  },
  'usun-kopie': () => { if (confirm('Usunąć kopię danych sprzed logowania?')) { C.usunKopie(); render(); } },
  'zaladuj-testowe': () => zaladujTestowe(),
  'usun-testowe': () => usunTestowe(),
  'cofnij': () => {
    const c = ui.cofnij;
    ui.cofnij = null;
    $('#komunikat').hidden = true;
    if (c) c();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-akcja]');
  const akcja = el && AKCJE[el.dataset.akcja];
  if (!akcja) return;
  const p = el.dataset.id ? M.pobierz().posilki.find(x => x.id === el.dataset.id) : null;
  akcja(el, p);
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'szukaj') {
    ui.szukaj = el.value;
    if (ui.szukaj.trim()) ui.filtr = 'Wszystkie';
    odswiezListe($('#arkusz').hidden ? 'przeglad' : 'dodawanie');
  } else if (el.dataset.pole) {
    zmienUstawienie(el);
  } else if (el.id?.startsWith('r-')) {
    sprawdzReczny();
  }
});

document.addEventListener('change', e => {
  if (e.target.id !== 'plik-pdf' || !e.target.files.length) return;
  const pliki = [...e.target.files];
  e.target.value = ''; // ten sam plik można wybrać ponownie
  importujPliki(pliki);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['log-email', 'log-haslo'].includes(e.target.id)) return zalogujSie();
  if (e.key !== 'Escape' || ui.przeniesienie) return;
  if (!$('#okno').hidden) zamknijOkno(); else if (!$('#arkusz').hidden) zamknijArkusz();
});

// Przy chowaniu aplikacji zmiany idą do konta od razu; po powrocie następnego dnia „Dzisiaj” pokazuje nowy dzień.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') return C.wyslijTeraz();
  if (ui.dzisPrzyRysowaniu === D.kluczDnia()) return;
  if (ui.dzien === ui.dzisPrzyRysowaniu) ui.dzien = D.kluczDnia();
  render();
});
window.addEventListener('pagehide', () => C.wyslijTeraz());

M.subskrybuj(() => render());
M.naZmianeLokalna(() => C.zaplanujWysylke());
render();
C.start({
  pobierz: M.pobierz,
  zastap: M.zastap,
  wyczysc: M.wyczysc,
  status: ustawStatus,
  pokazLogowanie: widoczne => {
    if (ui.logowanie === widoczne) return;
    ui.logowanie = widoczne;
    if (widoczne) { zamknijOkno(); zamknijArkusz(); }
    render();
  },
  zapytajOPrzeniesienie,
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
