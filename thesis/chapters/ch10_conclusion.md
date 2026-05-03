# 10. Összefoglalás

## 10.1. Eredmények

Szakdolgozatomban bemutattam az InstaCover webalkalmazást, egy AI-alapú könyvborító-generátort indie szerzők számára. Az alkalmazás sikeresen egyesíti a nagy nyelvi modelleket, a képgenerálási technológiát és a szerver oldali renderelést egy egységes, felhasználóbarát felületen.

A főbb megvalósított képességek:

- **Háromágú generálási pipeline** — Standard, stílusreferencia és sablon módok, amelyek eltérő felhasználói igényeket szolgálnak ki 2-5 lépéses, automatikus folyamatokkal
- **Stílusreferencia rendszer** — Feltöltött borítók AI-alapú dekompozíciója és a stílus szelektív reprodukciója (vizuális, tipográfiai, vagy mindkettő)
- **Valós idejű kommunikáció** — WebSocket-alapú, lépésenkénti visszajelzés a generálási folyamatról, állapot-visszaállítással és megszakítási lehetőséggel
- **Biztonsági réteg** — Row-Level Security, prompt injection detektálás, atomikus kredit-műveletek, rate limiting
- **Automatizált minőségbiztosítás** — 204 backend teszt, CI/CD pipeline, TypeScript típusellenőrzés

A zárt béta tesztelés során a rendszer megbízhatóan működött, a felhasználók sikeresen generáltak borítókat különböző pipeline-okon keresztül.

## 10.2. Tapasztalatok

A fejlesztés során több fontos tanulságot szűrtem le:

**A prompt engineering iteratív folyamat.** A generálási minőség legnagyobb mértékben a prompt szövegetől függ. Az externalizált `prompts.json` lehetővé tette, hogy a promptokat kódváltoztatás nélkül finomítsam — ez kulcsfontosságú volt az iteratív javításhoz.

**Az aszinkron job-kezelés komplexitást ad.** A WaveSpeed API aszinkron modellje (submit → poll) robusztus hibakezelést igényel: timeout, retry, stale detection. A polling mechanizmus egyszerűbb egy message queue-nál, de figyelni kell a végtelen ciklus és erőforráspazarlás kockázatára.

**A lépésenkénti kredit-levonás méltányosabb.** Az előre levonás + visszatérítés modellel szemben a lépésenkénti levonás biztosítja, hogy sikertelen generálás esetén a felhasználó csak a ténylegesen elhasznált erőforrásokért fizet.

## 10.3. Továbbfejlesztési lehetőségek

A rendszer több irányban bővíthető:

- **Fizetési integráció** — Stripe vagy PayPal integráció, hogy a felhasználók önállóan vásárolhassanak krediteket (jelenleg admin által kiosztott)
- **Frontend tesztek** — Vitest és React Testing Library a kritikus komponensekhez, Playwright E2E tesztek a fő felhasználói folyamatokhoz
- **LoRA finomhangolás** — Egyéni stílusmodellek tanítása specifikus vizuális stílusokra, a stílusreferencia rendszer bővítéseként
- **Alternatív objektumtárolás** — Migrálás Cloudflare R2-re vagy AWS S3-ra a Supabase free tier tárhelykorlátainak megkerülésére
- **Szerver oldali események** — A polling helyett WebSocket push a WaveSpeed eredményeknél, ha az API támogatná

## 10.4. Záró gondolatok

Az InstaCover demonstrálja, hogy a modern AI szolgáltatások (LLM + képgenerálás) megfelelő orkesztrációval képesek egy korábban kizárólag emberi kreativitást igénylő feladatot — a könyvborító-tervezést — hozzáférhetővé tenni azok számára is, akik nem rendelkeznek grafikai ismeretekkel. A felhasználónak elegendő leírnia könyvét, és a rendszer perceken belül professzionális minőségű borítót ad.
