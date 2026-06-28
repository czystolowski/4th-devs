# S03E04 — Negotiations Tool

**AI_devs 4 / lesson S03E04** — task `negotiations`

## Zadanie

Zbudowanie jednego lub dwóch narzędzi HTTP dla autonomicznego agenta, który musi znaleźć miasta oferujące jednocześnie wszystkie komponenty niezbędne do uruchomienia turbiny wiatrowej.

**Zdobyta flaga:** `{FLG:WINDFARM}`  
**Znalezione miasta:** Domatowo, Skolwin

## Architektura

Jeden endpoint `POST /api/search` pełni rolę jedynego narzędzia agenta.

```
Agent (hub.ag3nts.org)
  │  POST {"params": "turbina wiatrowa 400W"}
  ▼
app.js  :3033  /api/search
  │  token-based fuzzy match przeciwko items.csv (2137 pozycji)
  │  lookup w connections.csv (5349 par itemCode↔cityCode)
  ▼
{"output": "Przedmioty: Turbina wiatrowa 400W 48V; ... Miasta: Bydgoszcz, Domatowo, ..."}
```

### Fuzzy matching

Agent wysyła opisy w języku naturalnym (np. *"potrzebuję kabla długości 10 metrów"*). Algorytm:

1. Normalizuj i tokenizuj zapytanie oraz nazwy przedmiotów
2. Zlicz tokeny wspólne (substring match w obie strony)
3. Zwróć wszystkie przedmioty z najwyższym wynikiem
4. Zsumuj zbiory miast dla wszystkich trafionych kodów
5. Odpowiedź ≤ 500 bajtów (ograniczenie platformy)

## Dane

Pobierane z `https://hub.ag3nts.org/dane/s03e04_csv/` i zapisywane lokalnie (wykluczone z gita):

| Plik | Zawartość |
|------|-----------|
| `cities.csv` | 51 miast: `name,code` |
| `items.csv` | 2137 przedmiotów: `name,code` |
| `connections.csv` | 5349 par: `itemCode,cityCode` |

## Uruchomienie

```bash
# 1. Pobierz dane
curl -o cities.csv https://hub.ag3nts.org/dane/s03e04_csv/cities.csv
curl -o items.csv  https://hub.ag3nts.org/dane/s03e04_csv/items.csv
curl -o connections.csv https://hub.ag3nts.org/dane/s03e04_csv/connections.csv

# 2. Zainstaluj zależności
npm install

# 3. Uruchom serwer (port 3033, nadpisywalny przez NEGOTIATIONS_PORT)
npm start

# 4. Wystaw publicznie (np. ngrok)
ngrok http 3033
```

## Rejestracja narzędzia w centrali

```bash
curl -X POST https://hub.ag3nts.org/verify \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "<AGENT_TOKEN>",
    "task": "negotiations",
    "answer": {
      "tools": [{
        "URL": "https://<ngrok-url>/api/search",
        "description": "Searches items database by natural language description (in Polish) and returns city names where matching items are sold. Pass item description in the \"params\" field, e.g. \"turbina wiatrowa 400W 48V\" or \"inwerter 3kW\". Returns matching items and their available cities."
      }]
    }
  }'
```

## Sprawdzenie wyniku (weryfikacja asynchroniczna)

Po ~45 sekundach:

```bash
curl -X POST https://hub.ag3nts.org/verify \
  -H "Content-Type: application/json" \
  -d '{"apikey":"<AGENT_TOKEN>","task":"negotiations","answer":{"action":"check"}}'
```

## Zmienne środowiskowe

| Zmienna | Opis | Domyślnie |
|---------|------|-----------|
| `AGENT_TOKEN` | Klucz API do hub.ag3nts.org | wymagany |
| `NEGOTIATIONS_PORT` | Port serwera | `3033` |

Plik `.env` ładowany z katalogu nadrzędnego (`../.env`).
