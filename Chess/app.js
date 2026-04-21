const boardEl = document.getElementById("board");
const turnLabelEl = document.getElementById("turn-label");
const statusEl = document.getElementById("status");
const whiteCapturesEl = document.getElementById("white-captures");
const blackCapturesEl = document.getElementById("black-captures");
const feedbackEl = document.getElementById("feedback");
const moveHistoryEl = document.getElementById("move-history");

const flipBtn = document.getElementById("flip-board");
const undoBtn = document.getElementById("undo-move");
const resetBtn = document.getElementById("reset-game");

const PIECES = {
  wp: "♙",
  wr: "♖",
  wn: "♘",
  wb: "♗",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bq: "♛",
  bk: "♚",
};

const promotionModal = document.getElementById("promotion-modal");
const promotionButtons = Array.from(
  document.querySelectorAll(".promotion-btn"),
);

let pendingPromotion = null;
let castlingRights = null;

let board = [];
let turn = "w";
let selected = null;
let legalMoves = [];
let flipped = false;
let whiteCaptures = [];
let blackCaptures = [];
let moveHistory = [];
let historyStack = [];
let lastMove = null;
let gameOver = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function setFeedback(text, type = "warning") {
  feedbackEl.className = `feedback ${type}`;
  feedbackEl.textContent = text;
}

function makeInitialBoard() {
  return [
    ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
    ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
    ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
  ];
}

function makeInitialCastlingRights() {
  return {
    w: { kingSide: true, queenSide: true },
    b: { kingSide: true, queenSide: true },
  };
}

function cloneBoard(src) {
  return src.map((row) => row.slice());
}

function resetGame() {
  board = makeInitialBoard();
  turn = "w";
  selected = null;
  legalMoves = [];
  whiteCaptures = [];
  blackCaptures = [];
  moveHistory = [];
  historyStack = [];
  lastMove = null;
  gameOver = false;

  castlingRights = makeInitialCastlingRights();
  pendingPromotion = null;
  promotionModal.classList.add("hidden");
  promotionModal.setAttribute("aria-hidden", "true");

  turnLabelEl.textContent = "White";
  setStatus("White to move");
  setFeedback(
    "White starts. Open with control of the center if possible.",
    "warning",
  );
  whiteCapturesEl.textContent = "–";
  blackCapturesEl.textContent = "–";
  moveHistoryEl.innerHTML = "<li>No moves yet.</li>";
  undoBtn.disabled = true;

  renderBoard();
}

function updateCaptureUI() {
  whiteCapturesEl.textContent = whiteCaptures.length
    ? whiteCaptures.map((p) => PIECES[p]).join(" ")
    : "–";
  blackCapturesEl.textContent = blackCaptures.length
    ? blackCaptures.map((p) => PIECES[p]).join(" ")
    : "–";
}

function algebraic(r, c) {
  return `${"abcdefgh"[c]}${8 - r}`;
}

function inside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function colorOf(piece) {
  return piece ? piece[0] : null;
}

function typeOf(piece) {
  return piece ? piece[1] : null;
}

function enemyOf(color) {
  return color === "w" ? "b" : "w";
}

function findKing(bd, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (bd[r][c] === `${color}k`) return { r, c };
    }
  }
  return null;
}

function isSquareAttacked(bd, targetR, targetC, byColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = bd[r][c];
      if (!piece || colorOf(piece) !== byColor) continue;

      const pseudo = getPseudoMovesForPiece(bd, r, c, true);
      if (pseudo.some((m) => m.r === targetR && m.c === targetC)) {
        return true;
      }
    }
  }
  return false;
}

function isInCheck(bd, color) {
  const king = findKing(bd, color);
  if (!king) return false;
  return isSquareAttacked(bd, king.r, king.c, enemyOf(color));
}

function getPseudoMovesForPiece(bd, r, c, forAttackOnly = false) {
  const piece = bd[r][c];
  if (!piece) return [];
  const color = colorOf(piece);
  const type = typeOf(piece);
  const enemy = enemyOf(color);
  const moves = [];

  const pushRay = (dr, dc) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inside(nr, nc)) {
      const dest = bd[nr][nc];
      if (!dest) {
        moves.push({ r: nr, c: nc });
      } else {
        if (colorOf(dest) === enemy)
          moves.push({ r: nr, c: nc, capture: true });
        break;
      }
      nr += dr;
      nc += dc;
    }
  };

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;

    if (!forAttackOnly) {
      const nr = r + dir;
      if (inside(nr, c) && !bd[nr][c]) {
        moves.push({ r: nr, c });
        const nr2 = r + dir * 2;
        if (r === startRow && inside(nr2, c) && !bd[nr2][c]) {
          moves.push({ r: nr2, c });
        }
      }
    }

    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (!inside(nr, nc)) continue;

      if (forAttackOnly) {
        moves.push({ r: nr, c: nc });
      } else {
        const dest = bd[nr][nc];
        if (dest && colorOf(dest) === enemy) {
          moves.push({ r: nr, c: nc, capture: true });
        }
      }
    }
  }

  if (type === "n") {
    const jumps = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dr, dc] of jumps) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inside(nr, nc)) continue;
      const dest = bd[nr][nc];
      if (!dest) moves.push({ r: nr, c: nc });
      else if (colorOf(dest) === enemy)
        moves.push({ r: nr, c: nc, capture: true });
    }
  }

  if (type === "b" || type === "q") {
    pushRay(-1, -1);
    pushRay(-1, 1);
    pushRay(1, -1);
    pushRay(1, 1);
  }

  if (type === "r" || type === "q") {
    pushRay(-1, 0);
    pushRay(1, 0);
    pushRay(0, -1);
    pushRay(0, 1);
  }

  if (type === "k") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inside(nr, nc)) continue;
        const dest = bd[nr][nc];
        if (!dest) moves.push({ r: nr, c: nc });
        else if (colorOf(dest) === enemy)
          moves.push({ r: nr, c: nc, capture: true });
      }
    }

    if (!forAttackOnly) {
      moves.push(...getCastleMoves(bd, color));
    }
  }

  return moves;
}

function getCastleMoves(bd, color) {
  const row = color === "w" ? 7 : 0;
  const enemy = enemyOf(color);
  const king = bd[row][4];
  if (king !== `${color}k`) return [];

  const moves = [];
  if (isInCheck(bd, color)) return moves;

  // kingside
  if (
    castlingRights[color].kingSide &&
    bd[row][7] === `${color}r` &&
    !bd[row][5] &&
    !bd[row][6] &&
    !isSquareAttacked(bd, row, 5, enemy) &&
    !isSquareAttacked(bd, row, 6, enemy)
  ) {
    moves.push({ r: row, c: 6, castle: "kingside" });
  }

  // queenside
  if (
    castlingRights[color].queenSide &&
    bd[row][0] === `${color}r` &&
    !bd[row][1] &&
    !bd[row][2] &&
    !bd[row][3] &&
    !isSquareAttacked(bd, row, 3, enemy) &&
    !isSquareAttacked(bd, row, 2, enemy)
  ) {
    moves.push({ r: row, c: 2, castle: "queenside" });
  }

  return moves;
}

function simulateMove(bd, from, to) {
  const next = cloneBoard(bd);
  const piece = next[from.r][from.c];
  next[to.r][to.c] = piece;
  next[from.r][from.c] = null;

  if (to.castle === "kingside") {
    next[from.r][5] = next[from.r][7];
    next[from.r][7] = null;
  }

  if (to.castle === "queenside") {
    next[from.r][3] = next[from.r][0];
    next[from.r][0] = null;
  }

  return next;
}

function getLegalMoves(r, c) {
  const piece = board[r][c];
  if (!piece || colorOf(piece) !== turn) return [];

  const pseudo = getPseudoMovesForPiece(board, r, c, false);

  return pseudo.filter((move) => {
    const next = simulateMove(board, { r, c }, move);
    return !isInCheck(next, turn);
  });
}

function renderBoard() {
  boardEl.innerHTML = "";

  const rows = flipped
    ? [...Array(8).keys()]
    : [...Array(8).keys()].reverse().reverse();
  const displayRows = flipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = flipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  for (const r of displayRows) {
    for (const c of displayCols) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.r = r;
      square.dataset.c = c;

      const piece = board[r][c];
      if (piece) square.textContent = PIECES[piece];

      if (selected && selected.r === r && selected.c === c) {
        square.classList.add("selected");
      }

      const move = legalMoves.find((m) => m.r === r && m.c === c);
      if (move) {
        if (board[r][c]) square.classList.add("capture");
        else {
          const dot = document.createElement("span");
          dot.className = "dot";
          square.appendChild(dot);
        }
      }

      if (lastMove) {
        if (
          (lastMove.from.r === r && lastMove.from.c === c) ||
          (lastMove.to.r === r && lastMove.to.c === c)
        ) {
          square.classList.add("last-move");
        }
      }

      const kingInCheck = piece === `${turn}k` && isInCheck(board, turn);
      if (kingInCheck) square.classList.add("in-check");

      if (c === (flipped ? 7 : 0)) {
        const rank = document.createElement("span");
        rank.className = "coord rank";
        rank.textContent = 8 - r;
        square.appendChild(rank);
      }

      if (r === (flipped ? 0 : 7)) {
        const file = document.createElement("span");
        file.className = "coord file";
        file.textContent = "abcdefgh"[c];
        square.appendChild(file);
      }

      square.addEventListener("click", onSquareClick);
      boardEl.appendChild(square);
    }
  }

  updateCaptureUI();
}

function onSquareClick(e) {
  if (gameOver) return;

  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);
  const piece = board[r][c];

  const clickedMove = legalMoves.find((m) => m.r === r && m.c === c);
  if (selected && clickedMove) {
    makeMove(selected, clickedMove);
    return;
  }

  if (piece && colorOf(piece) === turn) {
    selected = { r, c };
    legalMoves = getLegalMoves(r, c);
    setFeedback(
      legalMoves.length
        ? `${PIECES[piece]} selected. Choose one of the highlighted moves.`
        : `That piece has no safe legal moves.`,
      legalMoves.length ? "success" : "warning",
    );
  } else {
    selected = null;
    legalMoves = [];
  }

  renderBoard();
}

function addHistoryEntry(text) {
  if (moveHistory.length === 0) {
    moveHistoryEl.innerHTML = "";
  }

  moveHistory.push(text);
  const li = document.createElement("li");
  li.textContent = text;
  moveHistoryEl.appendChild(li);
}

function moveToText(piece, from, to, captured, castle) {
  if (castle === "kingside")
    return `${turn === "w" ? "White" : "Black"} castled kingside`;
  if (castle === "queenside")
    return `${turn === "w" ? "White" : "Black"} castled queenside`;

  const nameMap = { p: "", r: "R", n: "N", b: "B", q: "Q", k: "K" };
  const prefix = nameMap[typeOf(piece)];
  return `${turn === "w" ? "White" : "Black"}: ${prefix}${algebraic(from.r, from.c)}${captured ? "x" : "→"}${algebraic(to.r, to.c)}`;
}

function finalizeMoveAfterBoardUpdate(
  piece,
  from,
  to,
  captured,
  castleType = null,
  promotionPiece = null,
) {
  const moveText = promotionPiece
    ? `${turn === "w" ? "White" : "Black"}: ${algebraic(from.r, from.c)}→${algebraic(to.r, to.c)}=${promotionPiece.toUpperCase()}`
    : moveToText(piece, from, to, captured, castleType);

  addHistoryEntry(moveText);

  lastMove = { from: { ...from }, to: { r: to.r, c: to.c } };
  selected = null;
  legalMoves = [];
  turn = enemyOf(turn);
  turnLabelEl.textContent = turn === "w" ? "White" : "Black";
  undoBtn.disabled = false;

  const enemyCheck = isInCheck(board, turn);
  const hasMoves = hasAnyLegalMove(turn);

  if (enemyCheck && !hasMoves) {
    gameOver = true;
    setStatus(`${turn === "w" ? "White" : "Black"} is checkmated`);
    setFeedback(
      `${enemyOf(turn) === "w" ? "White" : "Black"} wins by checkmate.`,
      "success",
    );
  } else if (!enemyCheck && !hasMoves) {
    gameOver = true;
    setStatus("Stalemate");
    setFeedback(
      "No legal moves remain. The game ends in stalemate.",
      "warning",
    );
  } else if (enemyCheck) {
    setStatus(`${turn === "w" ? "White" : "Black"} to move`);
    setFeedback(`${turn === "w" ? "White" : "Black"} is in check.`, "danger");
  } else {
    setStatus(`${turn === "w" ? "White" : "Black"} to move`);
    setFeedback(
      turn === "w"
        ? "White to move. Look for development and king safety."
        : "Black to move. Challenge the center and coordinate pieces.",
      "warning",
    );
  }

  renderBoard();
}

function makeMove(from, to) {
  const piece = board[from.r][from.c];
  const captured = board[to.r][to.c];

  historyStack.push({
    board: cloneBoard(board),
    turn,
    whiteCaptures: [...whiteCaptures],
    blackCaptures: [...blackCaptures],
    castlingRights: JSON.parse(JSON.stringify(castlingRights)),
    selected: selected ? { ...selected } : null,
    legalMoves: legalMoves.map((m) => ({ ...m })),
    lastMove: lastMove
      ? { from: { ...lastMove.from }, to: { ...lastMove.to } }
      : null,
  });

  if (captured) {
    if (turn === "w") whiteCaptures.push(captured);
    else blackCaptures.push(captured);
  }

  updateCastlingRights(piece, from, to, captured);

  board = simulateMove(board, from, to);

  // promotion now waits for player choice
  if (isPromotionMove(piece, to)) {
    lastMove = { from: { ...from }, to: { r: to.r, c: to.c } };
    selected = null;
    legalMoves = [];
    undoBtn.disabled = false;
    renderBoard();
    openPromotionModal(turn, from, to, captured, piece);
    return;
  }

  finalizeMoveAfterBoardUpdate(piece, from, to, captured, to.castle);
}

function hasAnyLegalMove(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || colorOf(piece) !== color) continue;

      const pseudo = getPseudoMovesForPiece(board, r, c, false);
      for (const move of pseudo) {
        const next = simulateMove(board, { r, c }, move);
        if (!isInCheck(next, color)) return true;
      }
    }
  }
  return false;
}

function undoMove() {
  if (!historyStack.length || (gameOver && historyStack.length === 0)) return;

  const prev = historyStack.pop();
  board = cloneBoard(prev.board);
  turn = prev.turn;
  whiteCaptures = [...prev.whiteCaptures];
  blackCaptures = [...prev.blackCaptures];
  castlingRights = JSON.parse(JSON.stringify(prev.castlingRights));
  selected = null;
  legalMoves = [];
  lastMove = prev.lastMove
    ? { from: { ...prev.lastMove.from }, to: { ...prev.lastMove.to } }
    : null;
  gameOver = false;

  closePromotionModal();

  turnLabelEl.textContent = turn === "w" ? "White" : "Black";
  setStatus(`${turn === "w" ? "White" : "Black"} to move`);
  setFeedback("Last move undone.", "warning");

  moveHistory.pop();
  if (moveHistory.length === 0) {
    moveHistoryEl.innerHTML = "<li>No moves yet.</li>";
  } else {
    moveHistoryEl.innerHTML = "";
    moveHistory.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      moveHistoryEl.appendChild(li);
    });
  }

  undoBtn.disabled = historyStack.length === 0;
  renderBoard();
}

function isPromotionMove(piece, to) {
  return (piece === "wp" && to.r === 0) || (piece === "bp" && to.r === 7);
}

function openPromotionModal(color, from, to, captured, movedPiece) {
  pendingPromotion = { color, from, to, captured, movedPiece };
  promotionModal.classList.remove("hidden");
  promotionModal.setAttribute("aria-hidden", "false");
}

function closePromotionModal() {
  pendingPromotion = null;
  promotionModal.classList.add("hidden");
  promotionModal.setAttribute("aria-hidden", "true");
}

function updateCastlingRights(piece, from, to, captured) {
  // if king moves, both rights gone
  if (piece === "wk") {
    castlingRights.w.kingSide = false;
    castlingRights.w.queenSide = false;
  }
  if (piece === "bk") {
    castlingRights.b.kingSide = false;
    castlingRights.b.queenSide = false;
  }

  // if rook moves from original square
  if (piece === "wr" && from.r === 7 && from.c === 0)
    castlingRights.w.queenSide = false;
  if (piece === "wr" && from.r === 7 && from.c === 7)
    castlingRights.w.kingSide = false;
  if (piece === "br" && from.r === 0 && from.c === 0)
    castlingRights.b.queenSide = false;
  if (piece === "br" && from.r === 0 && from.c === 7)
    castlingRights.b.kingSide = false;

  // if rook is captured on original square
  if (captured === "wr" && to.r === 7 && to.c === 0)
    castlingRights.w.queenSide = false;
  if (captured === "wr" && to.r === 7 && to.c === 7)
    castlingRights.w.kingSide = false;
  if (captured === "br" && to.r === 0 && to.c === 0)
    castlingRights.b.queenSide = false;
  if (captured === "br" && to.r === 0 && to.c === 7)
    castlingRights.b.kingSide = false;
}

flipBtn.addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
});

undoBtn.addEventListener("click", undoMove);
resetBtn.addEventListener("click", resetGame);

promotionButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!pendingPromotion) return;

    const chosen = btn.dataset.piece; // q r b n
    const { color, from, to, captured, movedPiece } = pendingPromotion;

    board[to.r][to.c] = `${color}${chosen}`;

    closePromotionModal();
    finalizeMoveAfterBoardUpdate(movedPiece, from, to, captured, null, chosen);
  });
});

resetGame();
