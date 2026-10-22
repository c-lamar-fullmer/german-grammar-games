// Connectors game (weil, obwohl, deshalb, trotzdem):
// you get two clauses and a connector, and TYPE the full sentence before the time runs out.
//
// Uses loadQuestions() from main.js. The data file looks like:
//   { connectors: { weil: {...}, ... }, roundLength: 10,
//     exercises: [ { id, pair, connector, a, b, answers: [...], verb, subFinal } ] }

const root = document.getElementById("game-root");

const SPEEDS = {
  relaxed: { label: "Relaxed", seconds: 60 },
  normal: { label: "Normal", seconds: 30 },
  sprint: { label: "Sprint", seconds: 15 },
  none: { label: "No timer", seconds: 0 },
};
const CONNECTOR_ORDER = ["weil", "obwohl", "deshalb", "trotzdem"];

let data = null;                                                    // loaded from the backend
let settings = { connectors: [...CONNECTOR_ORDER], speed: "normal" };
let round = null;                                                   // the round being played
let timer = null;                                                   // the running countdown

// ---------- small helpers ----------

function makeElement(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

// Best score per speed, saved in this browser.
function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("connectors-best")) || {};
  } catch (error) {
    return {};
  }
}

function saveBest(speed, points) {
  const best = loadBest();
  if (points > (best[speed] ?? -1)) {
    best[speed] = points;
    localStorage.setItem("connectors-best", JSON.stringify(best));
  }
}

// ---------- reading what you typed ----------

const IS_WORD = /[\p{L}\p{N}]/u;

// "Es regnet, ich gehe." -> ["Es", "regnet", ",", "ich", "gehe", "."]
function tokens(text) {
  return text.match(/[\p{L}\p{N}]+|[,;.!?]/gu) || [];
}

function wordsOf(text) {
  return tokens(text).filter(token => IS_WORD.test(token));
}

// Capital letters don't matter, and ae/oe/ue/ss are accepted for ä/ö/ü/ß.
function simplify(word) {
  return word.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

function sameWords(a, b) {
  return a.length === b.length && a.every((word, i) => simplify(word) === simplify(b[i]));
}

// Where does the first clause end? Returns { at: number of words before the break, mark },
// or null if there is no break in the middle of the sentence.
function breakAfter(text) {
  const all = tokens(text);
  let words = 0;
  for (let i = 0; i < all.length; i++) {
    if (IS_WORD.test(all[i])) {
      words++;
    } else if (words > 0 && all.slice(i + 1).some(token => IS_WORD.test(token))) {
      return { at: words, mark: all[i] };
    }
  }
  return null;
}

// Decide if a typed sentence is correct. Only the words and their order must match;
// a missing or misplaced comma is allowed but gets a note.
function judge(exercise, typed) {
  const typedWords = wordsOf(typed);
  const matched = exercise.answers.findIndex(answer => sameWords(wordsOf(answer), typedWords));
  if (matched === -1) {
    return { correct: false, matched: -1, hint: mistakeHint(exercise, typed), note: "" };
  }

  const expected = breakAfter(exercise.answers[matched]);
  const actual = breakAfter(typed);
  const kind = data.connectors[exercise.connector].kind;
  // deshalb/trotzdem may also be written as two sentences (a period or semicolon), weil/obwohl need a comma.
  const markOk = actual && (kind === "adverb" ? /[,;.]/.test(actual.mark) : actual.mark === ",");
  const note = markOk && actual.at === expected.at
    ? ""
    : `Your word order is right. Watch the comma: ${exercise.answers[matched]}`;
  return { correct: true, matched, hint: "", note };
}

// A short tip about the most likely mistake in a wrong sentence.
function mistakeHint(exercise, typed) {
  const conn = exercise.connector;
  const typedWords = wordsOf(typed).map(simplify);
  const expectedWords = wordsOf(exercise.answers[0]).map(simplify);

  if (typedWords.length === 0) return "";
  if (!typedWords.includes(conn)) return `Use the connector "${conn}" in your sentence.`;
  if ([...typedWords].sort().join(" ") !== [...expectedWords].sort().join(" ")) {
    return "Use exactly the words of both clauses plus the connector. Only the order changes; the word forms stay the same.";
  }

  if (data.connectors[conn].kind === "adverb") {
    // The second clause starts with the connector, so the verb must come right after it.
    const wordsInA = wordsOf(exercise.a).length;
    if (typedWords[wordsInA] === conn && typedWords[wordsInA + 1] !== simplify(exercise.verb)) {
      return `After "${conn}" the verb comes next (position 2): ${conn} ${exercise.verb} …`;
    }
    return `Check the order. Clause A comes first, then "${conn}" + verb, or the verb with "${conn}" after it.`;
  }

  // weil / obwohl: the verb must be the last word of the clause that starts with the connector.
  const all = tokens(typed);
  const start = all.findIndex(token => simplify(token) === conn);
  let end = all.length;
  for (let i = start + 1; i < all.length; i++) {
    if (all[i] === ",") { end = i; break; }
  }
  const clauseWords = all.slice(start + 1, end).filter(token => IS_WORD.test(token));
  if (!all.includes(",")) {
    return `Put a comma between the two clauses. After "${conn}" the verb goes to the end of its clause.`;
  }
  if (simplify(clauseWords[clauseWords.length - 1] || "") !== simplify(exercise.subFinal)) {
    return `After "${conn}" the verb goes to the END of its clause (… ${exercise.subFinal}).`;
  }
  return `Check the main clause: if the "${conn}" clause comes first, the main clause starts with its verb.`;
}

// ---------- timer ----------

function startTimer(seconds, onTimeUp) {
  stopTimer();
  timer = { seconds, deadline: Date.now() + seconds * 1000, last: Date.now() };
  timer.id = setInterval(() => {
    const now = Date.now();
    // Pause while you look at another tab (Grammar / Vocabulary) or another window.
    if (document.hidden || root.offsetParent === null) {
      timer.deadline += now - timer.last;
      timer.last = now;
      return;
    }
    timer.last = now;
    updateTimerDisplay();
    if (secondsLeft() <= 0) onTimeUp();
  }, 100);
  updateTimerDisplay();
}

function stopTimer() {
  if (timer) clearInterval(timer.id);
  timer = null;
}

function secondsLeft() {
  return timer ? Math.max(0, (timer.deadline - Date.now()) / 1000) : 0;
}

function updateTimerDisplay() {
  const bar = root.querySelector(".cg-timer-fill");
  const text = root.querySelector(".cg-time");
  if (!bar || !timer) return;
  const left = secondsLeft();
  bar.style.width = `${(left / timer.seconds) * 100}%`;
  bar.parentElement.classList.toggle("low", left <= 5);
  text.textContent = `⏱ ${Math.ceil(left)} s`;
}

// ---------- screen 1: setup ----------

function showSetup() {
  stopTimer();
  root.innerHTML = "";
  const screen = makeElement("div", "", "cg-setup");

  screen.appendChild(makeElement("p",
    "You get two clauses and a connector. Type one correct sentence with both clauses and the connector " +
    "before the time runs out. A round has 10 sentences."));

  // connectors
  const connectorBox = makeElement("fieldset");
  connectorBox.appendChild(makeElement("legend", "Connectors"));
  CONNECTOR_ORDER.forEach(name => {
    const label = makeElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = name;
    box.checked = settings.connectors.includes(name);
    box.addEventListener("change", () => {
      settings.connectors = [...connectorBox.querySelectorAll("input:checked")].map(input => input.value);
      start.disabled = settings.connectors.length === 0;
    });
    label.appendChild(box);
    label.appendChild(document.createTextNode(` ${name} (${data.connectors[name].meaning})`));
    connectorBox.appendChild(label);
  });
  screen.appendChild(connectorBox);

  // speed
  const best = loadBest();
  const speedBox = makeElement("fieldset");
  speedBox.appendChild(makeElement("legend", "Speed"));
  Object.entries(SPEEDS).forEach(([key, speed]) => {
    const label = makeElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "speed";
    radio.value = key;
    radio.checked = settings.speed === key;
    radio.addEventListener("change", () => { settings.speed = key; });
    label.appendChild(radio);
    const detail = speed.seconds ? `${speed.seconds} s per sentence` : "take your time";
    const record = best[key] !== undefined ? ` · best: ${best[key]} points` : "";
    label.appendChild(document.createTextNode(` ${speed.label} (${detail})${record}`));
    speedBox.appendChild(label);
  });
  screen.appendChild(speedBox);

  const start = makeElement("button", "Start round", "button");
  start.disabled = settings.connectors.length === 0;
  start.addEventListener("click", startRound);
  screen.appendChild(start);

  root.appendChild(screen);
}

// ---------- screen 2: one sentence ----------

// Pick up to 10 sentences, never using the same clause pair twice in a round.
function pickExercises() {
  const allowed = data.exercises.filter(exercise => settings.connectors.includes(exercise.connector));
  const byPair = new Map();
  allowed.forEach(exercise => {
    if (!byPair.has(exercise.pair)) byPair.set(exercise.pair, []);
    byPair.get(exercise.pair).push(exercise);
  });
  return shuffle([...byPair.keys()])
    .slice(0, data.roundLength)
    .map(pair => shuffle(byPair.get(pair))[0]);
}

function startRound() {
  round = { exercises: pickExercises(), index: 0, score: 0, results: [], finished: false };
  showQuestion();
}

function showQuestion() {
  const exercise = round.exercises[round.index];
  const seconds = SPEEDS[settings.speed].seconds;
  round.finished = false;
  root.innerHTML = "";

  // top bar
  const top = makeElement("div", "", "cg-top");
  top.appendChild(makeElement("span", `Sentence ${round.index + 1} / ${round.exercises.length}`));
  top.appendChild(makeElement("span", seconds ? "" : "No timer", "cg-time"));
  top.appendChild(makeElement("span", `Score: ${round.score}`, "cg-score"));
  root.appendChild(top);

  if (seconds) {
    const bar = makeElement("div", "", "cg-timer");
    bar.appendChild(makeElement("div", "", "cg-timer-fill"));
    root.appendChild(bar);
  }

  // the two clauses and the connector
  const clauses = makeElement("div", "", "cg-clauses");
  [["A", exercise.a], ["B", exercise.b]].forEach(([label, text]) => {
    const card = makeElement("div", "", "cg-clause");
    card.appendChild(makeElement("span", label, "cg-label"));
    card.appendChild(document.createTextNode(text));
    clauses.appendChild(card);
  });
  root.appendChild(clauses);

  const connector = makeElement("div", `[ ${exercise.connector.toUpperCase()} ]`, "cg-connector");
  connector.appendChild(makeElement("small", data.connectors[exercise.connector].meaning));
  root.appendChild(connector);

  // typing area
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cg-input";
  input.placeholder = "Type the full sentence…";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Your sentence");
  root.appendChild(input);

  const chars = makeElement("div", "", "cg-chars");
  ["ä", "ö", "ü", "ß"].forEach(char => {
    const button = makeElement("button", char);
    button.type = "button";
    button.addEventListener("mousedown", event => event.preventDefault()); // keep the cursor in the box
    button.addEventListener("click", () => {
      input.setRangeText(char, input.selectionStart, input.selectionEnd, "end");
      input.focus();
    });
    chars.appendChild(button);
  });
  chars.appendChild(makeElement("span", "  or type ae, oe, ue, ss", "muted"));
  root.appendChild(chars);

  const actions = makeElement("div", "", "cg-actions");
  const check = makeElement("button", "Check", "button");
  const skip = makeElement("button", "Skip", "button secondary");
  check.addEventListener("click", () => submit(exercise, input));
  skip.addEventListener("click", () => finishQuestion(exercise, { correct: false, skipped: true, typed: input.value }));
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(exercise, input);
    }
  });
  actions.appendChild(check);
  actions.appendChild(skip);
  root.appendChild(actions);

  root.appendChild(makeElement("div", "", "cg-feedback-box"));

  input.focus();
  if (seconds) {
    startTimer(seconds, () => finishQuestion(exercise, { correct: false, timedOut: true, typed: input.value }));
  }
}

function submit(exercise, input) {
  if (round.finished || input.value.trim() === "") return;
  const verdict = judge(exercise, input.value);
  finishQuestion(exercise, { ...verdict, typed: input.value });
}

// ---------- feedback after each sentence ----------

function finishQuestion(exercise, outcome) {
  if (round.finished) return;
  round.finished = true;

  const timed = SPEEDS[settings.speed].seconds > 0;
  outcome.points = outcome.correct ? 10 + (timed ? Math.floor(secondsLeft()) : 0) : 0;
  stopTimer();

  round.score += outcome.points;
  round.results.push({ exercise, ...outcome });
  root.querySelector(".cg-score").textContent = `Score: ${round.score}`;
  root.querySelector(".cg-input").disabled = true;
  root.querySelectorAll(".cg-actions button, .cg-chars button").forEach(button => { button.disabled = true; });

  const box = root.querySelector(".cg-feedback-box");
  box.appendChild(buildFeedback(exercise, outcome));

  const last = round.index === round.exercises.length - 1;
  const next = makeElement("button", last ? "See results" : "Next sentence", "button");
  next.addEventListener("click", () => {
    if (last) showSummary();
    else { round.index++; showQuestion(); }
  });
  box.appendChild(next);
  next.focus();
}

function buildFeedback(exercise, outcome) {
  const feedback = makeElement("div", "", `cg-feedback ${outcome.correct ? "good" : "bad"}`);

  let status = "✗ Not quite.";
  if (outcome.correct) status = `✓ Correct! +${outcome.points} points`;
  else if (outcome.timedOut) status = "⏱ Time's up.";
  else if (outcome.skipped) status = "Skipped.";
  feedback.appendChild(makeElement("p", status, "cg-status"));

  if (outcome.note) feedback.appendChild(makeElement("p", outcome.note));

  if (!outcome.correct && outcome.typed.trim()) {
    feedback.appendChild(makeElement("p", `You wrote: ${outcome.typed.trim()}`, "muted"));
  }
  if (outcome.hint) feedback.appendChild(makeElement("p", `Tip: ${outcome.hint}`));

  if (outcome.correct) {
    const others = exercise.answers.filter((answer, i) => i !== outcome.matched);
    if (others.length) feedback.appendChild(makeElement("p", `Also correct: ${others.join("  /  ")}`, "muted"));
  } else {
    feedback.appendChild(makeElement("p", "Correct sentences:", "muted"));
    exercise.answers.forEach((answer, i) => {
      feedback.appendChild(makeElement("p", answer, i === 0 ? "cg-sentence" : "cg-sentence-alt"));
    });
  }

  feedback.appendChild(makeElement("p", data.connectors[exercise.connector].rule, "cg-rule"));
  return feedback;
}

// ---------- screen 3: summary ----------

function showSummary() {
  stopTimer();
  root.innerHTML = "";

  const correct = round.results.filter(result => result.correct).length;
  saveBest(settings.speed, round.score);
  const best = loadBest()[settings.speed];

  root.appendChild(makeElement("h2", `Score: ${round.score} points`));
  root.appendChild(makeElement("p",
    `${correct} / ${round.results.length} sentences correct · ${SPEEDS[settings.speed].label} · best: ${best} points`));

  // results per connector
  const table = makeElement("table", "", "vocab-table");
  const head = makeElement("tr");
  ["Connector", "Correct"].forEach(title => head.appendChild(makeElement("th", title)));
  table.appendChild(head);
  CONNECTOR_ORDER.forEach(name => {
    const mine = round.results.filter(result => result.exercise.connector === name);
    if (mine.length === 0) return;
    const row = makeElement("tr");
    row.appendChild(makeElement("td", name));
    row.appendChild(makeElement("td", `${mine.filter(result => result.correct).length} / ${mine.length}`));
    table.appendChild(row);
  });
  root.appendChild(table);

  // review the mistakes
  const mistakes = round.results.filter(result => !result.correct);
  if (mistakes.length) {
    root.appendChild(makeElement("h3", "Review your mistakes", "cg-review"));
    mistakes.forEach(result => {
      const item = makeElement("div", "", "cg-review-item");
      item.appendChild(makeElement("p", `[${result.exercise.connector}]  ${result.exercise.a}  ${result.exercise.b}`, "muted"));
      if (result.typed.trim()) item.appendChild(makeElement("p", `You wrote: ${result.typed.trim()}`));
      item.appendChild(makeElement("p", result.exercise.answers[0], "cg-sentence"));
      root.appendChild(item);
    });
  } else {
    root.appendChild(makeElement("p", "Perfect round! 🎉"));
  }

  const again = makeElement("button", "Play again", "button");
  again.addEventListener("click", startRound);
  const change = makeElement("button", "Change settings", "button secondary");
  change.addEventListener("click", showSetup);
  const actions = makeElement("div", "", "cg-actions");
  actions.appendChild(again);
  actions.appendChild(change);
  root.appendChild(actions);
}

// ---------- start ----------

loadQuestions(root.dataset.slug)
  .then(loaded => {
    data = loaded;
    showSetup();
  })
  .catch(() => {
    root.textContent = "Sorry, the exercises could not be loaded.";
  });
