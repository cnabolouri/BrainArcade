let board = Array(9).fill("");
let current = "X";
let gameOver = false;
let mode = "pvp";

let xWins = Number(localStorage.getItem("brainarcade_ttt_xwins") || 0);
let oWins = Number(localStorage.getItem("brainarcade_ttt_owins") || 0);
let draws = Number(localStorage.getItem("brainarcade_ttt_draws") || 0);

const wins = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const cells = Array.from(document.querySelectorAll(".cell"));
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("reset");
const resetAllBtn = document.getElementById("reset-all");
const modeSelect = document.getElementById("mode-select");
const modeLabelEl = document.getElementById("mode-label");
const feedbackEl = document.getElementById("feedback");
const historyListEl = document.getElementById("history-list");

const xScoreEl = document.getElementById("x-score");
const oScoreEl = document.getElementById("o-score");
const drawScoreEl = document.getElementById("draw-score");

function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "") {
  feedbackEl.className = `feedback ${type}`.trim();
  feedbackEl.textContent = text;
}

function clearHighlights() {
  cells.forEach((cell) => cell.classList.remove("win"));
}

function updateStats() {
  xScoreEl.textContent = xWins;
  oScoreEl.textContent = oWins;
  drawScoreEl.textContent = draws;
  modeLabelEl.textContent = mode === "pvp" ? "2 Players" : "Vs CPU";

  localStorage.setItem("brainarcade_ttt_xwins", String(xWins));
  localStorage.setItem("brainarcade_ttt_owins", String(oWins));
  localStorage.setItem("brainarcade_ttt_draws", String(draws));
}

function addHistory(text) {
  if (
    historyListEl.children.length === 1 &&
    historyListEl.children[0].textContent === "No rounds played yet."
  ) {
    historyListEl.innerHTML = "";
  }

  const li = document.createElement("li");
  li.textContent = text;
  historyListEl.prepend(li);

  while (historyListEl.children.length > 6) {
    historyListEl.removeChild(historyListEl.lastChild);
  }
}

function render() {
  cells.forEach((btn, i) => {
    btn.textContent = board[i];
    btn.disabled = board[i] !== "" || gameOver;
    btn.classList.remove("x-mark", "o-mark");

    if (board[i] === "X") btn.classList.add("x-mark");
    if (board[i] === "O") btn.classList.add("o-mark");
  });
}

function checkWinner() {
  for (const [a, b, c] of wins) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      [a, b, c].forEach((i) => cells[i].classList.add("win"));
      return board[a];
    }
  }

  if (board.every((v) => v)) return "draw";
  return null;
}

function getAvailableMoves() {
  return board
    .map((value, index) => (value === "" ? index : null))
    .filter((value) => value !== null);
}

function cpuMove() {
  if (gameOver || current !== "O") return;

  const available = getAvailableMoves();
  if (!available.length) return;

  // 1. Try winning move
  for (const i of available) {
    board[i] = "O";
    if (checkWinner() === "O") {
      board[i] = "";
      makeMove(i);
      return;
    }
    board[i] = "";
  }

  // 2. Block X winning move
  for (const i of available) {
    board[i] = "X";
    if (checkWinner() === "X") {
      board[i] = "";
      makeMove(i);
      return;
    }
    board[i] = "";
  }

  // 3. Prefer center
  if (available.includes(4)) {
    makeMove(4);
    return;
  }

  // 4. Prefer corners
  const corners = [0, 2, 6, 8].filter((i) => available.includes(i));
  if (corners.length) {
    makeMove(corners[Math.floor(Math.random() * corners.length)]);
    return;
  }

  // 5. Otherwise random
  const randomMove = available[Math.floor(Math.random() * available.length)];
  makeMove(randomMove);
}

function finishRound(result) {
  gameOver = true;

  if (result === "draw") {
    draws++;
    setStatus("It's a draw! Start a new round.");
    setFeedback("Balanced round. Nobody broke through.", "warning");
    addHistory(`Draw in ${mode === "pvp" ? "2 Players" : "Vs CPU"} mode`);
  } else if (result === "X") {
    xWins++;
    setStatus("X wins! Start a new round.");
    setFeedback("X controlled the board and closed the line.", "success");
    addHistory(`X won in ${mode === "pvp" ? "2 Players" : "Vs CPU"} mode`);
  } else if (result === "O") {
    oWins++;
    setStatus("O wins! Start a new round.");
    setFeedback(
      mode === "cpu"
        ? "CPU found the winning line."
        : "O controlled the board and closed the line.",
      result === "O" && mode === "cpu" ? "danger" : "success",
    );
    addHistory(`O won in ${mode === "pvp" ? "2 Players" : "Vs CPU"} mode`);
  }

  updateStats();
  render();
}

function makeMove(i) {
  if (gameOver || board[i]) return;

  board[i] = current;
  const result = checkWinner();

  if (result) {
    finishRound(result);
    return;
  }

  current = current === "X" ? "O" : "X";
  setStatus(`${current}'s turn`);
  setFeedback(
    current === "X"
      ? "X is up. Look for a fork or block."
      : mode === "cpu"
        ? "CPU is thinking..."
        : "O is up. Watch the diagonals.",
    current === "O" && mode === "cpu" ? "warning" : "",
  );

  render();

  if (!gameOver && mode === "cpu" && current === "O") {
    setTimeout(cpuMove, 450);
  }
}

function onCellClick(e) {
  const i = Number(e.currentTarget.dataset.index);
  makeMove(i);
}

function resetGame() {
  board = Array(9).fill("");
  current = "X";
  gameOver = false;
  clearHighlights();
  setStatus("X's turn");
  setFeedback(
    mode === "cpu"
      ? "You are X. Make the first move."
      : "New round started. X goes first.",
    "warning",
  );
  render();
}

function resetAllScores() {
  xWins = 0;
  oWins = 0;
  draws = 0;
  historyListEl.innerHTML = "<li>No rounds played yet.</li>";
  updateStats();
  resetGame();
}

function handleModeChange() {
  mode = modeSelect.value;
  updateStats();
  resetGame();
}

cells.forEach((btn) => btn.addEventListener("click", onCellClick));
resetBtn.addEventListener("click", resetGame);
resetAllBtn.addEventListener("click", resetAllScores);
modeSelect.addEventListener("change", handleModeChange);

updateStats();
resetGame();
