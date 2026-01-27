# Adatvédelmi Nyilatkozat – InstaCover

**Utolsó frissítés:** 2025. november 16.

## 1. Bevezetés

Az InstaCover egy AI-alapú könyvborító-generáló webalkalmazás. Ez a nyilatkozat leírja, milyen adatokat gyűjtünk, hogyan tároljuk és kezeljük azokat.

## 2. Gyűjtött adatok

### 2.1 Fiókadatok
- **Google fiók email cím** – a bejelentkezéshez és felhasználó-azonosításhoz
- **Google fiók megjelenített név** – az alkalmazáson belüli megjelenítéshez
- **Google fiók profilkép URL** – opcionális, profilkép megjelenítéséhez

A bejelentkezés Google OAuth 2.0 protokollon keresztül történik a Supabase Auth szolgáltatásán keresztül. Jelszavakat nem tárolunk.

### 2.2 Generálási adatok
- **Könyvcím és szerzőnév** – a borító generálásához megadott szövegek
- **Leírások és beállítások** – könyvleírás, műfaj, hangulat, szín preferencia, karakter leírás, kulcsszavak
- **Generált képek** – az AI által létrehozott borítóképek (alap kép és végleges borító)
- **LLM promptok** – a képgeneráláshoz használt szöveges utasítások

### 2.3 Stílus referenciák
- **Feltöltött képek** – a felhasználó által feltöltött referencia képek stílus elemzéshez
- **Elemzési eredmények** – az AI által készített stíluselemzés (hangulat, elrendezés, illusztrációs stílus, tipográfia)

### 2.4 Technikai adatok
- **Kreditegyenleg** – a felhasználó rendelkezésére álló generálási kreditek száma
- **Felhasználói beállítások** – téma preferencia (világos/sötét mód)

## 3. Adattárolás

- Az adatokat **Supabase** platformon tároljuk (PostgreSQL adatbázis + privát tároló bucket)
- A képek **privát Supabase Storage bucket**-ben vannak, aláírt URL-ekkel érhetők el (1 óra lejárati idő)
- Az adatbázis és a tároló az EU-n belüli Supabase infrastruktúrán működik

## 4. Harmadik fél szolgáltatások

Az alkalmazás a következő külső szolgáltatásokat használja:

| Szolgáltatás | Cél | Továbbított adat |
|---|---|---|
| **Supabase** | Hitelesítés, adatbázis, fájltárolás | Fiókadatok, generálási adatok, képek |
| **OpenRouter** (LLM) | Szöveges prompt generálás | Könyvadatok (cím, leírás, műfaj) – személyes adat nem |
| **WaveSpeed** (Seedream) | Képgenerálás | LLM által generált promptok és referencia képek – személyes adat nem |
| **Google OAuth** | Bejelentkezés | Google fiókadatok (a Google saját adatkezelési szabályzata szerint) |
| **Sentry** | Hibakövetés | Technikai hibainformációk – személyes adat nem |

A LLM és képgenerálási szolgáltatásoknak nem továbbítunk személyazonosításra alkalmas adatokat (PII).

## 5. Adatmegőrzés és törlés

- A felhasználó bármikor törölheti a generált borítóit és stílus referenciáit az alkalmazáson belül
- A törlés a képfájlokat és az adatbázis-bejegyzéseket is eltávolítja
- Fiók törlését a felhasználó kérheti email-ben

## 6. Adatbiztonság

- A kommunikáció HTTPS protokollon keresztül történik
- A tárolt képek privát bucket-ben vannak, aláírt URL-ek szükségesek az elérésükhöz
- Az autentikáció JWT tokenekkel történik, amelyeket a Supabase Auth kezel

## 7. Sütik (cookie-k)

Az alkalmazás kizárólag a Supabase Auth munkamenet-tokent tárolja a böngésző helyi tárhelyén (localStorage). Harmadik féltől származó sütiket nem használunk.

## 8. Adatmegosztás

Az adatokat **nem adjuk el, nem osztjuk meg és nem adjuk át** harmadik feleknek marketing vagy egyéb célból. Adatok kizárólag a 4. pontban felsorolt szolgáltatásoknak kerülnek továbbításra, kizárólag az alkalmazás működéséhez szükséges mértékben.

## 9. Kapcsolat

Adatvédelmi kérdésekkel kapcsolatban keress minket az alkalmazásban megadott elérhetőségeken.
