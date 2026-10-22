from app import app


def test_pages_load():
    client = app.test_client()
    for path in ["/", "/games", "/games/passiv"]:
        assert client.get(path).status_code == 200


def test_unknown_game_is_404():
    client = app.test_client()
    assert client.get("/games/does-not-exist").status_code == 404


def test_questions_api_returns_404_json_when_no_questions():
    client = app.test_client()
    response = client.get("/api/games/passiv/questions")
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


def test_game_without_guide_or_vocab_only_has_play_tab():
    client = app.test_client()
    html = client.get("/games/passiv").get_data(as_text=True)
    assert 'data-tab="play"' in html
    assert 'data-tab="grammar"' not in html
    assert 'data-tab="vocab"' not in html


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
