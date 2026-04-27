# InstaCover

Mesterséges intelligenciával működő könyvborító-generátor indie szerzők számára.

## Áttekintés

Az InstaCover lehetővé teszi önálló kiadású szerzők számára, hogy percek alatt professzionális minőségű könyvborítókat készítsenek mesterséges intelligencia segítségével. Ahelyett, hogy grafikusokat bíznának meg (20-200 dollár/borító) vagy bonyolult tervezőeszközökkel küzdenének, a szerzők egyszerűen leírják könyvüket, és az AI piacra kész borítókat generál.

Az alkalmazás nagy nyelvi modelleket (LLM) kombinál kreatív promptgeneráláshoz, valamint korszerű képgenerálási technológiát a borítók elkészítéséhez, professzionális tipográfiával kiegészítve.

## Főbb funkciók

- **AI-alapú generálás**: Írd le a könyvedet, és kapj professzionálisan megtervezett borítót
- **Stílusreferenciák**: Tölts fel példaborítókat a generálás vizuális stílusának irányításához
- **Többféle képarány**: Kindle, papírkötés, négyzet és egyéni méretek támogatása
- **Valós idejű visszajelzés**: WebSocket-alapú frissítések mutatják az egyes generálási lépéseket
- **Tipográfia integráció**: Automatikus cím- és szerzőnév-elhelyezés AI-optimalizált stílussal
- **Generálási előzmények**: Hozzáférés és letöltés az összes korábban generált borítóhoz
- **Kreditrendszer**: Generálásonkénti fizetési modell kezdeti ingyenes kreditekkel

## Architektúra

### Rendszerkomponensek

Az alkalmazás három fő rétegből áll:

**Frontend (React SPA)**: Egyoldalas alkalmazás, amely kezeli a felhasználói interakciókat, az autentikációt és a valós idejű kommunikációt a backenddel. A GenerationContext tartja karban a WebSocket kapcsolatot és a generálási állapotot, míg az AuthContext a Supabase-alapú session kezelésért felelős.

**Backend (Flask API)**: REST végpontokat és WebSocket eseménykezelőket biztosít. A szolgáltatások rétegben (services) található az üzleti logika: az LLM szolgáltatás promptokat generál, az Image szolgáltatás képeket kér a WaveSpeed API-tól, a Storage szolgáltatás pedig a Supabase tárolót kezeli.

**Külső szolgáltatások**:

- Supabase szolgáltatja az adatbázist (PostgreSQL), az autentikációt és az objektumtárolást
- OpenRouter biztosítja az LLM hozzáférést (Grok, Gemini modellek)
- WaveSpeed AI végzi a képgenerálást (Seedream V4.5 modell)

### Generálási folyamat

1. **Bevitel feldolgozása**: A felhasználó megadja a könyv adatait (cím, szerző, borítóötletek, műfaj). A frontend WebSocketen keresztül elküldi a `start_generation` eseményt a backendnek.
2. **Kredit ellenőrzés és levonás**: A backend ellenőrzi a felhasználó kreditegyenlegét, levonja a generálási költséget (3 kredit), majd létrehozza a Generation rekordot az adatbázisban "generating" státusszal.
3. **Prompt generálás**: Az LLM szolgáltatás elküldi a könyv adatait az OpenRouter API-nak, amely egy részletes, könyvborító-esztétikára optimalizált képgenerálási promptot ad vissza.
4. **Alapkép létrehozása**: Az Image szolgáltatás a WaveSpeed API-hoz küldi a promptot. A kép generálása aszinkron: a rendszer job ID-t kap vissza, majd polling-gal ellenőrzi az állapotot a kép elkészültéig.
5. **Tipográfia réteg**: Ha nem csak alapképet kér a felhasználó, egy második LLM hívás tipográfiai promptot generál, majd a WaveSpeed újabb képet készít a címmel és szerzőnévvel.
6. **Tárolás és kézbesítés**: A végleges kép feltöltődik a Supabase tárolóba, a Generation rekord frissül "completed" státuszra, és a frontend megkapja a `generation_completed` eseményt a signed URL-lel.

Minden lépésnél a backend `generation_progress` eseményeket küld, így a felhasználó valós időben látja a haladást.

### Stílusreferencia rendszer

A felhasználók feltölthetnek meglévő könyvborítókat stílusreferenciának. Feltöltéskor az LLM elemzi a képet és kinyeri:

- A vizuális hangulatot és színvilágot
- Az elrendezési mintákat
- Az illusztrációs szabályokat
- A tipográfiai jellemzőket

Generáláskor három referencia mód közül választhat a felhasználó:

- **Mindkettő**: A teljes stílus (vizuális + tipográfia) átvétele
- **Háttér**: Csak a vizuális elemek átvétele, új tipográfiával
- **Szöveg**: Csak a tipográfiai stílus átvétele, új vizuális elemekkel

### Valós idejű kommunikáció

A WebSocket kapcsolat (Socket.IO) biztosítja az azonnali visszajelzést:

- `connect`: Autentikáció JWT tokennel, aktív generálás visszaállítása
- `start_generation`: Új generálás indítása
- `generation_started`: Visszaigazolás a generálás megkezdéséről
- `generation_progress`: Lépésenkénti haladási információ
- `generation_completed`: Végleges eredmény signed URL-lel
- `generation_failed`: Hibajelzés
- `cancel_generation`: Generálás megszakítása (kredit visszatérítéssel)

## Technológiai stack

### Frontend

- React 19 TypeScript-tel
- Vite build eszköz
- TailwindCSS stílusokhoz
- Socket.IO valós idejű kommunikációhoz
- React Query adatlekéréshez
- Framer Motion animációkhoz

### Backend

- Flask és Flask-SocketIO
- Gunicorn production deploymenthez
- Pillow képfeldolgozáshoz
- Flask-Limiter rate limitinghez

### Külső szolgáltatások

- **Supabase**: PostgreSQL adatbázis, autentikáció és objektumtárolás
- **OpenRouter**: LLM gateway (Grok, Gemini modellek) promptgeneráláshoz
- **WaveSpeed AI**: Képgenerálás (Seedream V4.5 modell)

### Infrastruktúra

- Docker és Docker Compose konténerizációhoz
- Nginx frontend statikus fájlok kiszolgálásához
- GitHub Actions CI/CD-hez

## Projekt struktúra

```
├── backend/
│   ├── app/
│   │   ├── models/       # Adatmodellek (Generation, User, StyleReference)
│   │   ├── routes/       # REST API végpontok (auth, generate)
│   │   ├── services/     # Üzleti logika
│   │   │   ├── llm_service.py      # OpenRouter API integráció
│   │   │   ├── image_service.py    # WaveSpeed API integráció
│   │   │   ├── storage_service.py  # Supabase tároló kezelés
│   │   │   ├── pipeline_service.py # Generálási folyamat orkesztráció
│   │   │   └── credit_service.py   # Kreditrendszer kezelés
│   │   ├── sockets/      # WebSocket kezelők és háttérfeladatok
│   │   └── utils/        # Validáció és adatbázis segédeszközök
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/   # React UI komponensek
│       ├── context/      # Állapotkezelők
│       │   ├── AuthContext.tsx       # Autentikáció és session
│       │   ├── GenerationContext.tsx # WebSocket és generálási állapot
│       │   └── GenerationFormContext.tsx # Űrlap állapot
│       ├── hooks/        # Egyéni React hookök
│       ├── pages/        # Route oldal komponensek
│       ├── services/     # API kliens (Axios)
│       └── lib/          # Supabase és Socket.IO kliensek
├── sprints/              # Projekt dokumentáció sprintenként
└── scripts/              # Validációs és segédeszközök
```

## Adatmodell

### Users

Felhasználói adatok tárolása: azonosító, email, név, profilkép, preferenciák, kreditegyenleg, admin státusz.

### Generations

Generálási rekordok: könyv adatok (cím, szerző, ötletek, műfaj), képarány, stílusreferencia kapcsolat, generált promptok, kép URL-ek, státusz és haladási információk.

### StyleReferences

Stílusreferencia képek: feltöltött kép elérési útja, LLM által generált stíluselemzés (hangulat, elrendezés, illusztrációs szabályok, tipográfia).

### Invites

Meghívókódok a zárt béta hozzáféréshez: kód, létrehozó, lejárat, felhasználás időpontja.

## Fejlesztői környezet beállítása

### Előfeltételek

- Python 3.11+
- Node.js 20+
- Docker (opcionális)
- Supabase fiók
- OpenRouter API kulcs
- WaveSpeed API kulcs

### Supabase beállítása

1. Hozz létre egy projektet a [supabase.com](https://supabase.com) oldalon
2. Futtasd a `backend/supabase/bootstrap_idempotent.sql` fájl tartalmát a Supabase SQL Editor-ban — ez létrehozza az összes táblát, indexet, RLS policy-t és RPC függvényt
3. Futtasd a `backend/supabase/seed_dev.sql` fájlt a Supabase SQL Editor-ban — ez létrehoz egy `DEV-SETUP` meghívókódot, ami soha nem jár le
4. Hozz létre egy storage bucket-et: Storage > New Bucket > név: `covers`

### Környezeti változók

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Töltsd ki mindkét `.env` fájlt a saját Supabase, OpenRouter és WaveSpeed adataiddal.

### Indítás Docker nélkül

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

**Frontend:**

```bash
cd frontend
npm ci
npm run dev
```

### Indítás Dockerrel

Frissítsd a `docker-compose.yml`-ben a frontend build args-okat a saját értékeidre, majd:

```bash
docker compose up --build
```

### Regisztráció

Az alkalmazás meghívó alapú. A `seed_dev.sql` futtatása után a fejlesztői meghívókóddal regisztrálhatsz:

```
http://localhost:5174/login?invite=DEV-SETUP
```
