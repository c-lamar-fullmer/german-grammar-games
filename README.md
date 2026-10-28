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

1. The browser asks for a page, e.g. `/games/praeteritum`. Flask fills in a template and sends HTML back.
2. The page loads `static/js/games/praeteritum.js`.
3. That script calls `loadQuestions("praeteritum")` (from `main.js`), which asks the backend
   at `/api/games/praeteritum/questions`. Flask replies with JSON from `data/questions/praeteritum.json`.
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

## Exercise format (sein/haben game)

`data/questions/sein-haben.json` holds the exercises. Each one is a sentence with one blank:

```json
{ "id": "per45", "tense": "perfect", "person": "ich",
  "sentence": "Gestern ___ ich nach Berlin gefahren.", "answer": "sein",
  "form": "bin", "full": "Gestern bin ich nach Berlin gefahren.",
  "tip": "Change of place (gehen, fahren, kommen, ...): the Perfekt uses sein." }
```

- `tense` is `present`, `perfect` or `preterite`. `answer` is `sein` or `haben`.
- `form` is the conjugated verb shown after you answer; `full` is the complete sentence.
- `tricky` is `true` for the false friends and exceptions. The setup screen has an "Only tricky sentences" option.
- In the game: left arrow = sein, right arrow = haben. The answer shows at once, with the reason, and stays until
  you press Enter or Space. A timer per sentence (10 / 6 / 3 s, or off) counts a missed sentence as wrong.
  Best rounds are saved per speed.

## Exercise format (Akkusativ/Dativ game)

`data/questions/akkusativ-dativ.json` holds the settings texts and the exercises. Each exercise is a sentence with one blank article:

```json
{ "id": "two7", "category": "two", "group": null,
  "sentence": "Ich gehe in ___ Park.", "answer": "akk", "form": "den",
  "full": "Ich gehe in den Park.", "key": "in",
  "tip": "Wohin? gehen = you are moving to a new place → Akkusativ. (in is a two-way preposition.)",
  "tricky": false }
```

- `category` is `akk` (always accusative), `dat` (always dative), `two` (two-way) or `verb`.
- `answer` is `akk` or `dat`. `key` is the preposition or verb (shown after answering and in "Practise these").
- `group` is only used for verbs: dative verb, accusative verb or verb + preposition.
- The setup screen lets you pick the categories, the round length, the speed and "only tricky sentences".
  When "two" is picked with other categories, it gets half of the round (`twoWayShare` in the JSON file).
- Left arrow = Akkusativ, right arrow = Dativ, Enter or Space = next sentence.

## Exercise format (da-/wo-words game)

`data/questions/da-wo-words.json` holds the 10 prepositions with their da- and wo-word, and the exercises:

```json
{ "id": "da-auf-1", "prep": "auf", "kind": "da", "answer": "darauf",
  "lines": ["Wartest du auf den Bus?", "Ja, ich warte schon lange ___."], "gapLine": 1,
  "en": ["Are you waiting for the bus?", "Yes, I have been waiting for it for a long time."],
  "expression": "warten auf", "meaning": "to wait for" }
```

- `lines` is one or two German lines with exactly one `___`; `gapLine` says which line has it.
- `en` is the English translation, one entry per line. It is shown after "Check answers".
- `expression` and `meaning` (optional) name the verb + preposition combination, shown after checking.
- In a round every sentence has a different `answer`, so each piece belongs to exactly one gap.
  Extra pieces (set on the setup screen) are other da-/wo-words that fit nowhere.
- Dragging uses the browser's drag-and-drop. Click-to-place (click a piece, then a gap) works too.

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
