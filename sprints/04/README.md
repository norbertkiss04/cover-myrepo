# Sprint 4 – Felkészülés a Való Világra

Ez a mappa tartalmazza a Sprint 4 összes leadandóját.

## Ellenőrző lista

- [X] Strukturált JSON logolás (`backend/app/__init__.py`)
- [X] `/metrics` végpont alapvető rendszerinformációkkal
- [X] Hibakövetés integrálása – Sentry SDK
- [X] Béta tesztelési útmutató (`sprints/04/beta_testing_guide.md`)
- [ ] Visszajelzés-gyűjtés és elemzés (`sprints/04/feedback/`)
- [X] `sprints/04/ai/ai_log.jsonl` ≥ 3 bejegyzéssel

## Jegyzetek

- A strukturált logolás `python-json-logger` könyvtárral történik, minden log sor JSON formátumú.
- A `/metrics` végpont alapvető szerver-metrikákat szolgáltat (uptime, kérésszám, hibaszám, memóriahasználat).
- A Sentry SDK automatikusan figyeli a Flask kivételeket és jelenti azokat.
- A béta tesztelés útmutatója tartalmazza a tesztelési feladatokat és a visszajelzési módot.
