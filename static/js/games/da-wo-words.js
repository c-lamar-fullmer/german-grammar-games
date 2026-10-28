// da-/wo-words game: drag the word pieces (damit, womit, darauf, worauf ...) into the gaps of the
// sentences. Click also works: click a piece, then click a gap. Then press "Check answers" and read
// the translations.
//
// Uses shuffle() and loadQuestions() from main.js. The data file looks like:
//   { roundLengths: [5, 8, 10], defaultRoundLength: 8, extraPieceChoices: [0, 2, 4], defaultExtraPieces: 2,
//     prepositions: [ { prep, da, wo } ],
//     exercises: [ { id, prep, kind, answer, lines, gapLine, en, expression, meaning } ] }
//
// How the board is stored (a "round"):
//   items:  one per sentence { exercise, pieceId }   pieceId = the piece that sits in its gap (or null)
//   pieces: all pieces { id, word }                  a piece is in the bank when no item holds it

const root = document.getElementById("game-root");

let data = null;
let settings = {
  kinds: ["da", "wo"],
  preps: [],                // filled from the data
  length: 8,
  extras: 2,
};
let round = null;
let selectedId = null;      // the piece you clicked (click-to-place)

// ---------- small helpers ----------

function makeElement(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function bestKey() {
  return `${settings.kinds.join("+")}-${settings.length}`;
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("dawo-best")) || {};
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
      localStorage.setItem("dawo-best", JSON.stringify(best));
    } catch (error) {
      // saving is optional
    }
  }
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ---------- choosing the round ----------

function allWords() {
  return data.prepositions.flatMap(entry => [
    { word: entry.da, prep: entry.prep, kind: "da" },
    { word: entry.wo, prep: entry.prep, kind: "wo" },
  ]);
}

// Every sentence in a round has a different answer word, so each piece belongs to one sentence.
function buildRound() {
  const candidates = shuffle(data.exercises.filter(exercise =>
    settings.kinds.includes(exercise.kind) && settings.preps.includes(exercise.prep)));
  const chosen = [];
  const usedWords = new Set();
  for (const exercise of candidates) {
    if (chosen.length >= settings.length) break;
    if (usedWords.has(exercise.answer)) continue;
    usedWords.add(exercise.answer);
    chosen.push(exercise);
  }

  const pieces = chosen.map((exercise, i) => ({ id: `p${i}`, word: exercise.answer }));

  // extra pieces that belong nowhere: words of the chosen kinds that are not in this round
  const spare = shuffle(allWords().filter(entry =>
    settings.kinds.includes(entry.kind) && !usedWords.has(entry.word)));
  spare.slice(0, settings.extras).forEach((entry, i) => {
    pieces.push({ id: `x${i}`, word: entry.word });
  });

  return {
    items: chosen.map(exercise => ({ exercise, pieceId: null })),
    pieces: shuffle(pieces),
    checked: false,
    correct: 0,
  };
}

// ---------- moving pieces around ----------

function pieceById(id) {
  return round.pieces.find(piece => piece.id === id);
}

function itemHolding(id) {
  return round.items.find(item => item.pieceId === id);
}

// Put a piece into the gap of sentence number `index`. Whatever was there goes back to the bank,
// or swaps places when the piece came from another gap.
function placePiece(id, index) {
  if (round.checked) return;
  const target = round.items[index];
  const from = itemHolding(id);
  const previous = target.pieceId;
  target.pieceId = id;
  if (from && from !== target) from.pieceId = previous;
  selectedId = null;
  render();
}

function returnToBank(id) {
  if (round.checked) return;
  const from = itemHolding(id);
  if (from) from.pieceId = null;
  selectedId = null;
  render();
}

// ---------- drawing the screens ----------

function showSetup() {
  round = null;
  selectedId = null;
  root.replaceChildren();
  const box = makeElement("div", "", "dw-setup");

  box.append(makeElement("p", "Drag each da- or wo-word into the sentence where it belongs "
    + "(or click a word, then click a gap). Press \"Check answers\" when every gap is filled. "
    + "After checking you see the translations."));

  const start = makeElement("button", "Start round", "button");
  start.type = "button";

  // which kinds of words
  const kinds = [["da", "da-words (damit, darauf ...)"], ["wo", "wo-words (womit, worauf ...)"]];
  const kindInputs = {};
  const kindFieldset = makeElement("fieldset");
  kindFieldset.append(makeElement("legend", "Which words?"));
  for (const [kind, text] of kinds) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = settings.kinds.includes(kind);
    kindInputs[kind] = input;
    label.append(input, ` ${text}`);
    kindFieldset.append(label);
  }
  box.append(kindFieldset);

  // which prepositions
  const prepInputs = {};
  const prepFieldset = makeElement("fieldset");
  prepFieldset.append(makeElement("legend", "Which prepositions?"));
  const prepRow = makeElement("div", "", "dw-preps");
  for (const entry of data.prepositions) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = settings.preps.includes(entry.prep);
    prepInputs[entry.prep] = input;
    label.append(input, ` ${entry.prep}`);
    prepRow.append(label);
  }
  prepFieldset.append(prepRow);
  box.append(prepFieldset);

  const refresh = () => {
    settings.kinds = kinds.map(([kind]) => kind).filter(kind => kindInputs[kind].checked);
    settings.preps = data.prepositions.map(entry => entry.prep).filter(prep => prepInputs[prep].checked);
    start.disabled = settings.kinds.length === 0 || settings.preps.length === 0;
  };
  [...Object.values(kindInputs), ...Object.values(prepInputs)].forEach(input =>
    input.addEventListener("change", refresh));
  refresh();

  box.append(radioGroup("Sentences per round", data.roundLengths, settings.length, value => { settings.length = value; },
    value => String(value)));
  box.append(radioGroup("Extra pieces that fit nowhere (to make it harder)", data.extraPieceChoices, settings.extras,
    value => { settings.extras = value; }, value => (value === 0 ? "None" : String(value))));

  start.addEventListener("click", () => {
    round = buildRound();
    render();
  });
  box.append(start);

  const best = loadBest()[bestKey()];
  if (best) box.append(makeElement("p", `Best round with these settings: ${best.correct} / ${best.total} correct`, "muted"));
  root.append(box);
}

function radioGroup(title, values, current, onChange, textOf) {
  const fieldset = makeElement("fieldset");
  fieldset.append(makeElement("legend", title));
  const row = makeElement("div", "", "dw-radios");
  for (const value of values) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = title;
    input.checked = value === current;
    input.addEventListener("change", () => onChange(value));
    label.append(input, ` ${textOf(value)}`);
    row.append(label);
  }
  fieldset.append(row);
  return fieldset;
}

// A word piece you can drag. Click selects it (then click a gap to place it).
function pieceElement(piece, className = "") {
  const element = makeElement("button", piece.word, `dw-piece ${className}`);
  element.type = "button";
  element.dataset.pieceId = piece.id;
  element.draggable = !round.checked;
  if (selectedId === piece.id) element.classList.add("selected");
  element.addEventListener("dragstart", event => {
    event.dataTransfer.setData("text/plain", piece.id);
    event.dataTransfer.effectAllowed = "move";
    selectedId = null;
  });
  return element;
}

function bankElement() {
  const bank = makeElement("div", "", "dw-bank");
  bank.append(makeElement("p", round.checked ? "Pieces" : "Pieces: drag them into the sentences", "dw-bank-title muted"));
  const row = makeElement("div", "", "dw-bank-row");
  const unused = round.pieces.filter(piece => !itemHolding(piece.id));
  if (unused.length === 0) {
    row.append(makeElement("span", "No pieces left in the bank", "muted"));
  }
  for (const piece of unused) {
    const element = pieceElement(piece);
    element.addEventListener("click", () => {
      if (round.checked) return;
      selectedId = selectedId === piece.id ? null : piece.id;
      render();
    });
    row.append(element);
  }
  // dropping a piece on the bank takes it out of its gap
  bank.addEventListener("dragover", event => { event.preventDefault(); bank.classList.add("over"); });
  bank.addEventListener("dragleave", () => bank.classList.remove("over"));
  bank.addEventListener("drop", event => {
    event.preventDefault();
    returnToBank(event.dataTransfer.getData("text/plain"));
  });
  bank.append(row);
  return bank;
}

// The line of a sentence that holds the gap, with the gap as a drop target.
function lineWithGap(item, index) {
  const { exercise } = item;
  const line = makeElement("p", "", "dw-line");
  const [before, after] = exercise.lines[exercise.gapLine].split("___");
  const atStart = before.trim() === "";
  line.append(before);

  const gap = makeElement("span", "", "dw-gap");
  const piece = item.pieceId ? pieceById(item.pieceId) : null;
  if (piece) {
    const shown = { ...piece, word: atStart ? capitalize(piece.word) : piece.word };
    const element = pieceElement(shown, "placed");
    element.addEventListener("click", () => {
      if (round.checked) return;
      if (selectedId && selectedId !== piece.id) {
        placePiece(selectedId, index);   // a piece is selected: put it here instead
      } else {
        returnToBank(piece.id);          // otherwise take this piece out again
      }
    });
    gap.append(element);
  } else {
    gap.append(makeElement("span", "   ", "dw-empty"));
  }

  if (round.checked) {
    const right = piece && piece.word === exercise.answer;
    gap.classList.add(right ? "good" : "bad");
  } else {
    gap.addEventListener("dragover", event => { event.preventDefault(); gap.classList.add("over"); });
    gap.addEventListener("dragleave", () => gap.classList.remove("over"));
    gap.addEventListener("drop", event => {
      event.preventDefault();
      placePiece(event.dataTransfer.getData("text/plain"), index);
    });
    gap.addEventListener("click", event => {
      if (selectedId && !(event.target instanceof HTMLElement && event.target.closest(".dw-piece"))) {
        placePiece(selectedId, index);
      }
    });
  }
  line.append(gap, after);
  return line;
}

function sentenceCard(item, index) {
  const { exercise } = item;
  const card = makeElement("div", "", "dw-card");
  card.append(makeElement("span", `${index + 1}`, "dw-number"));
  const body = makeElement("div", "", "dw-body");

  exercise.lines.forEach((text, lineIndex) => {
    if (lineIndex === exercise.gapLine) {
      body.append(lineWithGap(item, index));
    } else {
      body.append(makeElement("p", text, "dw-line"));
    }
  });

  if (round.checked) {
    const piece = item.pieceId ? pieceById(item.pieceId) : null;
    const right = piece && piece.word === exercise.answer;
    const result = makeElement("div", "", `dw-result ${right ? "good" : "bad"}`);
    if (right) {
      result.append(makeElement("p", "✓ Correct", "dw-verdict"));
    } else {
      const you = piece ? `You put: ${piece.word}. ` : "The gap was empty. ";
      result.append(makeElement("p", `✗ ${you}Correct: ${exercise.answer}`, "dw-verdict"));
    }
    // the finished German sentence(s) and the translation
    const german = exercise.lines.map((text, i) => (i === exercise.gapLine
      ? text.replace("___", text.startsWith("___") ? capitalize(exercise.answer) : exercise.answer)
      : text));
    const translation = makeElement("div", "", "dw-translation");
    translation.append(makeElement("p", german.join("  "), "dw-german"));
    translation.append(makeElement("p", exercise.en.join("  "), "dw-english"));
    result.append(translation);
    if (exercise.expression) {
      result.append(makeElement("p", `${exercise.expression}${exercise.meaning ? ` = ${exercise.meaning}` : ""}`, "dw-note muted"));
    }
    body.append(result);
  }

  card.append(body);
  return card;
}

function render() {
  root.replaceChildren();
  if (!round) return showSetup();

  const total = round.items.length;
  const filled = round.items.filter(item => item.pieceId).length;

  if (round.checked) {
    root.append(makeElement("p", `${round.correct} / ${total} correct`, "dw-score"));
    const best = loadBest()[bestKey()];
    if (best) root.append(makeElement("p", `Best round with these settings: ${best.correct} / ${best.total}`, "muted"));
    const wrong = round.items.filter(item => {
      const piece = item.pieceId ? pieceById(item.pieceId) : null;
      return !piece || piece.word !== item.exercise.answer;
    });
    if (wrong.length > 0) {
      const preps = [...new Set(wrong.map(item => item.exercise.prep))].join(", ");
      root.append(makeElement("p", `Practise these prepositions: ${preps}`, "dw-spots"));
    } else {
      root.append(makeElement("p", "No mistakes. Perfect round!"));
    }
  } else {
    root.append(makeElement("p", `${filled} / ${total} gaps filled`, "dw-progress"));
  }

  root.append(bankElement());

  const list = makeElement("div", "", "dw-list");
  round.items.forEach((item, index) => list.append(sentenceCard(item, index)));
  root.append(list);

  const actions = makeElement("p", "", "dw-actions");
  if (!round.checked) {
    const check = makeElement("button", "Check answers", "button");
    check.type = "button";
    check.disabled = filled < total;
    check.addEventListener("click", checkAnswers);
    const reset = makeElement("button", "Take all pieces back", "button secondary");
    reset.type = "button";
    reset.addEventListener("click", () => {
      round.items.forEach(item => { item.pieceId = null; });
      selectedId = null;
      render();
    });
    actions.append(check, reset);
    if (filled < total) actions.append(makeElement("span", "  Fill every gap to check.", "muted"));
  } else {
    const again = makeElement("button", "Play again", "button");
    again.type = "button";
    again.addEventListener("click", () => { round = buildRound(); render(); window.scrollTo({ top: 0 }); });
    const change = makeElement("button", "Change settings", "button secondary");
    change.type = "button";
    change.addEventListener("click", showSetup);
    actions.append(again, change);
  }
  root.append(actions);
}

function checkAnswers() {
  round.correct = round.items.filter(item => {
    const piece = item.pieceId ? pieceById(item.pieceId) : null;
    return piece && piece.word === item.exercise.answer;
  }).length;
  round.checked = true;
  selectedId = null;
  saveBest(round.correct, round.items.length);
  render();
  window.scrollTo({ top: 0 });
}

// ---------- start ----------

loadQuestions(root.dataset.slug)
  .then(loaded => {
    data = loaded;
    settings.preps = data.prepositions.map(entry => entry.prep);
    settings.length = data.defaultRoundLength;
    settings.extras = data.defaultExtraPieces;
    showSetup();
  })
  .catch(() => {
    root.textContent = "Could not load the sentences. Is the Flask server running?";
  });
