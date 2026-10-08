// JavaScript shared by every page. Game scripts can use these helpers.

// Return a shuffled copy of an array.
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Ask the Python backend for a game's questions (see /api/games/<slug>/questions in app.py).
async function loadQuestions(slug) {
  const response = await fetch(`/api/games/${slug}/questions`);
  if (!response.ok) {
    throw new Error("Could not load questions");
  }
  return response.json();
}
