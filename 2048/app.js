const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const movesEl = document.getElementById("moves");
const statusEl = document.getElementById("status");
const feedbackEl = document.getElementById("feedback");

const undoBtn = document.getElementById("undo");
const newBtn = document.getElementById("new");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayMessageEl = document.getElementById("overlay-message");
const continueBtn = document.getElementById("continue-btn");
const restartBtn = document.getElementById("restart-btn");

const SIZE = 4;
const BEST_KEY = "brainarcade_2048_best_v1";

let grid;
let score;
let moves;
let won;
let over;
let keepPlaying = false;
let prevState = null;

const cells = [];
let touchStart = null;

/* ---------- init UI ---------- */
for (let i = 0; i < SIZE * SIZE; i++) {
  const div = document.createElement("div");
  div.className = "cell tile-0";
  div.setAttribute("role", "gridcell");
  boardEl.appendChild(div);
  cells.push(div);
}

/* ---------- storage ---------- */
function getBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0);
  } catch {
    return 0;
  }
}

function setBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {}
  bestEl.textContent = value;
}

/* ---------- helpers ---------- */
function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "") {
  feedbackEl.className = `feedback ${type}`.trim();
  feedbackEl.textContent = text;
}

function cloneGrid(g) {
  return g.map((row) => row.slice());
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEmptyCells(g) {
  const out = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) out.push([r, c]);
    }
  }
  return out;
}

function addRandomTile(g) {
  const empties = getEmptyCells(g);
  if (!empties.length) return false;

  const [r, c] = randChoice(empties);
  g[r][c] = Math.random() < 0.9 ? 2 : 4;

  const idx = r * SIZE + c;
  requestAnimationFrame(() => {
    cells[idx].classList.add("pop");
    setTimeout(() => cells[idx].classList.remove("pop"), 110);
  });

  return true;
}

function gridsEqual(a, b) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function slideRowLeft(row) {
  const nums = row.filter((v) => v !== 0);
  const merged = [];

  for (let i = 0; i < nums.length; ) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const v = nums[i] * 2;
      merged.push(v);
      score += v;
      i += 2;
    } else {
      merged.push(nums[i]);
      i += 1;
    }
  }

  while (merged.length < SIZE) merged.push(0);
  return merged;
}

function rotateGridRight(g) {
  const out = emptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      out[c][SIZE - 1 - r] = g[r][c];
    }
  }
  return out;
}

function rotateGridLeft(g) {
  const out = emptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      out[SIZE - 1 - c][r] = g[r][c];
    }
  }
  return out;
}

/* ---------- game state ---------- */
function init() {
  grid = emptyGrid();
  score = 0;
  moves = 0;
  won = false;
  over = false;
  keepPlaying = false;
  prevState = null;

  addRandomTile(grid);
  addRandomTile(grid);

  undoBtn.disabled = true;
  overlayEl.classList.add("hidden");

  updateUI();
  setStatus("Ready");
  setFeedback("Use Arrow Keys, W/A/S/D, or swipe on mobile.");
}

function updateUI() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c];
      const el = cells[r * SIZE + c];

      el.textContent = value === 0 ? "" : String(value);

      let tileClass = `tile-${value}`;
      if (value > 2048) tileClass = "tile-super";

      el.className = `cell ${value === 0 ? "tile-0" : tileClass}`;
    }
  }

  scoreEl.textContent = score;
  movesEl.textContent = moves;

  const best = Math.max(getBest(), score);
  setBest(best);
}

function showOverlay(title, message) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function checkGameState() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] >= 2048 && !won) {
        won = true;
        setStatus("2048 reached!");
        setFeedback(
          "You made 2048. You can keep going or start a new round.",
          "success",
        );

        if (!keepPlaying) {
          showOverlay(
            "You Win!",
            "You reached 2048. Keep going for a higher score, or start a fresh game.",
          );
        }
      }
    }
  }

  if (getEmptyCells(grid).length > 0) return;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (r + 1 < SIZE && grid[r + 1][c] === v) return;
      if (c + 1 < SIZE && grid[r][c + 1] === v) return;
    }
  }

  over = true;
  setStatus("Game Over");
  setFeedback(
    "No moves left. Start a new run and try a better merge path.",
    "danger",
  );
  showOverlay("Game Over", "The board is full and there are no moves left.");
}

function move(dir) {
  if (over) return false;

  const before = cloneGrid(grid);
  let work = cloneGrid(grid);

  if (dir === "up") work = rotateGridLeft(work);
  if (dir === "right") work = work.map((row) => row.slice().reverse());
  if (dir === "down") work = rotateGridRight(work);

  work = work.map(slideRowLeft);

  if (dir === "right") work = work.map((row) => row.slice().reverse());
  if (dir === "up") work = rotateGridRight(work);
  if (dir === "down") work = rotateGridLeft(work);

  if (gridsEqual(before, work)) {
    setFeedback("No tile movement on that move.", "warning");
    return false;
  }

  prevState = { grid: before, score, moves };
  undoBtn.disabled = false;

  grid = work;
  moves += 1;
  addRandomTile(grid);
  updateUI();
  checkGameState();

  setStatus("Playing");
  setFeedback(`Move ${moves} completed. Keep building your chain.`, "success");

  return true;
}

/* ---------- controls ---------- */
function handleKey(e) {
  const key = e.key.toLowerCase();
  const valid = [
    "arrowleft",
    "arrowright",
    "arrowup",
    "arrowdown",
    "w",
    "a",
    "s",
    "d",
  ];
  if (!valid.includes(key)) return;

  e.preventDefault();

  if (key === "arrowleft" || key === "a") move("left");
  else if (key === "arrowright" || key === "d") move("right");
  else if (key === "arrowup" || key === "w") move("up");
  else if (key === "arrowdown" || key === "s") move("down");
}

function handleUndo() {
  if (!prevState) return;

  grid = cloneGrid(prevState.grid);
  score = prevState.score;
  moves = prevState.moves;
  prevState = null;
  undoBtn.disabled = true;
  over = false;

  updateUI();
  setStatus("Undo used");
  setFeedback("Previous move restored.", "warning");
}

function handleNewGame() {
  init();
}

function handleTouchStart(e) {
  if (!e.touches?.length) return;
  touchStart = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY,
  };
}

function handleTouchEnd(e) {
  if (!touchStart) return;

  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? "right" : "left");
  } else {
    move(dy > 0 ? "down" : "up");
  }
}

/* ---------- events ---------- */
window.addEventListener("keydown", handleKey);
boardEl.addEventListener("touchstart", handleTouchStart, { passive: true });
boardEl.addEventListener("touchend", handleTouchEnd, { passive: true });

undoBtn.addEventListener("click", handleUndo);
newBtn.addEventListener("click", handleNewGame);

continueBtn.addEventListener("click", () => {
  keepPlaying = true;
  hideOverlay();
  setFeedback("Keep going and push beyond 2048.", "success");
});

restartBtn.addEventListener("click", () => {
  hideOverlay();
  init();
});

/* ---------- boot ---------- */
setBest(getBest());
init();
