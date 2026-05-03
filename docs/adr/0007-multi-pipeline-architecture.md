# ADR-0007: Többlépéses, többágú pipeline architektúra

- Dátum: 2025-12-20
- Státusz: Elfogadva

## Kontextus

A könyvborító-generálás nem egyetlen API hívás, hanem több lépés láncolása. Különböző felhasználói igények különböző pipeline-okat igényelnek: van aki csak háttérképet akar (szöveget maga rakja rá), van aki teljes borítót (háttér + tipográfia), és van aki meglévő borító stílusát szeretné reprodukálni. Mindegyik eset eltérő lépésszámot és API hívás-kombinációt igényel.

## Döntés

Három fő pipeline implementálása egyetlen `pipeline_service` modulban:

1. **Standard pipeline** (2-3 lépés):
   - LLM prompt generálás → base image generálás → [opcionális: text overlay generálás]
   - Variációk: `base_image_only`, `two_step_generation`, teljes (3-step)

2. **Style reference pipeline** (2-5 lépés):
   - [Referencia variáns előkészítés: clean/text layer] → LLM prompt → base image → [text overlay]
   - Reference mode-ok: `both`, `background`, `text`
   - Text blending mode-ok: `ai_blend`, `direct_overlay`, `separate_reference`

3. **Template pipeline** (3 lépés):
   - LLM prompt → base image → Playwright/Chromium szerver-oldali template renderelés
   - HTML/CSS sablonok dinamikus kitöltése (cím, szerző, háttérkép)

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| Egyetlen, fix pipeline | Nem elég rugalmas különböző felhasználói igényekhez |
| Microservice-ek pipeline lépésenként | Túl komplex egyedüli fejlesztőként, nem szükséges ezen a skálán |
| Celery task queue | Extra infrastruktúra (Redis), a jelenlegi szinkron+WebSocket megoldás elegendő a terheléshez |

## Következmények

- Minden pipeline lépés előtt cancel check (DB status lekérdezés) → felhasználó bármikor megszakíthatja
- Kredit-levonás lépésenként történik → sikertelen lépésnél csak az addig felhasznált kreditek vesznek el
- Border detection + crop minden generált képen → konzisztens output minőség
- Style reference variánsok cache-elése (clean_image_path, text_layer_path) → ismételt használatnál nem kell újragenerálni
- Pipeline típus a frontend-en dinamikusan változtatja a költségbecslést
- Egyetlen service modul → könnyű tesztelni és bővíteni új pipeline-okkal
