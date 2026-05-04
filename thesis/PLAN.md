# Szakdolgozat Terv — InstaCover

## Alapadatok

- **Hallgató:** Kiss Norbert (NREWLO)
- **Cím:** InstaCover – könyvborító-készítő webalkalmazás
- **Intézmény:** Szegedi Tudományegyetem, Természettudományi és Informatikai Kar
- **Típus:** BSc szakdolgozat
- **Nyelv:** Magyar
- **Cél terjedelem:** ~30 oldal (követelmény: 25-50 oldal, mellékletek nem számítanak)
- **Formátum:** Word (.docx), a tartalom markdown fájlokból kerül átkonvertálásra

---

## Formai követelmények

| Paraméter | Érték |
|-----------|-------|
| Papírméret | A4, álló |
| Betűtípus | Times New Roman, 12pt |
| Sorköz | 1.5 |
| Margó | 2.5 cm minden oldalon |
| Igazítás | Sorkizárt |
| Címsorok | Arab számozás, félkövér (Heading 1: 14pt, többi: 12pt) |
| Oldalszám | Jobb alsó sarok, 2. oldaltól |
| Ábra felirat | Alul, középre igazítva: "X.Y. ábra: leírás" |
| Táblázat felirat | Felül, középre igazítva: "X.Y. táblázat: leírás" |
| Hivatkozás stílus | Szögletes zárójel: [1], [2] |
| Tartalomjegyzék mélység | Max 3 szint |

---

## Fejezeti struktúra

| # | Fejezet | Oldalszám | Tartalom forrás |
|---|---------|-----------|-----------------|
| - | Címlap | 1 | `eleje.doc` sablon |
| - | Feladatkiírás | 1 | Témavezetőtől |
| - | Tartalmi összefoglaló | 1 | Saját (utolsóként írva) |
| - | Tartalomjegyzék | 1-2 | Automatikusan generált |
| **1** | **Bevezetés** | 2 | PRD, interjúk, probléma leírás |
| **2** | **Piackutatás** | 2 | `competitors.csv`, meglévő megoldások elemzése |
| **3** | **Felhasznált technológiák** | 2-3 | Minden technológia 2-3 mondatos leírása |
| **4** | **Architektúra** | 3 | Rendszerdiagram, Docker, adatfolyam, ER diagram |
| **5** | **AI generálási pipeline** | 5-6 | `pipeline_service.py`, `llm_service.py`, `image_service.py` |
| **6** | **Stílusreferencia rendszer** | 2-3 | StyleReference modell, variáns generálás, blending módok |
| **7** | **Valós idejű kommunikáció** | 2-3 | Socket.IO, GenerationContext, állapotgép |
| **8** | **Biztonság és kreditrendszer** | 2-3 | RLS, prompt injection, kredit atomikus műveletek |
| **9** | **Tesztelés és CI/CD** | 1-2 | pytest, GitHub Actions, coverage |
| **10** | **MI-használat dokumentálása** | 2 | `official_base/ai_requirement.txt`, saját tapasztalat |
| **11** | **Összefoglalás** | 1-2 | Eredmények, tapasztalatok, továbbfejlesztés |
| - | Irodalomjegyzék | 1 | ~15-20 forrás |
| - | Nyilatkozat | 1 | Hivatalos sablon |
| - | Mellékletek | 3-5+ | Extra screenshotok, DB séma, API végpontok |

**Becsült összterjedelem:** ~30-34 oldal törzs + mellékletek

---

## Írási stílus szabályok

### Hangnem és személy

- Egyes szám első személy (E/1): "Szakdolgozatomban...", "A választásom a...-ra esett"
- Többes szám első személy kódleírásnál: "ellenőrizzük", "meghívjuk"
- Szenvedő/személytelen rendszer-viselkedésnél: "betöltődik", "módosításra kerül"
- Félig formális akadémiai magyar, közvetlen, tömör
- Rövid bekezdések (2-4 mondat), egy gondolat per bekezdés

### Technikai kifejezések

- Angol szakkifejezések magyar ragokkal: "a pipeline-ban", "a WebSocket-en", "a frontend-en"
- Minden technológia kap 2-3 mondatos magyarázatot (mi ez, mire való)
- Ismertnek feltételezett: frontend, backend, API, HTTP, JSON, TypeScript

### Kódrészletek

- Rövid, fókuszált snippetek (5-15 sor)
- Bevezetés rövid mondattal + kettőspont: "A generálás indítása:"
- NEM számozott, NEM képként — inline szöveges kódblokk
- Releváns fejezetbe beágyazva (nincs külön "Kódrészletek" fejezet)
- A kódban NINCS komment (projekt szabály)

### Ábrák és diagramok

- Számozás: `X.Y. ábra` (fejezet.sorszám)
- Szövegben hivatkozás: "Az X.Y. ábra mutatja..." / "...látható az X.Y. ábrán"
- Képernyőképek: valós alkalmazás screenshotok az `ux-docs` branch-ből
- Diagramok: architektúra diagram, generálási folyamat, ER diagram (Mermaid-ból)
- Mellékletbe kerül: extra screenshotok, sötét téma változatok

### Hivatkozások

- Szögletes zárójelben: `[1]`, `[2-3]`
- Technológiáknál a névhez kapcsolva: `React[1]`, `Supabase[5]`
- Fogalmaknál mondat végén: "...aszinkron polling mechanizmussal [8]."
- Irodalomjegyzék formátum: `Név: URL (Utolsó megtekintés: 2025. XX. XX.)`

---

## Hivatkozások tervezett listája

| # | Téma | Típus |
|---|------|-------|
| 1 | React | Technológia docs |
| 2 | TypeScript | Technológia docs |
| 3 | Vite | Technológia docs |
| 4 | Flask | Technológia docs |
| 5 | Supabase | Technológia docs |
| 6 | Socket.IO | Technológia docs |
| 7 | TailwindCSS | Technológia docs |
| 8 | OpenRouter | API docs |
| 9 | WaveSpeed AI | API docs |
| 10 | Docker | Technológia docs |
| 11 | GitHub Actions | Technológia docs |
| 12 | Canva | Versenytárs (piackutatás) |
| 13 | GetCovers | Versenytárs (piackutatás) |
| 14 | TheBookCoverDesigner | Versenytárs (piackutatás) |
| 15 | PostgreSQL Row Level Security | Fogalmi hivatkozás |
| 16 | WebSocket protokoll (RFC 6455 vagy MDN) | Fogalmi hivatkozás |
| 17 | Prompt injection / OWASP | Biztonsági hivatkozás |
| 18 | Self-publishing piaci adatok | Bevezető kontextus |
| 19 | TanStack Query | Technológia docs |
| 20 | Framer Motion | Technológia docs |

---

## Elérhető erőforrások

### Screenshotok (`ux-docs` branch)

| Fájl | Felhasználás |
|------|-------------|
| `S01_home.png` | 4. fejezet / melléklet |
| `S01_home_logged_in.png` | 4. fejezet |
| `S02_login.png` | 8. fejezet / melléklet |
| `S02_register.png` | 8. fejezet (invite rendszer) |
| `S05_generate_idle.png` | 5. fejezet (generálási form) |
| `S06_history.png` | Melléklet |
| `S07_style_references.png` | 6. fejezet |
| `S09_templates.png` | 5. vagy 6. fejezet |
| `pageflow.png` | 4. fejezet (navigáció) |
| `journey1.mp4` | Frame-ek kinyerhetők |

### Diagramok (létrehozandó)

| Diagram | Fejezet | Típus |
|---------|---------|-------|
| Rendszer architektúra | 4 | Komponens diagram (SPA↔Flask↔Supabase↔LLM↔WaveSpeed) |
| Generálási folyamat | 5 | Folyamatábra (3 pipeline útvonal) |
| WebSocket esemény szekvencia | 7 | Szekvencia diagram |
| ER diagram | 4 / melléklet | Adatmodell (users, generations, style_references, cover_templates, invites) |

### Kódbázis kulcsfájlok (snippet források)

| Fájl | Fejezet | Miért érdekes |
|------|---------|---------------|
| `backend/app/services/pipeline_service.py` | 5 | 3 pipeline, orkesztráció, border detection |
| `backend/app/services/llm_service.py` | 5, 6 | Prompt generálás, vision analízis, JSON schema |
| `backend/app/services/image_service.py` | 5 | WaveSpeed polling, edit API, blend |
| `backend/app/services/credit_service.py` | 8 | Atomikus kredit műveletek, költségbecslés |
| `backend/app/services/template_render_service.py` | 5 | Playwright HTML renderelés |
| `backend/app/sockets/handlers.py` | 7 | Socket auth, event kezelés |
| `backend/app/sockets/tasks.py` | 7 | Háttérfeladat indítás, hiba kezelés |
| `backend/app/utils/validation.py` | 8 | Prompt injection detektálás |
| `backend/app/routes/auth.py` | 8 | JWT validáció, invite rendszer |
| `frontend/src/context/GenerationContext.tsx` | 7 | Frontend állapotgép |
| `frontend/src/services/api.ts` | 7 | Token refresh queue |
| `backend/supabase/bootstrap_idempotent.sql` | 4, 8 | RLS policy-k, RPC-k |

---

## Munkafolyamat

### Fázisok

1. **Vázlat létrehozás** — Fejezet fájlok létrehozása heading struktúrával
2. **Mag fejezetek (5-8)** — A kódbázis alapján, technikai mélység
3. **Keret fejezetek (1-4, 9-10)** — Kontextus és összefoglalás
4. **Ábrák és diagramok** — Screenshotok beillesztése, diagramok generálása
5. **Hivatkozások** — Irodalomjegyzék összeállítása
6. **Elő/utó anyagok** — Absztrakt, nyilatkozat, mellékletek
7. **Word konverzió** — Pandoc + formázás a formai követelmények szerint

### Írási sorrend

| Sorrend | Fejezet | Indoklás |
|---------|---------|----------|
| 1. | Ch. 5 – AI pipeline | Magfunkció, legtöbb mélység |
| 2. | Ch. 6 – Stílusreferencia | Pipeline-hoz szorosan kapcsolódik |
| 3. | Ch. 7 – Valós idejű kommunikáció | Frontend↔Backend összekötés |
| 4. | Ch. 4 – Architektúra | Alapozás, rendszer áttekintés |
| 5. | Ch. 8 – Biztonság és kredit | Keresztvágó funkciók |
| 6. | Ch. 3 – Technológiák | Gyors áttekintő fejezet |
| 7. | Ch. 9 – Tesztelés | Rövid, tényszerű |
| 8. | Ch. 2 – Piackutatás | Kontextus |
| 9. | Ch. 1 – Bevezetés | Könnyebb ha tudjuk mit mond a dolgozat |
| 10. | Ch. 10 – MI-használat | Önreflexió, tapasztalat alapú |
| 11. | Ch. 11 – Összefoglalás | Legutoljára |
| 12. | Front/back matter | Absztrakt, nyilatkozat, hivatkozások, mellékletek |

### Együttműködési modell

- **Én:** Teljes fejezet vázlatok magyar nyelven a kódbázis alapján
- **Te:** Átnézés, pontosítás, személyes meglátások hozzáadása
- Iterálunk ha szükséges, majd továbblépünk

---

## Hiányzó elemek (tőled szükséges)

| Elem | Státusz | Megjegyzés |
|------|---------|-----------|
| Feladatkiírás (témavezetőtől) | Hiányzik | Placeholder-rel kezdünk, később kitöltjük |
| Témavezető neve és beosztása | Hiányzik | Címlaphoz kell |
| Szak pontos megnevezése | Hiányzik | Címlaphoz kell |
| Pontos befejezési év | 2025 (feltételezett) | Megerősítés |
| Screenshotok bemergelése | `ux-docs` branch-ben | Ellenőrizni kell merge státuszt |
