# ADR-0002: Migráció AWS S3-ról Supabase platformra

- Dátum: 2025-11-08
- Státusz: Elfogadva

## Kontextus

Az eredeti architektúra (ADR-0001) AWS S3-at használt fájltárolásra és saját Google OAuth implementációt autentikációra. A fejlesztés során kiderült, hogy három külön szolgáltatás (PostgreSQL hosting, S3, OAuth) kezelése egyedül túl sok overhead egy MVP-hez. Szükség volt egy egységes platformra, amely adatbázist, fájltárolást és autentikációt is biztosít.

## Döntés

Az egész backend infrastruktúrát Supabase-re migráljuk:
- **Adatbázis:** Supabase PostgreSQL (hosted)
- **Fájltárolás:** Supabase Storage (S3-kompatibilis, signed URL támogatás)
- **Autentikáció:** Supabase Auth (Google OAuth + email/password, JWT tokenek)
- **Biztonsági policy-k:** Row Level Security (RLS) az adatbázisban

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| Maradás AWS S3 + saját OAuth | Három szolgáltatás külön kezelése, több konfigurálás és karbantartás |
| Firebase | NoSQL nem ideális relációs adatmodellhez, vendor lock-in |
| PlanetScale + Cloudflare R2 | Két külön platform, nincs beépített auth |

## Következmények

- Egy platform, egy dashboard → egyszerűbb fejlesztés és ops
- Beépített signed URL-ek 1 órás lejárattal → soha nem kerülnek nyers storage path-ok a klienshez
- RLS policy-k → adatbázis-szintű hozzáférés-kontroll user_id alapján
- Supabase RPC funkciók → atomikus kreditműveletek (race condition védelem)
- Free tier korlát: 1 GB storage, 500 MB adatbázis → skálázásnál fizetős tervre kell váltani
- JWT tokenek automatikus kezelése → nem kell saját session management
