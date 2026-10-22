# Deutsch Spiele

A small web app for building and playing German grammar games (B1).

- **Backend:** Python + Flask (`app.py`)
- **Frontend:** HTML templates, CSS and JavaScript

## Run it

```bash
python -m venv .venv
.venv\Scripts\activate          # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000. The server restarts automatically when you save a file.

## Project layout

```
app.py            the backend: pages and the JSON API
templates/        HTML pages (base.html is the shared layout; guides/ holds grammar guides)
static/css/       styles
static/js/        main.js (shared helpers) and games/ (one script per game)
data/games.json   the list of games shown on the site
data/questions/   question data for each game, one JSON file per game
data/vocab/       vocabulary lists (optional, one JSON file per game)
tests/            automated tests (run with: pytest)
```

## How the pieces talk to each other

1. The browser asks for a page, e.g. `/games/passiv`. Flask fills in a template and sends HTML back.
2. The page loads `static/js/games/passiv.js`.
3. That script calls `loadQuestions("passiv")` (from `main.js`), which asks the backend
   at `/api/games/passiv/questions`. Flask replies with JSON from `data/questions/passiv.json`.
4. The script uses the questions to run the game in the browser.

## Adding a game

1. Add an entry to `data/games.json` (set `"ready": true` once it works).
2. Put its questions in `data/questions/<slug>.json`.
3. Write `static/js/games/<slug>.js`. Put your game inside the `#game-root` element.

## Story format (Präteritum game)

Stories live in `data/questions/praeteritum.json`. Each story looks like this:

```json
{
  "title": "Der erste Arbeitstag",
  "text": "Gestern {1} mein erster Arbeitstag. Ich {2} früh aufstehen ...",
  "blanks": [
    { "id": 1, "infinitive": "sein", "answer": "war", "type": "irregular", "person": "er" },
    { "id": 2, "infinitive": "müssen", "answer": "musste", "type": "irregular", "person": "ich" }
  ]
}
```

- `{1}`, `{2}`, ... in `text` mark the blanks; the numbers must match the `id`s. Each story has 10.
- `person` is one of `ich`, `du`, `er` (er/sie/es), `wir`, `ihr`, `sie` (plural), `Sie` (formal).
- `alt` (optional) is a list of other accepted answers, e.g. `"alt": ["sendetet"]`.
- `tip` (optional) is a short note shown after checking.
- Your best score for each story is saved in your browser (localStorage).

## Exercise format (connectors game)

`data/questions/konnektoren.json` holds the four connectors (with their grammar rule) and the exercises:

```json
{ "id": "c1-trotzdem", "pair": "c1", "connector": "trotzdem",
  "a": "Es regnet.", "b": "Ich gehe spazieren.",
  "answers": ["Es regnet, trotzdem gehe ich spazieren.", "Es regnet, ich gehe trotzdem spazieren."],
  "verb": "gehe", "subFinal": "regnet" }
```

- `answers` lists every correct sentence. The first one is shown as "the" solution.
- You type the sentence. Only the words and their order are checked (capital letters are ignored, and
  `ae/oe/ue/ss` count as `ä/ö/ü/ß`). A missing comma gets a note but still counts as correct.
- `verb` and `subFinal` are used for the tips after a wrong answer.
- A round uses each `pair` (the same two clauses) at most once.

## Grammar and vocabulary tabs

A game page always has a **Play** tab. It gets two more tabs automatically if these files exist
(`<slug>` is the game's slug, e.g. `praeteritum`):

- `templates/guides/<slug>.html` gives the **Grammar** tab. It is plain HTML, so edit the text freely.
- `data/vocab/<slug>.json` gives the **Vocabulary** tab (with a search box). Format:

```json
{ "sections": [
  { "title": "The 100 verbs", "note": "optional text", "columns": ["Infinitive", "English"],
    "rows": [["gehen", "to go"], ["kommen", "to come"]] }
] }
```

A tab can be opened directly with a link such as `/games/praeteritum#grammar`.

## Ideas for later

- Save scores and progress (a database such as SQLite)
- User accounts and login (Flask sessions)
- Deploying it somewhere
