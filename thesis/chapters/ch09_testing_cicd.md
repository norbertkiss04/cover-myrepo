# 9. Tesztelés és CI/CD

A projekt minőségbiztosítása automatizált tesztekre és folyamatos integrációra épül. Ebben a fejezetben bemutatom a tesztelési stratégiát, a teszt infrastruktúrát és a CI/CD pipeline konfigurációját.

## 9.1. Tesztelési stratégia

A tesztelés a tesztpiramis elvét követi: a hangsúly a backend unit és integrációs teszteken van, amelyeket automatikus TypeScript type-checking és manuális béta tesztelés egészít ki.

| Szint | Eszköz | Lefedett terület |
|-------|--------|------------------|
| Unit + integráció | pytest | Backend szolgáltatások, route-ok, modellek |
| Típusellenőrzés | TypeScript (`tsc --noEmit`) | Frontend típusbiztonság |
| Linting | flake8 | Backend kódminőség |
| Manuális | Béta tesztelők | E2E felhasználói folyamatok |

A backend teszt suite 204 tesztet tartalmaz 14 fájlban, amelyek lefedik az autentikációt, a generálási route-okat, az API v1 végpontokat, a pipeline szolgáltatásokat, a WebSocket kezelőket és a modellek szerializációját.

## 9.2. Mock infrastruktúra

A tesztek nem hívnak külső szolgáltatásokat (Supabase, OpenRouter, WaveSpeed). Ehelyett egy egyéni in-memory Supabase mock-ot implementáltam a `conftest.py`-ban:

```python
class MockQueryBuilder:
    def select(self, columns='*'): ...
    def insert(self, data): ...
    def update(self, data): ...
    def delete(self): ...
    def eq(self, column, value): ...
    def order(self, column, desc=False): ...
    def limit(self, count): ...
    def execute(self): ...
```

A `MockQueryBuilder` egy Python dictionary-ben tárolja az adatokat és szimulálja a Supabase táblaműveleteket szűréssel, rendezéssel és paginációval. A `MockRpcBuilder` az atomikus RPC hívásokat implementálja (kredit-levonás, visszatérítés, meghívó felhasználás).

Ez a megközelítés előnyösebb, mint a valódi adatbázis használata tesztekben: gyorsabb, nem igényel hálózati kapcsolatot, és minden teszt garantáltan tiszta állapotból indul.

## 9.3. Teszt típusok

A pozitív tesztek sikeres folyamatokat ellenőriznek: generálás indítása érvényes paraméterekkel, helyes autentikáció, kredit-levonás és visszatérítés.

A negatív tesztek a hibakezelést vizsgálják: hiányzó vagy érvénytelen token (401), jogosulatlan hozzáférés (403), hibás bemenet (400), elégtelen kredit (402), nem létező erőforrás (404).

A biztonsági tesztek más felhasználó adatainak elérési kísérletét (user isolation), admin-only végpontok nem-admin felhasználóval való hívását és lejárt tokenek kezelését fedik le.

Az izolációs tesztek biztosítják, hogy minden teszt független: nincs megosztott állapot, a fixture-ök minden futáskor újrainicializálják a mock adattárat.

## 9.4. CI/CD pipeline

A GitHub Actions[11] CI pipeline minden push és pull request esetén három párhuzamos jobot futtat:

1. A backend-test job Python 3.11 környezetben `pytest` futtatást végez coverage méréssel, az eredmény feltöltődik Codecov-ra
2. A frontend-build job Node.js 20 környezetben TypeScript type check-et (`tsc --noEmit`) és production buildet (`npm run build`) futtat
3. A lint job `flake8` futtatást végez a backend kódon (figyelmeztetésként, nem blokkoló)

A deployment manuális: `docker compose up --build` a VPS-en. Automata deployment-et nem implementáltam, mert a zárt béta jellegű alkalmazásnál a manuális ellenőrzés előnyösebb.
