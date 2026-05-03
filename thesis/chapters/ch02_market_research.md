# 2. Piackutatás

Az InstaCover fejlesztése előtt piackutatást végeztem, hogy megértsem a meglévő megoldásokat, azonosítsam a piaci rést, és validáljam a projekt értékajánlatát. Ebben a fejezetben összefoglalom a versenytárs-elemzés eredményeit és az önálló szerzők (indie authors) igényeinek feltárását.

## 2.1. Célcsoport

A self-publishing piac évről évre növekszik[18]: egyre több szerző publikál könyvet hagyományos kiadó nélkül, platformokon mint az Amazon Kindle Direct Publishing. Ezeknek a szerzőknek borítóra van szükségük, de jellemzően nem rendelkeznek grafikai ismeretekkel, és a költségérzékenység magas — különösen a kezdők körében.

A tipikus fájdalompontok (felhasználói interjúk alapján):
- Egy grafikus 20-200 dollárt kér borítónként, ami több könyv esetén jelentős költség
- A DIY eszközök (pl. Canva) sok időt igényelnek és a végeredmény amatőr hatású
- A sorozat-borítók vizuális konzisztenciáját nehéz fenntartani eszközváltás nélkül

## 2.2. Versenytárs-elemzés

Három fő versenytársat vizsgáltam meg:

### 2.2.1. Canva AI Book Cover Generator[12]

A Canva egy általános célú grafikai tervezőeszköz, amely rendelkezik AI képgenerálási funkcióval (Magic Media). Erősségei a nagy sablonkönyvtár és az ismert márkanév. Gyengesége, hogy az AI jellemzően csak a háttérképet generálja — a tipográfia, az elrendezés és a finomítás manuálisan szükséges. Az ingyenes verzió korlátozott, a Pro verzió havi előfizetést igényel.

### 2.2.2. TheBookCoverDesigner[14]

Premade borítókat árusít, amelyek megvásárlás után egyedi címmel és szerzőnévvel kerülnek kiszolgálásra. Az árak 50-159 dollár között mozognak. Nincs AI generálás és nincs testreszabhatóság a premade-eken túl — ha a felhasználó nem talál megfelelő borítót a katalógusban, más megoldást kell keresnie.

### 2.2.3. GetCovers[13]

Emberi grafikusok készítenek egyedi borítókat $10-35 árkategóriában. Az előnye az emberi kreativitás és az "unlimited revisions" ígéret. A hátránya, hogy nem azonnali (napokat vesz igénybe) és a minőség változó.

## 2.3. Piaci rés

| Szempont | Canva | TheBookCoverDesigner | GetCovers | **InstaCover** |
|----------|-------|---------------------|-----------|----------------|
| AI generálás | Részleges | Nincs | Nincs | Teljes pipeline |
| Tipográfia | Manuális | Fix premade | Emberi | AI + sablon |
| Stílus-konzisztencia | Nincs | Nincs | Emberi | Stílusreferencia |
| Azonnali eredmény | Részleges | Igen (premade) | Nem | Igen |
| Költség | Havi díj | Per borító | Per borító | Kredit-alapú |

Az InstaCover egyedülálló kombinációja: **teljes automatizáció** (a felhasználó leírja a könyvét és kap kész borítót), **stílus-reprodukció** (meglévő borító stílusának átvétele), és **azonnali kiszolgálás** (másodpercek alatt). Ezeket a képességeket egyetlen versenytárs sem kínálja együtt.

## 2.4. Értékajánlat

Az InstaCover értékajánlata: AI-alapú könyvborító-generátor indie szerzőknek, amely LLM prompttervezést, képgenerálást és automatikus tipográfiát kombinál egy többlépéses, valós idejű pipeline-ban. A felhasználónak elegendő megadnia a könyve alapadatait, és perceken belül professzionális minőségű borítót kap.
