// Adjective endings game: read a sentence and TYPE the missing ending of the adjective.
//
// Uses loadQuestions() and shuffle() from main.js. The data file looks like:
//   { roundLengths, defaultRoundLength, types, cases, genders, steps, tables,
//     exercises: [ { id, type, case, gender, before, after, stem, ending, determiner, noun, full, tip, hard } ] }
// "before" ends with the adjective stem ("... den kleinen" is NOT stored, only "... den klein"),
// so the sentence is shown as  before + [ input ] + after.

const root = document.getElementById("game-root");

const SPEEDS = {
  relaxed: { label: "Relaxed", seconds: 30 },
  normal: { label: "Normal", seconds: 15 },
  sprint: { label: "Sprint", seconds: 8 },
  none: { label: "No timer", seconds: 0 },
};
const HELP = {
  guided: "Guided: show the type, case and gender of every sentence",
  request: "On request: a Hint button shows them (the point bonus is smaller)",
  none: "No help: work it out from the sentence",
};
const TYPE_ORDER = ["weak", "mixed", "strong"];
const CASE_ORDER = ["nom", "akk", "dat", "gen"];
const GENDER_ORDER = ["m", "f", "n", "p"];

let data = null;
let settings = {
  types: ["weak"], cases: ["nom", "akk"], genders: [...GENDER_ORDER],
  hardOnly: false, help: "guided", speed: "none", length: 15, step: 0,
};
let round = null;
let timer = null;

// ---------- small helpers ----------

function makeElement(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function typeLabel(type) { return data.types[type].label; }
function genderLabel(gender) { return data.genders[gender]; }

// "weak · Akkusativ · masculine"
function cellLabel(type, kase, gender) {
  return `${typeLabel(type)} · ${data.cases[kase]} · ${genderLabel(gender)}`;
}

// Best score, saved in this browser for each combination of settings.
function bestKey() {
  return [settings.types.join("+"), settings.cases.join("+"), settings.genders.join("+"),
    settings.hardOnly ? "hard" : "all", settings.speed, settings.length].join("|");
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("adjektivendungen-best")) || {};
  } catch (error) {
    return {};
  }
}

function saveBest(points) {
  try {
    const best = loadBest();
    if (points > (best[bestKey()] ?? -1)) {
      best[bestKey()] = points;
      localStorage.setItem("adjektivendungen-best", JSON.stringify(best));
    }
  } catch (error) {
    // private mode etc.: not saving a score is fine
  }
}

// ---------- reading what you typed ----------

function simplify(text) {
  return text.trim().toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

// You may type "en", "-en" or the whole word ("kleinen").
function readEnding(exercise, typed) {
  let text = simplify(typed).replace(/^[-–_.\s]+/, "");
  const stem = simplify(exercise.stem);
  if (text.startsWith(stem) && text.length > stem.length) text = text.slice(stem.length);
  return text;
}

function judge(exercise, typed) {
  const ending = readEnding(exercise, typed);
  if (ending === exercise.ending) return { correct: true, hint: "" };
  return { correct: false, hint: mistakeHint(exercise, ending) };
}

// A short tip about the most likely mistake.
function mistakeHint(exercise, ending) {
  if (ending === "") return "";
  if (!["e", "en", "er", "es", "em"].includes(ending)) {
    return "An adjective ending is one of: -e, -en, -er, -es, -em.";
  }
  // same type and case, but the ending of another gender?
  const row = data.tables[exercise.type][exercise.case];
  const otherGender = GENDER_ORDER.find(g => g !== exercise.gender && row[g] === ending);
  if (otherGender) {
    return `-${ending} is the ending for ${genderLabel(otherGender)} here. This noun is ${genderLabel(exercise.gender)}.`;
  }
  // the right ending for another type?
  const otherType = TYPE_ORDER.find(t => t !== exercise.type && data.tables[t][exercise.case][exercise.gender] === ending);
  if (otherType) {
    return `-${ending} is the ${typeLabel(otherType).toLowerCase()} ending. Look at the word before the adjective: this is the ${typeLabel(exercise.type).toLowerCase()} type.`;
  }
  // the right ending for another case?
  const otherCase = CASE_ORDER.find(c => c !== exercise.case && data.tables[exercise.type][c][exercise.gender] === ending);
  if (otherCase) {
    return `-${ending} would be ${data.cases[otherCase]}. This sentence is ${data.cases[exercise.case]}.`;
  }
  return "";
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
  const bar = root.querySelector(".ae-timer-fill");
  const text = root.querySelector(".ae-time");
  if (!bar || !timer) return;
  const left = secondsLeft();
  bar.style.width = `${(left / timer.seconds) * 100}%`;
  bar.parentElement.classList.toggle("low", left <= 3);
  text.textContent = `⏱ ${Math.ceil(left)} s`;
}

// ---------- which sentences match the filters ----------

function matching() {
  return data.exercises.filter(e =>
    settings.types.includes(e.type) && settings.cases.includes(e.case) &&
    settings.genders.includes(e.gender) && (!settings.hardOnly || e.hard));
}

// Spread the round over all the type/case/gender combinations that are switched on,
// instead of picking at random (which would favour the combinations with most sentences).
function pickExercises() {
  const cells = new Map();
  shuffle(matching()).forEach(exercise => {
    const key = `${exercise.type}|${exercise.case}|${exercise.gender}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(exercise);
  });
  const queues = shuffle([...cells.values()]);
  const picked = [];
  while (picked.length < settings.length && queues.some(queue => queue.length)) {
    for (const queue of queues) {
      if (queue.length && picked.length < settings.length) picked.push(queue.pop());
    }
  }
  return shuffle(picked);
}

// ---------- screen 1: setup ----------

function checkboxGroup(legend, order, labels, selected, onChange) {
  const box = makeElement("fieldset");
  box.appendChild(makeElement("legend", legend));
  order.forEach(key => {
    const label = makeElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.checked = selected.includes(key);
    input.addEventListener("change", () => {
      onChange(order.filter(k => box.querySelector(`input[value="${k}"]`).checked));
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${labels[key]}`));
    box.appendChild(label);
  });
  return box;
}

function radioGroup(legend, name, options, current, onChange) {
  const box = makeElement("fieldset");
  box.appendChild(makeElement("legend", legend));
  options.forEach(([value, text]) => {
    const label = makeElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.checked = String(current) === String(value);
    input.addEventListener("change", () => onChange(value));
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${text}`));
    box.appendChild(label);
  });
  return box;
}

function showSetup() {
  stopTimer();
  root.innerHTML = "";
  const screen = makeElement("div", "", "ae-setup");

  screen.appendChild(makeElement("p",
    "Read the sentence and type the missing adjective ending (e, en, er, es or em), then press Enter. " +
    "Start with Step 1 and work your way up, or build your own mix with the filters."));

  // learning steps (presets for the filters below)
  const stepsBox = makeElement("fieldset");
  stepsBox.appendChild(makeElement("legend", "Learning steps"));
  const stepList = makeElement("div", "", "ae-steps");
  data.steps.forEach((step, i) => {
    const label = makeElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "step";
    radio.value = String(i + 1);
    radio.checked = settings.step === i + 1;
    radio.addEventListener("change", () => {
      settings.step = i + 1;
      settings.types = [...step.types];
      settings.cases = [...step.cases];
      settings.genders = [...GENDER_ORDER];
      settings.hardOnly = false;
      showSetup();
    });
    label.appendChild(radio);
    const strong = makeElement("b", step.label);
    label.appendChild(document.createTextNode(" "));
    label.appendChild(strong);
    label.appendChild(document.createTextNode(`: ${step.text}`));
    stepList.appendChild(label);
  });
  stepsBox.appendChild(stepList);
  stepsBox.appendChild(makeElement("p", settings.step ? "" : "You are using your own mix of filters.", "muted small ae-custom"));
  screen.appendChild(stepsBox);

  // filters
  const filterRow = makeElement("div", "", "ae-filters");
  const changed = () => { settings.step = 0; showSetup(); };
  const typeLabels = {};
  TYPE_ORDER.forEach(t => { typeLabels[t] = `${data.types[t].label} (${data.types[t].detail})`; });
  filterRow.appendChild(checkboxGroup("Declension type", TYPE_ORDER, typeLabels, settings.types,
    list => { settings.types = list; changed(); }));
  filterRow.appendChild(checkboxGroup("Case", CASE_ORDER, data.cases, settings.cases,
    list => { settings.cases = list; changed(); }));
  filterRow.appendChild(checkboxGroup("Gender", GENDER_ORDER, data.genders, settings.genders,
    list => { settings.genders = list; changed(); }));
  screen.appendChild(filterRow);

  const hardBox = makeElement("fieldset");
  const hardLabel = makeElement("label");
  const hard = document.createElement("input");
  hard.type = "checkbox";
  hard.checked = settings.hardOnly;
  hard.addEventListener("change", () => { settings.hardOnly = hard.checked; showSetup(); });
  hardLabel.appendChild(hard);
  hardLabel.appendChild(document.createTextNode(" Tricky endings only (-er, -es, -em: the ones that copy the article)"));
  hardBox.appendChild(hardLabel);
  screen.appendChild(hardBox);

  // help, length, speed
  screen.appendChild(radioGroup("Help", "help", Object.entries(HELP), settings.help,
    value => { settings.help = value; }));
  screen.appendChild(radioGroup("Round length", "length",
    data.roundLengths.map(n => [n, `${n} sentences`]), settings.length,
    value => { settings.length = Number(value); showSetup(); }));

  const best = loadBest();
  const speedOptions = Object.entries(SPEEDS).map(([key, speed]) =>
    [key, speed.seconds ? `${speed.label} (${speed.seconds} s per sentence)` : "No timer (take your time)"]);
  screen.appendChild(radioGroup("Speed", "speed", speedOptions, settings.speed, value => { settings.speed = value; showSetup(); }));

  const available = matching().length;
  const usable = Math.min(available, settings.length);
  const record = best[bestKey()] !== undefined ? ` · your best with these settings: ${best[bestKey()]} points` : "";
  screen.appendChild(makeElement("p",
    available === 0
      ? "No sentences match these filters. Switch on more types, cases or genders."
      : `${available} sentences match; this round will have ${usable}.${record}`, "muted ae-count"));

  const start = makeElement("button", "Start round", "button");
  start.disabled = available === 0;
  start.addEventListener("click", startRound);
  screen.appendChild(start);

  root.appendChild(screen);
}

// ---------- screen 2: one sentence ----------

function startRound() {
  round = { exercises: pickExercises(), index: 0, score: 0, results: [], finished: false, hintUsed: false };
  showQuestion();
}

function chipsFor(exercise) {
  const chips = makeElement("div", "", "ae-chips");
  [typeLabel(exercise.type), data.cases[exercise.case], genderLabel(exercise.gender)].forEach((text, i) => {
    chips.appendChild(makeElement("span", text, `ae-chip ae-chip-${i}`));
  });
  return chips;
}

function showQuestion() {
  const exercise = round.exercises[round.index];
  const seconds = SPEEDS[settings.speed].seconds;
  round.finished = false;
  round.hintUsed = false;
  root.innerHTML = "";

  const top = makeElement("div", "", "ae-top");
  top.appendChild(makeElement("span", `Sentence ${round.index + 1} / ${round.exercises.length}`));
  top.appendChild(makeElement("span", seconds ? "" : "No timer", "ae-time"));
  top.appendChild(makeElement("span", `Score: ${round.score}`, "ae-score"));
  root.appendChild(top);

  if (seconds) {
    const bar = makeElement("div", "", "ae-timer");
    bar.appendChild(makeElement("div", "", "ae-timer-fill"));
    root.appendChild(bar);
  }

  // the sentence with the input in the gap
  const sentence = makeElement("p", "", "ae-sentence");
  sentence.appendChild(document.createTextNode(exercise.before));
  const input = document.createElement("input");
  input.type = "text";
  input.className = "ae-input";
  input.maxLength = 12;
  input.size = 3;
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", `Ending of "${exercise.stem}"`);
  sentence.appendChild(input);
  sentence.appendChild(document.createTextNode(exercise.after));
  root.appendChild(sentence);

  // help: chips with type, case and gender
  const helpBox = makeElement("div", "", "ae-help");
  if (settings.help === "guided") {
    helpBox.appendChild(chipsFor(exercise));
  } else if (settings.help === "request") {
    const hint = makeElement("button", "Hint", "button secondary");
    hint.type = "button";
    hint.addEventListener("click", () => {
      round.hintUsed = true;
      hint.replaceWith(chipsFor(exercise));
      input.focus();
    });
    helpBox.appendChild(hint);
  }
  root.appendChild(helpBox);

  const actions = makeElement("div", "", "ae-actions");
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

  root.appendChild(makeElement("div", "", "ae-feedback-box"));

  input.focus();
  if (seconds) {
    startTimer(seconds, () => finishQuestion(exercise, { correct: false, timedOut: true, typed: input.value }));
  }
}

function submit(exercise, input) {
  if (round.finished || input.value.trim() === "") return;
  finishQuestion(exercise, { ...judge(exercise, input.value), typed: input.value });
}

// ---------- feedback after each sentence ----------

function finishQuestion(exercise, outcome) {
  if (round.finished) return;
  round.finished = true;

  const timed = SPEEDS[settings.speed].seconds > 0;
  const base = round.hintUsed ? 5 : 10;
  outcome.points = outcome.correct ? base + (timed ? Math.floor(secondsLeft()) : 0) : 0;
  stopTimer();

  round.score += outcome.points;
  round.results.push({ exercise, ...outcome });
  root.querySelector(".ae-score").textContent = `Score: ${round.score}`;

  // show the finished word right in the sentence
  const input = root.querySelector(".ae-input");
  input.disabled = true;
  input.classList.add(outcome.correct ? "good" : "bad");
  root.querySelectorAll(".ae-actions button, .ae-help button").forEach(button => { button.disabled = true; });
  const help = root.querySelector(".ae-help");
  if (!help.querySelector(".ae-chips")) help.appendChild(chipsFor(exercise));

  const box = root.querySelector(".ae-feedback-box");
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

// The table of endings for one declension type, with one cell highlighted.
function endingsTable(type, highlightCase, highlightGender) {
  const wrap = makeElement("div", "", "table-wrap");
  const table = makeElement("table", "", "ae-table");
  const head = makeElement("tr");
  head.appendChild(makeElement("th", `${typeLabel(type)} endings`));
  GENDER_ORDER.forEach(g => head.appendChild(makeElement("th", genderLabel(g))));
  table.appendChild(head);
  CASE_ORDER.forEach(c => {
    const row = makeElement("tr");
    row.appendChild(makeElement("td", data.cases[c]));
    GENDER_ORDER.forEach(g => {
      const cell = makeElement("td", `-${data.tables[type][c][g]}`);
      if (c === highlightCase && g === highlightGender) cell.className = "hl";
      row.appendChild(cell);
    });
    table.appendChild(row);
  });
  wrap.appendChild(table);
  return wrap;
}

function buildFeedback(exercise, outcome) {
  const feedback = makeElement("div", "", `ae-feedback ${outcome.correct ? "good" : "bad"}`);

  let status = "✗ Not quite.";
  if (outcome.correct) status = `✓ Correct! +${outcome.points} points`;
  else if (outcome.timedOut) status = "⏱ Time's up.";
  else if (outcome.skipped) status = "Skipped.";
  feedback.appendChild(makeElement("p", status, "ae-status"));

  // the full sentence with the ending marked
  const full = makeElement("p", "", "ae-full");
  full.appendChild(document.createTextNode(exercise.before));
  full.appendChild(makeElement("mark", exercise.ending));
  full.appendChild(document.createTextNode(exercise.after));
  feedback.appendChild(full);

  if (!outcome.correct && outcome.typed.trim()) {
    feedback.appendChild(makeElement("p", `You wrote: -${readEnding(exercise, outcome.typed) || outcome.typed.trim()}`, "muted"));
  }
  if (outcome.hint) feedback.appendChild(makeElement("p", `Tip: ${outcome.hint}`));
  feedback.appendChild(makeElement("p", exercise.tip, "ae-rule"));

  const details = document.createElement("details");
  details.open = !outcome.correct;
  details.appendChild(makeElement("summary", "Show the endings table"));
  details.appendChild(endingsTable(exercise.type, exercise.case, exercise.gender));
  feedback.appendChild(details);
  return feedback;
}

// ---------- screen 3: summary ----------

function tally(results, key) {
  const counts = new Map();
  results.forEach(result => {
    const name = key(result.exercise);
    const entry = counts.get(name) || { total: 0, right: 0 };
    entry.total++;
    if (result.correct) entry.right++;
    counts.set(name, entry);
  });
  return counts;
}

function resultTable(title, order, labels, counts) {
  const table = makeElement("table", "", "vocab-table");
  const head = makeElement("tr");
  [title, "Correct"].forEach(text => head.appendChild(makeElement("th", text)));
  table.appendChild(head);
  order.forEach(key => {
    const entry = counts.get(key);
    if (!entry) return;
    const row = makeElement("tr");
    row.appendChild(makeElement("td", labels[key]));
    row.appendChild(makeElement("td", `${entry.right} / ${entry.total}`));
    table.appendChild(row);
  });
  return table;
}

function showSummary() {
  stopTimer();
  root.innerHTML = "";

  const correct = round.results.filter(result => result.correct).length;
  saveBest(round.score);
  const best = loadBest()[bestKey()];

  root.appendChild(makeElement("h2", `Score: ${round.score} points`));
  root.appendChild(makeElement("p",
    `${correct} / ${round.results.length} correct · best with these settings: ${best} points`));

  const typeLabels = Object.fromEntries(TYPE_ORDER.map(t => [t, typeLabel(t)]));
  const tables = makeElement("div", "", "ae-result-tables");
  tables.appendChild(resultTable("Type", TYPE_ORDER, typeLabels, tally(round.results, e => e.type)));
  tables.appendChild(resultTable("Case", CASE_ORDER, data.cases, tally(round.results, e => e.case)));
  tables.appendChild(resultTable("Gender", GENDER_ORDER, data.genders, tally(round.results, e => e.gender)));
  root.appendChild(tables);

  const mistakes = round.results.filter(result => !result.correct);
  if (mistakes.length) {
    // which combinations went wrong?
    const weak = tally(round.results, e => `${e.type}|${e.case}|${e.gender}`);
    const lines = [...weak.entries()].filter(([, v]) => v.right < v.total);
    root.appendChild(makeElement("h3", "Practise these", "ae-review"));
    const list = makeElement("ul");
    lines.forEach(([key, v]) => {
      const [type, kase, gender] = key.split("|");
      list.appendChild(makeElement("li", `${cellLabel(type, kase, gender)}: ${v.total - v.right} wrong`));
    });
    root.appendChild(list);

    root.appendChild(makeElement("h3", "Review your mistakes", "ae-review"));
    mistakes.forEach(result => {
      const item = makeElement("div", "", "ae-review-item");
      const full = makeElement("p", "", "ae-full");
      full.appendChild(document.createTextNode(result.exercise.before));
      full.appendChild(makeElement("mark", result.exercise.ending));
      full.appendChild(document.createTextNode(result.exercise.after));
      item.appendChild(full);
      if (result.typed.trim()) item.appendChild(makeElement("p", `You wrote: -${readEnding(result.exercise, result.typed) || result.typed.trim()}`, "muted"));
      item.appendChild(makeElement("p", result.exercise.tip, "ae-rule"));
      root.appendChild(item);
    });
  } else {
    root.appendChild(makeElement("p", "Perfect round! 🎉 Try the next step or a faster speed."));
  }

  const actions = makeElement("div", "", "ae-actions");
  const again = makeElement("button", "Play again", "button");
  again.addEventListener("click", startRound);
  actions.appendChild(again);
  if (mistakes.length) {
    const drill = makeElement("button", "Drill my mistakes", "button secondary");
    drill.addEventListener("click", () => {
      settings.types = TYPE_ORDER.filter(t => mistakes.some(m => m.exercise.type === t));
      settings.cases = CASE_ORDER.filter(c => mistakes.some(m => m.exercise.case === c));
      settings.genders = GENDER_ORDER.filter(g => mistakes.some(m => m.exercise.gender === g));
      settings.step = 0;
      startRound();
    });
    actions.appendChild(drill);
  }
  const change = makeElement("button", "Change settings", "button secondary");
  change.addEventListener("click", showSetup);
  actions.appendChild(change);
  root.appendChild(actions);
}

// ---------- start ----------

loadQuestions(root.dataset.slug)
  .then(loaded => {
    data = loaded;
    settings.length = data.defaultRoundLength;
    settings.step = 1;
    settings.types = [...data.steps[0].types];
    settings.cases = [...data.steps[0].cases];
    showSetup();
  })
  .catch(() => {
    root.textContent = "Sorry, the exercises could not be loaded.";
  });
