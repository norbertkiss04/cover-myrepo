# 11. Összefoglalás

## 11.1. Eredmények

Szakdolgozatomban bemutattam az InstaCover webalkalmazást, egy AI-alapú könyvborító-generátort indie szerzők számára. Az alkalmazás sikeresen egyesíti a nagy nyelvi modelleket, a képgenerálási technológiát és a szerver oldali renderelést egy egységes, felhasználóbarát felületen.

A főbb megvalósított képességek:

- Háromágú generálási pipeline standard, stílusreferencia és sablon módokkal, amelyek eltérő felhasználói igényeket szolgálnak ki 2-5 lépéses, automatikus folyamatokkal
- Stílusreferencia rendszer, amely feltöltött borítók AI-alapú dekompozícióját és a stílus szelektív reprodukcióját végzi (vizuális, tipográfiai, vagy mindkettő)
- WebSocket-alapú valós idejű kommunikáció lépésenkénti visszajelzéssel, állapot-visszaállítással és megszakítási lehetőséggel
- Többrétegű biztonsági modell Row-Level Security-vel, prompt injection detektálással, atomikus kredit-műveletekkel és rate limitinggel
- Automatizált minőségbiztosítás 204 backend teszttel, CI/CD pipeline-nal és TypeScript típusellenőrzéssel

A zárt béta tesztelés során a rendszer stabilan működött, és a pipeline-ok a különböző konfigurációkban sikeresen produkáltak borítókat.

## 11.2. Tapasztalatok

A fejlesztés során több fontos tanulságot szűrtem le:

**A prompt engineering iteratív folyamat.** A generálási minőség legnagyobb mértékben a prompt szövegetől függ. Az externalizált `prompts.json` lehetővé tette, hogy a promptokat kódváltoztatás nélkül finomítsam, ami kulcsfontosságú volt az iteratív javításhoz.

**Az aszinkron job-kezelés komplexitást ad.** A WaveSpeed API aszinkron modellje (submit → poll) robusztus hibakezelést igényel: timeout, retry, stale detection. A polling mechanizmus egyszerűbb egy message queue-nál, de figyelni kell a végtelen ciklus és erőforráspazarlás kockázatára.

**A lépésenkénti kredit-levonás méltányosabb.** Az előre levonás + visszatérítés modellel szemben a lépésenkénti levonás biztosítja, hogy sikertelen generálás esetén a felhasználó csak a ténylegesen elhasznált erőforrásokért fizet.

**Az AI-eszközök hatékony kiegészítők, de nem helyettesítők.** A fejlesztés során szisztematikusan alkalmaztam nagy nyelvi modelleket kódgenerálásra, tesztírásra és tervezési előkészítésre. A tapasztalat egyértelműen megmutatta, hogy ezek az eszközök valódi sebességnövelést hoznak jól behatárolt feladatoknál, ugyanakkor a mérnöki ítélőképességet nem pótolják: a generált kód validálása és a kritikus döntések meghozatala mindig emberi felelősség maradt. A részletes tapasztalatokat a 10. fejezet tartalmazza.

## 11.3. Továbbfejlesztési lehetőségek

A rendszer több irányban bővíthető:

- Stripe vagy PayPal fizetési integráció, hogy a felhasználók önállóan vásárolhassanak krediteket (jelenleg admin által kiosztott)
- Frontend tesztek Vitest-tel és React Testing Library-vel a kritikus komponensekhez, Playwright E2E tesztek a fő felhasználói folyamatokhoz
- LoRA finomhangolás egyéni stílusmodellek tanítására specifikus vizuális stílusokhoz, a stílusreferencia rendszer bővítéseként
- Migrálás alternatív objektumtárolásra (Cloudflare R2 vagy AWS S3) a Supabase free tier tárhelykorlátainak megkerülésére
- Szerver oldali események a polling helyett a WaveSpeed eredményeknél, ha az API támogatná

## 11.4. Záró gondolatok

Az InstaCover demonstrálja, hogy a modern AI szolgáltatások (LLM + képgenerálás) megfelelő orkesztrációval képesek egy korábban kizárólag emberi kreativitást igénylő feladatot, a könyvborító-tervezést, hozzáférhetővé tenni azok számára is, akik nem rendelkeznek grafikai ismeretekkel. A felhasználónak elegendő leírnia könyvét, és a rendszer perceken belül professzionális minőségű borítót ad.
