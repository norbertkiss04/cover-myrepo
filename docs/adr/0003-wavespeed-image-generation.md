# ADR-0003: WaveSpeed AI választása képgeneráláshoz

- Dátum: 2025-11-20
- Státusz: Elfogadva

## Kontextus

A könyvborító-generáláshoz szükség van egy képgenerálási API-ra, amely támogatja: egyedi méreteket (könyvborító arányok: 2:3, 1:1, 3:4, stb.), szöveg-rajzolást a képre, és referencia-kép alapú szerkesztést. Az API-nak megbízhatóan kell kezelni a szöveges elemeket, mivel a könyvborítók tipográfiája kritikus.

## Döntés

**WaveSpeed AI** (Seedream V4.5 modell) használata aszinkron job-alapú API-val:
- Text-to-image: `bytedance/seedream-v4.5` endpoint
- Image editing (referencia + prompt): `bytedance/seedream-v4.5/edit` endpoint
- Aszinkron workflow: job submit → polling → result

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| Replicate (SDXL/Flux) | Drágább per-image, lassabb cold start, gyengébb szövegkezelés |
| DALL-E 3 (OpenAI) | Nincs image editing endpoint, fix méretek, drága |
| Midjourney API | Nem elérhető hivatalos API, csak Discord bot |
| Stability AI | Szöveges tipográfia minősége gyengébb |

## Következmények

- Seedream V4.5 jó minőség/ár arány könyvborítókhoz (olcsóbb mint DALL-E)
- Aszinkron polling szükséges: job ID → status check loop (max 120 poll, 1s intervallum)
- Támogatja a multi-image reference-t (edit endpoint) → stílusreferencia rendszerhez ideális
- Egyedi méretek támogatása → nem kell utólagos crop/resize
- Hibamódok kezelése szükséges: timeout, rate limit, content filter rejection
- Vendor dependency: ha WaveSpeed megszűnik, az image_service cserélhető (egyetlen service class mögött van)
