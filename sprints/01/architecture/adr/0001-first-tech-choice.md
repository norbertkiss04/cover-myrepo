# 0001: Kezdeti technológiai stack kiválasztása

- Dátum: 2025-10-17
- Státusz: Elfogadva

## Kontextus
Az InstaCover egy MVP AI borítógenerátor indie íróknak. A fő követelmények: prompt-alapú borítógenerálás, LoRA model training felhasználói karakterekhez, és egyszerű SVG logo feltöltés/elhelyezés. A projektet kezdetben egyedül fejlesztem, ezért olyan stack-re van szükség, amit ismerek és gyorsan tudok vele prototípust készíteni. Az AI inference külső API-n fog futni (HuggingFace, Replicate), a backend fő feladata a user management, request kezelés és file storage. Az authentikáció Google OAuth-on keresztül történik a user experience egyszerűsítése érdekében.

## Döntés
A frontendhez **React + TypeScript** kombinációt választom, mert ismerem és gyorsan tudok vele mobil-responsive UI-t építeni. A backend **Flask** (Python), ami könnyű, gyorsan felállítható, és a Google OAuth integrációja jól dokumentált. Az adatbázis **PostgreSQL** a user account és metadata tároláshoz. A generált képeket és feltöltött SVG-ket **AWS S3**-on tárolom, ami kis volumen mellett költséghatékony ($0.023/GB/hó).

## Megfontolt alternatívák
- **Django + React**: erősebb admin panel és ORM, de túl sok boilerplate egy MVP-hez, lassabb indulás
- **Next.js + Node.js**: teljes JS stack lenne konzisztens, de Python ecosystem erősebb AI/ML integrációkhoz ha később saját inference kell
- **Firebase**: gyors MVP setup OAuth-tal, de vendor lock-in és limitált kontroll hosszútávon drágább lehet

## Következmények

**Pozitívak:**
- Google OAuth használata → nincs saját user/password management, email verification, kevesebb security kockázat
- Flask + Python könnyen integrálható külső AI API-kkal, Python ecosystem erős AI/ML területen
- React + TypeScript típusbiztonság, gyors UI fejlesztés
- PostgreSQL + S3 kombináció költséghatékony kis volumen mellett
- Külső AI API kezdetben fizetés használat alapján, nincs GPU infrastructure költség

**Kihívások később:**
- LoRA training hosszú futású job-okhoz háttérrendszer kell (queue system: Celery + Redis)
- Flask dev server nem production-ready, később Gunicorn + nginx deployment szükséges
- Nagy traffic esetén S3-hoz CloudFront CDN integráció ajánlott