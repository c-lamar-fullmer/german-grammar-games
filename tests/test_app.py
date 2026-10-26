from app import app


def test_pages_load():
    client = app.test_client()
    for path in ["/", "/games", "/games/sein-haben"]:
        assert client.get(path).status_code == 200


def test_unknown_game_is_404():
    client = app.test_client()
    assert client.get("/games/does-not-exist").status_code == 404


def test_questions_api_returns_404_json_when_no_questions():
    client = app.test_client()
    response = client.get("/api/games/does-not-exist/questions")
    assert response.status_code == 404
    assert "error" in response.get_json()


def test_praeteritum_story_data_is_valid():
    import re

    client = app.test_client()
    response = client.get("/api/games/praeteritum/questions")
    assert response.status_code == 200
    for story in response.get_json()["stories"]:
        markers = [int(n) for n in re.findall(r"\{(\d+)\}", story["text"])]
        assert len(markers) == 10
        assert markers == [blank["id"] for blank in story["blanks"]]


def test_every_blank_has_an_answer():
    client = app.test_client()
    stories = client.get("/api/games/praeteritum/questions").get_json()["stories"]
    assert len(stories) >= 2
    for story in stories:
        for blank in story["blanks"]:
            assert blank["answer"].strip()
            assert blank["infinitive"].strip()


def test_praeteritum_page_has_grammar_and_vocabulary_tabs():
    client = app.test_client()
    html = client.get("/games/praeteritum").get_data(as_text=True)
    assert 'data-tab="grammar"' in html
    assert 'data-tab="vocab"' in html
    assert "Präteritum (simple past)" in html  # text of the grammar guide
    assert "The 100 verbs" in html             # first vocabulary table


def test_every_listed_game_is_ready_and_has_questions():
    import json
    from pathlib import Path

    root = Path(__file__).parent.parent
    games = json.loads((root / "data" / "games.json").read_text(encoding="utf-8"))
    client = app.test_client()
    for game in games:
        assert game["ready"], f"{game['slug']} is listed but not ready"
        assert client.get(f"/games/{game['slug']}").status_code == 200
        assert client.get(f"/api/games/{game['slug']}/questions").status_code == 200


def test_vocabulary_file_is_complete():
    import json
    from pathlib import Path

    path = Path(__file__).parent.parent / "data" / "vocab" / "praeteritum.json"
    sections = json.loads(path.read_text(encoding="utf-8"))["sections"]
    for section in sections:
        for row in section["rows"]:
            assert len(row) == len(section["columns"])
    assert len(sections[0]["rows"]) == 100  # the 100 verbs


def test_connector_exercises_are_consistent():
    import re

    client = app.test_client()
    data = client.get("/api/games/konnektoren/questions").get_json()
    assert set(data["connectors"]) == {"weil", "obwohl", "deshalb", "trotzdem"}
    assert len(data["exercises"]) >= 20
    for exercise in data["exercises"]:
        assert exercise["connector"] in data["connectors"]
        word_lists = [sorted(w.lower() for w in re.findall(r"\w+", a)) for a in exercise["answers"]]
        assert all(words == word_lists[0] for words in word_lists)       # every answer uses the same words
        assert exercise["connector"] in word_lists[0]                    # and contains the connector
        assert all(a.count(",") == 1 for a in exercise["answers"])       # one comma between the clauses


def test_connectors_page_has_all_three_tabs():
    client = app.test_client()
    html = client.get("/games/konnektoren").get_data(as_text=True)
    assert 'data-tab="grammar"' in html
    assert 'data-tab="vocab"' in html
    assert "The connectors" in html


def test_sein_haben_exercises_are_consistent():
    client = app.test_client()
    data = client.get("/api/games/sein-haben/questions").get_json()
    exercises = data["exercises"]
    assert set(data["tenses"]) == {"present", "perfect", "preterite"}
    assert len(exercises) >= 45
    for exercise in exercises:
        assert exercise["tense"] in data["tenses"]
        assert exercise["answer"] in ("sein", "haben")
        assert exercise["sentence"].count("___") == 1
        assert exercise["form"].lower() in exercise["full"].lower()
        assert "___" not in exercise["full"]
        assert exercise["tip"].strip()
    for tense in data["tenses"]:                                   # each tense has both answers
        answers = {e["answer"] for e in exercises if e["tense"] == tense}
        assert answers == {"sein", "haben"}
        tricky = {e["answer"] for e in exercises if e["tense"] == tense and e["tricky"]}
        assert tricky == {"sein", "haben"}                         # also in "only tricky" mode
    assert sum(e["tricky"] for e in exercises) >= 20


def test_sein_haben_page_has_all_three_tabs():
    client = app.test_client()
    html = client.get("/games/sein-haben").get_data(as_text=True)
    assert 'data-tab="grammar"' in html
    assert 'data-tab="vocab"' in html
    assert "sein or haben?" in html
    assert "sein and haben: all forms" in html
