# 3. Felhasznált technológiák

Ebben a fejezetben röviden bemutatom a projekt során felhasznált technológiákat és könyvtárakat, kitérve arra, hogy milyen szerepet töltenek be a rendszerben.

## 3.1. Frontend technológiák

**React[1]** — Komponens-alapú JavaScript UI könyvtár egyoldalas alkalmazások építéséhez. A választásom azért esett rá, mert kiterjedt ökoszisztémával rendelkezik (React Query, Framer Motion), és a komplex állapotgépek (generálási folyamat) kezeléséhez a Context API és hookök jól használhatók.

**TypeScript[2]** — A JavaScript típusos kiterjesztése, amely fordítási időben deríti fel a típushibákat. A generálási pipeline konfigurációs objektumai (referencia mód, blending mód, képarány) számos opcionális mezővel rendelkeznek, ahol a típusbiztonság megakadályozza a futásidejű hibákat.

**Vite[3]** — Modern frontend build eszköz, amely natív ES modulokat használ fejlesztés közben. A hagyományos bundlerekhez (Webpack) képest nagyságrendekkel gyorsabb fejlesztői szervert ad.

**TailwindCSS[7]** — Utility-first CSS keretrendszer, amely előre definiált osztályokkal működik. Nem kell egyéni CSS fájlokat írni; a stílus közvetlenül a JSX-ben jelenik meg.

**TanStack Query[19]** — Szerver-állapot kezelő könyvtár React-hez. Automatikus cache-elést, háttérfrissítést és loading/error állapotokat biztosít a REST API hívásokhoz.

**Framer Motion[20]** — Deklaratív animációs könyvtár React-hez. A generálási progress panel átmeneteinek és az oldal-váltás animációknak a megvalósításához használom.

**Socket.IO kliens** — A Socket.IO[6] JavaScript kliens oldali könyvtára, amely WebSocket kapcsolatot épít fel a backend-del. Automatikus újracsatlakozást és esemény-alapú kommunikációt biztosít.

## 3.2. Backend technológiák

**Flask[4]** — Lightweight Python web keretrendszer. Minimális beépített funkcionalitással rendelkezik, ami lehetővé teszi, hogy csak a szükséges kiegészítőket használjam. A Python ökoszisztéma (Pillow, requests) és a natív Socket.IO támogatás volt a fő motiváció.

**Flask-SocketIO** — Flask kiegészítő, amely WebSocket támogatást ad a Socket.IO protokollon keresztül. Szoba-alapú üzenetküldést és háttérfeladat-kezelést biztosít.

**Gunicorn** — Production-ready Python WSGI/ASGI szerver. A fejlesztői Flask szerver helyett ez szolgálja ki az alkalmazást éles környezetben, worker folyamatokkal.

**Pillow (PIL)** — Python képfeldolgozó könyvtár. A szegélydetektáláshoz, képvágáshoz és a programmatikus alpha-kompozícióhoz (direct overlay blending) használom.

**Playwright** — Böngésző-automatizáló könyvtár, amely headless Chromium-ot vezérel. A sablon pipeline utolsó lépésében HTML/CSS-ből PNG képet renderel pixelpontos tipográfiával.

**Flask-Limiter** — Rate limiting kiegészítő, amely végpont-specifikus kérés-korlátokat állít be (pl. 30 kérés/perc).

## 3.3. Külső szolgáltatások

**Supabase[5]** — Nyílt forráskódú Firebase-alternatíva, amely PostgreSQL adatbázist, autentikációt (JWT-vel), objektumtárolást és Row-Level Security-t biztosít egyetlen platformon. A választásom azért esett rá, mert az RPC függvények lehetővé teszik az atomikus kredit-műveleteket, és az RLS policy-k adatbázis-szintű adatszigetelést adnak.

**OpenRouter[8]** — LLM API gateway, amely egyetlen felületen keresztül ad hozzáférést több LLM szolgáltató modelljéhez (Grok, Gemini). Előnye, hogy modellváltás egyetlen konfiguráció-módosítással lehetséges, kódváltoztatás nélkül.

**WaveSpeed AI[9]** — Képgenerálási API, amely a ByteDance Seedream V4.5 modelljét üzemelteti. Aszinkron job-kezeléssel működik: a kérés beküldése után polling-gal kérdezhető az eredmény. A modell jó minőség/ár arányt kínál könyvborítók generálásához.

## 3.4. Infrastruktúra

**Docker[10]** — Konténerizációs platform, amely biztosítja, hogy az alkalmazás azonos környezetben fusson fejlesztés és éles üzem során. A Docker Compose két szolgáltatást definiál: a backend-et és a frontend-et.

**GitHub Actions[11]** — CI/CD szolgáltatás, amely minden push és pull request esetén automatikusan futtatja a teszteket, a TypeScript type check-et és a lintert.

**Nginx** — HTTP szerver és reverse proxy. A frontend konténerben statikus fájlokat szolgál ki, a VPS szintjén pedig (Nginx Proxy Manager formájában) TLS terminációt és reverse proxy-t biztosít.
