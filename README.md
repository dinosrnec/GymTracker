# Gym Tracker PWA

Osobna aplikacija za praćenje treninga, kilaže i napretka u teretani. Radi potpuno offline (svi podaci se spremaju lokalno na tvom telefonu, u IndexedDB), bez potrebe za backendom.

## Značajke

- **Kalendar treninga** – mjesečni pregled, dani s treningom su označeni.
- **Unos treninga** – bira se teretana (Five Star Fitness Varaždin, Gibi Gym Varaždin, Aquila Čakovec, ili "Ostalo" za bilo koju drugu), po vježbi se unose serije (kg × ponavljanja), uz mogućnost povezivanja vježbe s konkretnom spravom.
- **Tracking kilaže na vježbama** – iz Napretka se za svaku vježbu vidi graf max. kilaže kroz vrijeme.
- **Gamifikacija** – XP, levele, streak (dana zaredom), bedževi (prvi trening, 10/50/100 treninga, streakovi, PR-ovi...). Otključavanje PR-a (novi max na vježbi) daje bonus XP.
- **Dnevno vaganje** – unos tjelesne kilaže + graf kroz vrijeme.
- **Slike sprava** – fotkaš spravu u teretani (kamera se otvara direktno), upišeš naziv i bilješke (npr. podešavanje sjedala), sprema se po teretani da uvijek znaš koju spravu i kako koristiti kad odeš u drugu dvoranu.

## Kako objaviti na GitHub Pages

1. Napravi novi repozitorij na GitHubu (npr. `gym-tracker`).
2. Ubaci sve datoteke iz ovog foldera u root tog repozitorija (ne u podfolder).
3. Commit + push na `main` granu.
4. Na GitHubu: **Settings → Pages → Source** postavi na `Deploy from a branch`, granu `main`, folder `/ (root)`. Spremi.
5. Za par minuta aplikacija je dostupna na `https://<tvoj-username>.github.io/gym-tracker/`.
6. Otvori taj link na mobitelu u Chromeu/Safariju → izbornik → **"Dodaj na početni zaslon" / "Add to Home Screen"**. Nakon toga se otvara kao prava app, bez adresne trake.

## Napomene

- Svi podaci žive lokalno u browseru tog telefona (IndexedDB). Ako promijeniš telefon ili obrišeš podatke browsera, treninzi se gube — nema clouda ni logina. Ako ti kasnije zatreba sync između uređaja, najlakši put je dodati Firebase (Firestore + Storage) iza ovog istog frontenda.
- Graf treninga/kilaže koristi Chart.js s CDN-a (jsdelivr) — treba internet barem jednom (prvi put) da se učita; nakon toga service worker to kešira pa radi i offline.
- Slike sprava se prije spremanja automatski smanjuju (max širina ~640px, JPEG kompresija) da ne pune prostor pretjerano.
- Za dodavanje nove teretane u hodu: odaberi "Ostalo" u padajućem izborniku teretana pri unosu treninga i upiši naziv — ostaje zapamćeno za sljedeći put.

## Struktura projekta

```
index.html          – glavni HTML, svi tabovi/view-ovi
manifest.json        – PWA manifest (ikonice, ime, boje)
service-worker.js    – offline cache app shella
css/style.css        – sav styling (mobile-first, dark tema)
js/db.js             – IndexedDB wrapper (workouts, bodyweight, machines, meta)
js/gamification.js   – XP/level/streak/bedž logika (čiste funkcije)
js/app.js            – UI logika, rendering, event handleri
icons/               – app ikonice (192px, 512px)
```

Sljedeći koraci za brainstorm: multi-user/cloud sync (Firebase), PR notifikacije push, export/import podataka (backup u JSON), tjedni/mjesečni report napretka.
