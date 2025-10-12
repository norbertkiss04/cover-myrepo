[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/VSPuLl7_)
# Szakdolgozat 2.0 – Sprint 1 Kickoff

Szia! Üdv a kurzus első, legfontosabb sprintjében. A következő három hétben nem kódot írsz, hanem feltárod a valódi problémát: interjúzol, piacot elemzel és döntéseket dokumentálsz. Ha jól dolgozol, a sprint végére bizonyítod, hogy létező igényre építesz – ez a teljes projekt alapja.

## Fájlstruktúra (Sprint 1)
- `course.yaml`: hallgatói metaadatok és track választás (root szinten marad).
- `sprints/01/prd.yaml`: a Product Requirements Document (PRD) 0.1-es verziója.
- `sprints/01/interviews/`: legalább **5** felhasználói interjú JSON jegyzőkönyve.
- `sprints/01/market/competitors.csv`: legalább **3** versenytárs elemzése.
- `sprints/01/architecture/adr/`: legalább **1** Architecture Decision Record.
- `sprints/01/ai/usage_plan.yaml`: MI-használati terv (mire és mire nem használod a copilotot).
- `sprints/01/ai/ai_log.jsonl`: MI-használat naplója, legalább **N** bejegyzéssel (N a `course.yaml`-ból).
- `scripts/validate.py`: helyi validátor a sprint leadása előtt.
- `scripts/schemas/`: JSON sémák (pl. interjúk) a gépi ellenőrzéshez.

> **Fontos:** minden Sprint 1-specifikus artefaktum a `sprints/01/` mappában él, a validátor is itt keresi őket.

## Leadási folyamat
1. Dolgozz a saját (forkolt) repository-ban, töltsd ki a `course.yaml`-t.
2. Készíts Pull Requestet (`main` ágra). A PR ugyanaz, mint a beadás.
3. A CI automatikusan lefut, és PASS / FAIL eredményt ad a sprint követelményeire.
4. Csak a PASS státuszú PR tekinthető leadottnak.
5. Leadás előtt futtasd helyben: `python scripts/validate.py --sprint 1`.

## Heti ütemterv (javaslat)
**1. hét – Alapozás**
- Repository klónozása, `course.yaml` kitöltése (track dokumentálása).
- `sprints/01/prd.yaml` első verziója: probléma, célcsoport, értékajánlat, scope.
- `sprints/01/ai/usage_plan.yaml` megírása: célok, guardrail-ek, eszközök.

**2. hét – Kutatás**
- Végezz legalább **5** interjút; rögzítsd a jegyzőkönyveket `sprints/01/interviews/` alatt.
- Etika: csak engedéllyel rögzíts, anonimizáld a résztvevőket (pszeudonim), PII-t ne adj át MI-nek.
- Elemezz legalább **3** versenytársat a `sprints/01/market/competitors.csv` fájlban.
- Hozd meg az első technológiai döntést és dokumentáld az `architecture/adr/` mappában.

**3. hét – Véglegesítés és leadás**
- Frissítsd a PRD-t az interjú- és piackutatási insightokkal.
- Frissítsd az `ai/ai_log.jsonl`-t, hogy elérje a minimum bejegyzésszámot.
- Futtasd a helyi validátort, javítsd a hibákat, majd készíts PR-t.

## Interjú-etika és MI guardrail-ek
- Kérj kifejezett hozzájárulást a felvételhez és jegyzeteléshez.
- Anonimizáld a jegyzőkönyveket (csak pszeudonim és szegmens szerepeljen).
- Ne illessz be személyazonosító adatot (PII) külső MI eszközbe.
- Minden MI kimenetet kritikusan ellenőrizz, a végső döntés mindig a tiéd.

## Definition of Done – Sprint 1
| Tétel | Minimum elvárás | Ellenőrzés |
| --- | --- | --- |
| PRD (`sprints/01/prd.yaml`) | `problem.statement`, `target_audience`, `value_proposition`, `scope.in/out` kitöltve | YAML validáció + kulcsok (CI) |
| Interjúk (`sprints/01/interviews/*.json`) | ≥ **5** fájl, séma szerint | JSON sémaellenőrzés (CI) |
| Versenytársak (`sprints/01/market/competitors.csv`) | ≥ **3** sor a fejlécen túl | Sorok száma, fejléc (CI) |
| ADR (`sprints/01/architecture/adr/*.md`) | ≥ **1** Markdown fájl | Fájl léte (CI) |
| MI dokumentáció (`sprints/01/ai/*`) | Usage plan + napló ≥ **N** bejegyzés | Fájl léte + bejegyzésszám (CI) |
| Leadás | PR a `main` ágra, zöld CI | PASS szükséges |

## Használat
```bash
python scripts/validate.py --sprint 1
```
A szkript ellenőrzi, hogy minden kötelező Sprint 1 artefaktum a megfelelő helyen és formátumban megtalálható-e, továbbá az AI napló eléri-e a `course.yaml`-ban megadott minimumot.

## Forrás
A tartalom a kurzus hivatalos Hallgatói útmutatója (Sprint 1 fejezet) alapján készült.

## License
MIT
