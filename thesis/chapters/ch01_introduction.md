# 1. Bevezetés

A self-publishing iparág az elmúlt évtizedben robbanásszerű növekedésen ment keresztül[18]. Az Amazon Kindle Direct Publishing és hasonló platformok lehetővé tették, hogy bárki publikáljon könyvet hagyományos kiadó nélkül. Ezzel együtt megnőtt az igény professzionális megjelenésű könyvborítók iránt, mivel a borító a vásárlói döntés egyik legfontosabb vizuális tényezője.

Az önálló szerzők (indie authors) számára a borítókészítés hagyományosan két úton érhető el: grafikus megbízása (20-200 dollár/borító, napok-hetek átfutással) vagy saját készítés általános célú tervezőeszközökkel (időigényes, gyakran amatőr eredménnyel). Egyik megoldás sem ideális költségérzékeny, több könyvet publikáló szerzők számára.

Szakdolgozatomban egy webalkalmazást mutatok be, amely mesterséges intelligencia segítségével automatizálja a könyvborító-készítés teljes folyamatát. Az **InstaCover** nevű alkalmazás nagy nyelvi modelleket (LLM) kombinál kreatív promptgeneráláshoz, korszerű képgenerálási technológiát a vizuális elemek elkészítéséhez, és automatikus tipográfiát a szöveges réteg hozzáadásához.

## 1.1. A probléma

A meglévő megoldások nem képesek egyszerre teljesíteni az alábbi elvárásokat:

- Teljes automatizáció a leírástól a kész borítóig, manuális tervezés nélkül
- Vizuális konzisztencia sorozat-borítók között
- Másodpercek-percek alatti kiszolgálás
- Néhány centes egységköltség borítónként

## 1.2. A megoldás

Az InstaCover három generálási pipeline-t implementál, amelyek eltérő felhasználói igényeket szolgálnak ki:

1. A standard pipeline a felhasználó könyvadatai (cím, szerző, műfaj, borítóötletek) alapján generál teljes borítót
2. A stílusreferencia pipeline egy feltöltött borítókép vizuális stílusát elemzi AI-val és reprodukálja
3. A sablon pipeline HTML/CSS sablonon alapuló, pixelpontos tipográfiai kontrollt biztosít

Az alkalmazás valós idejű visszajelzést ad a generálási folyamatról WebSocket-en keresztül, kreditrendszerrel biztosítja a költségkontrollt, és zárt béta meghívó-rendszerrel kezeli a hozzáférést.

## 1.3. A dolgozat felépítése

A dolgozat a következőképpen épül fel: a 2. fejezetben a piackutatás eredményeit mutatom be, a 3. fejezetben a felhasznált technológiákat. A 4. fejezet a rendszer architektúráját tárgyalja. Az 5. fejezet a mesterséges intelligencia alapú generálási pipeline technikai részleteit mutatja be, a 6. fejezet pedig a stílusreferencia rendszert. A 7. fejezet a valós idejű kommunikációt, a 8. fejezet a biztonságot és kreditrendszert, a 9. fejezet a tesztelést és CI/CD-t ismerteti. A 10. fejezetben az MI-eszközök használatáról adok önreflexiót, végül a 11. fejezetben összefoglalom az eredményeket és a továbbfejlesztési lehetőségeket.
