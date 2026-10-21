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

// ---------- tabs (Play / Grammar / Vocabulary) ----------
// Each tab button has data-tab="name" and shows the panel with id="tab-name".
// The tab is also written to the URL (e.g. /games/praeteritum#grammar), so you can bookmark it.
function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  if (tabs.length === 0) return;

  function showTab(name) {
    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === name;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.hidden = panel.id !== `tab-${name}`;
    });
    history.replaceState(null, "", `#${name}`);
  }

  tabs.forEach(tab => tab.addEventListener("click", () => showTab(tab.dataset.tab)));

  const fromUrl = location.hash.slice(1);
  const exists = document.querySelector(`.tab[data-tab="${fromUrl}"]`);
  showTab(exists ? fromUrl : "play");
}

// ---------- vocabulary search ----------
// Hides table rows that don't contain the typed text, and sections with no rows left.
function setupVocabSearch() {
  const box = document.getElementById("vocab-search");
  if (!box) return;

  box.addEventListener("input", () => {
    const query = box.value.trim().toLowerCase();
    let anyVisible = false;

    document.querySelectorAll(".vocab-section").forEach(section => {
      let visibleRows = 0;
      section.querySelectorAll("tbody tr").forEach(row => {
        const matches = row.textContent.toLowerCase().includes(query);
        row.hidden = !matches;
        if (matches) visibleRows++;
      });
      section.hidden = visibleRows === 0;
      if (visibleRows > 0) anyVisible = true;
    });

    document.getElementById("vocab-empty").hidden = anyVisible;
  });
}

setupTabs();
setupVocabSearch();
