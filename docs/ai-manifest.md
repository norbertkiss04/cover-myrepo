# AI Manifest – InstaCover

## Projekt áttekintés

Az InstaCover fejlesztése során AI eszközöket használtam kutatásra, kódgenerálásra, tesztelésre és dokumentáció készítésre. Ez a dokumentum összefoglalja az AI használat módját, eszközeit és garanciáit.

## Felhasznált AI eszközök

| Eszköz | Felhasználási terület | Sprintek |
|---|---|---|
| Perplexity | Piackutatás, GDPR kutatás, brainstorming | S1, S2 |
| Roo Code | Interjú elemzés, dokumentáció formázás, kód validáció | S1 |
| Claude Code | Full-stack fejlesztés, UI/UX tervezés, teszt írás, CI/CD, observability | S2, S3, S4 |

## AI használati elvek (guardrails)

1. **Személyes adatok védelme:** Interjúalanyok valódi adatai soha nem kerülnek AI eszközbe — kizárólag anonimizált adatokkal dolgozom.
2. **Kritikus értékelés:** Minden AI-generált tartalmat manuálisan felülvizsgálok, tesztelek és szükség szerint átírok.
3. **Döntési felelősség:** Az AI segédeszköz, a végső döntéseket és elfogadásokat én hozom.
4. **Titoktartás:** API kulcsok, jelszavak és egyéb érzékeny adatok soha nem kerülnek AI eszközbe.
5. **Reprodukálhatóság:** Minden AI interakció dokumentálva van a sprint AI logokban.

## AI hatáskör a kódbázisban

| Komponens | AI szerepe | Emberi felülvizsgálat |
|---|---|---|
| Backend pipeline logika | Claude Code generálta, majd iteratívan finomítva | Kézi kód review, tesztelés minden változtatás után |
| Frontend komponensek | Claude Code generálta az alapstruktúrát | UI/UX manuális tesztelés, vizuális ellenőrzés |
| Teszt suite | Claude Code generálta a mock infrastruktúrát és teszteket | Tesztek futtatása, edge case-ek kézi hozzáadása |
| CI/CD pipeline | Claude Code generálta | Pipeline futtatás ellenőrzése GitHub Actions-ben |
| Dokumentáció | Perplexity kutatás + Claude Code formázás | Tartalom ellenőrzés, pontosítás |

## Prompt Log összefoglaló

A részletes prompt logok az egyes sprintekben találhatók:
- `sprints/01/ai/ai_log.jsonl` — 4 bejegyzés (piackutatás, interjú elemzés, PRD, formázás)
- `sprints/02/ai/ai_log.jsonl` — 3 bejegyzés (UI/UX, privacy policy, GDPR kutatás)
- `sprints/03/ai/ai_log.jsonl` — 3 bejegyzés (full-stack fejlesztés, teszt suite, CI/CD)
- `sprints/04/ai/ai_log.jsonl` — 3 bejegyzés (observability, metrics, béta tesztelés)

**Összesen: 13 dokumentált AI interakció** 4 sprint alatt.

## Verifikációs napló (Verification Log)

| Dátum | AI output | Verifikáció módja | Eredmény |
|---|---|---|---|
| 2025-10-04 | Versenytárs-elemzés (Canva, TheBookCoverDesigner, GetCovers) | Manuális ellenőrzés a cégek weblapjain | Elfogadva, árak pontosítva |
| 2025-10-15 | Interjú elemzés közös fájdalompontok | Visszaolvasás az eredeti interjúkból | Elfogadva |
| 2025-10-17 | ADR-0001 tech stack döntés | Saját tapasztalat és dokumentáció alapú értékelés | Elfogadva |
| 2025-11-10 | GeneratePage UI layout | Böngészőben vizuális tesztelés, reszponzivitás | Elfogadva, kisebb CSS javítások |
| 2025-11-14 | Privacy policy szöveg | GDPR checklist alapú ellenőrzés | Elfogadva, kiegészítve |
| 2025-12-02 | Pipeline service + WebSocket handlers | Pytest teszt suite (204 teszt), manuális E2E tesztelés | Elfogadva, edge case-ek javítva |
| 2025-12-08 | Teszt suite (conftest + mock Supabase) | `pytest --cov` futtatás, coverage ellenőrzés | Elfogadva |
| 2025-12-10 | GitHub Actions CI config | Push to main → pipeline sikeresen lefut | Elfogadva |
| 2026-01-12 | Strukturált JSON logolás | Log output ellenőrzés fejlesztői környezetben | Elfogadva |
| 2026-01-14 | /metrics endpoint | cURL tesztelés, válasz struktúra ellenőrzés | Elfogadva |
| 2026-01-18 | Béta tesztelési útmutató | Végigolvasás, lépések kipróbálása | Elfogadva |

## Összefoglalás

- **AI által generált kód aránya (becslés):** ~60-70% (minden commit manuálisan review-zva)
- **AI által generált dokumentáció aránya:** ~40% (strukturális segítség, tartalom saját)
- **Verifikálatlan AI output a végtermékben:** 0% — minden output tesztelve és review-zva
