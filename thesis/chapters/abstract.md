# Tartalmi összefoglaló

Szakdolgozatomban az InstaCover webalkalmazást mutatom be, amely mesterséges intelligencia segítségével automatizálja a könyvborító-készítés teljes folyamatát indie szerzők számára. Az alkalmazás nagy nyelvi modelleket (LLM) kombinál kreatív promptgeneráláshoz, korszerű képgenerálási technológiát a vizuális elemek elkészítéséhez, és automatikus tipográfiát a szöveges réteg hozzáadásához.

A rendszer három generálási pipeline-t implementál: a standard pipeline könyv adatokból generál borítót, a stílusreferencia pipeline feltöltött borítók vizuális stílusát reprodukálja AI-alapú elemzés alapján, a sablon pipeline pedig HTML/CSS sablonon alapuló pixelpontos tipográfiai kontrollt biztosít szerver oldali Chromium rendereléssel.

A technikai megvalósítás React frontend-re, Flask backend-re és Supabase szolgáltatásokra (PostgreSQL, autentikáció, fájltárolás) épül. A generálási folyamat valós időben követhető WebSocket-en keresztül. A biztonságot Row-Level Security policy-k, prompt injection detektálás, input validáció és atomikus kreditműveletek biztosítják.

A dolgozat bemutatja a többlépéses pipeline architektúra tervezését, a prompttervezés módszertanát, az aszinkron képgenerálási integráció megvalósítását, valamint a stílusreferencia rendszer működését (képdekompozíció, variáns-cache-elés, háromféle blending mód). A 204 automatizált backend teszt és a CI/CD pipeline biztosítja a kód minőségét. A dolgozat kitér a fejlesztés során alkalmazott MI-eszközök használatának tapasztalataira is.
