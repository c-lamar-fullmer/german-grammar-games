"""Backend for the German grammar games site.

Run it with:  python app.py
Then open:    http://127.0.0.1:5000
"""

import json
import os
from pathlib import Path

from flask import Flask, abort, jsonify, render_template

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__)

# Flask needs a secret key once you add logins (it signs the session cookie).
# Locally it falls back to a dummy value. On the server, set a real SECRET_KEY
# environment variable (never put the real key in the code or on GitHub).
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-me")


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

    # Optional extras. A game only gets a "Grammar" tab if it has a guide page
    # (templates/guides/<slug>.html) and a "Vocabulary" tab if it has a
    # vocabulary file (data/vocab/<slug>.json).
    has_guide = (BASE_DIR / "templates" / "guides" / f"{slug}.html").exists()
    vocab_path = DATA_DIR / "vocab" / f"{slug}.json"
    vocab = None
    if vocab_path.exists():
        with open(vocab_path, encoding="utf-8") as f:
            vocab = json.load(f)

    return render_template("game.html", game=game, has_guide=has_guide, vocab=vocab)


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
    # Only used locally (python app.py). On Render, gunicorn starts the app and
    # this block never runs. Set FLASK_DEBUG=0 to turn debug mode off.
    app.run(debug=os.environ.get("FLASK_DEBUG", "1") == "1")
