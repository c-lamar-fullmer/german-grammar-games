// Sein or haben game: read a sentence with a blank and press the LEFT arrow (sein) or the
// RIGHT arrow (haben). The answer is revealed at once, with the reason.
// You read it at your own pace and press Enter or Space for the next sentence.
// A timer counts down for every sentence (you can switch it off).
//
// Uses shuffle() and loadQuestions() from main.js. The data file looks like:
//   { roundLength: 15, tenses: { present: {label, english}, ... },
//     exercises: [ { id, tense, person, sentence, answer, form, full, tip } ] }

const root = document.getElementById("game-root");

const TENSE_ORDER = ["present", "perfect", "preterite"];
const SPEEDS = {
  relaxed: { label: "Relaxed", seconds: 10 },
  normal: { label: "Normal", seconds: 6 },
  sprint: { label: "Sprint", seconds: 3 },
  none: { label: "No timer", seconds: 0 },
};
let data = null;
let settings = { tenses: [...TENSE_ORDER], speed: "normal", trickyOnly: false };
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

// Best round per speed, saved in this browser.
function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("seinhaben-best-by-speed")) || {};
  } catch (error) {
    return {};
  }
}

function saveBest(speed, correct, total) {
  const best = loadBest();
  if (!best[speed] || correct > best[speed].correct) {
    best[speed] = { correct, total };
    try {
      localStorage.setItem("seinhaben-best-by-speed", JSON.stringify(best));
    } catch (error) {
      // saving is optional
    }
  }
}

function tenseName(tense) {
  const info = data.tenses[tense];
  return `${info.label} (${info.english})`;
}

// Build a sentence element. The blank, or the revealed verb, is a highlighted <span>.
function sentenceElement(exercise, revealed, className) {
  const paragraph = makeElement("p", "", className);
  const [before, after] = exercise.sentence.split("___");
  paragraph.append(before);
  const slot = makeElement("span", revealed ? exercise.form : "  ", "sh-slot");
  paragraph.append(slot, after);
  return { paragraph, slot };
}

// Take exercises from every chosen tense in turn, so a round is a real mix.
function pickExercises() {
  const lists = settings.tenses.map(tense =>
    shuffle(data.exercises.filter(exercise =>
      exercise.tense === tense && (!settings.trickyOnly || exercise.tricky))));
  const picked = [];
  while (picked.length < data.roundLength && lists.some(list => list.length > 0)) {
    for (const list of lists) {
      if (list.length > 0 && picked.length < data.roundLength) picked.push(list.pop());
    }
  }
  return shuffle(picked);
}

function topBar() {
  const top = makeElement("div", "", "sh-top");
  top.append(
    makeElement("span", `Sentence ${round.index + 1} / ${round.exercises.length}`),
    makeElement("span", round.streak >= 2 ? `🔥 ${round.streak} in a row` : "", "sh-streak"),
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
  const fill = root.querySelector(".sh-timer-fill");
  const text = root.querySelector(".sh-time");
  if (!fill || !timer) return;
  const left = secondsLeft();
  fill.style.width = `${(left / timer.seconds) * 100}%`;
  text.textContent = `${left.toFixed(1)} s`;
  fill.parentElement.classList.toggle("low", left <= 1.5);
}

// ---------- screens ----------

function showSetup() {
  stopTimer();
  phase = "setup";
  root.replaceChildren();
  const box = makeElement("div", "", "sh-setup");

  box.append(makeElement("p", "You see a sentence with a blank. Press the left arrow key for sein "
    + "or the right arrow key for haben (you can also click the buttons). The answer shows right "
    + "away. Read the explanation, then press Enter or Space for the next sentence. "
    + `A round has ${data.roundLength} sentences.`));

  const tenses = makeElement("fieldset");
  tenses.append(makeElement("legend", "Tenses"));
  const checkboxes = {};
  for (const tense of TENSE_ORDER) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = settings.tenses.includes(tense);
    checkboxes[tense] = checkbox;
    label.append(checkbox, ` ${tenseName(tense)}`);
    tenses.append(label);
  }
  box.append(tenses);

  const speeds = makeElement("fieldset");
  speeds.append(makeElement("legend", "Speed"));
  for (const [key, speed] of Object.entries(SPEEDS)) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "speed";
    radio.checked = settings.speed === key;
    radio.addEventListener("change", () => { settings.speed = key; });
    const text = speed.seconds > 0
      ? ` ${speed.label} (${speed.seconds} s per sentence)`
      : ` ${speed.label} (take your time)`;
    label.append(radio, text);
    speeds.append(label);
  }
  box.append(speeds);

  const trickyLabel = document.createElement("label");
  const trickyBox = document.createElement("input");
  trickyBox.type = "checkbox";
  trickyBox.checked = settings.trickyOnly;
  trickyBox.addEventListener("change", () => { settings.trickyOnly = trickyBox.checked; });
  trickyLabel.append(trickyBox, " Only tricky sentences (false friends and exceptions)");
  trickyLabel.className = "sh-tricky";
  box.append(trickyLabel);

  const start = makeElement("button", "Start round", "button");
  start.type = "button";
  const refresh = () => {
    settings.tenses = TENSE_ORDER.filter(tense => checkboxes[tense].checked);
    start.disabled = settings.tenses.length === 0;
  };
  Object.values(checkboxes).forEach(checkbox => checkbox.addEventListener("change", refresh));
  refresh();
  start.addEventListener("click", startRound);
  box.append(start);

  const best = loadBest()[settings.speed];
  if (best) {
    box.append(makeElement("p", `Best round at this speed: ${best.correct} / ${best.total} correct`, "muted"));
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

  const bar = makeElement("div", "", "sh-timer");
  if (seconds > 0) {
    bar.append(makeElement("div", "", "sh-timer-fill"));
  }
  const clock = makeElement("p", seconds > 0 ? "" : "No timer", "sh-time muted");
  root.append(bar, clock);

  root.append(sentenceElement(exercise, false, "sh-sentence").paragraph);

  const choices = makeElement("div", "", "sh-choices");
  for (const [choice, arrow] of [["sein", "left"], ["haben", "right"]]) {
    const button = makeElement("button", "", "sh-choice");
    button.type = "button";
    button.dataset.choice = choice;
    button.append(
      makeElement("span", arrow === "left" ? "←" : "→", "sh-arrow"),
      makeElement("span", choice, "sh-word"),
    );
    button.addEventListener("click", () => answer(choice));
    choices.append(button);
  }
  root.append(choices);
  root.append(makeElement("p", "Left arrow = sein · Right arrow = haben", "muted sh-hint"));

  if (seconds > 0) startTimer(seconds, () => answer(null));
}

// choice is "sein", "haben", or null when the time ran out.
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

  const { paragraph, slot } = sentenceElement(exercise, true, "sh-sentence");
  slot.classList.add(correct ? "good" : "bad");
  root.append(paragraph);

  let status = "✓ Correct!";
  if (choice === null) status = `⏱ Time's up: it is ${exercise.answer}.`;
  else if (!correct) status = `✗ Not quite: it is ${exercise.answer}.`;

  const box = makeElement("div", "", `sh-feedback ${correct ? "good" : "bad"}`);
  box.append(makeElement("p", status, "sh-status"));
  box.append(makeElement("p", `${exercise.form} → ${exercise.answer}  ·  ${tenseName(exercise.tense)}`, "sh-form"));
  box.append(makeElement("p", exercise.tip, "sh-tip"));
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
  saveBest(settings.speed, round.correct, total);
  root.replaceChildren();

  root.append(makeElement("h3", "Round finished"));
  root.append(makeElement("p", `${round.correct} / ${total} correct`, "sh-score"));
  const best = loadBest()[settings.speed];
  if (best) {
    root.append(makeElement("p", `Best round at this speed (${SPEEDS[settings.speed].label}): ${best.correct} / ${best.total}`, "muted"));
  }

  // result per tense
  const table = makeElement("table", "", "vocab-table");
  const head = document.createElement("tr");
  ["Tense", "Correct"].forEach(text => head.append(makeElement("th", text)));
  table.append(head);
  for (const tense of TENSE_ORDER) {
    const rows = round.results.filter(result => result.exercise.tense === tense);
    if (rows.length === 0) continue;
    const row = document.createElement("tr");
    row.append(
      makeElement("td", tenseName(tense)),
      makeElement("td", `${rows.filter(result => result.correct).length} / ${rows.length}`),
    );
    table.append(row);
  }
  const wrap = makeElement("div", "", "table-wrap");
  wrap.append(table);
  root.append(wrap);

  const mistakes = round.results.filter(result => !result.correct);
  if (mistakes.length > 0) {
    root.append(makeElement("h3", "Review your mistakes", "sh-review"));
    for (const { exercise, choice } of mistakes) {
      const item = makeElement("div", "", "sh-review-item");
      const youPicked = choice === null ? "You ran out of time." : `You picked ${choice}.`;
      item.append(
        makeElement("p", exercise.full, "sh-sentence-small"),
        makeElement("p", `${youPicked} Answer: ${exercise.answer} (${tenseName(exercise.tense)})`, "muted"),
        makeElement("p", exercise.tip, "sh-tip"),
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
  const actions = makeElement("p", "", "sh-actions");
  actions.append(again, change);
  root.append(actions);
}

// ---------- keyboard ----------
// Left = sein, Right = haben. Enter or Space = next sentence.
// Ignored while you type somewhere (the vocabulary search) or when the Play tab is hidden.

document.addEventListener("keydown", event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
  if (root.offsetParent === null) return;

  if (phase === "question" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    answer(event.key === "ArrowLeft" ? "sein" : "haben");
  } else if (phase === "feedback" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    nextQuestion();
  }
});

// ---------- start ----------

loadQuestions(root.dataset.slug)
  .then(loaded => {
    data = loaded;
    showSetup();
  })
  .catch(() => {
    root.textContent = "Could not load the sentences. Is the Flask server running?";
  });
