# ADR-0004: WebSocket (Socket.IO) a valós idejű kommunikációhoz

- Dátum: 2025-12-01
- Státusz: Elfogadva

## Kontextus

A borítógenerálási pipeline 2-5 lépésből áll, és egy teljes generálás 30-120 másodpercig tarthat (külső API hívások: LLM prompt generálás + képgenerálás polling). A felhasználónak valós idejű visszajelzést kell kapnia a folyamat aktuális állapotáról (melyik lépésnél tart, hány lépés van összesen). Emellett szükség van generálás megszakítási lehetőségre is.

## Döntés

**Flask-SocketIO** használata Socket.IO protokollal:
- JWT token-alapú autentikáció a WebSocket kapcsolaton
- Server → Client események: `generation_progress`, `generation_completed`, `generation_failed`
- Client → Server események: `start_generation`, `cancel_generation`
- Reconnect esetén aktív generálás állapotának visszaállítása

## Megfontolt alternatívák

| Alternatíva | Elutasítás oka |
|---|---|
| HTTP polling (client-side) | Felesleges terhelés, nem valós idejű, bonyolultabb kliens logika |
| Server-Sent Events (SSE) | Egyirányú (server → client), nem támogatja a cancel műveletet |
| WebSocket (raw, ws library) | Nincs beépített reconnect, room management, fallback |

## Következmények

- Socket.IO automatikus reconnect + fallback long-polling-ra → megbízható kapcsolat
- Room-based architecture: minden user saját room-ban → izolált üzenetek
- Generálás megszakítás: kliens küld `cancel_generation` → szerver ellenőrzi DB státuszt minden pipeline lépés előtt
- Kredit-visszatérítés cancel esetén → atomikus Supabase RPC hívás
- Frontend állapotgép szükséges: idle → generating → completed/failed/cancelled
- Gunicorn + eventlet worker szükséges production-ben a WebSocket támogatáshoz
