# Példaborítók

Az alábbi borítók 2026. 10. 28-án készültek a `main` ág kódjával, a valódi pipeline függvényekkel (`llm_service`, `image_service`). A könyvadatok kitaláltak. Minden borítóhoz tartozik egy JSON fájl a bemenettel, a generált promptokkal, a modellekkel és a futási idővel.

Modellek: Grok 4.7 (prompt), Seedream 5.0 Pro (kép, 2k felbontás).

| Fájl | Műfaj | Mód | Képarány | Hívások | Idő |
|---|---|---|---|---|---|
| `lighthouse.jpg` | Irodalmi / krimi | kétlépéses | 2:3 | 2 LLM + 2 kép | 263 s |
| `scifi.jpg` | Sci-fi | kétlépéses | 2:3 | 2 LLM + 2 kép | 241 s |
| `fantasy.jpg` | Fantasy | kétlépéses | 2:3 | 2 LLM + 2 kép | 237 s |
| `children.jpg` | Gyerekkönyv | egylépéses | 1:1 | 1 LLM + 1 kép | 97 s |

A `lighthouse_base.jpg` a kétlépéses mód első lépésének szöveg nélküli alapképe. A `lighthouse.jpg` ugyanerre a képre, szerkesztéssel kerül rá a cím és a szerzőnév.

A képek a dokumentációhoz 1000 px-re kicsinyített JPEG változatok.
