# Vertikális Szelet – AI Könyvborító Generálás

## Kiválasztott funkció

**"Felhasználóként AI-generált könyvborítót akarok létrehozni a könyvem adatai alapján."**

Ez a funkció a teljes alkalmazás magja: végigmegy az összes rétegen a felhasználói felülettől az adatbázisig és vissza, valós idejű visszajelzéssel.

## Érintett rétegek

### Frontend (React + TypeScript)
- **GeneratePage** (`frontend/src/pages/GeneratePage.tsx`) – Űrlap a könyvadatokkal (cím, szerző, leírás, műfaj, hangulat, stb.) és az eredmény megjelenítése
- **GenerationContext** (`frontend/src/context/GenerationContext.tsx`) – WebSocket állapotkezelés, generálási életciklus (idle → generating → completed/failed)
- **GenerationFormContext** (`frontend/src/context/GenerationFormContext.tsx`) – Űrlap állapot megőrzése navigáció között

### Valós idejű kommunikáció (Socket.IO)
- **Frontend**: `frontend/src/lib/socket.ts` – Socket.IO kliens JWT autentikációval
- **Backend**: `backend/app/sockets.py` – Socket eseménykezelők: `start_generation`, `generation_progress`, `generation_completed`, `generation_failed`, `cancel_generation`

### Backend (Flask)
- **Pipeline-ok** (`backend/app/routes/generate.py`):
  - **Standard pipeline** (2 vagy 4 lépés): prompt generálás → báziskép generálás → (tipográfia tervezés → szöveges borító generálás)
  - **Stílus-referenciás pipeline** (3 lépés): prompt generálás → referencia előkészítés → végleges borító generálás
- **LLM szolgáltatás** (`backend/app/services/llm_service.py`) – OpenRouter API (Grok modell) a képpromptok generálásához
- **Képgenerálás** (`backend/app/services/image_service.py`) – WaveSpeed Seedream API a borítóképek előállításához
- **Tároló szolgáltatás** (`backend/app/services/storage_service.py`) – Supabase Storage fájlkezelés (feltöltés, aláírt URL-ek)

### Adatbázis (Supabase / PostgreSQL)
- **`generations` tábla** – Tárolja az összes generálási adatot: felhasználói bemenetek, LLM promptok, kép URL-ek, státusz, lépésinformációk
- **`users` tábla** – Felhasználói adatok és kreditegyenleg
- **`style_references` tábla** – Feltöltött referencia képek és AI stíluselemzések

### Fájltárolás (Supabase Storage)
- **Privát bucket** – Az összes generált és feltöltött kép privát bucket-ben tárolódik
- **Aláírt URL-ek** – 1 órás lejárati idejű aláírt URL-ek a képek biztonságos eléréséhez

## Adatáramlás

```
1. Felhasználó kitölti az űrlapot (GeneratePage)
           ↓
2. Socket.IO emit: 'start_generation' + űrlapadatok
           ↓
3. Backend: kredit levonás, DB rekord létrehozás (status: 'generating')
           ↓
4. Socket.IO emit: 'generation_started' → Frontend állapotváltás
           ↓
5. Háttérfeladat indul (socketio.start_background_task)
   ├── Lépés 1: LLM prompt generálás (OpenRouter/Grok)
   │   └── Socket emit: 'generation_progress' (step 1/N)
   ├── Lépés 2: Képgenerálás (WaveSpeed Seedream)
   │   └── Socket emit: 'generation_progress' (step 2/N)
   ├── [Lépés 3-4: Tipográfia + végleges borító, ha van szöveg]
   │   └── Socket emit: 'generation_progress' (step 3-4/N)
   └── Képek feltöltése Supabase Storage-ba
           ↓
6. DB frissítés: status → 'completed', kép URL-ek mentése
           ↓
7. Socket.IO emit: 'generation_completed' + generálás adatok (aláírt URL-ekkel)
           ↓
8. Frontend: ResultPanel megjelenítése a kész borítóval
```

## Minőségbiztosítás

- **Backend tesztek**: `backend/tests/` – pytest keretrendszer mock Supabase fixture-ökkel
  - Health endpoint teszt
  - Auth endpoint tesztek (token validáció, jogosultsági hibák)
  - Model unit tesztek (from_row, to_dict, aspektus arányok)
  - Generate API tesztek (műfajok, aspektus arányok, jogosultság-ellenőrzés)
- **CI pipeline**: `.github/workflows/ci.yml` – Automatikus tesztelés, TypeScript ellenőrzés, build és linting minden push és PR esetén
