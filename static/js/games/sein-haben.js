// Sein or haben game: read a sentence with a blank and press the LEFT arrow (sein) or the
// RIGHT arrow (haben). Then the full sentence is shown with the correct, conjugated verb.
//
// Uses shuffle() and loadQuestions() from main.js. The data file looks like:
//   { roundLength: 15, tenses: { present: {label, english}, ... },
//     exercises: [ { id, tense, person, sentence, answer, form, full, tip } ] }

const root = document.getElementById("game-root");

const TENSE_ORDER = ["present", "perfect", "preterite"];

let data = null;
let settings = { tenses: [...TENSE_ORDER] };
let round = null;     // the round being played
let phase = "setup";  // "setup" | "question" | "feedback" | "summary"

// ---------- small helpers ----------

function makeElement(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("seinhaben-best")) || null;
  } catch (error) {
    return null;
  }
}

// Remember the best result (most correct answers, in a round of the same length).
function saveBest(correct, total) {
  const best = loadBest();
  if (!best || correct > best.correct) {
    try {
      localStorage.setItem("seinhaben-best", JSON.stringify({ correct, total }));
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
    shuffle(data.exercises.filter(exercise => exercise.tense === tense)));
  const picked = [];
  while (picked.length < data.roundLength && lists.some(list => list.length > 0)) {
    for (const list of lists) {
      if (list.length > 0 && picked.length < data.roundLength) picked.push(list.pop());
    }
  }
  return shuffle(picked);
}

// ---------- screens ----------

function showSetup() {
  phase = "setup";
  root.replaceChildren();
  const box = makeElement("div", "", "sh-setup");

  box.append(makeElement("p", "You see a sentence with a blank. Press the left arrow key for sein "
    + "or the right arrow key for haben (you can also click the buttons). Then you see the full "
    + `sentence with the right form. A round has ${data.roundLength} sentences.`));

  const fieldset = makeElement("fieldset");
  fieldset.append(makeElement("legend", "Tenses"));
  const checkboxes = {};
  for (const tense of TENSE_ORDER) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = settings.tenses.includes(tense);
    checkboxes[tense] = checkbox;
    label.append(checkbox, ` ${tenseName(tense)}`);
    fieldset.append(label);
  }
  box.append(fieldset);

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

  const best = loadBest();
  if (best) box.append(makeElement("p", `Best round so far: ${best.correct} / ${best.total} correct`, "muted"));

  root.append(box);
}

function startRound() {
  round = { exercises: pickExercises(), index: 0, correct: 0, streak: 0, results: [] };
  showQuestion();
}

function showQuestion() {
  phase = "question";
  const exercise = round.exercises[round.index];
  root.replaceChildren();

  const top = makeElement("div", "", "sh-top");
  top.append(
    makeElement("span", `Sentence ${round.index + 1} / ${round.exercises.length}`),
    makeElement("span", round.streak >= 2 ? `🔥 ${round.streak} in a row` : ""),
    makeElement("span", `Correct: ${round.correct}`),
  );
  root.append(top);

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
}

function answer(choice) {
  if (phase !== "question") return;
  phase = "feedback";
  const exercise = round.exercises[round.index];
  const correct = choice === exercise.answer;

  round.correct += correct ? 1 : 0;
  round.streak = correct ? round.streak + 1 : 0;
  round.results.push({ exercise, choice, correct });

  root.replaceChildren();

  const top = makeElement("div", "", "sh-top");
  top.append(
    makeElement("span", `Sentence ${round.index + 1} / ${round.exercises.length}`),
    makeElement("span", round.streak >= 2 ? `🔥 ${round.streak} in a row` : ""),
    makeElement("span", `Correct: ${round.correct}`),
  );
  root.append(top);

  const { paragraph, slot } = sentenceElement(exercise, true, "sh-sentence");
  slot.classList.add(correct ? "good" : "bad");
  root.append(paragraph);

  const box = makeElement("div", "", `sh-feedback ${correct ? "good" : "bad"}`);
  box.append(makeElement("p", correct ? "✓ Correct!" : `✗ Not quite: it is ${exercise.answer}.`, "sh-status"));
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
  const total = round.exercises.length;
  saveBest(round.correct, total);
  root.replaceChildren();

  root.append(makeElement("h3", "Round finished"));
  root.append(makeElement("p", `${round.correct} / ${total} correct`, "sh-score"));
  const best = loadBest();
  if (best) root.append(makeElement("p", `Best round so far: ${best.correct} / ${best.total}`, "muted"));

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
      item.append(
        makeElement("p", exercise.full, "sh-sentence-small"),
        makeElement("p", `You picked ${choice}. Answer: ${exercise.answer} (${tenseName(exercise.tense)})`, "muted"),
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
