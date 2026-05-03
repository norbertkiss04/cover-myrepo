# Tesztelési stratégia – InstaCover

## Áttekintés

A projekt a tesztpiramis elvét követi: sok unit teszt az alapon, integrációs tesztek középen, és manuális E2E tesztelés a csúcson. A tesztelés fő célja a backend üzleti logika és API réteg megbízhatóságának biztosítása.

## Tesztelési keretrendszer

| Szint | Eszköz | Lefedett terület |
|---|---|---|
| Unit + Integration | pytest + Flask test client | Backend szolgáltatások, modellek, route-ok |
| Type checking | TypeScript (`tsc --noEmit`) | Frontend típusbiztonság |
| Linting | flake8 | Backend kódminőség |
| Manuális | Béta tesztelők | E2E felhasználói folyamatok |

## Teszt infrastruktúra

### Mock rendszer

A `backend/tests/conftest.py` tartalmaz egy teljes in-memory Supabase mock-ot:
- **MockQueryBuilder:** Szimulálja a Supabase table műveleteket (select, insert, update, delete) szűréssel, rendezéssel, és limit kezeléssel
- **MockRpcBuilder:** Szimulálja az atomikus RPC hívásokat (`deduct_credits`, `refund_credits`, `consume_invite`)
- Izolált fixture-ök: minden teszt tiszta állapotból indul

### Fixture-ök

| Fixture | Leírás |
|---|---|
| `app` | Flask test alkalmazás `testing` konfigurációval |
| `client` | Flask test client |
| `auth_headers` | Hitelesített user (id=1) Bearer token |
| `admin_auth_headers` | Admin user (id=100, is_admin=True) |
| `api_token_headers` | API token alapú admin hitelesítés (id=101) |
| `non_admin_api_token_headers` | Nem-admin API token (id=102) |
| `test_user` | Másodlagos user (id=2) izolációs tesztekhez |
| `test_generation` | Előre létrehozott generálás rekord |

## Teszt lefedettség számokban

| Fájl | Tesztek száma | Lefedett terület |
|---|---|---|
| test_api_v1.py | 34 | REST API v1 endpointok (CRUD, auth, pagination) |
| test_generate_routes.py | 31 | Generálási route-ok (validáció, jogosultság) |
| test_llm_service.py | 21 | LLM szolgáltatás (prompt generálás, hibakezelés) |
| test_auth.py | 21 | Autentikáció (token validáció, invite, user CRUD) |
| test_socket_handlers.py | 15 | WebSocket eseménykezelők |
| test_models.py | 14 | Adatmodellek (Generation, User, StyleReference) |
| test_api_token.py | 13 | API token autentikáció és jogosultságkezelés |
| test_storage_service.py | 13 | Fájltárolási szolgáltatás |
| test_services.py | 12 | Pipeline és kredit szolgáltatások |
| test_pipeline_service.py | 12 | Pipeline orchestráció és lépések |
| test_sockets.py | 10 | WebSocket kapcsolatkezelés |
| test_generate.py | 7 | Generálási logika |
| test_health.py | 1 | Health check endpoint |
| **Összesen** | **204** | — |

## Tesztelési stratégia típusonként

### Pozitív tesztek (happy path)
- Sikeres generálás indítás megfelelő paraméterekkel
- Helyes autentikáció és user lookup
- Kredit levonás és visszatérítés
- API v1 CRUD műveletek

### Negatív tesztek (error handling)
- Hiányzó/érvénytelen autentikáció (401, 403)
- Érvénytelen input adatok (400)
- Hiányzó erőforrás (404)
- Elégtelen kredit (402)
- Rate limit túllépés (429)

### Biztonsági tesztek
- Más user adatainak elérési kísérlete (user isolation)
- Admin-only endpointok nem-admin felhasználóval
- Érvénytelen/lejárt tokenek
- SQL injection védelem (paraméteres lekérdezések)

### Izolációs tesztek
- Minden teszt független, nincs megosztott állapot
- Mock-ok biztosítják, hogy külső API-k nem hívódnak

## CI integráció

A GitHub Actions CI pipeline minden push és PR esetén futtatja:
1. `pytest` teljes teszt suite futtatás
2. Code coverage generálás és feltöltés Codecov-ra
3. `tsc --noEmit` TypeScript type check (frontend)
4. `flake8` linting (backend, continue-on-error)

## Hiányosságok és fejlesztési terv

| Hiány | Prioritás | Terv |
|---|---|---|
| Frontend tesztek (React) | Közepes | Vitest + React Testing Library a kritikus komponensekhez |
| E2E tesztek | Alacsony | Playwright a fő felhasználói folyamatokhoz |
| Coverage küszöbérték | Közepes | Minimum 70% coverage gate a CI-ban |
| Load testing | Alacsony | k6 a WebSocket és API terhelés teszteléshez |
