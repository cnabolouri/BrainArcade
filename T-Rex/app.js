const WIDTH = 800;
const HEIGHT = 240;
const GROUND_Y = HEIGHT - 40;
const GRAVITY = 2600;
const JUMP_V = -820;
const SPEED_START = 420;
const SPEED_MAX = 900;
const ACCEL = 28;
const DINO_W = 44;
const DINO_H = 48;
const DINO_H_DUCK = 28;
const BEST_KEY = "brainarcade_trex_best_v1";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const spdEl = document.getElementById("spd");
const feedbackEl = document.getElementById("feedback");
const sessionNoteEl = document.getElementById("session-note");

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");
const mJump = document.getElementById("m-jump");
const mDuck = document.getElementById("m-duck");

const DPR = window.devicePixelRatio || 1;

function scaleCanvas(c, w, h) {
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  c.width = w * DPR;
  c.height = h * DPR;
  c.getContext("2d").scale(DPR, DPR);
}
scaleCanvas(canvas, WIDTH, HEIGHT);

let storageOK = true;
try {
  localStorage.setItem("__trex_test", "1");
  localStorage.removeItem("__trex_test");
} catch {
  storageOK = false;
}

function getBest() {
  return storageOK
    ? Number(localStorage.getItem(BEST_KEY) || 0)
    : Number(bestEl.textContent || 0);
}

function setBest(v) {
  if (storageOK) {
    try {
      localStorage.setItem(BEST_KEY, String(v));
    } catch {}
  }
  bestEl.textContent = v;
}
setBest(getBest());

let running = false;
let paused = false;
let gameOver = false;
let lastTime = 0;
let speed = SPEED_START;
let distSpawn = 0;
let nextGap = 320;
let score = 0;

const dino = {
  x: 60,
  y: GROUND_Y - DINO_H,
  w: DINO_W,
  h: DINO_H,
  vy: 0,
  duck: false,
  onGround: true,
  leg: 0,
  legTime: 0,
};

const obstacles = [];
const clouds = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "warning") {
  feedbackEl.className = `feedback ${type}`;
  feedbackEl.textContent = text;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function updateUI() {
  scoreEl.textContent = Math.floor(score);
  spdEl.textContent = Math.round(speed);
  setBest(Math.max(getBest(), Math.floor(score)));
}

function reset() {
  running = false;
  paused = false;
  gameOver = false;
  lastTime = 0;
  speed = SPEED_START;
  distSpawn = 0;
  score = 0;

  dino.y = GROUND_Y - DINO_H;
  dino.vy = 0;
  dino.duck = false;
  dino.h = DINO_H;
  dino.onGround = true;
  dino.leg = 0;
  dino.legTime = 0;

  obstacles.length = 0;
  clouds.length = 0;
  for (let i = 0; i < 3; i++) spawnCloud(true);

  nextGap = 260 + Math.random() * 220;

  updateUI();
  setStatus("Ready");
  setFeedback(
    "Press Start and settle into the obstacle rhythm early.",
    "warning",
  );
  sessionNoteEl.textContent =
    "The best runs come from steady rhythm, not panic reactions.";

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = "⏸ Pause";

  draw();
}

function start() {
  if (running) return;
  running = true;
  paused = false;
  gameOver = false;
  setStatus("Go!");
  setFeedback("Run started. Jump cacti, and duck low birds.", "success");
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = "⏸ Pause";
  lastTime = 0;
  requestAnimationFrame(update);
}

function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;
  setStatus(paused ? "Paused" : "Go!");
  setFeedback(
    paused
      ? "Paused. Resume when ready."
      : "Back in motion. Watch the next landing.",
    paused ? "warning" : "success",
  );
  pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";

  if (!paused) {
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
  setFeedback("Collision detected. Reset and try a cleaner rhythm.", "danger");
  sessionNoteEl.textContent =
    "Good runner play is about rhythm recognition, not only reflex. Notice where timing broke.";
  draw();
}

function jump() {
  if (!running || paused || gameOver) return;
  if (dino.onGround) {
    dino.vy = JUMP_V;
    dino.onGround = false;
  }
}

function setDuck(v) {
  if (!running || paused || gameOver) return;
  dino.duck = v;
  if (dino.onGround) {
    const oldH = dino.h;
    dino.h = dino.duck ? DINO_H_DUCK : DINO_H;
    dino.y += oldH - dino.h;
  }
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  const tracked = ["arrowup", "arrowdown", " ", "p", "r", "enter"];
  if (tracked.includes(k)) e.preventDefault();

  if (!running) {
    if (k === " " || k === "arrowup" || k === "enter") {
      start();
    }
    return;
  }

  if (gameOver) return;

  if (k === "p") togglePause();
  else if (paused) return;
  else if (k === " " || k === "arrowup") jump();
  else if (k === "arrowdown") setDuck(true);
  else if (k === "r") reset();
});

window.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === "arrowdown") setDuck(false);
});

canvas.addEventListener("click", () => jump());
mJump.addEventListener("click", () => jump());

function duckOn(e) {
  e.preventDefault();
  setDuck(true);
}
function duckOff(e) {
  e.preventDefault();
  setDuck(false);
}

mDuck.addEventListener("mousedown", duckOn);
mDuck.addEventListener("mouseup", duckOff);
mDuck.addEventListener("touchstart", duckOn, { passive: false });
mDuck.addEventListener("touchend", duckOff, { passive: false });

let touchStart = null;
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches?.length) touchStart = { t: performance.now() };
  },
  { passive: true },
);
canvas.addEventListener(
  "touchend",
  () => {
    const dt = performance.now() - (touchStart?.t || 0);
    if (dt < 180) jump();
    else setDuck(false);
    touchStart = null;
  },
  { passive: true },
);
canvas.addEventListener(
  "touchmove",
  () => {
    if (touchStart) setDuck(true);
  },
  { passive: true },
);

startBtn.addEventListener("click", start);
pauseBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", reset);

function spawnObstacle() {
  const makeBird = Math.random() < 0.28; // around 28% chance

  if (makeBird) {
    const birdHeights = [
      GROUND_Y - 26, // low: duck is useful
      GROUND_Y - 58, // medium: usually jump
      GROUND_Y - 92, // higher flight
    ];

    const y = birdHeights[Math.floor(Math.random() * birdHeights.length)];

    obstacles.push({
      type: "bird",
      x: WIDTH + 20,
      y,
      w: 34,
      h: 24,
      flap: 0,
      flapTime: 0,
    });
  } else {
    const h = 34 + Math.floor(Math.random() * 30);
    const w = 16 + Math.floor(Math.random() * 18);

    obstacles.push({
      type: "cactus",
      x: WIDTH + 20,
      y: GROUND_Y - h,
      w,
      h,
    });
  }
}

function spawnCloud(initial = false) {
  const y = 30 + Math.random() * 60;
  const s = 40 + Math.random() * 40;
  const x = initial ? Math.random() * WIDTH : WIDTH + 20;
  clouds.push({ x, y, s });
}

function hitsObstacle() {
  const dx = dino.x + 6;
  const dy = dino.y + 4;
  const dw = dino.w - 12;
  const dh = (dino.duck ? DINO_H_DUCK : DINO_H) - 8;

  for (const o of obstacles) {
    let ox, oy, ow, oh;

    if (o.type === "bird") {
      ox = o.x + 3;
      oy = o.y + 4;
      ow = o.w - 6;
      oh = o.h - 8;
    } else {
      ox = o.x + 4;
      oy = o.y + 2;
      ow = o.w - 8;
      oh = o.h - 4;
    }

    if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
      return true;
    }
  }

  return false;
}

function update(time = 0) {
  if (!running || paused) return;

  if (!lastTime) lastTime = time;
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  speed = clamp(speed + ACCEL * dt, SPEED_START, SPEED_MAX);
  score += speed * dt * 0.25;
  updateUI();

  dino.vy += GRAVITY * dt;
  dino.y += dino.vy * dt;

  const groundTop = GROUND_Y - (dino.duck ? DINO_H_DUCK : DINO_H);
  if (dino.y >= groundTop) {
    dino.y = groundTop;
    dino.vy = 0;
    dino.onGround = true;
  } else {
    dino.onGround = false;
  }

  if (dino.onGround) {
    const period = clamp(0.12 - (speed - 300) / 5000, 0.05, 0.12);
    dino.legTime += dt;
    if (dino.legTime > period) {
      dino.leg ^= 1;
      dino.legTime = 0;
    }
  }

  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i];
    c.x -= c.s * dt;
    if (c.x < -60) clouds.splice(i, 1);
  }

  if (Math.random() < 0.01) spawnCloud();

  distSpawn += speed * dt;
  const minGap = Math.max(160, speed * 0.65);
  const maxGap = minGap + 240;

  if (distSpawn > nextGap) {
    spawnObstacle();
    distSpawn = 0;
    nextGap = minGap + Math.random() * (maxGap - minGap);
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;

    if (o.type === "bird") {
      o.flapTime += dt;
      if (o.flapTime > 0.12) {
        o.flap ^= 1;
        o.flapTime = 0;
      }
    }

    if (o.x + o.w < -10) obstacles.splice(i, 1);
  }

  if (hitsObstacle()) {
    endGame();
    return;
  }

  if (Math.floor(score) >= 50 && Math.floor(score) < 120) {
    sessionNoteEl.textContent =
      "You’re past the easy phase. Focus on landing consistency.";
  } else if (Math.floor(score) >= 120) {
    sessionNoteEl.textContent =
      "At this speed, prediction matters more than reaction alone.";
  }

  draw();
  if (running && !paused) requestAnimationFrame(update);
}

function draw() {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#9ca3af";
  for (const c of clouds) drawCloud(c.x, c.y);

  ctx.strokeStyle = "rgba(255,255,255,.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 1);
  ctx.lineTo(WIDTH, GROUND_Y + 1);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,.06)";
  ctx.lineWidth = 1;
  const dashW = 14;
  const dashGap = 10;
  const offset = (performance.now() / 20) % (dashW + dashGap);
  for (let x = -offset; x < WIDTH; x += dashW + dashGap) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 6);
    ctx.lineTo(x + dashW, GROUND_Y + 6);
    ctx.stroke();
  }

  for (const o of obstacles) {
    if (o.type === "bird") {
      drawBird(o);
    } else {
      ctx.fillStyle = "#f59e0b";
      drawCactus(o.x, o.y, o.w, o.h);
    }
  }

  drawDino();

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawCloud(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.arc(x + 16, y + 6, 14, 0, Math.PI * 2);
  ctx.arc(x - 16, y + 6, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawCactus(x, y, w, h) {
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(0,0,0,.2)";
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 6);
  ctx.lineTo(x + 2, y + 6);
  ctx.moveTo(x + w - 2, y + h - 10);
  ctx.lineTo(x + w - 2, y + 10);
  ctx.stroke();
}

function drawBird(bird) {
  const x = bird.x;
  const y = bird.y;

  ctx.fillStyle = "#9ca3af";

  // body
  roundRect(x + 8, y + 8, 18, 10, 4, true);

  // head
  roundRect(x + 22, y + 6, 10, 8, 3, true);

  // beak
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(x + 32, y + 10);
  ctx.lineTo(x + 38, y + 8);
  ctx.lineTo(x + 32, y + 14);
  ctx.closePath();
  ctx.fill();

  // wings
  ctx.fillStyle = "#9ca3af";
  if (bird.flap === 0) {
    roundRect(x + 10, y + 2, 10, 8, 3, true);
    roundRect(x + 14, y + 14, 10, 6, 3, true);
  } else {
    roundRect(x + 10, y + 6, 10, 6, 3, true);
    roundRect(x + 14, y + 0, 10, 10, 3, true);
  }

  // eye
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(x + 26, y + 8, 2, 2);
}

function drawDino() {
  const green = "#34d399";
  ctx.fillStyle = green;
  const h = dino.duck ? DINO_H_DUCK : DINO_H;
  const y = dino.y;

  roundRect(dino.x, y + 8, 32, h - 16, 6, true);
  roundRect(dino.x + 22, y, 22, 20, 6, true);

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(dino.x + 38, y + 6, 3, 3);

  ctx.fillStyle = green;
  if (dino.onGround) {
    if (dino.leg === 0) {
      roundRect(dino.x + 4, y + h - 8, 12, 8, 3, true);
    } else {
      roundRect(dino.x + 14, y + h - 8, 12, 8, 3, true);
    }
  } else {
    roundRect(dino.x + 8, y + h - 8, 16, 8, 3, true);
  }

  roundRect(dino.x - 6, y + Math.max(8, h - 16), 10, 6, 3, true);
}

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
}

reset();
