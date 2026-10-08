"""Backend for the German grammar games site.

Run it with:  python app.py
Then open:    http://127.0.0.1:5000
"""

import json
from pathlib import Path

from flask import Flask, abort, jsonify, render_template

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__)

# Flask needs a secret key once you add logins (it signs the session cookie).
# Fine for local use; load it from an environment variable before deploying.
app.secret_key = "dev-only-change-me"


# ---------- helpers ----------

def load_games():
    """Read the list of games from data/games.json."""
    with open(DATA_DIR / "games.json", encoding="utf-8") as f:
        return json.load(f)


def find_game(slug):
    """Return the game with this slug, or None."""
    for game in load_games():
        if game["slug"] == slug:
            return game
    return None


# ---------- pages (return HTML) ----------

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/games")
def games():
    return render_template("games.html", games=load_games())


@app.route("/games/<slug>")
def game(slug):
    game = find_game(slug)
    if game is None:
        abort(404)
    return render_template("game.html", game=game)


# ---------- API (returns JSON for JavaScript to use) ----------

@app.route("/api/games/<slug>/questions")
def game_questions(slug):
    """JavaScript calls this to get a game's questions.

    The questions live in data/questions/<slug>.json.
    """
    path = DATA_DIR / "questions" / f"{slug}.json"
    if find_game(slug) is None or not path.exists():
        return jsonify({"error": "No questions for this game yet"}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))


# ---------- errors ----------

@app.errorhandler(404)
def not_found(error):
    return render_template("404.html"), 404


if __name__ == "__main__":
    app.run(debug=True)  # debug=True reloads the server when you save a file
