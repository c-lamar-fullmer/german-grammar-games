// Präteritum game: pick a story, then fill the blanks with the correct verb form.
//
// Uses loadQuestions() from main.js, which gets data/questions/praeteritum.json
// from the backend. The file looks like: { "stories": [ { title, text, blanks } ] }

const root = document.getElementById("game-root");

// How each "person" in the data file is shown after you check your answers.
const PERSON_LABELS = {
  ich: "ich",
  du: "du",
  er: "er/sie/es",
  wir: "wir",
  ihr: "ihr",
  sie: "sie (plural)",
  Sie: "Sie (formal)",
};

let stories = [];       // all stories from the backend
let storyIndex = 0;     // which story we are on
let inputs = [];        // one <input> per blank, in the order they appear
let checkButton = null; // the "Check answers" button of the current story

// ---------- small helpers ----------

// Make answers comparable: ignore capital letters and extra spaces.
function normalize(text) {
  return text.trim().toLowerCase();
}

// Shortcut for creating an element with some text and a CSS class.
function makeElement(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

// All accepted answers for a blank: the main one plus any "alt" ones.
function acceptedAnswers(blank) {
  return [blank.answer, ...(blank.alt || [])];
}

// ---------- best scores (saved in this browser with localStorage) ----------

function loadBestScores() {
  try {
    return JSON.parse(localStorage.getItem("praeteritum-best")) || {};
  } catch (error) {
    return {};
  }
}

function saveBestScore(title, score) {
  const best = loadBestScores();
  if (score > (best[title] ?? -1)) {
    best[title] = score;
    localStorage.setItem("praeteritum-best", JSON.stringify(best));
  }
}

// ---------- the story menu ----------

function showMenu() {
  root.innerHTML = "";
  const best = loadBestScores();

  root.appendChild(makeElement("h2", "Choose a story"));

  const list = makeElement("ul", "", "game-list");
  stories.forEach((story, index) => {
    const card = makeElement("li", "", "card");
    card.appendChild(makeElement("h3", story.title));

    const score = best[story.title];
    const label = score === undefined ? "Not played yet" : `Best: ${score} / ${story.blanks.length}`;
    card.appendChild(makeElement("p", label, "muted"));

    const play = makeElement("button", "Play", "button");
    play.addEventListener("click", () => showStory(index));
    card.appendChild(play);

    list.appendChild(card);
  });
  root.appendChild(list);
}

// ---------- building the story page ----------

function showStory(index) {
  storyIndex = index;
  const story = stories[storyIndex];
  root.innerHTML = "";
  inputs = [];

  if (stories.length > 1) {
    const back = makeElement("button", "← All stories", "button secondary");
    back.addEventListener("click", showMenu);
    root.appendChild(back);
  }

  root.appendChild(makeElement("h2", story.title));
  root.appendChild(makeElement("p", "Type the Präteritum form of the verb in brackets.", "muted"));

  // The story text contains markers like {1}. Splitting on them gives
  // [text, "1", text, "2", ...]: even positions are text, odd are blank numbers.
  const paragraph = makeElement("p", "", "story");
  const parts = story.text.split(/\{(\d+)\}/);

  parts.forEach((part, position) => {
    if (position % 2 === 0) {
      paragraph.appendChild(document.createTextNode(part));
      return;
    }
    const blank = story.blanks.find(b => b.id === Number(part));
    paragraph.appendChild(makeBlank(blank));
  });
  root.appendChild(paragraph);

  checkButton = makeElement("button", "Check answers", "button");
  checkButton.addEventListener("click", checkAnswers);
  root.appendChild(checkButton);

  root.appendChild(makeElement("div", "", "result"));
  inputs[0].focus();
}

// One blank = an input box plus the infinitive in brackets.
function makeBlank(blank) {
  const wrapper = makeElement("span", "", "blank");

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", `Präteritum of ${blank.infinitive}`);
  input.size = 9;
  input.dataset.id = blank.id;
  // Enter jumps to the next blank, or checks the answers on the last one.
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = inputs[inputs.indexOf(input) + 1];
    if (next) next.focus();
    else checkAnswers();
  });
  inputs.push(input);

  wrapper.appendChild(input);
  wrapper.appendChild(makeElement("span", ` (${blank.infinitive})`, "infinitive"));
  return wrapper;
}

// ---------- checking ----------

function checkAnswers() {
  const story = stories[storyIndex];
  let score = 0;

  inputs.forEach(input => {
    const blank = story.blanks.find(b => b.id === Number(input.dataset.id));
    const wrapper = input.parentElement;
    const accepted = acceptedAnswers(blank).map(normalize);
    const isCorrect = accepted.includes(normalize(input.value));

    input.disabled = true;
    wrapper.classList.add(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      score++;
    } else {
      wrapper.appendChild(makeElement("span", ` → ${acceptedAnswers(blank).join(" / ")}`, "answer"));
    }
  });

  saveBestScore(story.title, score);
  showResult(score, story);
}

function showResult(score, story) {
  const result = root.querySelector(".result");
  checkButton.remove();

  result.appendChild(makeElement("p", `Score: ${score} / ${story.blanks.length}`, "score"));

  // Summary of every verb, with its person and a tip where there is one.
  const list = document.createElement("ul");
  story.blanks.forEach(blank => {
    const details = [blank.type];
    if (blank.person) details.push(PERSON_LABELS[blank.person]);
    let line = `${blank.infinitive} → ${acceptedAnswers(blank).join(" / ")} (${details.join(", ")})`;
    if (blank.tip) line += `: ${blank.tip}`;
    list.appendChild(makeElement("li", line));
  });
  result.appendChild(list);

  const retry = makeElement("button", "Try this story again", "button secondary");
  retry.addEventListener("click", () => showStory(storyIndex));
  result.appendChild(retry);

  // Move on to the next story; after the last one it wraps around to the first.
  const next = makeElement("button", stories.length > 1 ? "Next story" : "Play again", "button");
  next.addEventListener("click", () => showStory((storyIndex + 1) % stories.length));
  result.appendChild(next);

  if (stories.length > 1) {
    const menu = makeElement("button", "All stories", "button secondary");
    menu.addEventListener("click", showMenu);
    result.appendChild(menu);
  }
}

// ---------- start ----------

loadQuestions(root.dataset.slug)
  .then(data => {
    stories = data.stories;
    if (stories.length > 1) showMenu();
    else showStory(0);
  })
  .catch(() => {
    root.textContent = "Sorry, the stories could not be loaded.";
  });
