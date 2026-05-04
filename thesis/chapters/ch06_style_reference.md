# 6. Stílusreferencia rendszer

Az InstaCover egyik legértékesebb funkciója a stílusreferencia rendszer: a felhasználó feltölthet meglévő könyvborítókat, amelyek vizuális stílusát a rendszer AI segítségével elemzi és reprodukálja új generálásoknál. Ez lehetővé teszi, hogy egy sorozat borítói vizuálisan konzisztensek maradjanak, vagy hogy a felhasználó egy tetszőleges borító "hangulatát" újrahasznosítsa saját könyvéhez.

## 6.1. Stíluselemzés feltöltéskor

Amikor a felhasználó feltölt egy stílusreferencia képet, a rendszer azonnal AI-alapú elemzést futtat rajta. A Gemini 3 Flash multimodális modell négy dimenzió mentén dekompozícionálja a borítót:

- **Feeling** — az érzelmi hangulat és atmoszféra (pl. "sötét, misztikus, feszültségkeltő")
- **Layout** — a kompozíciós szerkezet és térelosztás (pl. "központi alak, felső harmadban cím")
- **Illustration rules** — a médium, művészeti technika és színpaletta (pl. "digitális festmény, hideg tónusok, kontrasztos megvilágítás")
- **Typography** — betűtípus-választás, hierarchia és kezelés (pl. "nagy serif cím, kis sans-serif szerzőnév")

Az elemzés JSON Schema-val kényszerített struktúrában érkezik:

```python
def analyze_style_reference(self, image_url, user=None):
    system_prompt = get_prompt('style_analysis', 'system')
    user_text = get_prompt('style_analysis', 'user_template')

    messages = [
        {'role': 'system', 'content': system_prompt},
        {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': user_text},
                {'type': 'image_url', 'image_url': {'url': image_url}},
            ],
        },
    ]
    result = self._make_request(
        messages, schema=get_prompt_schema('style_analysis'),
        model=STYLE_ANALYSIS_MODEL, user=user,
    )
    return result
```

A multimodális hívásban a kép URL-ként kerül az üzenetbe — a modell közvetlenül "látja" a borítót és szöveges analízist ad vissza. Az eredmény a `StyleReference` modellben tárolódik, ahol minden dimenzió külön mezőt kap.

## 6.2. Szövegdetektálás és szelekció

A stíluselemzés mellett a rendszer szövegdetektálást is végez a feltöltött képen. Ez azonosítja a borítón található szöveges elemeket (cím, szerzőnév, alcím, kiadó stb.) és metaadatokkal látja el őket:

```json
{
  "detected_texts": [
    {
      "id": 1,
      "text": "THE MIDNIGHT GARDEN",
      "text_type": "title",
      "position": "top-center",
      "style_description": "large serif white text with shadow"
    },
    {
      "id": 2,
      "text": "Sarah Mitchell",
      "text_type": "author_name",
      "position": "bottom-center",
      "style_description": "small sans-serif gold text"
    }
  ]
}
```

A felhasználó a frontend-en kiválaszthatja, mely szövegelemeket szeretné megtartani a tipográfiai stílus reprodukálásánál. Ez a `selected_text_ids` mezőben tárolódik. Ha a felhasználó például csak a cím stílusát szeretné átvenni (és az alcímet vagy kiadót nem), ezt itt jelölheti meg.

## 6.3. Referencia variánsok

A stílusreferencia pipeline működéséhez a rendszernek két származtatott képre van szüksége az eredeti borítóból:

1. **Clean variáns** — az eredeti kép szöveg nélkül (csak háttérgrafika)
2. **Text variáns** — a szöveg kiemelve fehér háttérre (csak tipográfia)

Ezek előállítása költséges (képgenerálási API hívások), ezért a rendszer lusta kiértékeléssel és cache-eléssel dolgozik:

```python
def ensure_reference_variant(style_ref, variant_type, user_id, user=None):
    if variant_type == 'clean':
        if style_ref.clean_image_path:
            return storage_service.get_signed_url(
                style_ref.clean_image_path, expires_in=600
            )

        signed_original = storage_service.get_signed_url(
            style_ref.image_path, expires_in=600
        )
        result = image_service.generate_clean_background(
            signed_original, user=user
        )
        upload = storage_service.upload_from_url(
            result['image_url'], folder='references'
        )
        get_supabase().table('style_references').update({
            'clean_image_path': upload['path']
        }).eq('id', style_ref.id).eq('user_id', user_id).execute()
        return storage_service.get_signed_url(upload['path'], expires_in=600)
```

Az első használatkor a variáns legenerálódik és az adatbázisban cache-elődik. Minden további generálásnál a cache-elt verzió töltődik be, így nem kell újra fizetni a variáns előállításáért. Ez a megoldás különösen fontos, mert egy stílusreferenciát a felhasználó tipikusan többször is felhasznál — minden új borítógenerálásnál.

### 6.3.1. Text layer verifikáció

A text variáns előállítása után a rendszer egy extra minőségellenőrzési lépést hajt végre. Az LLM megvizsgálja a generált text layert, és ellenőrzi, hogy valóban csak szöveget tartalmaz-e fehér háttéren:

```python
verification = llm_service.verify_text_layer(variant_url, user=user)
if not verification.get('is_clean', True) and verification.get('artifacts'):
    artifacts = verification['artifacts']
    cleanup_result = image_service.cleanup_text_layer(
        variant_url, artifacts_desc, text_details=text_details, user=user
    )
    variant_url = cleanup_result['image_url']
```

Ha a verifikáció artifaktumokat talál (például háttérelemek maradványait vagy torz szöveget), automatikusan elindít egy tisztítási lépést, amely eltávolítja ezeket. Ez a két fázisú ellenőrzés biztosítja, hogy a text layer valóban használható legyen a későbbi blending műveleteknél.

## 6.4. Referencia módok

A felhasználó három módban használhatja a stílusreferenciát:

| Mód | Felhasznált elemzés | Hatás |
|-----|---------------------|-------|
| **both** | feeling + layout + illustration_rules + typography | Teljes stílus átvétel |
| **background** | feeling + layout + illustration_rules | Csak vizuális elemek, új tipográfia |
| **text** | typography | Csak tipográfiai stílus, új vizuális |

A mód választás közvetlenül befolyásolja, hogy az elemzés mely részeit injektáljuk az LLM promptba:

```python
def get_style_analysis(self, mode: str = 'both') -> dict:
    if mode == 'text':
        return {'typography': self.typography or ''}
    elif mode == 'background':
        return {
            'feeling': self.feeling or '',
            'layout': self.layout or '',
            'illustration_rules': self.illustration_rules or '',
        }
    return {
        'feeling': self.feeling or '',
        'layout': self.layout or '',
        'illustration_rules': self.illustration_rules or '',
        'typography': self.typography or '',
    }
```

## 6.5. Text blending módok

A kétlépéses stílusreferencia pipeline utolsó fázisában — amikor a szöveget kell ráhelyezni az alapképre — három blending módszer közül választhat a felhasználó:

### 6.5.1. AI Blend

Az alapértelmezett és legösszetettebb mód. Két WaveSpeed hívást használ:

1. Az első összefésüli az alapképet és a text layert (a referencia tipográfiájával)
2. Egy LLM szövegcsere promptot generál, majd egy második WaveSpeed hívás lecseréli a referencia szövegeit a felhasználó könyvének adataira

Ez a mód adja a legjobb vizuális eredményt, mert az AI természetesen integrálja a szöveget a háttérrel, de a legdrágább is (extra LLM + 2 kép hívás).

### 6.5.2. Direct Overlay

Programmatikus megoldás PIL könyvtárral: a text layer fehér pixeleit átlátszóvá teszi, majd alpha-kompozícióval a base image-re helyezi. Utána egyetlen WaveSpeed cleanup hívás javítja az esetleges artifaktumokat:

```python
def blend_images_programmatic(base_image_url, text_layer_url,
                              white_threshold=240):
    base_img = Image.open(io.BytesIO(base_response.content)).convert('RGBA')
    text_img = Image.open(io.BytesIO(text_response.content)).convert('RGBA')

    text_data = text_img.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = text_data[x, y]
            if r >= white_threshold and g >= white_threshold \
               and b >= white_threshold:
                text_data[x, y] = (r, g, b, 0)
            else:
                brightness = (r + g + b) / 3
                opacity = int(255 * (1 - brightness / 255))
                text_data[x, y] = (r, g, b, min(255, opacity + 50))

    result = Image.alpha_composite(base_img, text_img)
    return result
```

A fehér háttér eltávolítása egy küszöbértékkel történik: minden pixel, amelynek RGB értékei meghaladják a 240-et, átlátszóvá válik. A sötétebb pixelek opacitása arányosan növekszik, így a szöveg természetesen jelenik meg az alapképen.

### 6.5.3. Separate Reference

A legegyszerűbb AI-alapú mód: egyetlen WaveSpeed edit hívás kap két referenciaképet — az alapképet és a text layert — és egy utasítást, hogy egyesítse őket. Ez gyorsabb és olcsóbb, mint az AI Blend, de kevesebb kontrollal rendelkezik a szövegcsere felett.
