# Sprint 3 – A Működő Mag Megépítése

Ez a mappa tartalmazza a Sprint 3 összes leadandóját.

## Ellenőrző lista

- [X] Vertikális szelet dokumentáció (`sprints/03/vertical_slice.md`)
- [X] Automatizált tesztek (backend: `backend/tests/`)
- [X] CI integráció (`.github/workflows/ci.yml`)
- [X] `sprints/03/ai/ai_log.jsonl` ≥ 3 bejegyzéssel

## Jegyzetek

- A vertikális szelet a teljes borítógenerálási folyamatot öleli fel: űrlap kitöltés → WebSocket kommunikáció → LLM prompt generálás → képgenerálás → tárolás → eredmény megjelenítés.
- A tesztek pytest keretrendszerrel futnak, mock Supabase fixture-ökkel.
- A CI pipeline GitHub Actions-ben fut: backend tesztek + kódlefedettség, frontend TypeScript ellenőrzés + build, és linting.
