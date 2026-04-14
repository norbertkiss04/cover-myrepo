# User Journeys — InstaCover

## Journey 1: Első könyvborító generálása

**Persona:** Anna, önálló kiadású fantasy regényíró, aki gyorsan szeretne professzionális megjelenésű borítót a következő könyvéhez. Első alkalommal használja az InstaCoveret.

**Belépési pont:** Direkt link az alkalmazásra (marketing email vagy ismerős ajánlása alapján)

### Lépések

1. **S01 — Home**
   - Anna megnyitja az InstaCover főoldalát
   - Látja a "Book covers made in minutes, not months" üzenetet és a funkciók összefoglalóját
   - A "Start Creating" gombra kattint
   - *Hibaág: Nincs*

2. **S02 — Login/Register**
   - Anna az "Sign Up" fülre vált
   - Kitölti: Name, Email, Invite code (amit emailben kapott), Password, Confirm Password
   - A jelszó erősség indikátor mutatja, hogy megfelelő-e a jelszó
   - A "Create Account" gombra kattint
   - *Hibaág: Ha az invite kód érvénytelen → "Invalid or expired invite code" hibaüzenet; Ha az email már foglalt → "Email already registered" hibaüzenet; Ha a jelszó nem elég erős → Jelszó követelmények pirossal jelölve*

3. **Email megerősítés** (külső)
   - Anna megkapja a megerősítő emailt
   - A linkre kattintva visszakerül az alkalmazásba
   - *Hibaág: Ha nem érkezik email → Spam mappa ellenőrzése, újraküldés lehetőség*

4. **S05 — Generate**
   - Anna automatikusan a Generate oldalra kerül bejelentkezés után
   - Kitölti a könyv adatait:
     - Book Title: "The Dragon's Legacy"
     - Author Name: "Anna Wilson"
     - Cover Ideas: "Dark fantasy, epic battle scene, dragon breathing fire over a medieval castle"
     - Aspect Ratio: Kindle Standard (2:3)
   - Az "Add field" gombbal hozzáadja a "Genres" mezőt
   - Kiválasztja: Fantasy, Adventure
   - A "Generate (7 credits)" gombra kattint
   - *Hibaág: Ha nincs elég kredit → "Not enough credits" üzenet, gomb letiltva*

5. **S05 — Generate (generálás folyamatban)**
   - A Progress panel megjelenik a jobb oldalon
   - Anna valós időben látja a lépéseket:
     - "Crafting the perfect scene..." (LLM prompt generálás)
     - "Bringing your vision to life..." (Képgenerálás)
     - "Adding the finishing touches..." (Tipográfia)
   - *Hibaág: Ha a generálás sikertelen → Piros hibaüzenet, kredit visszatérítés, "Dismiss" gomb*

6. **S05 — Generate (eredmény)**
   - A kész borító megjelenik a Result panelen
   - Anna megtekinti a borítót, elégedett az eredménnyel
   - A "Download" gombra kattint és letölti a PNG fájlt
   - *Hibaág: Nincs*

**Sikerkritérium:** Anna sikeresen letöltötte az első AI-generált könyvborítóját.

**Mért időtartam:** ~3-5 perc (regisztráció + generálás + letöltés), ebből a generálás ~45 másodperc.

---

## Journey 2: Stílusreferencia használata konzisztens borítósorozathoz

**Persona:** Márk, romantikus regények szerzője, aki egy háromkötetes sorozatot ad ki. Az első kötet borítója már elkészült egy grafikusnál, és szeretné, ha a további kötetek hasonló stílusúak lennének.

**Belépési pont:** Direkt belépés a /generate oldalra (már regisztrált felhasználó)

### Lépések

1. **S05 — Generate**
   - Márk belép az alkalmazásba, a Generate oldalra kerül
   - Látja, hogy a "Style Reference" dropdown üres
   - A "Create one" linkre kattint
   - *Hibaág: Nincs*

2. **S07 — Style References**
   - Márk az üres állapotú referencia oldalon van
   - A "Drop an image here, click to upload, or paste from clipboard" területre húzza az első kötet borítóját
   - Alternatíva: Ctrl+V-vel beilleszti a vágólapról
   - "Uploading image..." üzenet jelenik meg
   - *Hibaág: Ha a fájl túl nagy (>5MB) → "File too large" hibaüzenet; Ha nem kép formátum → "Please select an image file" hibaüzenet*

3. **S07 — Style References (feltöltés után)**
   - A kép megjelenik a galériában
   - Márk a képre viszi az egeret, megjelenik az overlay
   - A ceruza ikonra kattint és átnevezi: "Love in Paris Series - Cover Style"
   - A fogaskerék (Cog) ikonra kattint a beállításokhoz
   - *Hibaág: Nincs*

4. **S07 — Style Reference Modal (♦)**
   - A modal megnyílik a stílus részleteivel
   - Látja az AI által kinyert stíluselemeket (hangulat, színek, tipográfia)
   - Bezárja a modalt
   - A Navbar-on a "Generate" linkre kattint
   - *Hibaág: Nincs*

5. **S05 — Generate**
   - Márk kitölti a második kötet adatait:
     - Book Title: "Summer in Provence"
     - Author Name: "Mark Stevens"
     - Cover Ideas: "Lavender fields, romantic couple, sunset"
   - A "Style Reference" dropdown-ban kiválasztja: "Love in Paris Series - Cover Style"
   - A "Reference Mode" beállítást "Both"-ra hagyja (teljes stílus átvétel)
   - A "Generate" gombra kattint
   - *Hibaág: Ha a referencia törlésre került → Dropdown frissül, "None" lesz kiválasztva*

6. **S05 — Generate (eredmény)**
   - A generált borító stílusa konzisztens az első kötettel
   - Márk letölti a képet
   - *Hibaág: Nincs*

**Sikerkritérium:** Márk sikeresen generált egy olyan borítót, amely vizuálisan illeszkedik a meglévő sorozatához.

**Mért időtartam:** ~2-3 perc (feltöltés + generálás + letöltés)

---

## Journey 3: Sablon-alapú borító létrehozása egyedi tipográfiával

**Persona:** Kata, krimi szerző, aki saját tipográfiai stílust szeretne minden könyvén használni. A cím mindig felül, nagybetűs, a szerző név alul, dőlt betűvel.

**Belépési pont:** Navbar "Templates" link (már belépett felhasználó)

### Lépések

1. **S09 — Templates**
   - Kata a Templates oldalra navigál
   - Üres állapot: "Start new layout" kártya látható
   - A "New Template" gombra kattint
   - *Hibaág: Nincs*

2. **S09 — Templates (szerkesztő)**
   - Megjelenik a draft sablon az alapértelmezett beállításokkal
   - A "Template name" mezőbe beírja: "Kata Krimi Style"
   - A "Cover format" dropdown-ban kiválasztja: "Kindle Standard (2:3)"
   - *Hibaág: Nincs*

3. **S09 — Templates (cím szövegdoboz szerkesztése)**
   - A "Title" gombot választja (már aktív alapból)
   - A Canvas-on húzza a cím szövegdobozt a borító felső részére
   - A Layout panelen finomhangolja: Y: 8%, Height: 20%
   - Typography beállítások:
     - Font: "Bebas Neue"
     - Size: 140
     - Weight: 700
     - Uppercase: bekapcsolva
     - Text align: Center
   - *Hibaág: Nincs*

4. **S09 — Templates (szerző szövegdoboz szerkesztése)**
   - Az "Author" gombra kattint
   - A Canvas-on húzza a szerző szövegdobozt a borító alsó részére
   - Layout: Y: 85%, Height: 8%
   - Typography:
     - Font: "Cormorant Garamond"
     - Size: 48
     - Italic: bekapcsolva
     - Uppercase: kikapcsolva
   - *Hibaág: Nincs*

5. **S09 — Templates (teszt és mentés)**
   - Az "Upload Image" gombbal feltölt egy teszt háttérképet
   - A "Test title" és "Test author" mezőket kitölti saját adataival
   - A "Render Test Preview" gombra kattint
   - Megtekinti a renderelt előnézetet
   - Elégedett, a "Save Changes" gombra kattint
   - "Template created" toast üzenet jelenik meg
   - *Hibaág: Ha a sablon név üres → "Template name is required" toast; Ha a renderelés sikertelen → "Failed to render preview" hibaüzenet*

6. **S05 — Generate**
   - Kata a Navbar-on a "Generate" linkre kattint
   - Kitölti a könyv adatait:
     - Book Title: "A gyilkos árnyéka"
     - Author Name: "Kata Kovács"
     - Cover Ideas: "Dark alley, mysterious figure, rain"
   - A "Cover Template" dropdown-ban kiválasztja: "Kata Krimi Style"
   - Látja: "Template mode is active. Text is rendered from template..."
   - Az Aspect Ratio automatikusan zárolódik a sablon formátumára
   - A "Generate" gombra kattint
   - *Hibaág: Ha a sablon törlésre került → Dropdown frissül, "None" lesz kiválasztva*

7. **S05 — Generate (eredmény)**
   - A borító elkészül a sablonban definiált tipográfiával
   - A cím és szerző név pontosan úgy jelenik meg, ahogy a sablonban beállította
   - Kata letölti a képet
   - *Hibaág: Nincs*

**Sikerkritérium:** Kata sikeresen létrehozott egy újrafelhasználható sablont és generált egy borítót vele.

**Mért időtartam:** ~5-7 perc (sablon létrehozás + tesztelés + generálás)
