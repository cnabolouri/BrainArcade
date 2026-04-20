console.log("Snake booting…");

// ====== CONFIG ======
const GRID = 24;
const TILE = 20;
const SPEED_START = 140;
const SPEED_MIN = 70;
const SPEED_STEP = 6;

// ====== CANVAS ======
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.style.width = GRID * TILE + "px";
canvas.style.height = GRID * TILE + "px";
const DPR = window.devicePixelRatio || 1;
canvas.width = GRID * TILE * DPR;
canvas.height = GRID * TILE * DPR;
ctx.scale(DPR, DPR);

// ====== UI ======
const statusEl = document.getElementById("status");
const scoreEl  = document.getElementById("score");
const bestEl   = document.getElementById("best");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");
const bestKey  = "snake-best-v1";

// robust localStorage
let storageOK = true;
try { localStorage.setItem("__snake_test","1"); localStorage.removeItem("__snake_test"); }
catch(e){ storageOK = false; }
function getBest(){ if(!storageOK) return Number(bestEl.textContent||0);
  const v = Number(localStorage.getItem(bestKey) || 0); return Number.isFinite(v)?v:0; }
function setBest(v){ if(storageOK){ try{ localStorage.setItem(bestKey,String(v)); }catch(_){} }
  bestEl.textContent = v; }
setBest(getBest());

// ====== STATE ======
let snake, dir, nextDir, food, score, timer, speed, gameOver;

function init(){
  const mid = Math.floor(GRID/2);
  snake = [{x:mid-1,y:mid},{x:mid,y:mid},{x:mid+1,y:mid}];
  dir = {x:1,y:0};
  nextDir = {...dir};
  food = spawnFood();
  score = 0;
  speed = SPEED_START;
  gameOver = false;
  updateScore();
  setStatus("Ready. Press ▶ Start");
  draw();
}

function setStatus(t){ statusEl.textContent = t; }
function updateScore(){
  scoreEl.textContent = score;
  const best = Math.max(getBest(), score);
  setBest(best);
}

function spawnFood(){
  const occupied = new Set(snake.map(p => `${p.x},${p.y}`));
  if (occupied.size >= GRID*GRID) return null;
  let x,y; do { x = Math.floor(Math.random()*GRID); y = Math.floor(Math.random()*GRID); }
  while (occupied.has(`${x},${y}`));
  return {x,y};
}
function same(a,b){ return a.x===b.x && a.y===b.y; }

// INPUT
window.addEventListener("keydown", (e)=>{
  const k = e.key.toLowerCase();
  const isArrow = ["arrowup","arrowdown","arrowleft","arrowright"].includes(k);
  const isWASD  = ["w","a","s","d"].includes(k);
  if (isArrow || isWASD) e.preventDefault();
  const wanted =
    k==="arrowup"||k==="w"?{x:0,y:-1}:
    k==="arrowdown"||k==="s"?{x:0,y:1}:
    k==="arrowleft"||k==="a"?{x:-1,y:0}:
    k==="arrowright"||k==="d"?{x:1,y:0}:null;
  if (wanted && !(wanted.x===-dir.x && wanted.y===-dir.y)) nextDir = wanted;
});

startBtn.addEventListener("click", start);
resetBtn.addEventListener("click", ()=>{ stop(); init(); });

// LOOP
function start(){
  if (timer || gameOver) return;
  setStatus("Go!");
  timer = setInterval(tick, speed);
}
function stop(){ clearInterval(timer); timer = null; }

function tick(){
  dir = nextDir;
  const head = snake[snake.length-1];
  const newHead = {x: head.x + dir.x, y: head.y + dir.y};

  // walls
  if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID)
    return die("You hit the wall!");

  // self
  for (let i=0;i<snake.length;i++)
    if (snake[i].x===newHead.x && snake[i].y===newHead.y) return die("You bit yourself!");

  snake.push(newHead);

  if (same(newHead, food)){
    score += 1; updateScore(); food = spawnFood();
    if (score % 4 === 0 && speed > SPEED_MIN){
      speed = Math.max(SPEED_MIN, speed - SPEED_STEP);
      stop(); timer = setInterval(tick, speed);
    }
  } else {
    snake.shift();
  }

  draw();
}

function die(reason){
  gameOver = true;
  stop();
  setStatus(`Game Over — ${reason}  •  Press ↺ Reset`);
  draw(true);
}

// DRAW
function draw(isDead=false){
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0,0,GRID*TILE,GRID*TILE);

  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = 1;
  for (let i=1;i<GRID;i++){
    ctx.beginPath(); ctx.moveTo(i*TILE,0); ctx.lineTo(i*TILE,GRID*TILE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*TILE); ctx.lineTo(GRID*TILE,i*TILE); ctx.stroke();
  }

  if (food){
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--food").trim();
    roundRect(ctx, food.x*TILE+2, food.y*TILE+2, TILE-4, TILE-4, 5, true);
  }

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--snake").trim();
  for (let i=0;i<snake.length-1;i++){
    const s = snake[i]; roundRect(ctx, s.x*TILE+2, s.y*TILE+2, TILE-4, TILE-4, 6, true);
  }
  const h = snake[snake.length-1];
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--snakeHead").trim();
  roundRect(ctx, h.x*TILE+1, h.y*TILE+1, TILE-2, TILE-2, 6, true);

  if (isDead){ ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0,0,GRID*TILE,GRID*TILE); }
}

function roundRect(ctx,x,y,w,h,r,fill){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  if (fill) ctx.fill();
}

// boot
init();
console.log("Snake ready. If you see this, JS is running.");
