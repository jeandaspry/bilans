// Import planów z Respo: tekst z PDF-a (pdf.js) → posiłki z kcal i makro, z kontrolą sum każdego dnia.
// Te same reguły co w narzędziu do odczytu na komputerze; dania z PDF-ów trafiają tylko do danych użytkownika.
import { rozjazdAtwater } from './obliczenia.js';
import { bezOgonkow } from './tekst.js';
import { kluczDnia } from './daty.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

const NAGLOWEK = /^(?:Posiłek (\d)|Przekąska) \/ (\d{1,2}:\d{2}-\d{1,2}:\d{2}|dowolna pora dnia) \| (\d+) \| ([\d.,]+) g \| ([\d.,]+) g \| ([\d.,]+) g/;
const KOLUMNY = /^Kcal \| ([BTW]) \| ([BTW]) \| ([BTW])$/;
const DZIEN_PRZEPISOW = /^Dzień (\d+) \| \(/;
const DZIEN_PODSUMOWANIE = /^Dzień (\d+) \| B: ([\d.,]+) g \| T: ([\d.,]+) g \| W: ([\d.,]+) g \| (\d+) kcal/;
// Nazwa to 1–2 linie pod nagłówkiem; kończy ją składnik („ – ”), druga kolumna („ | ”), krok przepisu,
// podtytuł z dwukropkiem, nowy nagłówek albo koniec strony.
const KONIEC_NAZWY = [/ – /, / \| /, /^\d+\. /, /:$/, /^(Posiłek|Przekąska)/, /^===/, /^Dzień/];
const PORCJE = / ?\(liczba porcji: (\d+)\)/;

const liczbaZPdf = s => parseFloat(String(s).replace(',', '.'));
const zaokr1 = x => Math.round(x * 10) / 10;
export const kluczNazwy = nazwa => bezOgonkow(nazwa).replace(/\s+/g, ' ').trim();

// Składa elementy tekstu strony w linie po współrzędnej y; duży odstęp w linii to kolejna kolumna („ | ”).
export function linieStrony(items) {
  const wiersze = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    let w = wiersze.find(r => Math.abs(r.y - y) < 3);
    if (!w) wiersze.push(w = { y, el: [] });
    w.el.push({ x, k: x + it.width, s: it.str });
  }
  wiersze.sort((a, b) => b.y - a.y);
  return wiersze.map(w => {
    w.el.sort((a, b) => a.x - b.x);
    let t = '', koniec = null;
    for (const e of w.el) {
      if (koniec !== null) t += e.x - koniec > 8 ? ' | ' : e.x - koniec > 1 ? ' ' : '';
      t += e.s;
      koniec = e.k;
    }
    return t;
  });
}

export function parsujPlan(linie) {
  const posilki = [], podsumowania = [], uwagi = [];
  let dzien = null, biezacy = null;
  const zakoncz = () => {
    if (!biezacy) return;
    const porcje = PORCJE.exec(biezacy.nazwa);
    if (porcje) biezacy.porcje = Number(porcje[1]);
    biezacy.nazwa = biezacy.nazwa.replace(PORCJE, '').replace(/\s+/g, ' ').trim();
    if (biezacy.nazwa) posilki.push(biezacy); else uwagi.push(`posiłek bez nazwy w dniu ${biezacy.dzien}`);
    biezacy = null;
  };
  for (let i = 0; i < linie.length; i++) {
    const l = linie[i].trim();
    if (!l) continue;
    if (biezacy) {
      if (!KONIEC_NAZWY.some(r => r.test(l))) { biezacy.nazwa += ' ' + l; continue; }
      zakoncz();
    }
    let m;
    if ((m = DZIEN_PODSUMOWANIE.exec(l))) {
      podsumowania.push({ dzien: Number(m[1]), kcal: Number(m[5]), b: liczbaZPdf(m[2]), t: liczbaZPdf(m[3]), w: liczbaZPdf(m[4]) });
    } else if ((m = DZIEN_PRZEPISOW.exec(l))) {
      dzien = Number(m[1]);
    } else if ((m = NAGLOWEK.exec(l))) {
      // kolejność kolumn bierzemy z linii pod nagłówkiem (w Respo: Kcal | B | W | T)
      const kolumny = KOLUMNY.exec((linie[i + 1] || '').trim());
      const kolejnosc = kolumny && new Set(kolumny.slice(1)).size === 3 ? kolumny.slice(1) : null;
      if (kolejnosc) i++; else uwagi.push(`brak opisu kolumn przy posiłku w dniu ${dzien}; przyjęto B, W, T`);
      const wartosci = {};
      (kolejnosc || ['B', 'W', 'T']).forEach((k, j) => { wartosci[k] = liczbaZPdf(m[4 + j]); });
      biezacy = {
        dzien, kategoria: m[1] && m[1] !== '4' ? `Posiłek ${m[1]}` : 'Przekąska', pora: m[2],
        kcal: Number(m[3]), b: wartosci.B, t: wartosci.T, w: wartosci.W, nazwa: '', porcje: null,
      };
    }
  }
  zakoncz();
  return { posilki, podsumowania, uwagi };
}

// Suma posiłków każdego dnia musi się zgadzać z podsumowaniem dnia w PDF-ie (kcal i gramy B/T/W).
export function sprawdzDni(posilki, podsumowania) {
  const sumy = new Map();
  for (const p of posilki) {
    const s = sumy.get(p.dzien) || { kcal: 0, b: 0, t: 0, w: 0 };
    sumy.set(p.dzien, { kcal: s.kcal + p.kcal, b: s.b + p.b, t: s.t + p.t, w: s.w + p.w });
  }
  return podsumowania.map(d => {
    const s = sumy.get(d.dzien) || { kcal: 0, b: 0, t: 0, w: 0 };
    return { dzien: d.dzien, zgodny: s.kcal === d.kcal && zaokr1(s.b) === d.b && zaokr1(s.t) === d.t && zaokr1(s.w) === d.w };
  });
}

// Data planu: z daty utworzenia PDF-a (Respo tworzy go w dniu wysyłki), potem z nazwy pliku, na końcu z daty zapisu pliku.
export function dataPlanu(utworzono, nazwaPliku, zmieniono) {
  const m = /^D:(\d{4})(\d{2})(\d{2})/.exec(utworzono || '') || /(\d{4})-(\d{2})-(\d{2})/.exec(nazwaPliku || '');
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return zmieniono ? kluczDnia(new Date(zmieniono)) : null;
}

export const oznacz = (posilki, plan) => posilki.map(p => ({ ...p, plan, sprawdz: rozjazdAtwater(p) > 0.1 }));

// To samo danie z kilku planów: zostaje wersja z najnowszego planu.
export function deduplikuj(posilki) {
  const najnowsze = new Map(), warianty = new Map();
  for (const p of posilki) {
    const k = kluczNazwy(p.nazwa);
    if (!warianty.has(k)) warianty.set(k, new Set());
    warianty.get(k).add(`${p.kcal}/${p.b}/${p.t}/${p.w}`);
    const obecny = najnowsze.get(k);
    if (!obecny || (p.plan || '') > (obecny.plan || '')) najnowsze.set(k, p);
  }
  return { unikalne: [...najnowsze.values()], zRoznymiPorcjami: [...warianty.values()].filter(w => w.size > 1).length };
}

const POLA = ['kategoria', 'pora', 'kcal', 'b', 't', 'w', 'porcje', 'plan', 'sprawdz'];
const wybierz = o => Object.fromEntries(POLA.map(k => [k, o[k] ?? null]));

// Dopisuje dania z planów do listy: nowe dochodzą, starsze wersje z planów się aktualizują
// (zostają identyfikator i ulubione); własne i przykładowe posiłki zostają bez zmian.
export function scalPosilki(istniejace, nowe, noweId) {
  const posilki = istniejace.map(p => ({ ...p }));
  const zPlanow = new Map(posilki.filter(p => p.zrodlo === 'respo').map(p => [kluczNazwy(p.nazwa), p]));
  let dodane = 0, zaktualizowane = 0, bezZmian = 0;
  for (const n of nowe) {
    const k = kluczNazwy(n.nazwa), st = zPlanow.get(k);
    if (!st) {
      const p = { id: noweId(), nazwa: n.nazwa, zrodlo: 'respo', ulubiony: false, ...wybierz(n) };
      posilki.push(p);
      zPlanow.set(k, p);
      dodane++;
    } else if ((n.plan || '') < (st.plan || '') || POLA.every(p => (st[p] ?? null) === (n[p] ?? null))) {
      bezZmian++;
    } else {
      Object.assign(st, wybierz(n), { nazwa: n.nazwa });
      zaktualizowane++;
    }
  }
  return { posilki, dodane, zaktualizowane, bezZmian };
}

// --- odczyt pliku (tylko w przeglądarce)

let ladowanie = null;
function zaladujPdfJs() {
  if (globalThis.pdfjsLib) return Promise.resolve(globalThis.pdfjsLib);
  return (ladowanie ||= new Promise((ok, blad) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(globalThis.pdfjsLib); };
    s.onerror = () => { ladowanie = null; s.remove(); blad(new Error('nie udało się wczytać czytnika PDF; import wymaga internetu')); };
    document.head.appendChild(s);
  }));
}

export async function czytajPdf(plik) {
  const pdfjs = await zaladujPdfJs();
  // bez eval: czytamy tylko tekst, a polityka bezpieczeństwa strony i tak go blokuje
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await plik.arrayBuffer()), isEvalSupported: false }).promise;
  const linie = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tresc = await (await pdf.getPage(n)).getTextContent();
    linie.push(`=== strona ${n} ===`, ...linieStrony(tresc.items));
  }
  const info = (await pdf.getMetadata().catch(() => null))?.info || {};
  return { linie, plan: dataPlanu(info.CreationDate, plik.name, plik.lastModified) };
}
