// Service worker: pliki aplikacji najpierw z sieci (zawsze najnowsza wersja), bez sieci z kopii w telefonie.
// Biblioteki z CDN (Firebase, pdf.js) mają numer wersji w adresie, więc wystarczy raz je zapisać.
const WERSJA = 'bilans-0.7';
const PLIKI = [
  './', 'index.html', 'styl.css', 'manifest.webmanifest',
  'js/aplikacja.js', 'js/obliczenia.js', 'js/daty.js', 'js/magazyn.js', 'js/ikony.js', 'js/tekst.js', 'js/dane-testowe.js',
  'js/import-respo.js', 'js/synchronizacja.js', 'js/chmura.js', 'js/konfiguracja.js',
  'ikony/ikona-180.png', 'ikony/ikona-192.png', 'ikony/ikona-512.png',
];
const BIBLIOTEKI = ['https://www.gstatic.com/firebasejs/', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/'];

self.addEventListener('install', e => e.waitUntil(caches.open(WERSJA).then(c => c.addAll(PLIKI)).then(() => self.skipWaiting())));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(nazwy => Promise.all(nazwy.filter(n => n !== WERSJA).map(n => caches.delete(n)))).then(() => self.clients.claim()),
));

const zapamietaj = (z, o) => { if (o.ok) { const kopia = o.clone(); caches.open(WERSJA).then(c => c.put(z, kopia)); } return o; };
const zKopii = async z => (await caches.match(z, { ignoreSearch: true })) || (z.mode === 'navigate' ? caches.match('index.html') : undefined);

// Słaba sieć (np. na siłowni): po 3 s bierzemy kopię, żeby aplikacja nie wisiała; bez kopii czekamy na sieć.
function odpowiedz(z) {
  return new Promise(gotowe => {
    let wyslano = false;
    const wyslij = o => { if (!wyslano) { wyslano = true; gotowe(o); } };
    const zegar = setTimeout(async () => { const k = await zKopii(z); if (k) wyslij(k); }, 3000);
    fetch(z).then(o => { clearTimeout(zegar); wyslij(zapamietaj(z, o)); }, async () => {
      clearTimeout(zegar);
      wyslij((await zKopii(z)) || Response.error());
    });
  });
}

self.addEventListener('fetch', e => {
  const z = e.request;
  if (z.method !== 'GET') return;
  if (BIBLIOTEKI.some(p => z.url.startsWith(p))) {
    e.respondWith(caches.match(z).then(k => k || fetch(z).then(o => zapamietaj(z, o))));
  } else if (new URL(z.url).origin === location.origin) {
    e.respondWith(odpowiedz(z));
  }
});
