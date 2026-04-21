const COLS = 10;
const ROWS = 20;
const TILE = 32;

const COLORS = [
  "#000000",
  "#00c7ff", // I
  "#ffd600", // O
  "#b15cff", // T
  "#42e37b", // S
  "#ff6b6b", // Z
  "#4c78ff", // J
  "#ff9f40", // L
];

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const ORDER = ["I", "O", "T", "S", "Z", "J", "L"];
const IDMAP = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
const BEST_KEY = "brainarcade_tetris_best_v1";

const canvas = document.getElementById("canvas");
const boardEl = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nctx = nextCanvas.getContext("2d");

const statusEl = document.getElementById("status");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const feedbackEl = document.getElementById("feedback");

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");

const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayMessageEl = document.getElementById("overlay-message");
const overlayResumeBtn = document.getElementById("overlay-resume");
const overlayResetBtn = document.getElementById("overlay-reset");

const DPR = window.devicePixelRatio || 1;
let board, piece, nextType;
let bag = [];

let running = false;
let paused = false;
let gameOver = false;

let score = 0;
let lines = 0;
let level = 1;

let lastTime = 0;
let dropCounter = 0;
let dropInterval = 1000;

let touchStart = null;

function scaleCanvas(c, w, h) {
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  c.width = w * DPR;
  c.height = h * DPR;
  c.getContext("2d").scale(DPR, DPR);
}

scaleCanvas(canvas, COLS * TILE, ROWS * TILE);
scaleCanvas(nextCanvas, 120, 120);

function getBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0);
  } catch {
    return 0;
  }
}

function setBest(v) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {}
  bestEl.textContent = v;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "") {
  feedbackEl.className = `feedback ${type}`.trim();
  feedbackEl.textContent = text;
}

function emptyRow() {
  return new Array(COLS).fill(0);
}

function createBoard() {
  return Array.from({ length: ROWS }, emptyRow);
}

function cloneGrid(g) {
  return g.map((row) => row.slice());
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rotate(mat, dir = 1) {
  const rows = mat.length;
  const cols = mat[0].length;
  const out = Array.from({ length: cols }, () => Array(rows).fill(0));

  if (dir > 0) {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        out[i][rows - 1 - j] = mat[j][i];
      }
    }
  } else {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        out[cols - 1 - i][j] = mat[j][i];
      }
    }
  }
  return out;
}

function collides(board, piece) {
  const { x, y, mat } = piece;
  for (let j = 0; j < mat.length; j++) {
    for (let i = 0; i < mat[j].length; i++) {
      if (!mat[j][i]) continue;
      const nx = x + i;
      const ny = y + j;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge(board, piece) {
  const { x, y, mat, id } = piece;
  for (let j = 0; j < mat.length; j++) {
    for (let i = 0; i < mat[j].length; i++) {
      if (mat[j][i] && y + j >= 0) {
        board[y + j][x + i] = id;
      }
    }
  }
}

function nextFromBag() {
  if (!bag.length) bag = ORDER.slice().sort(() => Math.random() - 0.5);
  return bag.pop();
}

function levelSpeed() {
  return Math.max(120, 1000 - (level - 1) * 80);
}

function drawCell(context, x, y, size, color, ghost = false) {
  context.fillStyle = ghost ? `${color}55` : color;
  const r = Math.min(8, size / 3);

  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + size, y, x + size, y + size, r);
  context.arcTo(x + size, y + size, x, y + size, r);
  context.arcTo(x, y + size, x, y, r);
  context.arcTo(x, y, x + size, y, r);
  context.fill();

  if (!ghost) {
    context.strokeStyle = "rgba(255,255,255,.08)";
    context.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }
}

function drawBoard() {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);

  ctx.strokeStyle = "rgba(255,255,255,.05)";
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, ROWS * TILE);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(COLS * TILE, y * TILE);
    ctx.stroke();
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = board[y][x];
      if (!v) continue;
      drawCell(ctx, x * TILE, y * TILE, TILE, COLORS[v], false);
    }
  }
}

function drawPiece(p, ghost = false) {
  const { x, y, mat, id } = p;
  for (let j = 0; j < mat.length; j++) {
    for (let i = 0; i < mat[j].length; i++) {
      if (!mat[j][i]) continue;
      const xx = (x + i) * TILE;
      const yy = (y + j) * TILE;
      if (yy >= 0) drawCell(ctx, xx, yy, TILE, COLORS[id], ghost);
    }
  }
}

function ghostOf(p) {
  const g = { x: p.x, y: p.y, mat: p.mat, id: p.id };
  while (!collides(board, { ...g, y: g.y + 1 })) g.y++;
  return g;
}

function drawNext() {
  nctx.clearRect(0, 0, 120, 120);
  nctx.fillStyle = "#0b1220";
  nctx.fillRect(0, 0, 120, 120);

  const mat = SHAPES[nextType].map((r) => r.slice());
  const id = IDMAP[nextType];
  const size = 24;
  const w = mat[0].length * size;
  const h = mat.length * size;
  const ox = Math.floor((120 - w) / 2);
  const oy = Math.floor((120 - h) / 2);

  for (let j = 0; j < mat.length; j++) {
    for (let i = 0; i < mat[j].length; i++) {
      if (!mat[j][i]) continue;
      drawCell(nctx, ox + i * size, oy + j * size, size, COLORS[id], false);
    }
  }
}

function draw() {
  drawBoard();
  if (piece) {
    drawPiece(ghostOf(piece), true);
    drawPiece(piece, false);
  }
}

function updateUI() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  setBest(Math.max(getBest(), score));
  draw();
}

function showOverlay(title, message, resumable = false) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayResumeBtn.classList.toggle("hidden", !resumable);
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function spawn() {
  const type = nextType ?? nextFromBag();
  nextType = nextFromBag();

  const matBase = SHAPES[type];
  piece = {
    x: Math.floor((COLS - matBase[0].length) / 2),
    y: -1,
    mat: matBase.map((r) => r.slice()),
    id: IDMAP[type],
  };

  drawNext();

  if (collides(board, piece)) {
    endGame();
  }
}

function reset() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = levelSpeed();

  running = false;
  paused = false;
  gameOver = false;
  bag = [];
  nextType = nextFromBag();

  spawn();
  updateUI();
  setStatus("Ready");
  setFeedback("Press Start and build clean stacks.", "warning");

  pauseBtn.disabled = true;
  startBtn.disabled = false;
  pauseBtn.textContent = "⏸ Pause";
  hideOverlay();
}

function start() {
  if (running) return;

  running = true;
  paused = false;
  gameOver = false;
  lastTime = 0;
  dropCounter = 0;

  startBtn.disabled = true;
  pauseBtn.disabled = false;

  hideOverlay();
  setStatus("Go!");
  setFeedback("Game started. Watch your stack height.", "success");
  draw();

  requestAnimationFrame(update);
}

function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;
  pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";

  if (paused) {
    setStatus("Paused");
    setFeedback("Take a moment. Resume when ready.", "warning");
    showOverlay("Paused", "Resume when you're ready to continue.", true);
  } else {
    hideOverlay();
    setStatus("Go!");
    setFeedback("Back in motion.", "success");
    lastTime = 0;
    requestAnimationFrame(update);
  }
}

function endGame() {
  running = false;
  gameOver = true;
  pauseBtn.disabled = true;
  startBtn.disabled = true;
  setStatus("Game Over");
  setFeedback(
    "The stack reached the top. Reset and try a smarter line clear rhythm.",
    "danger",
  );
  showOverlay("Game Over", "The board is blocked. Start a new run.");
}

function tryMove(dx, dy) {
  const ox = piece.x;
  const oy = piece.y;
  piece.x += dx;
  piece.y += dy;

  if (collides(board, piece)) {
    piece.x = ox;
    piece.y = oy;
    return false;
  }
  return true;
}

function tryRotate(dir) {
  const old = piece.mat;
  const oldX = piece.x;
  const rotated = rotate(piece.mat, dir);
  piece.mat = rotated;

  for (const kick of [0, -1, 1, -2, 2]) {
    piece.x = oldX + kick;
    if (!collides(board, piece)) return true;
  }

  piece.mat = old;
  piece.x = oldX;
  return false;
}

function softDrop() {
  if (!(running && !paused)) return;
  if (!tryMove(0, 1)) {
    lockPiece();
  } else {
    score += 1;
    updateUI();
  }
}

function hardDrop() {
  if (!(running && !paused)) return;

  let dist = 0;
  while (tryMove(0, 1)) dist++;
  score += dist * 2;
  updateUI();
  lockPiece();
}

function lockPiece() {
  merge(board, piece);
  const cleared = sweep();

  if (cleared > 0) {
    const base = [0, 100, 300, 500, 800][cleared] || cleared * 200;
    score += base * level;
    lines += cleared;

    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      dropInterval = levelSpeed();
      setFeedback(`Level up! You are now on level ${level}.`, "success");
    } else {
      setFeedback(
        `${cleared} line${cleared > 1 ? "s" : ""} cleared.`,
        "success",
      );
    }
  }

  spawn();
  updateUI();
}

function sweep() {
  let count = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((v) => v !== 0)) {
      board.splice(y, 1);
      board.unshift(emptyRow());
      y++;
      count++;
    }
  }

  return count;
}

function update(time = 0) {
  if (!running || paused) return;

  if (!lastTime) lastTime = time;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  if (dropCounter > dropInterval) {
    dropCounter = 0;
    if (!tryMove(0, 1)) lockPiece();
  }

  draw();

  if (running && !paused) requestAnimationFrame(update);
}

function handleKey(e) {
  const k = e.key.toLowerCase();
  const tracked = [
    "arrowleft",
    "arrowright",
    "arrowdown",
    "arrowup",
    " ",
    "z",
    "x",
    "p",
    "r",
  ];
  if (tracked.includes(k)) e.preventDefault();

  if (!running) {
    if (k === " " || k === "enter") start();
    return;
  }

  if (gameOver) return;

  if (k === "p" || (k === " " && paused)) {
    togglePause();
    return;
  }

  if (paused) return;

  if (k === "arrowleft") tryMove(-1, 0);
  else if (k === "arrowright") tryMove(1, 0);
  else if (k === "arrowdown") softDrop();
  else if (k === "arrowup" || k === "x") tryRotate(1);
  else if (k === "z") tryRotate(-1);
  else if (k === " ") hardDrop();
  else if (k === "r") reset();

  draw();
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
    tryMove(dx > 0 ? 1 : -1, 0);
    draw();
  } else if (dy > 0) {
    hardDrop();
  } else {
    tryRotate(1);
    draw();
  }
}

/* events */
window.addEventListener("keydown", handleKey);

boardEl.addEventListener("touchstart", handleTouchStart, { passive: true });
boardEl.addEventListener("touchend", handleTouchEnd, { passive: true });

startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", reset);

document.getElementById("m-left").addEventListener("click", () => {
  if (running && !paused) {
    tryMove(-1, 0);
    draw();
  }
});
document.getElementById("m-right").addEventListener("click", () => {
  if (running && !paused) {
    tryMove(1, 0);
    draw();
  }
});
document.getElementById("m-ccw").addEventListener("click", () => {
  if (running && !paused) {
    tryRotate(-1);
    draw();
  }
});
document.getElementById("m-cw").addEventListener("click", () => {
  if (running && !paused) {
    tryRotate(1);
    draw();
  }
});
document.getElementById("m-drop").addEventListener("click", hardDrop);

overlayResumeBtn.addEventListener("click", () => {
  if (paused) togglePause();
});

overlayResetBtn.addEventListener("click", () => {
  hideOverlay();
  reset();
});

setBest(getBest());
reset();
