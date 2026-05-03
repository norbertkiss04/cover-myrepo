# Security Threat Model – InstaCover

## Módszertan

STRIDE keretrendszer alkalmazása a rendszer fő komponenseire és adatfolyamaira.

## Rendszer határok és bizalmi zónák

```
┌─────────────────────────────────────────────────────┐
│ Böngésző (nem megbízható)                           │
│  - React SPA                                        │
│  - Supabase Auth SDK (JWT)                          │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
┌────────────────────────┼────────────────────────────┐
│ Backend (megbízható)   │                            │
│  - Flask API           │                            │
│  - WebSocket server    │                            │
│  - Pipeline service    │                            │
└────────────────────────┼────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────┐
│ Külső szolgáltatások   │                            │
│  - Supabase (DB + Storage + Auth)                   │
│  - OpenRouter (LLM)                                 │
│  - WaveSpeed AI (képgenerálás)                      │
│  - Sentry (monitoring)                              │
└─────────────────────────────────────────────────────┘
```

## STRIDE elemzés

### S – Spoofing (identitás-hamisítás)

| Fenyegetés | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| JWT token ellopása (XSS) | Közepes | Magas | HttpOnly cookie nem alkalmazható (SPA), de: rövid token élettartam (Supabase default 1h), CSP header-ek, input sanitizáció |
| API token ellopása | Alacsony | Magas | Token csak admin felhasználóknál, HTTPS-en keresztül, revoke lehetőség |
| Invite kód brute-force | Alacsony | Közepes | URL-safe random token (16 byte), 7 napos lejárat, egyszer használatos |

### T – Tampering (adatmódosítás)

| Fenyegetés | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| Más user generálásainak módosítása | Közepes | Magas | Minden DB query user_id-re szűrt, RLS policy-k Supabase-ben |
| Kredit manipuláció (request módosítás) | Közepes | Közepes | Server-side kredit számítás, atomikus RPC műveletek, kliens-oldali érték nem megbízható |
| Prompt injection LLM-en keresztül | Közepes | Alacsony | User input nem kerül közvetlenül a system prompt-ba, dedikált prompt template-ek |

### R – Repudiation (letagadás)

| Fenyegetés | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| Felhasználó letagadja tevékenységét | Alacsony | Alacsony | Strukturált logolás minden műveletről (user_id + timestamp + action), Sentry audit trail |
| Admin kredit-kiosztás nyomkövethetősége | Alacsony | Közepes | Admin műveletek logolva (give_credits, invite creation) |

### I – Information Disclosure (információszivárgás)

| Fenyegetés | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| Storage URL-ek kiszivárgása | Közepes | Közepes | Signed URL-ek 1 órás lejárattal, soha nem nyers path |
| Más user képeinek elérése | Közepes | Magas | Storage path-ok user_id alapú szeparáció, API response-ok user_id szűrtek |
| API kulcsok a kliensben | Alacsony | Kritikus | Csak `SUPABASE_ANON_KEY` kerül a kliensbe (publikus by design), minden titkos kulcs server-side |
| Hibaüzenetek információ-szivárgása | Alacsony | Alacsony | Generikus hibaüzenetek a kliensnek, részletes logolás server-side |

### D – Denial of Service (szolgáltatás-megtagadás)

| Fenyegetés | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| API rate limit kimerítés | Közepes | Közepes | Flask-Limiter: 30/perc alapértelmezés, specifikus endpoint-okra (5/perc token generálás, 10/perc kredit kiosztás) |
| WebSocket connection flooding | Alacsony | Közepes | JWT autentikáció a WebSocket-en, egy user = egy aktív generálás |
| Drága pipeline-ok spammelése | Közepes | Magas | Kreditrendszer természetes korlát, admin bypass csak megbízható felhasználóknál |
| Supabase free tier kimerítés | Közepes | Magas | Storage monitoring, régi generálások törlési lehetősége |

### E – Elevation of Privilege (jogosultság-emelés)

| Fenyegetés | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| Nem-admin felhasználó admin funkciók elérése | Közepes | Magas | `is_admin` check minden admin endpoint-on (server-side), API token csak admin-nak |
| Invite kód nélküli regisztráció | Alacsony | Közepes | Server-side invite validáció (consume_invite RPC), metadata ellenőrzés |
| User ID manipuláció request-ben | Közepes | Magas | User ID soha nem jön a klienstől — mindig a JWT-ből/DB-ből származik |

## Biztonsági kontrollok összefoglalása

| Kontroll | Implementáció |
|---|---|
| Autentikáció | Supabase Auth JWT + API token (kétféle auth path) |
| Autorizáció | User_id szűrés minden query-ben + is_admin check admin route-okon |
| Input validáció | `backend/app/utils/validation.py`, hossz-limitek, típus-ellenőrzés |
| Rate limiting | Flask-Limiter endpoint-specifikus korlátokkal |
| HTTPS | Cloudflare SSL termination + Nginx Proxy Manager |
| Secret management | `.env` fájl (nem verziókövetett), `.gitignore`-ban |
| Signed URL-ek | Supabase Storage 1 órás lejárattal |
| Atomikus műveletek | Supabase RPC (deduct_credits, refund_credits) |
| Audit logging | Strukturált JSON log minden biztonsági eseményről |
| Dependency security | GitHub Dependabot (automatikus vulnerability alertek) |

## Elfogadott kockázatok

| Kockázat | Indoklás |
|---|---|
| JWT nem HttpOnly cookie-ban | SPA architektúra megköveteli a JS-ből való hozzáférést; rövid élettartam mitigálja |
| Nincs WAF | Kis forgalom, zárt béta (invite-only), rate limiting elegendő |
| Nincs IP-alapú blokkolás | Cloudflare biztosít alapszintű bot-védelmet |
| Sentry-be kerülhetnek request path-ok | Nem tartalmaz érzékeny adatot (auth header-ek ki vannak szűrve) |
