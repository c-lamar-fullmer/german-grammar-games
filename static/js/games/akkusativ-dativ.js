// Akkusativ or Dativ game: read a sentence with a blank article and press the LEFT arrow
// (Akkusativ) or the RIGHT arrow (Dativ). The answer is revealed at once, with the reason.
// You read it at your own pace and press Enter or Space for the next sentence.
//
// Uses shuffle() and loadQuestions() from main.js. The data file looks like:
//   { roundLengths: [10, 15, 20], defaultRoundLength: 15, twoWayShare: 0.5,
//     categories: { akk: {label, detail}, dat: ..., two: ..., verb: ... },
//     cases: { akk: {label, articles}, dat: {...} },
//     exercises: [ { id, category, group, sentence, answer, form, full, key, tip, tricky } ] }

const root = document.getElementById("game-root");

const CATEGORY_ORDER = ["akk", "dat", "two", "verb"];
const SPEEDS = {
  relaxed: { label: "Relaxed", seconds: 15 },
  normal: { label: "Normal", seconds: 10 },
  sprint: { label: "Sprint", seconds: 5 },
  none: { label: "No timer", seconds: 0 },
};

let data = null;
let settings = {
  categories: [...CATEGORY_ORDER],
  length: 15,
  speed: "normal",
  trickyOnly: false,
};
let round = null;     // the round being played
let phase = "setup";  // "setup" | "question" | "feedback" | "summary"
let timer = null;     // the countdown for the current sentence

// ---------- small helpers ----------

function makeElement(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

// Best round per speed and length, saved in this browser.
function bestKey() {
  return `${settings.speed}-${settings.length}`;
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("cases-best")) || {};
  } catch (error) {
    return {};
  }
}

function saveBest(correct, total) {
  const best = loadBest();
  const old = best[bestKey()];
  if (!old || correct > old.correct) {
    best[bestKey()] = { correct, total };
    try {
      localStorage.setItem("cases-best", JSON.stringify(best));
    } catch (error) {
      // saving is optional
    }
  }
}

function categoryLabel(category) {
  return data.categories[category].label;
}

function caseLabel(answer) {
  return data.cases[answer].label;
}

// Build a sentence element. The blank, or the revealed article, is a highlighted <span>.
function sentenceElement(exercise, revealed, className) {
  const paragraph = makeElement("p", "", className);
  const [before, after] = exercise.sentence.split("___");
  paragraph.append(before);
  const slot = makeElement("span", revealed ? exercise.form : "  ", "cs-slot");
  paragraph.append(slot, after);
  return { paragraph, slot };
}

// ---------- choosing the sentences of a round ----------

function pool(category) {
  return shuffle(data.exercises.filter(exercise =>
    exercise.category === category && (!settings.trickyOnly || exercise.tricky)));
}

// Two-way prepositions make up half of the round (when chosen together with other categories).
// The other categories share the rest equally. If a category runs out, the others fill the gap.
function pickExercises() {
  const length = settings.length;
  const chosen = settings.categories;
  const pools = Object.fromEntries(chosen.map(category => [category, pool(category)]));
  const others = chosen.filter(category => category !== "two");

  const quota = {};
  if (chosen.includes("two") && others.length > 0) {
    quota.two = Math.ceil(length * data.twoWayShare);
    const rest = length - quota.two;
    others.forEach((category, i) => {
      quota[category] = Math.floor(rest / others.length) + (i < rest % others.length ? 1 : 0);
    });
  } else {
    chosen.forEach((category, i) => {
      quota[category] = Math.floor(length / chosen.length) + (i < length % chosen.length ? 1 : 0);
    });
  }

  const picked = [];
  for (const category of chosen) {
    picked.push(...pools[category].splice(0, quota[category]));
  }
  // fill up from whatever is left (a small category, or tricky-only mode)
  const leftovers = shuffle(chosen.flatMap(category => pools[category]));
  while (picked.length < length && leftovers.length > 0) picked.push(leftovers.pop());
  return shuffle(picked);
}

function topBar() {
  const top = makeElement("div", "", "cs-top");
  top.append(
    makeElement("span", `Sentence ${round.index + 1} / ${round.exercises.length}`),
    makeElement("span", round.streak >= 2 ? `🔥 ${round.streak} in a row` : "", "cs-streak"),
    makeElement("span", `Correct: ${round.correct}`),
  );
  return top;
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
  }, 50);
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
  const fill = root.querySelector(".cs-timer-fill");
  const text = root.querySelector(".cs-time");
  if (!fill || !timer) return;
  const left = secondsLeft();
  fill.style.width = `${(left / timer.seconds) * 100}%`;
  text.textContent = `${left.toFixed(1)} s`;
  fill.parentElement.classList.toggle("low", left <= 2);
}

// ---------- screens ----------

// A fieldset with a legend and one labelled input per option. Used for the settings.
function optionGroup(title, options) {
  const fieldset = makeElement("fieldset");
  fieldset.append(makeElement("legend", title));
  for (const option of options) {
    const label = document.createElement("label");
    label.append(option.input, " ", option.text);
    if (option.detail) label.append(makeElement("span", ` ${option.detail}`, "muted cs-detail"));
    fieldset.append(label);
  }
  return fieldset;
}

function makeInput(type, name, checked, onChange) {
  const input = document.createElement("input");
  input.type = type;
  if (name) input.name = name;
  input.checked = checked;
  input.addEventListener("change", onChange);
  return input;
}

function showSetup() {
  stopTimer();
  phase = "setup";
  root.replaceChildren();
  const box = makeElement("div", "", "cs-setup");

  box.append(makeElement("p", "You see a sentence with a blank article. Press the left arrow key for "
    + "Akkusativ or the right arrow key for Dativ (or click the buttons). The answer shows right away, "
    + "with the reason. Press Enter or Space for the next sentence."));

  // categories
  const start = makeElement("button", "Start round", "button");
  start.type = "button";
  const categoryInputs = {};
  const categoryOptions = CATEGORY_ORDER.map(category => {
    const input = makeInput("checkbox", null, settings.categories.includes(category), () => {
      settings.categories = CATEGORY_ORDER.filter(key => categoryInputs[key].checked);
      start.disabled = settings.categories.length === 0;
    });
    categoryInputs[category] = input;
    return { input, text: data.categories[category].label, detail: `(${data.categories[category].detail})` };
  });
  const categories = optionGroup("What do you want to practise?", categoryOptions);
  categories.append(makeElement("p",
    "Two-way prepositions are the hardest, so they fill half of every round when you pick them with other categories.",
    "muted cs-note"));
  box.append(categories);

  // round length
  box.append(optionGroup("Sentences per round", data.roundLengths.map(length => ({
    input: makeInput("radio", "length", settings.length === length, () => { settings.length = length; }),
    text: String(length),
  }))));

  // speed
  box.append(optionGroup("Speed", Object.entries(SPEEDS).map(([key, speed]) => ({
    input: makeInput("radio", "speed", settings.speed === key, () => { settings.speed = key; }),
    text: speed.seconds > 0 ? `${speed.label} (${speed.seconds} s per sentence)` : `${speed.label} (take your time)`,
  }))));

  // tricky only
  const trickyLabel = document.createElement("label");
  trickyLabel.className = "cs-tricky";
  trickyLabel.append(
    makeInput("checkbox", null, settings.trickyOnly, event => { settings.trickyOnly = event.target.checked; }),
    " Only tricky sentences (traps and exceptions)",
  );
  box.append(trickyLabel);

  start.disabled = settings.categories.length === 0;
  start.addEventListener("click", startRound);
  box.append(start);

  const best = loadBest()[bestKey()];
  if (best) {
    box.append(makeElement("p", `Best round so far: ${best.correct} / ${best.total} correct`, "muted"));
  }
  root.append(box);
}

function startRound() {
  round = { exercises: pickExercises(), index: 0, correct: 0, streak: 0, results: [] };
  showQuestion();
}

function showQuestion() {
  phase = "question";
  const exercise = round.exercises[round.index];
  const seconds = SPEEDS[settings.speed].seconds;
  root.replaceChildren();

  root.append(topBar());

  const bar = makeElement("div", "", "cs-timer");
  if (seconds > 0) bar.append(makeElement("div", "", "cs-timer-fill"));
  root.append(bar, makeElement("p", seconds > 0 ? "" : "No timer", "cs-time muted"));

  root.append(sentenceElement(exercise, false, "cs-sentence").paragraph);

  const choices = makeElement("div", "", "cs-choices");
  for (const [choice, arrow] of [["akk", "left"], ["dat", "right"]]) {
    const button = makeElement("button", "", "cs-choice");
    button.type = "button";
    button.dataset.choice = choice;
    const word = makeElement("span", "", "cs-word");
    word.append(makeElement("span", caseLabel(choice)), makeElement("small", data.cases[choice].articles));
    button.append(makeElement("span", arrow === "left" ? "←" : "→", "cs-arrow"), word);
    button.addEventListener("click", () => answer(choice));
    choices.append(button);
  }
  root.append(choices);
  root.append(makeElement("p", "Left arrow = Akkusativ · Right arrow = Dativ", "muted cs-hint"));

  if (seconds > 0) startTimer(seconds, () => answer(null));
}

// choice is "akk", "dat", or null when the time ran out.
function answer(choice) {
  if (phase !== "question") return;
  phase = "feedback";
  stopTimer();
  const exercise = round.exercises[round.index];
  const correct = choice === exercise.answer;

  round.correct += correct ? 1 : 0;
  round.streak = correct ? round.streak + 1 : 0;
  round.results.push({ exercise, choice, correct });

  root.replaceChildren();
  root.append(topBar());

  const { paragraph, slot } = sentenceElement(exercise, true, "cs-sentence");
  slot.classList.add(correct ? "good" : "bad");
  root.append(paragraph);

  const right = caseLabel(exercise.answer);
  let status = "✓ Correct!";
  if (choice === null) status = `⏱ Time's up: it is ${right}.`;
  else if (!correct) status = `✗ Not quite: it is ${right}.`;

  const box = makeElement("div", "", `cs-feedback ${correct ? "good" : "bad"}`);
  box.append(makeElement("p", status, "cs-status"));
  const group = exercise.group || categoryLabel(exercise.category);
  box.append(makeElement("p", `${exercise.form} → ${right}  ·  ${exercise.key}  ·  ${group}`, "cs-form"));
  box.append(makeElement("p", exercise.tip, "cs-tip"));
  root.append(box);

  const last = round.index === round.exercises.length - 1;
  const next = makeElement("button", last ? "See results" : "Next sentence", "button");
  next.type = "button";
  next.addEventListener("click", nextQuestion);
  root.append(next, makeElement("span", "  (Enter or Space)", "muted"));
  next.focus();
}

function nextQuestion() {
  if (phase !== "feedback") return;
  round.index += 1;
  if (round.index >= round.exercises.length) {
    showSummary();
  } else {
    showQuestion();
  }
}

function showSummary() {
  phase = "summary";
  stopTimer();
  const total = round.exercises.length;
  saveBest(round.correct, total);
  root.replaceChildren();

  root.append(makeElement("h3", "Round finished"));
  root.append(makeElement("p", `${round.correct} / ${total} correct`, "cs-score"));
  const best = loadBest()[bestKey()];
  if (best) root.append(makeElement("p", `Best round with these settings: ${best.correct} / ${best.total}`, "muted"));

  // result per category
  const table = makeElement("table", "", "vocab-table");
  const head = document.createElement("tr");
  ["Category", "Correct"].forEach(text => head.append(makeElement("th", text)));
  table.append(head);
  for (const category of CATEGORY_ORDER) {
    const rows = round.results.filter(result => result.exercise.category === category);
    if (rows.length === 0) continue;
    const row = document.createElement("tr");
    row.append(
      makeElement("td", categoryLabel(category)),
      makeElement("td", `${rows.filter(result => result.correct).length} / ${rows.length}`),
    );
    table.append(row);
  }
  const wrap = makeElement("div", "", "table-wrap");
  wrap.append(table);
  root.append(wrap);

  const mistakes = round.results.filter(result => !result.correct);
  if (mistakes.length > 0) {
    // which prepositions or verbs went wrong most often?
    const counts = {};
    mistakes.forEach(({ exercise }) => { counts[exercise.key] = (counts[exercise.key] || 0) + 1; });
    const spots = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([key, count]) => (count > 1 ? `${key} (${count})` : key)).join(", ");
    root.append(makeElement("p", `Practise these: ${spots}`, "cs-spots"));

    root.append(makeElement("h3", "Review your mistakes", "cs-review"));
    for (const { exercise, choice } of mistakes) {
      const item = makeElement("div", "", "cs-review-item");
      const youPicked = choice === null ? "You ran out of time." : `You picked ${caseLabel(choice)}.`;
      item.append(
        makeElement("p", exercise.full, "cs-sentence-small"),
        makeElement("p", `${youPicked} Answer: ${caseLabel(exercise.answer)}`, "muted"),
        makeElement("p", exercise.tip, "cs-tip"),
      );
      root.append(item);
    }
  } else {
    root.append(makeElement("p", "No mistakes. Perfect round!"));
  }

  const again = makeElement("button", "Play again", "button");
  again.type = "button";
  again.addEventListener("click", startRound);
  const change = makeElement("button", "Change settings", "button secondary");
  change.type = "button";
  change.addEventListener("click", showSetup);
  const actions = makeElement("p", "", "cs-actions");
  actions.append(again, change);
  root.append(actions);
}

// ---------- keyboard ----------
// Left = Akkusativ, Right = Dativ. Enter or Space = next sentence.
// Ignored while you type somewhere (the vocabulary search) or when the Play tab is hidden.

document.addEventListener("keydown", event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (root.offsetParent === null) return;

  if (phase === "question" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    answer(event.key === "ArrowLeft" ? "akk" : "dat");
  } else if (phase === "feedback" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    nextQuestion();
  }
});

// ---------- start ----------

loadQuestions(root.dataset.slug)
  .then(loaded => {
    data = loaded;
    settings.length = data.defaultRoundLength;
    showSetup();
  })
  .catch(() => {
    root.textContent = "Could not load the sentences. Is the Flask server running?";
  });
