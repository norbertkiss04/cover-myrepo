# Project Plan – InstaCover

## Egy mondatos értékajánlat

AI-alapú könyvborító-generátor indie szerzőknek, amely LLM prompttervezést, képgenerálást és automatikus tipográfiát kombinál egy többlépéses, valós idejű pipeline-ban

## Képességek

| Képesség | Kategória | Komplexitás | Miért nem triviális? |
|---|---|---|---|
| Többlépéses AI generálási pipeline | Value | L | 3 különböző pipeline (standard, style-ref, template), LLM prompt → képgenerálás → tipográfia láncolás, aszinkron job polling WaveSpeed API felé, lépésenkénti WebSocket progress |
| Stílusreferencia rendszer | Value | L | Feltöltött borítók AI-alapú dekompozíciója (hangulat, szín, elrendezés, tipográfia), 3 referencia mód (mindkettő/háttér/szöveg), az LLM kontextusba injektálás prompt engineering-et igényel |
| Sablon alapú generálás | Value | L | Playwright/Chromium szerver oldali renderelés, HTML/CSS sablonok dinamikus kitöltése, a generált kép és a tipográfiai réteg összeillesztése, böngésző-instancia menedzsment |
| Valós idejű WebSocket kommunikáció | Value | M | Socket.IO auth JWT tokennel, reconnect és aktív generálás visszaállítása, generálás megszakítás kredit-visszatérítéssel, állapotgép a frontend oldalon |
| Autentikáció és invite-kód zárt béta | Productization | M | Supabase Auth integráció (Google OAuth + email/password), invite-kód validáció regisztrációnál, role-based route védelem (admin panel), session kezelés React kontextussal |
| Kreditrendszer költségbecsléssel | Productization | M | Atomikus kredit-levonás Supabase RPC-vel (race condition védelem), per-művelet árazás (1 kredit/LLM, 6 kredit/kép), dinamikus költségbecslés a frontend-en pipeline típus alapján |
| REST API v1 token-alapú hozzáféréssel | Productization | M | Admin-only API token generálás és kezelés, bearer token autentikáció, az összes generálási pipeline elérhető programozottan, rate limiting |
| CI/CD pipeline, tesztek és Docker deployment | Productization | M | GitHub Actions (pytest + coverage, TypeScript check, lint), Dockerizált 2-konténeres architektúra (Flask + React/Nginx), Gunicorn production config |
| Input validáció és biztonsági réteg | Productization | S | Prompt injection detektálás, input sanitizáció és hossz-limitek, signed URL-ek (soha nem nyers storage path), RLS policy-k Supabase-ben |

## A legnehezebb rész

A többlépéses AI pipeline megbízható orkesztrálása. Egy generálás 2–4 külső API hívást láncol (OpenRouter LLM → WaveSpeed képgenerálás → opcionálisan újabb LLM + újabb képgenerálás), mindegyik eltérő hibamódokkal (timeout, rate limit, tartalomszűrő elutasítás, rossz minőségű output). A WaveSpeed API aszinkron: job ID-t ad vissza, utána polling-gal kell ellenőrizni az állapotot. Ha bármelyik lépés elbukik, a krediteket vissza kell téríteni, a felhasználót értesíteni kell WebSocket-en, és a részleges eredményeket konzisztens állapotban kell tartani az adatbázisban.

## Tech stack – indoklással

| Réteg | Technológia | Miért ezt és nem mást? |
|---|---|---|
| UI | React + TypeScript + Vite + TailwindCSS | React ökoszisztéma (React Query, Framer Motion), TypeScript típusbiztonság a komplex állapotgéphez (generálási folyamat), Vite gyors dev szerver |
| Backend / logika | Flask + Flask-SocketIO + Gunicorn | Lightweight Python backend, natív Socket.IO támogatás valós idejű kommunikációhoz, Python ökoszisztéma az AI/ML integrációkhoz (Pillow képfeldolgozás, prompt kezelés) |
| Adattárolás | Supabase (PostgreSQL + Object Storage) | Egy platformon: relációs DB + fájltárolás + RLS policy-k, beépített signed URL támogatás, RPC funkciók az atomikus kreditműveletekhez |
| Auth | Supabase Auth (Google OAuth + email/password) | Beépített JWT kezelés, social login támogatás, a Supabase ökoszisztémán belül marad (RLS-sel összekapcsolható), nem kell saját auth rendszert írni |
| AI szolgáltatások | OpenRouter (LLM) + WaveSpeed AI (képgenerálás) | OpenRouter: egy API mögött több LLM modell (Grok, Gemini), könnyű modellváltás; WaveSpeed: Seedream V4.5 modell jó minőség/ár aránnyal könyvborítókra |

## Ami kimarad (non-goals)

- LoRA finomhangolás egyedi stílusmodellekhez
- Fizetési integráció (Stripe, PayPal) — a kreditek admin által kiosztottak, nincs önkiszolgáló vásárlás

## Ami még nem tiszta

- Átváltsak-e másik objektumtárolóra (pl. Cloudflare R2, AWS S3), mert a Supabase free tier csak 1 GB tárhelyet ad és már majdnem betelt
