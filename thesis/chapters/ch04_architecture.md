# 4. Architektúra

Az InstaCover egy háromrétegű webalkalmazás, amely egyoldalas frontend-et (SPA), Python backend-et és külső szolgáltatásokat kombinál. Ebben a fejezetben bemutatom a rendszer komponenseit, azok kapcsolatát, az adatmodellt és a deployment architektúrát.

## 4.1. Rendszer áttekintés

Az alkalmazás három fő rétegből áll:

- **Frontend (React SPA)** — A felhasználói felületet szolgálja ki statikus fájlokként. A böngészőben fut, és REST API illetve WebSocket kapcsolaton keresztül kommunikál a backend-del.
- **Backend (Flask API)** — REST végpontokat és WebSocket eseménykezelőket biztosít. Itt fut az üzleti logika: a generálási pipeline-ok, az LLM integráció, a képgenerálási hívások és a kredit-kezelés.
- **Külső szolgáltatások** — Supabase[5] (adatbázis, autentikáció, fájltárolás), OpenRouter[8] (LLM hozzáférés) és WaveSpeed AI[9] (képgenerálás).

A rétegek közötti kommunikáció kizárólag HTTPS-en zajlik. A frontend és backend között kétféle csatorna működik: REST API a CRUD műveletekhez (generálási előzmények, stílusreferenciák, sablonok kezelése) és WebSocket a valós idejű generálási folyamathoz.

## 4.2. Frontend architektúra

A frontend egy React[1] alapú egyoldalas alkalmazás TypeScript[2]-ben, Vite[3] build eszközzel. Az alkalmazás állapotkezelése három React Context-re épül:

- **AuthContext** — A Supabase Auth integrációt kezeli: session menedzsment, token frissítés, felhasználói profil
- **GenerationContext** — A WebSocket kapcsolatot és a generálási állapotgépet tartja karban (idle → generating → completed/failed)
- **GenerationFormContext** — Az űrlap mezőinek állapota (cím, szerző, műfajok, beállítások)

A szerver-állapot lekérdezéséhez (generálási előzmények, stílusreferenciák listája, sablonok) a TanStack Query[19] könyvtárat használom, amely automatikus cache-elést, háttérfrissítést és optimista frissítéseket biztosít.

A routing védett útvonalakkal operál: a `/generate`, `/references`, `/history` és `/templates` oldalak csak autentikált felhasználók számára elérhetők. Nem autentikált felhasználók a `/login` oldalra irányítódnak.

## 4.3. Backend architektúra

A backend Flask[4] keretrendszerre épül, Flask-SocketIO kiegészítéssel a valós idejű kommunikációhoz. A belső felépítés a szolgáltatás-réteg mintát követi:

| Réteg | Felelősség | Példák |
|-------|------------|--------|
| Routes | HTTP végpontok, request validáció | `auth.py`, `generate.py`, `api_v1.py` |
| Sockets | WebSocket eseménykezelés | `handlers.py`, `tasks.py` |
| Services | Üzleti logika, külső API integráció | `pipeline_service.py`, `llm_service.py` |
| Models | Adatmodellek, szerializáció | `Generation`, `User`, `StyleReference` |
| Utils | Validáció, segédfüggvények | `validation.py`, `db.py` |

A szolgáltatások singleton példányok (`llm_service`, `image_service`, `storage_service`), amelyek a Flask alkalmazás kontextusából olvassák ki a konfigurációt az első híváskor (lazy inicializáció).

## 4.4. Adatmodell

Az adatbázis öt fő táblából áll, PostgreSQL-ben Supabase-en hostolva:

**Users** — Felhasználói adatok: azonosító, Supabase auth ID (`google_id`), email, név, kreditegyenleg, admin státusz, API token, preferenciák (JSONB).

**Generations** — Generálási rekordok: bemenet (cím, szerző, ötletek, műfaj, leírás), beállítások (képarány, pipeline típus, referencia mód), eredmények (base prompt, text prompt, kép URL-ek), és futási állapot (status, current_step, error_message).

**StyleReferences** — Stílusreferencia képek: eredeti kép útvonala, AI elemzés négy dimenzióban, származtatott variánsok útvonala (clean, text layer), detektált szövegek (JSONB).

**CoverTemplates** — Borítósablonok: felhasználó által definiált szövegdoboz-konfigurációk (`title_box`, `author_box` JSONB mezőkben), amelyek pozíciót, betűtípust, méretet és stílust határoznak meg.

**Invites** — Meghívókódok: kód, létrehozó, lejárat, felhasználás időpontja. A zárt béta hozzáférés-kezeléséhez.

A táblák közötti kapcsolatok:
- `generations.user_id → users.id` (CASCADE DELETE)
- `generations.style_reference_id → style_references.id` (SET NULL)
- `generations.cover_template_id → cover_templates.id` (SET NULL)
- `style_references.user_id → users.id` (CASCADE DELETE)
- `cover_templates.user_id → users.id` (CASCADE DELETE)

## 4.5. Deployment architektúra

Az alkalmazás Docker[10] konténerekben fut, két szolgáltatással:

- **instacover-api** — Python 3.11 alapú konténer Flask + Gunicorn-nal, Playwright/Chromium-mal a sablon-rendereléshez. Port: 5000 (belső), 7710 (külső).
- **instacover-web** — Többlépcsős build: Node.js 20-al fordít, majd Nginx Alpine-nal szolgálja ki a statikus fájlokat. Port: 80 (belső), 7711 (külső).

A konténerek egy közös Docker bridge hálózaton futnak. A külvilág felé Nginx Proxy Manager végzi a reverse proxy feladatot és a TLS terminációt, a domain pedig Cloudflare mögött áll.

A production deployment lépései:
1. `docker compose up --build` a VPS-en
2. Az Nginx Proxy Manager proxyálja a 7710 és 7711 portokat
3. A Cloudflare biztosítja a DNS-t és az alap DDoS védelmet

## 4.6. Adatfolyam

Egy tipikus generálási kérés adatfolyama:

1. A felhasználó kitölti az űrlapot → a React app összegyűjti a `GenerationInput` objektumot
2. A WebSocket `start_generation` eseményt küld a backend-nek
3. A backend validálja a bemenetet, ellenőrzi a krediteket, létrehoz egy `Generation` rekordot
4. Háttérfeladat indul, amely a megfelelő pipeline-t futtatja
5. A pipeline LLM hívásokat tesz az OpenRouter-hez → promptot kap vissza
6. A pipeline képgenerálási kéréseket küld a WaveSpeed-nek → polling-gal várja az eredményt
7. A kész képek feltöltődnek a Supabase Storage-ba
8. A backend frissíti az adatbázist és `generation_completed` eseményt küld a kliensnek
9. A frontend megjeleníti az eredményt signed URL-lel

Minden lépésnél `generation_progress` események tájékoztatják a felhasználót a haladásról.

## 4.7. Összegzés

Az architektúra tudatosan egyszerű: két konténer, egy külső adatbázis-szolgáltatás, és két AI API. Nincs message queue, nincs microservice szétdarabolás, nincs saját auth rendszer. Ez a döntés a projekt méretéből adódik — egyedüli fejlesztőként a komplexitás minimalizálása fontosabb volt, mint az elméleti skálázhatóság.
