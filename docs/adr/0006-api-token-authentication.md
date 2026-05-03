# ADR-0006: API token alapú hozzáférés programozott integrációkhoz

- Dátum: 2026-01-20
- Státusz: Elfogadva

## Kontextus

A webes felületen kívül szükség van programozott hozzáférésre is (automatizált borítógenerálás, külső eszközök integrációja, batch feldolgozás). A meglévő Supabase JWT alapú autentikáció nem alkalmas erre, mivel a token rövid élettartamú és OAuth flow-t igényel.

## Döntés

Dedikált API token rendszer bevezetése az `/api/v1/` endpointokhoz:
- Admin-only jogosultság: csak admin felhasználók generálhatnak API tokent
- Token formátum: `ic_` prefix + 32 byte hex (64 karakter) → egyértelműen megkülönböztethető a JWT-től
- Bearer token autentikáció: `Authorization: Bearer ic_...` vagy `X-API-Key` header
- Egy user = egy aktív token (generálás felülírja a régit, revoke törli)
- Rate limiting: 30/perc alapértelmezés

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| OAuth2 client credentials flow | Túl komplex MVP-hez, külön auth szerver kellene |
| JWT long-lived token | Nem revokálható egyedileg, refresh flow bonyolult |
| API key a query string-ben | Biztonsági kockázat (logolás, referrer leak) |

## Következmények

- Egyszerű, stateless autentikáció → token DB lookup minden kérésnél
- Admin-only korlátozás → kevesebb abuse kockázat béta fázisban
- Prefix-alapú routing: `ic_` kezdetű token → API token lookup, egyéb → Supabase JWT validation
- Token revoke azonnal hatásos (DB-ből törlés)
- Teljes REST API elérhető: generate, list generations, templates, styles
- Későbbi bővítés: per-token scope-ok, rate limit testreszabás
