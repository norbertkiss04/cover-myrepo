# ADR-0005: Kreditrendszer bevezetése költségkezeléshez

- Dátum: 2025-12-15
- Státusz: Elfogadva

## Kontextus

Minden borítógenerálás valós költséggel jár (LLM API hívás + képgenerálás API hívás). A zárt béta során a felhasználók ingyenesen használják a rendszert, de korlátozni kell a felhasználást a költségek kontrollálása érdekében. A különböző pipeline típusok eltérő számú API hívást igényelnek (2-8 hívás generálásonként), ezért fix "generálás/nap" korlát helyett granularis költségkezelés szükséges.

## Döntés

Token-alapú kreditrendszer bevezetése:
- **LLM hívás:** 1 kredit/hívás
- **Képgenerálás:** 6 kredit/hívás
- Regisztrációkor minden user 30 kreditet kap
- Admin manuálisan oszthat ki további krediteket
- Generálás előtt dinamikus költségbecslés a pipeline típus alapján
- Atomikus kredit-levonás Supabase RPC-vel (race condition védelem)
- Sikertelen generálás esetén automatikus kredit-visszatérítés
- Admin felhasználók korlátlan kredittel rendelkeznek (skip deduction)

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| Fix napi generálás limit | Nem tükrözi a valós költségkülönbséget pipeline típusok között |
| Stripe integráció (fizetős) | MVP/béta fázisban túl korai, felesleges komplexitás |
| Korlátlan ingyenes használat | Nem fenntartható, nincs költségkontroll |

## Következmények

- `deduct_credits` és `refund_credits` Supabase RPC funkciók → atomikus, race-condition-mentes
- Frontend dinamikus költségbecslés → a user látja előre mennyibe kerül egy generálás
- Pipeline típusonként eltérő költség (standard 2-step: 14 kredit, style-ref both+ai_blend: 50+ kredit)
- Admin bypass → tesztelés és debug egyszerűbb
- Későbbi Stripe integráció alapja megvan (kredit vásárlás)
