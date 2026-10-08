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
templates/        HTML pages (base.html is the shared layout)
static/css/       styles
static/js/        main.js (shared helpers) and games/ (one script per game)
data/games.json   the list of games shown on the site
data/questions/   question data for each game, one JSON file per game
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

## Ideas for later

- Save scores and progress (a database such as SQLite)
- User accounts and login (Flask sessions)
- Deploying it somewhere
# german-grammar-games
