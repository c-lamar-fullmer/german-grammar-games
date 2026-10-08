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
