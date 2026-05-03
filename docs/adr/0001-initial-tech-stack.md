# ADR-0001: Kezdeti technológiai stack kiválasztása

- Dátum: 2025-10-17
- Státusz: Elfogadva (részben felülírva ADR-0002 által)

## Kontextus

Az InstaCover egy MVP AI borítógenerátor indie íróknak. A fő követelmények: prompt-alapú borítógenerálás és egyszerű felhasználókezelés. A projektet egyedül fejlesztem, ezért gyorsan prototípusozható stack szükséges. Az AI inference külső API-n fut, a backend fő feladata a user management, request kezelés és file storage.

## Döntés

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Flask (Python) + Gunicorn
- **Adatbázis:** PostgreSQL
- **Fájltárolás:** AWS S3
- **Auth:** Google OAuth

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| Django + React | Túl sok boilerplate MVP-hez |
| Next.js + Node.js | Python ökoszisztéma erősebb AI/ML integrációkhoz |
| Firebase | Vendor lock-in, limitált kontroll |

## Következmények

- Google OAuth → nincs saját password management, kevesebb security kockázat
- Flask + Python → natív AI API integrációk, erős ökoszisztéma
- React + TypeScript → típusbiztonság, gyors UI fejlesztés
- PostgreSQL + S3 → költséghatékony kis volumen mellett
