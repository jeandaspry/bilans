// Synchronizacja przez Firebase: logowanie e-mailem i hasłem, dane w Firestore z kopią offline na urządzeniu.
// Dane konta leżą pod uzytkownicy/{uid}; reguły w firestore.rules wpuszczają tylko to konto.
import { FIREBASE } from './konfiguracja.js';
import * as S from './synchronizacja.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const KLUCZ_KONTA = 'bilans.konto';
const KLUCZ_BAZY = 'bilans.zsynchronizowane';
const KLUCZ_KOPII = 'bilans.kopia-sprzed-logowania';
const OPOZNIENIE_WYSYLKI = 600;

export const kopiaSprzedLogowania = () => czytaj(KLUCZ_KOPII);
export const usunKopie = () => pisz(KLUCZ_KOPII, null);

let api = null;          // funkcje aplikacji: pobierz, zastap, wyczysc, status, pokazLogowanie, zapytajOPrzeniesienie
let fb = null;           // { app, auth, fs, a, db } po wczytaniu biblioteki
let uzytkownik = null;
let odpiecia = [];
let czesci = null;       // ostatnie dane z chmury: konto, posilki, dni (Map) i ich metadane
let baza = new Map();    // ścieżka → odcisk treści ostatnio zsynchronizowanej
let etap = 'czekam';     // 'czekam' na pierwsze dane, 'pytanie' o przeniesienie danych, 'gotowe'
let obce = false;        // dane na urządzeniu nie pochodzą z tego konta
let zegar = null;

export const skonfigurowana = () => !!FIREBASE;
export const zalogowany = () => uzytkownik?.email || null;

function czytaj(klucz) { try { return JSON.parse(localStorage.getItem(klucz)); } catch { return null; } }
function pisz(klucz, wartosc) { try { wartosc === null ? localStorage.removeItem(klucz) : localStorage.setItem(klucz, JSON.stringify(wartosc)); } catch {} }
const zapiszBaze = () => pisz(KLUCZ_BAZY, Object.fromEntries(baza));

async function zaladujSdk() {
  const [app, auth, fs] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(p => import(SDK + p)));
  const aplikacja = app.initializeApp(FIREBASE);
  const a = auth.initializeAuth(aplikacja, { persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence] });
  const db = fs.initializeFirestore(aplikacja, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentSingleTabManager() }), ignoreUndefinedProperties: true });
  return { app: aplikacja, auth, fs, a, db };
}

export async function start(funkcje) {
  api = funkcje;
  if (!FIREBASE) { api.status({ tryb: 'lokalnie' }); return; }
  api.status({ tryb: 'laczenie' });
  try {
    fb = await zaladujSdk();
  } catch {
    // brak internetu przy pierwszym uruchomieniu: wpisy zapisują się na urządzeniu i wyślą się później
    api.status({ tryb: 'brak-biblioteki' });
    return;
  }
  fb.auth.onAuthStateChanged(fb.a, u => (u ? polacz(u) : rozlacz()));
}

function sciezkaDokumentu(s) {
  const { fs, db } = fb, konto = ['uzytkownicy', uzytkownik.uid];
  return s === S.SCIEZKA_KONTA ? fs.doc(db, ...konto) : fs.doc(db, ...konto, ...s.split('/'));
}

function polacz(u) {
  odepnij();
  uzytkownik = u;
  etap = 'czekam';
  obce = czytaj(KLUCZ_KONTA)?.uid !== u.uid;
  baza = obce ? new Map() : new Map(Object.entries(czytaj(KLUCZ_BAZY) || {}));
  czesci = { konto: undefined, posilki: undefined, dni: undefined, meta: {} };
  api.pokazLogowanie(false);
  api.status({ tryb: 'laczenie', email: u.email });
  const { fs, db } = fb, opcje = { includeMetadataChanges: true };
  const odbierz = (czesc, wartosc, meta) => {
    czesci[czesc] = wartosc;
    czesci.meta[czesc] = meta;
    if (etap !== 'pytanie' && ['konto', 'posilki', 'dni'].every(k => czesci[k] !== undefined)) naDaneZChmury();
  };
  odpiecia = [
    fs.onSnapshot(sciezkaDokumentu(S.SCIEZKA_KONTA), opcje, d => odbierz('konto', d.exists() ? d.data() : null, d.metadata), blad),
    fs.onSnapshot(sciezkaDokumentu(S.SCIEZKA_POSILKOW), opcje, d => odbierz('posilki', d.exists() ? d.data() : null, d.metadata), blad),
    fs.onSnapshot(fs.collection(db, 'uzytkownicy', u.uid, 'dni'), opcje, q => odbierz('dni', new Map(q.docs.map(d => [d.id, d.data()])), q.metadata), blad),
  ];
}

function dokumentyZChmury() {
  const d = new Map();
  if (czesci.konto) d.set(S.SCIEZKA_KONTA, czesci.konto);
  if (czesci.posilki) d.set(S.SCIEZKA_POSILKOW, czesci.posilki);
  for (const [k, v] of czesci.dni) d.set(`dni/${k}`, v);
  return d;
}

async function naDaneZChmury() {
  if (etap === 'czekam') {
    if (obce) {
      // dane z urządzenia sprzed logowania nie mieszają się z kontem: na puste konto można je przenieść
      const lokalny = api.pobierz();
      // zanim dane z urządzenia ustąpią danym konta, zostaje ich kopia do przywrócenia w Ustawieniach
      if (S.coPrzeniesc(lokalny)) pisz(KLUCZ_KOPII, lokalny);
      const doPrzeniesienia = dokumentyZChmury().size === 0 ? S.coPrzeniesc(lokalny) : null;
      let przeniesione = null;
      if (doPrzeniesienia) {
        etap = 'pytanie';
        const wybor = await api.zapytajOPrzeniesienie(doPrzeniesienia);
        if (!uzytkownik) return; // wylogowano w trakcie pytania
        if (wybor) przeniesione = { wersja: 1, ustawienia: wybor.ustawienia ? lokalny.ustawienia : {}, posilki: wybor.posilki ? lokalny.posilki : [], dni: wybor.dni ? lokalny.dni : {} };
      }
      api.zastap(przeniesione || S.stanZDokumentow(dokumentyZChmury()));
      baza = S.skroty(dokumentyZChmury());
    }
    pisz(KLUCZ_KONTA, { uid: uzytkownik.uid, email: uzytkownik.email });
    etap = 'gotowe';
  }
  const zdalne = dokumentyZChmury(), lokalne = S.dokumentyZeStanu(api.pobierz());
  const { wynik } = S.scalDokumenty(lokalne, zdalne, baza);
  baza = S.skroty(zdalne);
  zapiszBaze();
  // echo własnego zapisu nie przerysowuje ekranu (np. pola, w które ktoś właśnie pisze)
  if (!S.takieSame(wynik, lokalne)) api.zastap(S.stanZDokumentow(wynik));
  wyslijTeraz();
  pokazStan();
}

function pokazStan() {
  const meta = Object.values(czesci?.meta || {});
  const tryb = meta.some(m => m?.hasPendingWrites) ? 'wysylanie' : meta.some(m => m?.fromCache) ? 'offline' : 'zsynchronizowano';
  api.status({ tryb, email: uzytkownik?.email });
}

function blad(e) {
  api.status({ tryb: 'blad', email: uzytkownik?.email, kod: e?.code || String(e) });
}

// Wysyła to, czym urządzenie różni się od chmury. Firestore trzyma niewysłane zapisy także po zamknięciu aplikacji.
export function wyslijTeraz() {
  clearTimeout(zegar);
  zegar = null;
  if (!fb || !uzytkownik || etap !== 'gotowe') return;
  const lokalne = S.dokumentyZeStanu(api.pobierz());
  const { zapisy, usuniecia } = S.planZapisow(lokalne, baza);
  for (const s of zapisy) {
    fb.fs.setDoc(sciezkaDokumentu(s), lokalne.get(s)).catch(blad);
    baza.set(s, S.skrot(lokalne.get(s)));
  }
  for (const s of usuniecia) {
    fb.fs.deleteDoc(sciezkaDokumentu(s)).catch(blad);
    baza.delete(s);
  }
  if (zapisy.length || usuniecia.length) zapiszBaze();
}

export function zaplanujWysylke() {
  if (!uzytkownik) return;
  clearTimeout(zegar);
  zegar = setTimeout(wyslijTeraz, OPOZNIENIE_WYSYLKI);
}

function odepnij() {
  odpiecia.forEach(o => o());
  odpiecia = [];
}

function rozlacz() {
  odepnij();
  uzytkownik = null;
  etap = 'czekam';
  // kopia danych konta na urządzeniu bez zalogowania nie zostaje
  if (czytaj(KLUCZ_KONTA)) { pisz(KLUCZ_KONTA, null); pisz(KLUCZ_BAZY, null); pisz(KLUCZ_KOPII, null); api.wyczysc(); }
  api.status({ tryb: 'wylogowany' });
  api.pokazLogowanie(true);
}

export async function zaloguj(email, haslo) {
  if (!fb) throw Object.assign(new Error('brak biblioteki'), { code: 'auth/network-request-failed' });
  await fb.auth.signInWithEmailAndPassword(fb.a, email.trim(), haslo);
}

export async function resetujHaslo(email) {
  await fb.auth.sendPasswordResetEmail(fb.a, email.trim());
}

// Wylogowanie czyści dane konta z urządzenia (także kopię Firestore) i uruchamia aplikację od nowa.
export async function wyloguj() {
  wyslijTeraz();
  odepnij();
  await fb.auth.signOut(fb.a);
  try {
    await fb.fs.terminate(fb.db);
    await fb.fs.clearIndexedDbPersistence(fb.db);
  } catch {}
  pisz(KLUCZ_KONTA, null);
  pisz(KLUCZ_BAZY, null);
  pisz(KLUCZ_KOPII, null);
  api.wyczysc();
  location.reload();
}

export function opisBledu(e) {
  const kod = e?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/missing-password'].includes(kod)) return 'Nieprawidłowy e-mail lub hasło.';
  if (kod === 'auth/too-many-requests') return 'Za dużo prób. Spróbuj ponownie za kilka minut.';
  if (kod === 'auth/network-request-failed') return 'Brak połączenia z internetem.';
  return `Nie udało się (${kod || 'nieznany błąd'}).`;
}
