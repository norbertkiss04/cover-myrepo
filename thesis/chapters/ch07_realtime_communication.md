# 7. Valós idejű kommunikáció

A könyvborító generálása 15-60 másodpercig tart a pipeline típusától és a lépések számától függően. Ez az időtartam túl hosszú ahhoz, hogy a felhasználó visszajelzés nélkül várakozzon, szüksége van arra, hogy lépésről lépésre lássa a haladást. A hagyományos HTTP kérés-válasz modell erre nem alkalmas: a hosszú pollozás pazarló, a szerver oldali események (SSE) pedig egyirányúak. A választásom a WebSocket protokollra[16] esett, konkrétan a Socket.IO[6] könyvtárra, amely kétirányú, valós idejű kommunikációt biztosít.

## 7.1. Kommunikációs architektúra

A rendszer a Flask-SocketIO kiszolgálót és a Socket.IO JavaScript klienst használja. A kommunikáció szoba-alapú (room-based): minden felhasználó egy `user_{id}` nevű szobába kerül csatlakozáskor, és az összes őt érintő esemény ebbe a szobába érkezik.

A backend oldalon a Flask-SocketIO natívan integrálódik a Flask alkalmazásba:

```python
@socketio.on('connect')
def handle_connect(auth=None):
    token = auth.get('token') if auth and isinstance(auth, dict) else None
    if not token:
        disconnect()
        return False

    supabase_user = get_user_from_token(token)
    if not supabase_user:
        disconnect()
        return False

    user = User.from_row(db_result.data[0])
    connected_users[request.sid] = user
    join_room(_room_for(user.id))
```

A csatlakozás során három dolog történik: JWT token validáció, a felhasználó beazonosítása az adatbázisból, és a szobához való csatlakozás. Ha bármelyik lépés sikertelen, a kapcsolat azonnal bontásra kerül.

## 7.2. Eseménymodell

A rendszer hét fő eseménytípust definiál:

| Esemény | Irány | Leírás |
|---------|-------|--------|
| `start_generation` | kliens → szerver | Generálás indítása |
| `generation_started` | szerver → kliens | Visszaigazolás, generálás elindult |
| `generation_progress` | szerver → kliens | Lépésenkénti haladás |
| `generation_completed` | szerver → kliens | Végleges eredmény |
| `generation_failed` | szerver → kliens | Hiba történt |
| `cancel_generation` | kliens → szerver | Generálás megszakítása |
| `active_generation` | szerver → kliens | Aktív generálás visszaállítása reconnect után |

A `generation_progress` esemény tartalmazza az aktuális lépés sorszámát, az összes lépés számát, és egy szöveges üzenetet:

```python
def on_progress(step, total, message):
    get_supabase().table('generations').update({
        'current_step': step,
        'total_steps': total,
        'step_message': message,
    }).eq('id', gen_id).execute()
    socketio.emit('generation_progress', {
        'generation_id': gen_id,
        'step': step,
        'total_steps': total,
        'message': message,
    }, room=room)
```

A haladási információ az adatbázisba is íródik, nem csak a WebSocket-re kerül. Ennek oka, hogy ha a kliens kapcsolata megszakad és újracsatlakozik, a szerver az adatbázisból képes visszaállítani az aktuális állapotot.

## 7.3. Háttérfeladat-kezelés

A generálási pipeline nem a WebSocket eseménykezelő szálában fut, mert az túl sokáig blokkolná a szerver válaszképességét. Ehelyett a Flask-SocketIO `start_background_task` metódusával indítok háttérfeladatot:

```python
socketio.start_background_task(
    _run_generation_task,
    current_app._get_current_object(),
    generation, user,
    generation.style_reference_id,
    generation.use_style_image,
    generation.aspect_ratio,
    generation.base_image_only,
    generation.reference_mode,
    text_blending_mode,
    generation.cover_template_id,
)
```

A háttérfeladat megkapja az alkalmazás kontextust (szükséges a konfiguráció és adatbázis eléréséhez), a generálás és felhasználó objektumokat, valamint az összes konfigurációs paramétert. A feladat futása alatt a szerver szabad marad más kérések kiszolgálására.

A duplikált futás megelőzésére egy `_running_tasks` halmaz tartja számon az aktív generálás-azonosítókat:

```python
_running_tasks = set()

def _run_generation_task(app, generation, user, ...):
    with app.app_context():
        gen_id = generation.id
        if gen_id in _running_tasks:
            return
        _running_tasks.add(gen_id)
        try:
            ...
        finally:
            _running_tasks.discard(gen_id)
```

## 7.4. Hibakezelés és állapot-konzisztencia

A háttérfeladat három különböző hibatípust kezel eltérő módon:

```python
except Exception as e:
    if isinstance(e, GenerationCancelled):
        return

    if isinstance(e, InsufficientCreditsError):
        error_message = f"Insufficient credits: need {e.required}, "
                        f"have {e.available}"
    else:
        error_message = 'Generation failed. Please try again.'

    get_supabase().table('generations').update({
        'status': 'failed',
        'error_message': error_message,
    }).eq('id', gen_id).execute()

    socketio.emit('generation_failed', {
        'generation_id': gen_id,
        'error': error_message,
    }, room=room)
```

A `GenerationCancelled` kivétel esetén a felhasználó megszakította a folyamatot, így a feladat csendben leáll, mert a megszakítás kezelés már frissítette az adatbázist. Az `InsufficientCreditsError` azt jelzi, hogy elfogytak a kreditek közben, és specifikus hibaüzenetet küld a felhasználónak. Minden egyéb kivétel (API timeout, hálózati hiba stb.) esetén a felhasználó generikus hibaüzenetet kap, míg a szerveren részletes log keletkezik.

Minden esetben az adatbázis konzisztens állapotba kerül (`status='failed'`), és a kliens értesül a hibáról.

## 7.5. Reconnect és állapot-visszaállítás

Ha a felhasználó böngészője újratöltődik vagy a hálózati kapcsolat átmenetileg megszakad, a Socket.IO automatikusan megpróbálja újra felépíteni a kapcsolatot (legfeljebb 10 próbálkozás, exponenciális backoff). Újracsatlakozáskor a szerver ellenőrzi, hogy van-e aktív generálás:

```python
active = _check_active_generation(user.id)
if active:
    emit('active_generation', {
        'generation_id': active.id,
        'book_title': active.book_title,
        'step': active.current_step or 0,
        'total_steps': active.total_steps or 0,
        'step_message': active.step_message or 'Resuming generation...',
    })
```

Ez biztosítja, hogy a felhasználó soha ne veszítse el a generálási folyamat állapotát: akár szándékos oldalújratöltés, akár hálózati probléma esetén a progress panel azonnal visszaáll az aktuális lépéshez.

Emellett, ha a generálás az elmúlt 2 percben fejeződött be, a szerver a `generation_completed` eseményt is elküldi, így a felhasználó akkor sem veszít eredményt, ha éppen a befejezés pillanatában szakadt meg a kapcsolata.

## 7.6. Stale detection

Ha egy generálás valamilyen okból elakad (szerver újraindulás, kezeletlen kivétel a háttérfeladatban), a rendszer nem hagyja végtelen "generating" állapotban. Minden alkalommal, amikor aktív generálást keres, ellenőrzi annak korát:

```python
STALE_TIMEOUT_MINUTES = 5

def _is_stale(generation):
    created = generation.created_at
    age_minutes = (datetime.now(timezone.utc) - created).total_seconds() / 60
    return age_minutes > STALE_TIMEOUT_MINUTES
```

Az 5 percnél régebbi, még mindig "generating" státuszú rekordok automatikusan "failed" állapotra váltanak. Ez megakadályozza, hogy egy felhasználó végleg blokkolva maradjon, és lehetővé teszi, hogy új generálást indítson.

## 7.7. Frontend állapotgép

A kliens oldalon a `GenerationContext` React kontextus kezeli a WebSocket kommunikációt és a generálási állapotot. Az állapotgép négy állapotot definiál: idle (nincs aktív generálás, a felhasználó kitöltheti az űrlapot), generating (generálás folyamatban, a progress panel látható), completed (generálás kész, az eredmény megtekinthető) és failed (hiba történt, hibaüzenet látható).

Az átmenetek kizárólag szerver-eseményeken alapulnak:

```typescript
socket.on('generation_progress', (data) => {
  setStep(data.step);
  setTotalSteps(data.total_steps);
  setStepMessage(data.message);
});

socket.on('generation_completed', (data) => {
  setStatus('completed');
  setResult(data.generation);
});

socket.on('generation_failed', (data) => {
  setStatus('failed');
  setError(data.error);
});
```

A generálás indítása is WebSocket-en történik (nem REST hívás):

```typescript
const startGeneration = useCallback((data: GenerationInput) => {
  const socket = getSocket();
  if (!socket?.connected) {
    setError('Not connected to server. Please refresh the page.');
    return;
  }
  socket.emit('start_generation', data);
}, []);
```

Ez a döntés leegyszerűsíti az architektúrát: a teljes generálási folyamat egyetlen csatornán zajlik, nincs szükség HTTP és WebSocket közötti koordinációra.

## 7.8. Rate limiting

A WebSocket eseményekre is alkalmazok rate limitinget, hogy megakadályozzam a visszaélést. Egy felhasználó legfeljebb 10 eseményt küldhet 60 másodperc alatt:

```python
SOCKET_RATE_LIMIT = 10
SOCKET_RATE_WINDOW = 60

def _check_socket_rate_limit(sid):
    now = _time.time()
    window_start = now - SOCKET_RATE_WINDOW
    _rate_limit_store[sid] = [
        t for t in _rate_limit_store[sid] if t > window_start
    ]
    if len(_rate_limit_store[sid]) >= SOCKET_RATE_LIMIT:
        return False
    _rate_limit_store[sid].append(now)
    return True
```

Ha a limit túllépésre kerül, a felhasználó `generation_error` eseményt kap és a kérése elutasítódik.
