// Wymyślone posiłki do sprawdzania aplikacji; nie pochodzą z planu dietetyka. Kolejność: nazwa, kategoria, kcal, B, T, W.
export const POSILKI_TESTOWE = [
  ['Owsianka proteinowa z bananem', 'Posiłek 1', 590, 38, 14, 78],
  ['Omlet ze szpinakiem i pieczywem', 'Posiłek 1', 525, 42, 22, 40],
  ['Jogurt naturalny z granolą i owocami', 'Posiłek 1', 560, 30, 18, 70],
  ['Kanapki z twarożkiem i rzodkiewką', 'Posiłek 1', 415, 34, 10, 48],
  ['Kurczak z ryżem i surówką', 'Posiłek 2', 690, 52, 16, 85],
  ['Wołowina z kaszą bulgur', 'Posiłek 2', 685, 48, 24, 70],
  ['Makaron z indykiem w pomidorach', 'Posiłek 2', 700, 50, 15, 92],
  ['Łosoś z ziemniakami i fasolką', 'Posiłek 2', 610, 40, 26, 55],
  ['Sałatka z kurczakiem i kaszą', 'Posiłek 3', 600, 45, 20, 60],
  ['Tortilla z indykiem i warzywami', 'Posiłek 3', 580, 40, 18, 65],
  ['Jajecznica z pomidorami i chlebem', 'Posiłek 3', 540, 32, 26, 45],
  ['Leczo z kiełbasą drobiową i ryżem', 'Posiłek 3', 600, 35, 18, 75],
  ['Skyr z owocami i orzechami', 'Przekąska', 365, 30, 12, 35],
  ['Koktajl białkowy z bananem', 'Przekąska', 335, 30, 6, 40],
  ['Jabłko i orzechy włoskie', 'Przekąska', 255, 5, 15, 25],
  ['Hummus z warzywami', 'Przekąska', 265, 10, 14, 25],
].map(([nazwa, kategoria, kcal, b, t, w]) => ({ nazwa, kategoria, kcal, b, t, w }));
