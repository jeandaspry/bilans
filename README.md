# Bilans

Prosty licznik kalorii i makro na telefon (aplikacja webowa, PWA): dzienny limit z planu dietetyka, posiłki z importowanych planów PDF, a trening z zegarka podnosi limit dnia.

- Działa w przeglądarce i po dodaniu do ekranu początkowego iPhone'a, także bez internetu.
- Dane są w Firebase (Firestore) i widzi je wyłącznie zalogowany właściciel konta; zob. `firestore.rules`.
- W repozytorium jest tylko kod: bez danych osobowych i bez treści planów.

Testy obliczeń, importu i synchronizacji: `testy.html`.
