# Observability – InstaCover

## Áttekintés

A rendszer három szintű megfigyelhetőséget implementál: strukturált logolás, metrikák és hibakövetés.

## 1. Strukturált logolás

### Implementáció

`python-json-logger` könyvtár használata — minden log sor JSON formátumú, gépi feldolgozásra optimalizált.

### Log formátum

```json
{
  "timestamp": "2026-01-15T14:32:01.123Z",
  "level": "INFO",
  "name": "app.services.pipeline_service",
  "message": "Gen #42 COMPLETED successfully (two-step mode)"
}
```

### Log szintek használata

| Szint | Mikor használjuk |
|---|---|
| DEBUG | Részletes diagnosztika (token validáció, poll count) |
| INFO | Normál üzleti események (generálás indítás/befejezés, user login, kredit levonás) |
| WARNING | Nem-kritikus hibák (token érvénytelen, kredit elégtelen, border detection sikertelen) |
| ERROR | Kritikus hibák (DB hiba, API token mentés sikertelen) |

### Log hozzáférés

```bash
docker logs instacover-api --tail 100 -f
docker logs instacover-api --since 1h | jq '.level == "ERROR"'
```

## 2. Metrikák

### `/metrics` endpoint

`GET /metrics` — publikus endpoint alapvető szerver-metrikákkal.

Response:
```json
{
  "uptime_seconds": 86400,
  "total_requests": 1523,
  "error_count": 12,
  "requests_by_method": {
    "GET": 980,
    "POST": 543
  },
  "python_version": "3.11.5",
  "memory_mb": 128.5
}
```

### Monitorozható metrikák

| Metrika | Leírás | Riasztási küszöb |
|---|---|---|
| `uptime_seconds` | Szerver futási idő | < 60s (újraindulás detektálás) |
| `error_count` | Összesített hibaszám | Gyors növekedés |
| `memory_mb` | Memóriahasználat | > 512 MB |
| `total_requests` | Összes kérés | Baseline eltérés |

## 3. Hibakövetés (Sentry)

### Integráció

Sentry SDK automatikusan rögzíti:
- Flask route-okban keletkező unhandled exception-ök
- Stack trace + request context (URL, method, headers)
- Környezeti információk (Python verzió, OS, release)

### Konfigurálás

A `SENTRY_DSN` környezeti változón keresztül. Ha nincs beállítva, a Sentry integráció inaktív (fejlesztői környezetben).

### Riasztások

Sentry dashboard-on konfigurálva:
- Új exception típus megjelenése → email értesítés
- Exception spike (normál felett) → azonnali értesítés

## 4. Alkalmazás-szintű nyomkövetés

### Generálás lifecycle logolás

Minden generálás teljes lifecycle-ja követhető a logokban:

```
INFO  Gen #42 Step 1/3 done. Prompt length: 256 chars
INFO  Gen #42 Step 2/3 done. Base image URL received
INFO  Gen #42: Checking for borders...
INFO  Gen #42: No border detected
INFO  Gen #42 COMPLETED successfully (two-step mode)
```

Vagy hiba esetén:
```
WARNING Gen #42 was cancelled
INFO    Refunded 14 credits to user id=5 (remaining=30)
```

### Kredit műveletek auditálása

Minden kredit levonás és visszatérítés logolva:
```
INFO  Deducted 6 image credits for user id=5
INFO  Refunded 14 credits to user id=5 (remaining=30)
WARNING Insufficient credits for user id=5 (needed=14, has=8)
```

## 5. Elérhetőség monitoring

### Health check

`GET /health` → `{"status": "healthy"}` (200 OK)

Külső monitoring szolgáltatás (pl. UptimeRobot) konfigurálható erre az endpointra 1 perces intervallummal.

## Hiányosságok és fejlesztési terv

| Hiány | Terv |
|---|---|
| Nincs dashboarding (Grafana) | JSON logok feldolgozása Loki + Grafana stack-kel |
| Nincs distributed tracing | OpenTelemetry integráció a pipeline lépésekhez |
| Nincs alerting a metrikákra | Prometheus scraping a /metrics endpoint-ról |
| Nincs request-szintű latency mérés | Middleware hozzáadása response time logoláshoz |
