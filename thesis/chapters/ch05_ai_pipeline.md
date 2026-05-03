# 5. AI generálási pipeline

Az InstaCover magfunkciója a könyvborító automatikus generálása mesterséges intelligencia segítségével. A generálási folyamat nem egyetlen API hívás, hanem több lépés láncolata: egy nagy nyelvi modell (LLM) kreatív promptot generál, egy képgenerálási szolgáltatás ennek alapján elkészíti a vizuális elemet, majd opcionálisan további lépések adják hozzá a tipográfiát. Szakdolgozatomban ezt a többlépéses feldolgozási láncot pipeline-nak nevezem.

A rendszer három különálló pipeline-t implementál, amelyek eltérő felhasználói igényeket szolgálnak ki. Ebben a fejezetben bemutatom mindhárom pipeline működését, a prompttervezés módszertanát, a képgenerálási integráció technikai részleteit, valamint a pipeline-ok közös infrastruktúráját.

## 5.1. Pipeline architektúra áttekintése

A pipeline-ok tervezésénél az volt a kiindulópontom, hogy a felhasználók igényei jelentősen eltérnek: egyesek csak háttérképet szeretnének (a szöveget saját maguk helyezik el), mások teljes borítót (háttér + tipográfia), megint mások egy meglévő borító stílusát szeretnék reprodukálni. Mindegyik eset eltérő lépésszámot és API-hívás-kombinációt igényel.

A három pipeline:

1. **Standard pipeline** — könyv adatok alapján generál borítót, opcionálisan tipográfiával
2. **Stílusreferencia pipeline** — feltöltött borítókép vizuális stílusát veszi alapul
3. **Sablon pipeline** — HTML/CSS sablonon alapuló tipográfiai réteg, szerver oldali renderelés

Mindhárom pipeline azonos életciklust követ: a felhasználó bemenete validáláson és kredit-ellenőrzésen megy keresztül, majd a háttérfeladat elindítja a megfelelő pipeline-t. Minden lépés előtt a rendszer ellenőrzi, hogy a felhasználó nem kezdeményezte-e a generálás megszakítását. A haladásról WebSocket eseményeken keresztül kap visszajelzést a kliens.

A pipeline-ok közös segédfüggvényt használnak a szegélydetektáláshoz. A képgenerálási szolgáltatások gyakran adnak egyszínű szegélyt az eredményhez, amit automatikusan eltávolítok:

```python
def _check_and_remove_border(image_url, gen_id):
    response = http_requests.get(image_url, timeout=60)
    response.raise_for_status()
    cropped_bytes = detect_and_crop_border(response.content)

    if cropped_bytes is not None:
        upload = storage_service.upload_bytes(cropped_bytes, folder='covers')
        return upload['public_url']
    else:
        return image_url
```

A `detect_and_crop_border` függvény a PIL könyvtárral pixel-szinten vizsgálja a kép széleit. Ha a szélső sorok és oszlopok színe megegyezik (egy toleranciaértéken belül), levágja azokat. Ez biztosítja, hogy a végeredmény konzisztens legyen függetlenül attól, hogy a képgeneráló API milyen szegélyt adott hozzá.

A megszakítás-ellenőrzés szintén közös mechanizmus:

```python
def _check_cancelled(gen_id):
    result = get_supabase().table('generations').select('status') \
        .eq('id', gen_id).execute()
    if result.data and result.data[0]['status'] != 'generating':
        raise GenerationCancelled(f"Generation #{gen_id} was cancelled")
```

Ez a függvény minden pipeline-lépés előtt lefut. Ha a felhasználó időközben megszakította a generálást (a frontend `cancel_generation` eseményt küldött), a pipeline azonnal leáll, és nem futtatja a további — költséges — API hívásokat.

## 5.2. Standard pipeline

A standard pipeline a legegyszerűbb útvonal: a felhasználó megadja könyve adatait (cím, szerző, műfaj, borítóötletek), és a rendszer ezekből generál borítót. Három almódja van, amelyeket a felhasználó a generálási beállításokban választhat ki.

### 5.2.1. Csak alapkép mód

Ez a legrövidebb útvonal (2 lépés). Az LLM egy szövegmentes háttérképet leíró promptot generál, majd a WaveSpeed API elkészíti a képet.

Az LLM prompt generálása során explicit utasítást kap: ne tartalmazzon szöveget az eredmény. Ezt a generált prompt végéhez fűzött kiegészítéssel is megerősítem:

```python
base_prompt = llm_service.generate_base_image_prompt(
    book_data, base_image_only=True, user=user
)
base_prompt += " Do not include any text, words, letters, titles, "
               "or typography anywhere in the image."
```

A kettős biztosítás szükséges, mert a képgenerálási modellek hajlamosak szöveget beilleszteni a könyvborítókra akkor is, ha a prompt ezt nem kéri — pusztán azért, mert a tanító adatban gyakran szerepelt szöveg a borítókon.

### 5.2.2. Egylépéses mód

Az egylépéses mód (szintén 2 lépés a pipeline-ban) egyetlen promptból generál teljes borítót szöveggel együtt. Az LLM ilyenkor a cím és szerzőnév tipográfiai elhelyezését is leírja a promptban. Ez gyorsabb és olcsóbb (1 LLM + 1 kép hívás), de a tipográfiai minőség kevésbé kontrollálható.

### 5.2.3. Kétlépéses mód

A kétlépéses mód (3 lépés) az alapértelmezett és leggyakrabban használt útvonal:

1. Az LLM szövegmentes háttérkép-promptot generál
2. A WaveSpeed generálja az alapképet
3. Egy második LLM hívás tipográfiai promptot generál, majd a WaveSpeed `edit` végpontja ráhelyezi a szöveget az alapképre

A harmadik lépésben a rendszer nem egy új képet generál, hanem a WaveSpeed szerkesztő API-ját használja. Ez a végpont egy meglévő képet (referenciaként) és egy szöveges utasítást kap bemenetül:

```python
signed_base_url = storage_service.get_signed_url(
    base_storage_path, expires_in=600
)
final_prompt = (
    f"Add the following text to the book cover "
    f"using this base image as reference: {text_prompt}"
)
final_result = image_service.generate_image_with_text(
    signed_base_url, final_prompt, aspect_ratio, user=user
)
```

Ez a megközelítés szétválasztja a vizuális tervezést és a tipográfiát, ami jobb eredményt ad: az alapkép nem torzul a szöveg beszúrásától, a tipográfia pedig a meglévő kompozícióhoz igazodik.

## 5.3. Sablon pipeline

A sablon pipeline eltérő megközelítést alkalmaz a tipográfiához: a szöveget nem AI-val generáltatja a képre, hanem egy HTML/CSS sablon alapján rendereli szerver oldalon. Ez precíz, pixelpontos kontrollt biztosít a felhasználónak a szöveg elhelyezése, betűtípusa, mérete és stílusa felett.

A pipeline három lépésből áll:

1. LLM generál egy szövegmentes háttérkép-promptot (opcionálisan stílusreferenciával)
2. WaveSpeed elkészíti az alapképet
3. A Playwright böngésző-motor rendereli a végleges borítót

A harmadik lépés a legérdekesebb. A `CoverTemplate` modell két JSONB mezőt tartalmaz (`title_box` és `author_box`), amelyek precízen definiálják a szövegdobozok pozícióját, méretét, betűtípusát és stílusát. Ezekből a rendszer egy teljes HTML oldalt épít:

```python
def render_cover_from_template(self, base_image_url, template,
                               book_title, author_name, aspect_ratio='2:3'):
    ratio = ASPECT_RATIOS.get(aspect_ratio, ASPECT_RATIOS['2:3'])
    width, height = ratio['width'], ratio['height']

    html_content = _build_html(
        base_image_url=base_image_url,
        width=width, height=height,
        title_box=title_box, author_box=author_box,
        book_title=book_title, author_name=author_name,
    )

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': width, 'height': height},
            device_scale_factor=1,
        )
        page = context.new_page()
        page.set_content(html_content, wait_until='networkidle')
        page.evaluate('() => document.fonts.ready')
        image_bytes = page.locator('#canvas').screenshot(type='png')
        browser.close()
        return image_bytes
```

A generált HTML a háttérképet CSS `background-image`-ként tölti be, a szövegdobozokat abszolút pozicionálással helyezi el, és a Google Fonts CDN-ről tölt be 14 előre jóváhagyott betűtípust. A `wait_until='networkidle'` biztosítja, hogy a betűtípusok betöltődjenek a screenshot előtt, a `document.fonts.ready` Promise pedig garantálja a renderelés teljességét.

A Playwright használatának előnye, hogy a CSS teljes eszköztára rendelkezésre áll: text-shadow, letter-spacing, text-transform, opacity — mindez pixelpontosan megjelenik a végleges képen. Hátránya a szerver oldali erőforrásigény: a Docker konténerbe Chromium böngészőt is telepíteni kell.

## 5.4. Prompt engineering

A generálási minőség döntő mértékben függ az LLM-nek adott promptoktól. Az összes prompt sablon egy központi `prompts.json` fájlban él, amely a rendszer indításakor egyszer betöltődik és cache-elődik.

### 5.4.1. Prompt struktúra

Minden LLM hívás két üzenetből áll: egy `system` prompt határozza meg a szerepet és szabályokat, egy `user` prompt adja meg a konkrét feladatot. A válasz formátumát JSON Schema-val kényszerítem ki:

```python
payload = {
    'model': model,
    'messages': messages,
    'temperature': 0.7,
    'max_tokens': 2000,
}
if schema:
    payload['response_format'] = {
        'type': 'json_schema',
        'json_schema': schema,
    }
```

A JSON Schema használata garantálja, hogy az LLM mindig géppel feldolgozható formátumban válaszoljon. Ha a modell mégis hibás JSON-t ad vissza (ritka, de előfordul), egy többlépcsős javítási mechanizmus próbálja helyreállítani: először standard parse, majd kódblokk-kivonás, végül a `json_repair` könyvtár.

### 5.4.2. Modellválasztás

A rendszer két LLM modellt használ:

- **Grok 4.1 Fast** — Az alapértelmezett modell promptgeneráláshoz. Gyors válaszidővel rendelkezik és jól teljesít kreatív szövegalkotásban.
- **Gemini 3 Flash** — Kizárólag képelemzési feladatokhoz (stílusanalízis, szövegdetektálás, réteg-verifikáció), mert multimodális képességei kifinomultabbak.

Mindkét modell az OpenRouter[8] API-n keresztül érhető el, ami egy egységes felületet biztosít különböző LLM szolgáltatók modelljeihez. A választásom azért esett az OpenRouter-re, mert egyetlen API kulccsal több tucat modell elérhető, és modellváltás kódmódosítás nélkül lehetséges.

### 5.4.3. Könyvadatok injektálása

A felhasználó által megadott könyvadatokat strukturáltan építem be a promptba:

```python
def _build_book_details_content(book_data, include_title=True):
    parts = []
    if include_title and book_data.get('book_title'):
        parts.append(f"Title: {book_data.get('book_title')}")
    if book_data.get('cover_ideas'):
        parts.append(
            f"Cover Ideas (author's vision): {book_data.get('cover_ideas')}"
        )
    if book_data.get('description'):
        parts.append(f"Description: {book_data.get('description')}")
    if book_data.get('genres'):
        parts.append(f"Genre(s): {', '.join(book_data.get('genres', []))}")
    return "\n".join(parts)
```

A "Cover Ideas" mező különösen fontos: itt a felhasználó saját elképzelését adja meg (pl. "sötét erdő, holdvilág, egy magányos alak"), amely közvetlenül irányítja a vizuális generálást. Ez a mező opcionális — ha nincs megadva, az LLM a cím, műfaj és leírás alapján önállóan tervez.

## 5.5. Képgenerálási integráció

A képgenerálást a WaveSpeed AI[9] szolgáltatás végzi, amely a ByteDance Seedream V4.5 modelljét üzemelteti. Ez egy korszerű text-to-image modell, amely különösen jól kezeli a könyvborítókra jellemző igényeket: magas felbontás, szöveges elemek renderelése, konzisztens stílusú illusztrációk.

### 5.5.1. Aszinkron job-kezelés

A WaveSpeed API aszinkron működésű: a kérés beküldésekor azonnal visszaad egy job azonosítót, a kép generálása pedig háttérben történik. A rendszernek polling mechanizmussal kell lekérdeznie az eredményt:

```python
def _submit(self, url, payload, user=None):
    r = requests.post(
        url, headers=self._headers(), json=payload, timeout=30
    )
    job_id = r.json()["data"]["id"]
    return job_id

def _poll(self, job_id, interval=1):
    url = f"{self.base_url}/predictions/{job_id}/result"
    poll_count = 0
    while True:
        r = requests.get(url, headers=self._headers(), timeout=30)
        data = r.json()["data"]
        poll_count += 1

        if data["status"] == "completed":
            return data["outputs"][0]
        if data["status"] == "failed":
            raise RuntimeError(f"Job failed: {data.get('error')}")
        if poll_count >= 120:
            raise RuntimeError("Job timed out")
        time.sleep(interval)
```

A polling másodpercenként kérdez, és legfeljebb 120 próbálkozás után timeout hibát dob. Ez biztosítja, hogy egy elakadt job ne blokkolja végtelenül a rendszert.

### 5.5.2. Két API végpont

A WaveSpeed két végpontot biztosít:

- **`/bytedance/seedream-v4.5`** — Text-to-image generálás. Bemenete egy szöveges prompt és a kívánt méret.
- **`/bytedance/seedream-v4.5/edit`** — Képszerkesztés. Bemenete egy vagy több referenciakép, egy szöveges utasítás, és a kívánt méret. Ez a végpont a tipográfia hozzáadásához és a stílusreferencia-alapú generáláshoz használatos.

A méret meghatározásánál a felhasználó által választott képarányt (pl. 2:3, 3:2, 1:1) pixel-értékekre képezem le egy előre definiált táblázat alapján.

## 5.6. Kredit-integráció a pipeline-ban

A pipeline-ok lépésenként vonnak le krediteket. Nem előre számolom ki és vonom le a teljes költséget, hanem minden egyes API híváskor külön-külön történik a levonás. Ennek oka, hogy ha egy közbenső lépés elbukik, a felhasználó csak az addig felhasznált lépések kreditjét veszíti el.

A költségek:

- LLM hívás: 1 kredit
- Képgenerálás: 6 kredit

Egy tipikus kétlépéses standard generálás összesen 14 kreditet fogyaszt (2 LLM + 2 kép = 2×1 + 2×6). A stílusreferencia pipeline a legtöbb hívással járó útvonal (akár 5 lépés, 20+ kredit), ezért a frontend generálás indítása előtt költségbecslést mutat, ami a kiválasztott beállítások alapján dinamikusan változik.

A kredit-levonás az `_make_request` (LLM) és `_submit` (kép) metódusokban történik, közvetlenül az API hívás előtt:

```python
def _submit(self, url, payload, user=None):
    if user is not None:
        result = deduct_image_credit(user)
        if not result['success']:
            raise InsufficientCreditsError(
                required=6, available=result['remaining']
            )
    r = requests.post(url, headers=self._headers(), json=payload, timeout=30)
    ...
```

Ha a kredit nem elegendő, az `InsufficientCreditsError` kivétel azonnal leállítja a pipeline-t, és a felhasználó hibaüzenetet kap a WebSocket-en.

## 5.7. Összegzés

A háromágú pipeline architektúra lehetővé teszi, hogy egyetlen alkalmazáson belül három fundamentálisan eltérő generálási stratégiát szolgáljak ki. A standard pipeline egyszerű és gyors, a stílusreferencia pipeline finomhangolt vizuális konzisztenciát biztosít, a sablon pipeline pedig pixelpontos tipográfiai kontrollt ad.

A megoldás kulcselemei:

- Externalizált prompt sablonok JSON fájlban a könnyű iterációhoz
- JSON Schema kényszerített LLM válaszformátum a megbízható gépi feldolgozáshoz
- Aszinkron job-kezelés polling mechanizmussal a képgeneráláshoz
- Lépésenkénti kredit-levonás a méltányos költségelszámoláshoz
- Automatikus szegélydetektálás és -eltávolítás a konzisztens output minőséghez
- Megszakítás-ellenőrzés minden lépés előtt a felhasználói élmény javításához

A következő fejezetben a stílusreferencia rendszert mutatom be részletesen, amely a három pipeline közül a legösszetettebb: a feltöltött képek AI-alapú dekompozícióját és az ebből származó vizuális irányítás módszereit.
