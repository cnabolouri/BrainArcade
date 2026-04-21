const GRID = 24;
const TILE = 20;
const SPEED_START = 140;
const SPEED_MIN = 70;
const SPEED_STEP = 6;
const BEST_KEY = "brainarcade_snake_best_v1";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedLabelEl = document.getElementById("speed-label");
const statusEl = document.getElementById("status");
const feedbackEl = document.getElementById("feedback");
const sessionNoteEl = document.getElementById("session-note");

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");

const DPR = window.devicePixelRatio || 1;
canvas.style.width = GRID * TILE + "px";
canvas.style.height = GRID * TILE + "px";
canvas.width = GRID * TILE * DPR;
canvas.height = GRID * TILE * DPR;
ctx.scale(DPR, DPR);

let storageOK = true;
try {
  localStorage.setItem("__snake_test", "1");
  localStorage.removeItem("__snake_test");
} catch {
  storageOK = false;
}

function getBest() {
  if (!storageOK) return Number(bestEl.textContent || 0);
  const value = Number(localStorage.getItem(BEST_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

function setBest(value) {
  if (storageOK) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {}
  }
  bestEl.textContent = value;
}

setBest(getBest());

let snake;
let dir;
let nextDir;
let food;
let score;
let timer = null;
let speed;
let gameOver;
let paused;

function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "warning") {
  feedbackEl.className = `feedback ${type}`;
  feedbackEl.textContent = text;
}

function updateSpeedLabel() {
  if (speed <= 80) speedLabelEl.textContent = "Fast";
  else if (speed <= 110) speedLabelEl.textContent = "Medium";
  else speedLabelEl.textContent = "Normal";
}

function updateScore() {
  scoreEl.textContent = score;
  const best = Math.max(getBest(), score);
  setBest(best);
  updateSpeedLabel();
}

function spawnFood() {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  if (occupied.size >= GRID * GRID) return null;

  let x, y;
  do {
    x = Math.floor(Math.random() * GRID);
    y = Math.floor(Math.random() * GRID);
  } while (occupied.has(`${x},${y}`));

  return { x, y };
}

function same(a, b) {
  return a.x === b.x && a.y === b.y;
}

function init() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid - 1, y: mid },
    { x: mid, y: mid },
    { x: mid + 1, y: mid },
  ];

  dir = { x: 1, y: 0 };
  nextDir = { ...dir };
  food = spawnFood();
  score = 0;
  speed = SPEED_START;
  gameOver = false;
  paused = false;

  updateScore();
  setStatus("Ready");
  setFeedback(
    "Press Start and avoid folding back into your own path.",
    "warning",
  );
  sessionNoteEl.textContent =
    "Leave yourself space near the edges and avoid sudden reversals in crowded areas.";

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "⏸ Pause";

  draw();
}

function requestDir(dx, dy) {
  const wanted = { x: dx, y: dy };
  if (!(wanted.x === -dir.x && wanted.y === -dir.y)) {
    nextDir = wanted;
  }
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  const tracked = [
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "w",
    "a",
    "s",
    "d",
    " ",
    "p",
    "r",
  ];
  if (tracked.includes(k)) e.preventDefault();

  if (k === "arrowup" || k === "w") requestDir(0, -1);
  else if (k === "arrowdown" || k === "s") requestDir(0, 1);
  else if (k === "arrowleft" || k === "a") requestDir(-1, 0);
  else if (k === "arrowright" || k === "d") requestDir(1, 0);
  else if (k === " " || k === "p") togglePause();
  else if (k === "r") reset();
});

function bindPad(id, dx, dy) {
  const el = document.getElementById(id);
  const handler = (e) => {
    e.preventDefault();
    requestDir(dx, dy);
  };
  el.addEventListener("click", handler);
  el.addEventListener("touchstart", handler, { passive: false });
}

bindPad("btn-up", 0, -1);
bindPad("btn-down", 0, 1);
bindPad("btn-left", -1, 0);
bindPad("btn-right", 1, 0);

let touchStart = null;

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches && e.touches.length) {
      touchStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  },
  { passive: true },
);

canvas.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

    if (Math.abs(dx) > Math.abs(dy)) requestDir(dx > 0 ? 1 : -1, 0);
    else requestDir(0, dy > 0 ? 1 : -1);
  },
  { passive: true },
);

startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", reset);

function start() {
  if (timer || gameOver) return;
  setStatus("Go!");
  setFeedback("Game started. Think one move ahead at all times.", "success");
  timer = setInterval(tick, speed);
  paused = false;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
}

function stop() {
  clearInterval(timer);
  timer = null;
}

function pause() {
  if (!timer || gameOver) return;
  stop();
  paused = true;
  setStatus("Paused");
  setFeedback("Paused. Resume when you’re ready.", "warning");
  pauseBtn.textContent = "▶ Resume";
}

function resume() {
  if (timer || gameOver) return;
  timer = setInterval(tick, speed);
  paused = false;
  setStatus("Go!");
  setFeedback("Back in motion. Watch the corners.", "success");
  pauseBtn.textContent = "⏸ Pause";
}

function togglePause() {
  if (gameOver) return;
  if (paused || !timer) resume();
  else pause();
}

function reset() {
  stop();
  init();
}

function tick() {
  dir = nextDir;

  const head = snake[snake.length - 1];
  const newHead = { x: head.x + dir.x, y: head.y + dir.y };

  if (
    newHead.x < 0 ||
    newHead.x >= GRID ||
    newHead.y < 0 ||
    newHead.y >= GRID
  ) {
    return die("You hit the wall.");
  }

  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
      return die("You bit yourself.");
    }
  }

  snake.push(newHead);

  if (same(newHead, food)) {
    score += 1;
    updateScore();
    food = spawnFood();

    setFeedback("Food collected. Keep the route open.", "success");

    if (score % 4 === 0 && speed > SPEED_MIN) {
      speed = Math.max(SPEED_MIN, speed - SPEED_STEP);
      stop();
      timer = setInterval(tick, speed);
      updateSpeedLabel();
      setFeedback(
        "Speed increased. Stay calm and plan farther ahead.",
        "warning",
      );
    }

    sessionNoteEl.textContent =
      score < 5
        ? "Use the open center early before the snake becomes harder to control."
        : "Longer body means tighter turns. Don’t trap yourself near the walls.";
  } else {
    snake.shift();
  }

  draw();
}

function die(reason) {
  gameOver = true;
  stop();
  setStatus("Game Over");
  setFeedback(reason + " Reset and try a cleaner route.", "danger");
  sessionNoteEl.textContent =
    "Review where the path collapsed. Most losses come from short-term movement instead of board planning.";
  pauseBtn.disabled = true;
  startBtn.disabled = true;
  draw(true);
}

function draw(isDead = false) {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, GRID * TILE, GRID * TILE);

  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE, 0);
    ctx.lineTo(i * TILE, GRID * TILE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * TILE);
    ctx.lineTo(GRID * TILE, i * TILE);
    ctx.stroke();
  }

  if (food) {
    ctx.fillStyle = "#f59e0b";
    roundRect(
      ctx,
      food.x * TILE + 2,
      food.y * TILE + 2,
      TILE - 4,
      TILE - 4,
      5,
      true,
    );
  }

  ctx.fillStyle = "#a7f3d0";
  for (let i = 0; i < snake.length - 1; i++) {
    const s = snake[i];
    roundRect(ctx, s.x * TILE + 2, s.y * TILE + 2, TILE - 4, TILE - 4, 6, true);
  }

  const h = snake[snake.length - 1];
  ctx.fillStyle = "#34d399";
  roundRect(ctx, h.x * TILE + 1, h.y * TILE + 1, TILE - 2, TILE - 2, 6, true);

  if (isDead) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, GRID * TILE, GRID * TILE);
  }
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
}

init();
