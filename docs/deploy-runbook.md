# Deploy Runbook – InstaCover

## Architektúra áttekintés

```
[Cloudflare DNS] → [Nginx Proxy Manager (VPS)] → [instacover-web :7711] → Nginx (statikus React build)
                                                 → [instacover-api :7710] → Gunicorn + Flask + SocketIO
```

Külső szolgáltatások:
- Supabase (PostgreSQL + Storage + Auth)
- OpenRouter (LLM API)
- WaveSpeed AI (képgenerálás)
- Sentry (hibakövetés)

## Előfeltételek

- Docker + Docker Compose a szerveren
- Érvényes `.env` fájl a `backend/` mappában
- Supabase projekt beállítva (táblák, RLS policy-k, RPC funkciók)
- Domain konfiguráció (DNS, SSL)

## Környezeti változók

### Backend (`backend/.env`)

| Változó | Leírás |
|---|---|
| `SUPABASE_URL` | Supabase projekt URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side) |
| `OPENROUTER_API_KEY` | OpenRouter LLM API kulcs |
| `WAVESPEED_API_KEY` | WaveSpeed képgenerálás API kulcs |
| `WAVESPEED_BASE_URL` | WaveSpeed API base URL |
| `FRONTEND_URL` | Frontend URL (CORS beállításhoz) |
| `FLASK_ENV` | `production` |
| `SENTRY_DSN` | Sentry projekt DSN (opcionális) |

### Frontend (build-time args)

| Változó | Leírás |
|---|---|
| `VITE_API_URL` | Backend API URL |
| `VITE_SUPABASE_URL` | Supabase projekt URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side) |

## Deployment lépések

### 1. Kód frissítés

```bash
ssh vps
cd /path/to/cover-myrepo
git pull origin main
```

### 2. Konténerek újraépítése és indítása

```bash
docker compose build --no-cache
docker compose up -d
```

### 3. Állapot ellenőrzés

```bash
docker ps
curl -s http://localhost:7710/health | jq .
curl -s http://localhost:7710/metrics | jq .
```

Elvárt health response:
```json
{"status": "healthy"}
```

### 4. Rollback (ha szükséges)

```bash
docker compose down
git checkout <previous-commit>
docker compose build --no-cache
docker compose up -d
```

## Konténer architektúra

| Konténer | Port | Leírás |
|---|---|---|
| `instacover-api` | 7710 → 5000 | Flask backend (Gunicorn + eventlet) |
| `instacover-web` | 7711 → 80 | React frontend (Nginx static serve) |

Hálózat: `authorverse` bridge network (konténerek közötti kommunikáció).

## CI/CD pipeline

A GitHub Actions automatikusan futtatja minden push/PR esetén:
1. Backend tesztek (pytest + coverage)
2. Frontend build (TypeScript check + Vite build)
3. Linting (flake8)

A deployment manuális (`git pull` + `docker compose up`). Automatikus deployment nincs konfigurálva.

## Adatbázis

A Supabase kezeli az adatbázist (hosted PostgreSQL). Szükséges objektumok:
- **Táblák:** `users`, `generations`, `style_references`, `invites`, `cover_templates`
- **RPC funkciók:** `deduct_credits(p_user_id, p_amount)`, `refund_credits(p_user_id, p_amount)`, `consume_invite(p_code, p_google_id)`
- **Storage bucket:** `covers` (private, signed URL hozzáférés)
- **RLS policy-k:** Minden tábla user_id alapú szűréssel

## Monitoring és riasztások

- **Health check:** `GET /health` → 200 OK
- **Metrics:** `GET /metrics` → uptime, request count, error count, memory
- **Sentry:** Automatikus exception tracking és alerting
- **Docker logs:** `docker logs instacover-api --tail 100 -f`

## Ismert problémák és megkerülések

| Probléma | Megkerülés |
|---|---|
| Supabase free tier 1 GB storage limit | Régi generálások rendszeres törlése |
| WaveSpeed timeout (120s polling) | Automatikus retry nincs, user újraindítja |
| Gunicorn eventlet kompatibilitás | Specifikus verzió pin-ek a requirements.txt-ben |
