# 10. Mesterséges intelligencia használata a fejlesztés során

Az InstaCover fejlesztése során a mesterséges intelligenciát tudatosan, munkaeszközként alkalmaztam: különböző fázisokban, különböző eszközökkel, megválasztott feladatokra. Ez a fejezet összefoglalja, hogyan integráltam ezeket az eszközöket a fejlesztési folyamatba, hogyan validáltam a kimeneteiket, és milyen tanulságokat szűrtem le a tapasztalatból.

## 10.1. Felhasznált eszközök

A fejlesztés során három fő eszközt alkalmaztam rendszeresen. A Claude Sonnet 4.5 és 4.6 modelleket (Anthropic) az OpenCode CLI-n keresztül értem el; ezek a legnehezebb feladatokban nyújtottak segítséget: összetett kódrészletek generálásában, refaktorálásban, a tesztkészlet bővítésében, valamint a szakdolgozat szövegének fogalmazásában. A GitHub Copilot az editorba integrálva folyamatos kiegészítési javaslatokat adott kisebb, rutinjellegű feladatoknál, ismétlődő validációs blokkok, TypeScript típusdefiníciók, SQL snippetek esetén. A ChatGPT-t (GPT-4o) főként ellenőrzési célra használtam: ha egy Claude által javasolt megoldásban nem voltam biztos, a ChatGPT-vel mint második véleménnyel vetettem össze az eredményt.

## 10.2. Felhasználási területek

A kódgenerálás volt a legintenzívebb felhasználási terület. Az AI-eszközök legnagyobb hozzáadott értékét a boilerplate-heavy rétegekben tapasztaltam: a Supabase RLS policy-k és a PostgreSQL RPC függvények megírásában, a pytest tesztkészlet bővítésében (a 204 teszt döntő részéhez vázlatot generáltam, amelyet átdolgoztam és kiegészítettem), valamint a Flask route-ok validációs rétegeinek kialakításában. Az architektúra-tervezés korábbi fázisában a technológiai döntések feltárásakor, például a Socket.IO és a Server-Sent Events összehasonlításánál, az eszközök gyors, strukturált áttekintést adtak, amelyet saját kutatással egészítettem ki. A szakdolgozat szövegéhez első draftokat generáltam fejezetenként, amelyeket ezt követően átdolgoztam, a személyes tapasztalatokkal gazdagítottam, és a saját stílusomhoz igazítottam.

## 10.3. Validáció és kritikus szemlélet

Az MI kimenetét minden esetben hipotézisként kezeltem, soha nem fogadtam el futtatás vagy ellenőrzés nélkül. Az elsődleges ellenőrzési módszerem a tesztek futtatása, a hivatalos dokumentáció összevetése és saját tudásomra való támaszkodás volt.

Két konkrét példán keresztül illusztrálom ezt a szemléletet. A Supabase RLS policy-k generálásakor a Claude egy olyan policy-t javasolt, amely szintaktikailag helyes volt, de logikailag hibás: az `INSERT` műveletre vonatkozó ellenőrzés `WITH CHECK` helyett `USING` feltételt alkalmazott, ami szilens adathozzáférési problémát eredményezhetett volna. A hibát csak a PostgreSQL dokumentáció újraolvasásával azonosítottam. Egy másik esetben az LLM-hívás retry-logikájának generálásakor a javasolt megvalósítás nem kezelte helyesen az exponenciális backoff-ot aszinkron kontextusban, és a problémát manuális kódátvizsgálással tártam fel.

## 10.4. Ahol nem alkalmaztam MI-t

Szándékosan nem támaszkodtam MI-re azokban a részekben, ahol a döntés domén-specifikus felelőssége az enyém volt. A kredit-levonási logika atomikusságának tervezésekor, ahol egy hiba közvetlen felhasználói következményekkel jár, a teljes folyamatot magam terveztem és implementáltam; az MI csupán a PostgreSQL szintaxis pontosításában segített. Hasonlóképpen, a prompt injection detektálási stratégiát és a biztonsági szűrőket magam alakítottam ki, az OWASP ajánlásaira és saját biztonsági megfontolásaimra támaszkodva. A szakdolgozat értékelő, reflektív részeit, köztük ezt a fejezetet is, saját tapasztalataim alapján fogalmaztam, nem generáltattam.

## 10.5. Tanulságok

Az MI-eszközök legnagyobb hozzáadott értékét a jól behatárolt, ismétlődő jellegű feladatoknál tapasztaltam: tesztek generálása meglévő funkciók alapján, ismert sémájú kódrészletek kiterjesztése, és szöveg első draftjainak elkészítése. Ezeken a területeken mérhető időmegtakarítást hoztak.

Megtanultam ugyanakkor, hogy az MI magabiztosan képes helytelenül válaszolni. A legnehezebb hibák azok voltak, ahol a kimenet szintaktikailag korrekt és plauzibilis volt, de szemantikailag hibás; ezeket automatikus tesztek nélkül nehéz észrevenni. A következő projektben hamarabb írnám meg az integrációs teszteket, hogy az AI-generált kód helyességét automatikusan, ne csak vizuálisan ellenőrizzem. A tapasztalat összességében megerősítette azt a szemléletet, hogy az MI hatékony eszköz, de nem helyettesíti a mérnöki ítélőképességet.
