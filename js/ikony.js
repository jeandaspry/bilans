// Ikony liniowe 24×24 rysowane ręcznie; kolor z currentColor.
const ikona = sciezki => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${sciezki}</svg>`;

export const IKONY = {
  dzisiaj: ikona('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>'),
  historia: ikona('<path d="M5 20v-8M12 20V6M19 20v-5"/>'),
  posilki: ikona('<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 20h6M10 7.5c0-1.2 1-1.6 1-2.8M14 7.5c0-1.2 1-1.6 1-2.8"/>'),
  ustawienia: ikona('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  plus: ikona('<path d="M12 5v14M5 12h14"/>'),
  serce: ikona('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>'),
  kosz: ikona('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>'),
  x: ikona('<path d="M6 6l12 12M18 6L6 18"/>'),
  hantla: ikona('<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  szukaj: ikona('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>'),
  lewo: ikona('<path d="M15 5l-7 7 7 7"/>'),
  prawo: ikona('<path d="M9 5l7 7-7 7"/>'),
};
