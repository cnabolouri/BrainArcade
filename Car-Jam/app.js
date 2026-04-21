const GRID = 6;
const CELL = 90;
const WIDTH = 600;
const HEIGHT = 600;
const EXIT_ROW = 2;
const DPR = window.devicePixelRatio || 1;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.style.width = WIDTH + "px";
canvas.style.height = HEIGHT + "px";
canvas.width = WIDTH * DPR;
canvas.height = HEIGHT * DPR;
ctx.scale(DPR, DPR);

const statusEl = document.getElementById("status");
const movesEl = document.getElementById("moves");
const bestEl = document.getElementById("best");
const lvlEl = document.getElementById("lvl");
const totalEl = document.getElementById("lvltotal");

const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const randBtn = document.getElementById("rand");
const undoBtn = document.getElementById("undo");
const resetBtn = document.getElementById("reset");

const feedbackEl = document.getElementById("feedback");
const sessionNoteEl = document.getElementById("session-note");

const LEVELS = [
  [
    { x: 0, y: 2, len: 2, dir: "H", target: true },
    { x: 2, y: 0, len: 3, dir: "V", color: "var(--car2)" },
    { x: 4, y: 0, len: 2, dir: "V", color: "var(--car3)" },
    { x: 0, y: 0, len: 2, dir: "H", color: "var(--car4)" },
    { x: 0, y: 4, len: 3, dir: "H", color: "var(--car5)" },
    { x: 3, y: 5, len: 2, dir: "H", color: "var(--car6)" },
    { x: 5, y: 3, len: 3, dir: "V", color: "var(--car1)" },
  ],
  [
    { x: 1, y: 2, len: 2, dir: "H", target: true },
    { x: 3, y: 1, len: 3, dir: "V", color: "var(--car2)" },
    { x: 4, y: 2, len: 2, dir: "V", color: "var(--car3)" },
    { x: 0, y: 0, len: 2, dir: "H", color: "var(--car4)" },
    { x: 0, y: 3, len: 2, dir: "H", color: "var(--car5)" },
    { x: 2, y: 4, len: 3, dir: "H", color: "var(--car6)" },
    { x: 5, y: 3, len: 3, dir: "V", color: "var(--car1)" },
  ],
  [
    { x: 2, y: 2, len: 2, dir: "H", target: true },
    { x: 0, y: 1, len: 3, dir: "V", color: "var(--car2)" },
    { x: 1, y: 4, len: 2, dir: "V", color: "var(--car3)" },
    { x: 3, y: 0, len: 2, dir: "H", color: "var(--car4)" },
    { x: 3, y: 3, len: 3, dir: "V", color: "var(--car5)" },
    { x: 4, y: 4, len: 2, dir: "H", color: "var(--car6)" },
    { x: 5, y: 0, len: 3, dir: "V", color: "var(--car1)" },
  ],
  [
    { x: 1, y: 2, len: 2, dir: "H", target: true },
    { x: 0, y: 0, len: 3, dir: "V", color: "var(--car1)" },
    { x: 2, y: 0, len: 2, dir: "H", color: "var(--car2)" },
    { x: 4, y: 0, len: 2, dir: "H", color: "var(--car3)" },
    { x: 3, y: 3, len: 2, dir: "V", color: "var(--car4)" },
    { x: 0, y: 5, len: 3, dir: "H", color: "var(--car5)" },
    { x: 5, y: 1, len: 3, dir: "V", color: "var(--car6)" },
    { x: 1, y: 4, len: 2, dir: "H", color: "var(--car2)" },
  ],
];

totalEl.textContent = LEVELS.length;

let levelIndex = 0;
let cars = [];
let targetIndex = 0;
let moves = 0;
let history = [];
let dragging = null;
let won = false;

let bestCacheOK = true;
const BEST_KEY_PREFIX = "carjam-best-v1-";

try {
  localStorage.setItem("__cj_test", "1");
  localStorage.removeItem("__cj_test");
} catch {
  bestCacheOK = false;
}

function validateLevel(level) {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(null));

  for (let i = 0; i < level.length; i++) {
    const car = level[i];

    for (let k = 0; k < car.len; k++) {
      const x = car.dir === "H" ? car.x + k : car.x;
      const y = car.dir === "V" ? car.y + k : car.y;

      if (x < 0 || y < 0 || x >= GRID || y >= GRID) {
        console.error(
          `Level validation failed: car ${i} is out of bounds`,
          car,
        );
        return false;
      }

      if (grid[y][x] !== null) {
        console.error(
          `Level validation failed: overlap at (${x}, ${y}) between car ${grid[y][x]} and car ${i}`,
        );
        return false;
      }

      grid[y][x] = i;
    }
  }

  return true;
}

function getBest(level) {
  if (!bestCacheOK) return null;
  const raw = localStorage.getItem(BEST_KEY_PREFIX + level);
  const value = raw == null ? null : Number(raw);
  return Number.isFinite(value) ? value : null;
}

function setBest(level, value) {
  if (!bestCacheOK) return;
  try {
    localStorage.setItem(BEST_KEY_PREFIX + level, String(value));
  } catch {}
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "warning") {
  feedbackEl.className = `feedback ${type}`;
  feedbackEl.textContent = text;
}

function updateBestLabel() {
  const best = getBest(levelIndex);
  bestEl.textContent = best == null ? "–" : String(best);
}

function pickColor(i) {
  const palette = [
    "var(--car1)",
    "var(--car2)",
    "var(--car3)",
    "var(--car4)",
    "var(--car5)",
    "var(--car6)",
  ];
  return palette[i % palette.length];
}

function loadLevel(idx) {
  levelIndex = (idx + LEVELS.length) % LEVELS.length;
  const base = LEVELS[levelIndex];

  if (!validateLevel(base)) {
    setStatus(`Level ${levelIndex + 1} has an invalid layout`);
    setFeedback(
      "This level contains overlapping or out-of-bounds cars.",
      "danger",
    );
    return;
  }

  cars = base.map((c, i) => ({
    x: c.x,
    y: c.y,
    len: c.len,
    dir: c.dir,
    target: !!c.target,
    color: c.target ? "var(--target)" : c.color || pickColor(i),
  }));

  targetIndex = cars.findIndex((c) => c.target);
  moves = 0;
  history = [];
  dragging = null;
  won = false;

  lvlEl.textContent = levelIndex + 1;
  movesEl.textContent = moves;
  updateBestLabel();

  setStatus(`Level ${levelIndex + 1} — free the red car →`);
  setFeedback(
    "Drag the red car toward the green exit on the right side.",
    "warning",
  );
  sessionNoteEl.textContent =
    "Efficient puzzle solving usually comes from identifying the deepest blocker first.";

  undoBtn.disabled = true;
  draw();
}

function resetLevel() {
  loadLevel(levelIndex);
}

function saveSnapshot() {
  history.push({
    cars: cars.map((c) => ({ ...c })),
    moves,
  });
  undoBtn.disabled = false;
}

function undo() {
  if (!history.length || won) return;

  const prev = history.pop();
  cars = prev.cars.map((c) => ({ ...c }));
  moves = prev.moves;
  dragging = null;
  movesEl.textContent = moves;

  undoBtn.disabled = history.length === 0;
  setStatus("Undo applied");
  setFeedback(
    "Previous move restored. Re-evaluate the blocking chain.",
    "warning",
  );
  sessionNoteEl.textContent =
    "Undo is most useful when you want to compare two short move sequences.";

  draw();
}

function toBoardXY(px, py) {
  const bx = (px - (WIDTH - GRID * CELL) / 2) / CELL;
  const by = (py - (HEIGHT - GRID * CELL) / 2) / CELL;
  return { bx, by };
}

function carAtPixel(px, py) {
  const { bx, by } = toBoardXY(px, py);
  const x = Math.floor(bx);
  const y = Math.floor(by);

  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return -1;

  return cars.findIndex((c) => {
    if (c.dir === "H") return y === c.y && x >= c.x && x < c.x + c.len;
    return x === c.x && y >= c.y && y < c.y + c.len;
  });
}

function buildOccGrid(excludeIndex) {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(-1));

  for (let i = 0; i < cars.length; i++) {
    if (i === excludeIndex) continue;
    const c = cars[i];

    if (c.dir === "H") {
      for (let dx = 0; dx < c.len; dx++) grid[c.y][c.x + dx] = i;
    } else {
      for (let dy = 0; dy < c.len; dy++) grid[c.y + dy][c.x] = i;
    }
  }

  return grid;
}

function computeLimits(i) {
  const c = cars[i];
  const occ = buildOccGrid(i);

  if (c.dir === "H") {
    let minX = c.x;
    let maxX = c.x;

    while (minX - 1 >= 0 && occ[c.y][minX - 1] === -1) minX--;
    while (maxX + c.len <= GRID - 1 && occ[c.y][maxX + c.len] === -1) maxX++;

    return { min: minX, max: maxX };
  } else {
    let minY = c.y;
    let maxY = c.y;

    while (minY - 1 >= 0 && occ[minY - 1][c.x] === -1) minY--;
    while (maxY + c.len <= GRID - 1 && occ[maxY + c.len][c.x] === -1) maxY++;

    return { min: minY, max: maxY };
  }
}

function pointerDown(px, py) {
  if (won) return;
  const i = carAtPixel(px, py);
  if (i < 0) return;

  const c = cars[i];
  const lim = computeLimits(i);

  dragging = {
    i,
    startX: px,
    startY: py,
    baseX: c.x,
    baseY: c.y,
    min: lim.min,
    max: lim.max,
  };

  setFeedback(
    c.target
      ? "Red car selected. Clear the route to the exit."
      : c.dir === "H"
        ? "Horizontal car selected. Slide left or right."
        : "Vertical car selected. Slide up or down.",
    "success",
  );
}

function pointerMove(px, py) {
  if (!dragging || won) return;

  const c = cars[dragging.i];

  if (c.dir === "H") {
    const delta = (px - dragging.startX) / CELL;
    let want = Math.round(dragging.baseX + delta);
    want = Math.max(dragging.min, Math.min(dragging.max, want));

    if (want !== c.x) {
      c.x = want;
      draw();
    }
  } else {
    const delta = (py - dragging.startY) / CELL;
    let want = Math.round(dragging.baseY + delta);
    want = Math.max(dragging.min, Math.min(dragging.max, want));

    if (want !== c.y) {
      c.y = want;
      draw();
    }
  }
}

function pointerUp() {
  if (!dragging || won) return;

  const i = dragging.i;
  const c = cars[i];
  const moved = c.x !== dragging.baseX || c.y !== dragging.baseY;
  dragging = null;

  if (moved) {
    saveSnapshot();
    moves += 1;
    movesEl.textContent = moves;

    const target = cars[targetIndex];
    if (target.y === EXIT_ROW && target.x + target.len === GRID) {
      won = true;

      const prevBest = getBest(levelIndex);
      if (prevBest == null || moves < prevBest) setBest(levelIndex, moves);
      updateBestLabel();

      setStatus(`Level ${levelIndex + 1} cleared!`);
      setFeedback(
        `Solved in ${moves} moves. Try another level for a cleaner route.`,
        "success",
      );
      sessionNoteEl.textContent =
        "Great puzzle solving usually comes from reducing unnecessary setup moves.";
      undoBtn.disabled = true;
    } else {
      setStatus(`Level ${levelIndex + 1} — continue solving`);
      setFeedback(
        "Move recorded. Re-check the remaining blocker chain.",
        "warning",
      );

      if (moves >= 8) {
        sessionNoteEl.textContent =
          "If the puzzle feels messy, trace the blockers from the exit backward instead of forward.";
      }
    }

    draw();
  }
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  const scaleY = HEIGHT / rect.height;
  pointerDown(
    (e.clientX - rect.left) * scaleX,
    (e.clientY - rect.top) * scaleY,
  );
});

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  const scaleY = HEIGHT / rect.height;
  pointerMove(
    (e.clientX - rect.left) * scaleX,
    (e.clientY - rect.top) * scaleY,
  );
});

window.addEventListener("mouseup", pointerUp);

canvas.addEventListener(
  "touchstart",
  (e) => {
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    pointerDown(
      (t.clientX - rect.left) * scaleX,
      (t.clientY - rect.top) * scaleY,
    );
  },
  { passive: true },
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    pointerMove(
      (t.clientX - rect.left) * scaleX,
      (t.clientY - rect.top) * scaleY,
    );
  },
  { passive: true },
);

canvas.addEventListener("touchend", pointerUp, { passive: true });

prevBtn.addEventListener("click", () => loadLevel(levelIndex - 1));
nextBtn.addEventListener("click", () => loadLevel(levelIndex + 1));
randBtn.addEventListener("click", () =>
  loadLevel(Math.floor(Math.random() * LEVELS.length)),
);
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", resetLevel);

function getVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function drawBoard() {
  ctx.fillStyle = getVar("--board");
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const x0 = (WIDTH - GRID * CELL) / 2;
  const y0 = (HEIGHT - GRID * CELL) / 2;

  ctx.strokeStyle = getVar("--grid");
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + i * CELL, y0);
    ctx.lineTo(x0 + i * CELL, y0 + GRID * CELL);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x0, y0 + i * CELL);
    ctx.lineTo(x0 + GRID * CELL, y0 + i * CELL);
    ctx.stroke();
  }

  const exitX = x0 + GRID * CELL;
  const exitY = y0 + EXIT_ROW * CELL;

  ctx.fillStyle = getVar("--exit");
  ctx.fillRect(exitX - 6, exitY + CELL * 0.2, 6, CELL * 0.6);

  ctx.beginPath();
  ctx.moveTo(exitX - 6, exitY + CELL * 0.5);
  ctx.lineTo(exitX + 16, exitY + CELL * 0.5);
  ctx.lineTo(exitX + 8, exitY + CELL * 0.5 - 8);
  ctx.moveTo(exitX + 16, exitY + CELL * 0.5);
  ctx.lineTo(exitX + 8, exitY + CELL * 0.5 + 8);
  ctx.strokeStyle = getVar("--exit");
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function roundRect(x, y, w, h, r, fill = true) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
  else ctx.stroke();
}

function drawCars() {
  const x0 = (WIDTH - GRID * CELL) / 2;
  const y0 = (HEIGHT - GRID * CELL) / 2;

  if (dragging) {
    const c = cars[dragging.i];
    ctx.fillStyle = getVar("--ghost");

    if (c.dir === "H") {
      const y = y0 + c.y * CELL;
      const leftX = x0 + dragging.min * CELL;
      const rightX = x0 + (dragging.max + c.len) * CELL;
      ctx.fillRect(leftX, y + CELL * 0.12, rightX - leftX, CELL * 0.76);
    } else {
      const x = x0 + c.x * CELL;
      const topY = y0 + dragging.min * CELL;
      const botY = y0 + (dragging.max + c.len) * CELL;
      ctx.fillRect(x + CELL * 0.12, topY, CELL * 0.76, botY - topY);
    }
  }

  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const px = x0 + c.x * CELL;
    const py = y0 + c.y * CELL;
    const w = c.dir === "H" ? c.len * CELL : CELL;
    const h = c.dir === "V" ? c.len * CELL : CELL;
    const rad = 14;

    ctx.fillStyle = c.color;
    roundRect(px + 6, py + 6, w - 12, h - 12, rad, true);

    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.lineWidth = 2;

    if (c.dir === "H") {
      ctx.beginPath();
      ctx.moveTo(px + w * 0.33, py + 10);
      ctx.lineTo(px + w * 0.33, py + h - 10);
      ctx.moveTo(px + w * 0.66, py + 10);
      ctx.lineTo(px + w * 0.66, py + h - 10);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(px + 10, py + h * 0.33);
      ctx.lineTo(px + w - 10, py + h * 0.33);
      ctx.moveTo(px + 10, py + h * 0.66);
      ctx.lineTo(px + w - 10, py + h * 0.66);
      ctx.stroke();
    }

    if (c.target) {
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 3;
      roundRect(px + 6, py + 6, w - 12, h - 12, rad, false);
      ctx.lineWidth = 1;
    }
  }
}

function draw() {
  drawBoard();
  drawCars();

  if (won) {
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui,-apple-system,Segoe UI,Roboto,Arial";
    ctx.textAlign = "center";
    ctx.fillText("Level Cleared! 🎉", WIDTH / 2, HEIGHT / 2 - 8);

    ctx.font = "16px system-ui,-apple-system,Segoe UI,Roboto,Arial";
    ctx.fillText(
      "Use Next or Random for another puzzle.",
      WIDTH / 2,
      HEIGHT / 2 + 18,
    );
    ctx.textAlign = "start";
  }
}

loadLevel(0);
