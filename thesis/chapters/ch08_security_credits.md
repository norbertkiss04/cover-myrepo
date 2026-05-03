# 8. Biztonság és kreditrendszer

Egy publikusan elérhető webalkalmazásnál, amely költséges külső API-kat hív (LLM és képgenerálás), a biztonság és a költségkontroll kritikus. Ebben a fejezetben bemutatom az autentikációs rendszert, a több szintű jogosultság-kezelést, a bemeneti validációt, a prompt injection elleni védelmet és az atomikus kreditrendszert.

## 8.1. Autentikáció

Az autentikációt a Supabase Auth[5] szolgáltatás végzi, amely JWT token alapú session kezelést biztosít. Két belépési módot támogatok: email/jelszó és Google OAuth.

A backend kétféle token-validációt implementál:

**JWT token** (felhasználói hozzáférés): Minden REST kérés és WebSocket csatlakozás egy Supabase által kibocsátott JWT-t tartalmaz. A backend a Supabase SDK-val validálja:

```python
def get_user_from_token(token):
    response = current_app.supabase.auth.get_user(token)
    return response.user
```

**API token** (programozói hozzáférés): Admin felhasználók számára elérhető, `ic_` prefixű, 64 hexadecimális karakterből álló token. Ez lehetővé teszi a generálási API programozói elérését (pl. automatizáláshoz):

```python
API_TOKEN_PREFIX = 'ic_'
API_TOKEN_BYTES = 32

def generate_api_token():
    return API_TOKEN_PREFIX + secrets.token_hex(API_TOKEN_BYTES)
```

## 8.2. Meghívó rendszer

Az alkalmazás zárt bétában működik: regisztrálni kizárólag érvényes meghívókóddal lehet. A meghívókódok kriptográfiailag biztonságos, URL-kompatibilis tokenek (16 byte, `secrets.token_urlsafe`), 7 napos lejárattal.

A meghívó felhasználása atomikus adatbázis-művelet:

```sql
CREATE OR REPLACE FUNCTION public.consume_invite(
    p_code TEXT, p_google_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE invite_id BIGINT;
BEGIN
    UPDATE public.invites
    SET used_at = NOW(), used_by_google_id = p_google_id
    WHERE code = p_code
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING id INTO invite_id;

    RETURN invite_id IS NOT NULL;
END; $$;
```

Az `UPDATE ... WHERE used_at IS NULL` biztosítja, hogy egy kódot csak egyszer lehessen felhasználni — még párhuzamos kérések esetén is.

## 8.3. Row-Level Security

A Supabase PostgreSQL-ben Row-Level Security (RLS)[15] policy-kat alkalmazok minden táblán. Ez az adatbázis szintű védelmi réteg garantálja, hogy egy felhasználó kizárólag saját adatait érheti el:

```sql
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own generations"
    ON public.generations FOR ALL
    USING (user_id = (
        SELECT id FROM public.users
        WHERE google_id = auth.uid()::text
    ))
    WITH CHECK (user_id = (
        SELECT id FROM public.users
        WHERE google_id = auth.uid()::text
    ));
```

Ez a minta minden táblán azonos: a `users` tábla `google_id = auth.uid()::text` feltétellel, a többi tábla a `user_id` mezőn keresztül, alkérdéssel visszavezetve az autentikált felhasználóra.

Az RLS kiegészíti — nem helyettesíti — az alkalmazás szintű szűrést. A backend kódban is minden lekérdezés tartalmazza a `.eq('user_id', user.id)` feltételt. Ez a "defense in depth" elv: ha az alkalmazás szintű szűrés hibás lenne, az adatbázis szintű védelem még megáll.

## 8.4. Input validáció és prompt injection

Mivel a felhasználó szöveges bemenetei LLM promptokba kerülnek, a prompt injection[17] reális támadási vektor. Egy rosszindulatú felhasználó megpróbálhatja az LLM viselkedését módosítani a bemeneti mezőkön keresztül.

A védekezés két rétegből áll. Először a bemenet sanitizálása: vezérlőkarakterek eltávolítása, hossz-limitálás:

```python
MAX_TITLE_LENGTH = 200
MAX_LONG_TEXT_LENGTH = 2000

def sanitize_text(value, max_length=MAX_SHORT_TEXT_LENGTH):
    if not isinstance(value, str):
        return None
    value = value.strip()
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
    return value[:max_length]
```

Majd regex-alapú mintaillesztés a gyakori injection technikákra:

```python
INJECTION_PATTERNS = re.compile(
    r'(?:ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?'
    r'|you\s+are\s+now\s+(?:a|an)\s+'
    r'|system\s*:\s*'
    r'|<\s*(?:script|system|admin)'
    r'|\bDAN\b.*\bjailbreak\b'
    r'|override\s+(?:all\s+)?(?:safety|content|policy))',
    re.IGNORECASE,
)
```

Ha a mintaillesztés pozitív eredményt ad, a generálás elutasításra kerül. Ez nem tökéletes védelem (a prompt injection nem oldható meg regex-szel teljes bizonyossággal), de az ismert, gyakori támadási mintákat kiszűri.

A harmadik védelmi vonal az, hogy a felhasználó szövege soha nem kerül közvetlenül a system promptba — mindig a user prompton belül, strukturált formátumban jelenik meg.

## 8.5. Rate limiting

Több szintű rate limitinget alkalmazok a visszaélések megelőzésére:

- **REST API** — Flask-Limiter végpont-specifikus korlátokkal: 30 kérés/perc az általános végpontokon, 10/perc a kredit-kiosztáson, 5/perc az API token generáláson.
- **WebSocket** — Egyéni implementáció: 10 esemény/60 másodperc felhasználónként. A sliding window algoritmus időbélyegeket tárol és a régieket kiszűri.
- **Természetes korlát** — A kreditrendszer önmagában rate limiter: ha elfogynak a kreditek, nem indítható több generálás.

## 8.6. Kreditrendszer

A kreditrendszer kettős célt szolgál: költségkontrollt biztosít (minden generálás valós API költséggel jár), és fair használatot ösztönöz a felhasználók között.

### 8.6.1. Költségstruktúra

| Művelet | Költség | Indoklás |
|---------|---------|----------|
| LLM hívás | 1 kredit | Alacsony API költség (~$0.001) |
| Képgenerálás | 6 kredit | Magasabb API költség (~$0.03) |
| Kezdő egyenleg | 200 kredit | ~15-20 teljes generálásra elegendő |

### 8.6.2. Atomikus műveletek

A kredit-levonás race condition-érzékeny: ha két párhuzamos kérés egyszerre próbál levonni, az egyenleg negatívba mehet. Ezt PostgreSQL `SELECT ... FOR UPDATE` sorszintű zárolással oldom meg:

```sql
CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_user_id BIGINT, p_amount INT
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_credits INT;
    new_credits INT;
BEGIN
    SELECT credits INTO current_credits
    FROM public.users WHERE id = p_user_id
    FOR UPDATE;

    IF current_credits IS NULL OR current_credits < p_amount THEN
        RETURN NULL;
    END IF;

    UPDATE public.users
    SET credits = credits - p_amount, updated_at = NOW()
    WHERE id = p_user_id AND credits >= p_amount
    RETURNING credits INTO new_credits;

    RETURN new_credits;
END; $$;
```

A `FOR UPDATE` zárolja a sort az olvasástól a tranzakció végéig. Az `UPDATE` feltételében ismételt `credits >= p_amount` ellenőrzés biztosítja, hogy még ha valami hiba miatt a zárolás nem lenne hatékony, az egyenleg akkor sem megy negatívba.

### 8.6.3. Lépésenkénti levonás

A kreditek nem egyben, hanem lépésenként vonódnak le a pipeline futása közben. Ha egy közbülső lépés elbukik, a felhasználó csak az addig ténylegesen elhasznált krediteket veszíti el. Ez méltányosabb, mint az előre levonás + visszatérítés modell.

### 8.6.4. Dinamikus költségbecslés

A frontend a generálás indítása előtt költségbecslést kér a backend-től, amely a kiválasztott beállítások (pipeline típus, referencia mód, blending mód, cache-elt variánsok megléte) alapján számítja a várható költséget:

```python
def calculate_generation_cost(
    use_style_image, base_image_only, reference_mode,
    text_blending_mode, style_ref_has_clean, style_ref_has_text,
    two_step_generation, use_template,
) -> dict:
    llm_calls = 0
    image_calls = 0

    if use_template:
        llm_calls, image_calls = 1, 1
    elif base_image_only:
        llm_calls, image_calls = 1, 1
    elif use_style_image:
        llm_calls, image_calls = 2, 2
        if reference_mode in ('both', 'background') \
           and not style_ref_has_clean:
            image_calls += 1
        ...

    total = llm_calls * LLM_CALL_COST + image_calls * IMAGE_CALL_COST
    return {'llm_calls': llm_calls, 'image_calls': image_calls, 'total': total}
```

A `style_ref_has_clean` és `style_ref_has_text` paraméterek figyelembe veszik, hogy a variánsok már cache-elve vannak-e — ha igen, azokért nem kell fizetni újra.

## 8.7. Összegzés

A biztonsági modell a "defense in depth" elvet követi: minden szinten van védelem, és egyetlen réteg megkerülése nem kompromittálja a teljes rendszert. Az RLS az adatbázisban, a token validáció a backend-ben, az input sanitizáció a bemenetnél, a rate limiting a terhelésnél, és a kreditrendszer a költségnél — együttesen biztosítják, hogy a rendszer biztonságosan és fenntarthatóan működjön.
