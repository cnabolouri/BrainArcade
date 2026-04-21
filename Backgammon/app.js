const showError = (e) => {
  const status = document.getElementById("status");
  if (status) status.textContent = "Error: " + (e?.message || e);
  console.error(e);
};

try {
  /* ---------- layout / canvas ---------- */
  const W = 940;
  const H = 560;
  const M = 18;
  const BAR_W = 46;
  const RIM = 12;
  const PIP_W = Math.floor((W - 2 * M - BAR_W) / 12);
  const MID_Y = H / 2;
  const CHECK_R = 16;
  const STACK_SP = 22;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  /* ---------- ui ---------- */
  const statusEl = document.getElementById("status");
  const diceEl = document.getElementById("dice");
  const barWEl = document.getElementById("barW");
  const barBEl = document.getElementById("barB");
  const offWEl = document.getElementById("offW");
  const offBEl = document.getElementById("offB");

  const rollBtn = document.getElementById("roll");
  const endBtn = document.getElementById("end");
  const undoBtn = document.getElementById("undo");
  const resetBtn = document.getElementById("reset");
  const modeSelect = document.getElementById("mode-select");

  const feedbackEl = document.getElementById("feedback");
  const sessionNoteEl = document.getElementById("session-note");

  /* ---------- model ---------- */
  let points,
    bar,
    off,
    turn,
    dice,
    movesLeft,
    selected = null,
    targets = [];
  let history = [];
  let gameOver = false;
  let mode = "pvp";

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setFeedback(text, type = "warning") {
    feedbackEl.className = `feedback ${type}`;
    feedbackEl.textContent = text;
  }

  function setPoint(i, c, n) {
    points[i] = { c, n };
  }

  function nameOf(p) {
    return p === "W" ? "White" : "Black";
  }

  function dirOf(p) {
    return p === "W" ? -1 : 1;
  }

  function homeRange(p) {
    return p === "W" ? [1, 6] : [19, 24];
  }

  function entryPoint(p, die) {
    return p === "W" ? 25 - die : die;
  }

  function ownerAt(i) {
    return points[i]?.c || null;
  }

  function countAt(i) {
    return points[i]?.n || 0;
  }

  function isOpenFor(i, player) {
    const c = ownerAt(i);
    const n = countAt(i);
    return n === 0 || c === player || (c !== player && n === 1);
  }

  function cloneState() {
    return {
      points: points.map((p) => (p ? { c: p.c, n: p.n } : null)),
      bar: { ...bar },
      off: { ...off },
      turn,
      dice: [...dice],
      movesLeft: [...movesLeft],
      selected,
      targets: JSON.parse(JSON.stringify(targets)),
    };
  }

  function restoreState(s) {
    points = s.points.map((p) => (p ? { c: p.c, n: p.n } : null));
    bar = { ...s.bar };
    off = { ...s.off };
    turn = s.turn;
    dice = [...s.dice];
    movesLeft = [...s.movesLeft];
    selected = s.selected;
    targets = s.targets;
    updateHUD();
    draw();
  }

  function updateHUD() {
    barWEl.textContent = bar.W;
    barBEl.textContent = bar.B;
    offWEl.textContent = off.W;
    offBEl.textContent = off.B;
    diceEl.textContent = dice.length
      ? dice[0] + " & " + dice[1] + (dice[0] === dice[1] ? " (double)" : "")
      : "–";
  }

  function allInHome(player) {
    const [a, b] = homeRange(player);
    let total = off[player];
    for (let i = a; i <= b; i++) {
      if (ownerAt(i) === player) total += countAt(i);
    }
    return bar[player] === 0 && total === 15;
  }

  function highestOccupiedHome(player) {
    const [a, b] = homeRange(player);

    if (player === "W") {
      for (let i = b; i >= a; i--) {
        if (ownerAt(i) === player && countAt(i) > 0) return i;
      }
    } else {
      for (let i = a; i <= b; i++) {
        if (ownerAt(i) === player && countAt(i) > 0) return i;
      }
    }
    return null;
  }

  function canBearOffFrom(p, die, player) {
    if (!allInHome(player)) return false;

    if (player === "W") {
      const dest = p - die;
      if (dest === 0) return true;
      if (dest < 0) return highestOccupiedHome("W") === p;
      return false;
    } else {
      const dest = p + die;
      if (dest === 25) return true;
      if (dest > 25) return highestOccupiedHome("B") === p;
      return false;
    }
  }

  function hasAnyLegalMove() {
    const player = turn;
    const uniq = [...new Set(movesLeft)];

    if (bar[player] > 0) {
      for (const d of uniq) {
        const ep = entryPoint(player, d);
        if (isOpenFor(ep, player)) return true;
      }
      return false;
    }

    for (let i = 1; i <= 24; i++) {
      if (ownerAt(i) !== player) continue;

      for (const d of uniq) {
        const dest = i + dirOf(player) * d;
        if (dest >= 1 && dest <= 24) {
          if (isOpenFor(dest, player)) return true;
        } else if (canBearOffFrom(i, d, player)) {
          return true;
        }
      }
    }
    return false;
  }

  function legalTargetsFrom(from) {
    const player = turn;
    const outs = [];
    const uniq = [...new Set(movesLeft)];

    if (bar[player] > 0 && from !== "bar") return outs;

    if (from === "bar") {
      for (const d of uniq) {
        const ep = entryPoint(player, d);
        if (isOpenFor(ep, player)) outs.push({ to: ep, die: d, type: "enter" });
      }
      return outs;
    }

    if (ownerAt(from) !== player) return outs;

    for (const d of uniq) {
      const dest = from + dirOf(player) * d;
      if (dest >= 1 && dest <= 24) {
        if (isOpenFor(dest, player))
          outs.push({ to: dest, die: d, type: "move" });
      } else if (canBearOffFrom(from, d, player)) {
        outs.push({ to: player === "W" ? 0 : 25, die: d, type: "bearoff" });
      }
    }

    return outs;
  }

  function useDie(v) {
    const i = movesLeft.indexOf(v);
    if (i >= 0) movesLeft.splice(i, 1);
  }

  function takeFrom(i) {
    if (!points[i] || points[i].n === 0) return;
    points[i].n--;
    if (points[i].n === 0) points[i] = null;
  }

  function landOn(i, player) {
    const c = ownerAt(i);
    const n = countAt(i);

    if (n === 0) {
      setPoint(i, player, 1);
    } else if (c === player) {
      points[i].n++;
    } else if (n === 1) {
      points[i] = { c: player, n: 1 };
      bar[c]++;
    }
  }

  function declareWinner(winner) {
    gameOver = true;
    setStatus(`${nameOf(winner)} wins!`);
    setFeedback(`${nameOf(winner)} has borne off all 15 checkers.`, "success");
    sessionNoteEl.textContent =
      winner === "W"
        ? "White closed the game cleanly. Study the timing of the bear-off."
        : "Black finished the race first. Notice how tempo and safety shaped the result.";
    dice = [];
    movesLeft = [];
    selected = null;
    targets = [];
    rollBtn.disabled = true;
    endBtn.disabled = true;
    undoBtn.disabled = true;
    draw();
  }

  function applyMove(from, target) {
    history.push(cloneState());
    undoBtn.disabled = false;

    const player = turn;
    useDie(target.die);

    if (target.type === "enter") {
      bar[player]--;
      landOn(target.to, player);
    } else if (target.type === "move") {
      takeFrom(from);
      landOn(target.to, player);
    } else if (target.type === "bearoff") {
      takeFrom(from);
      off[player]++;
      if (off[player] >= 15) {
        updateHUD();
        declareWinner(player);
        return;
      }
    }

    selected = null;
    targets = [];
    updateHUD();

    if (!movesLeft.length || !hasAnyLegalMove()) {
      endBtn.disabled = false;
      setStatus(`${nameOf(player)} may end the turn`);
      setFeedback(
        !movesLeft.length
          ? `${nameOf(player)} used all available dice.`
          : `${nameOf(player)} is blocked and cannot continue.`,
        "warning",
      );
    } else {
      endBtn.disabled = true;
      setStatus(`${nameOf(player)} to continue`);
      setFeedback(
        "Choose the next checker to continue the move sequence.",
        "success",
      );
    }

    draw();

    if (!gameOver && mode === "cpu" && turn === "B") {
      maybeRunCpuTurn();
    }
  }

  function rollDice() {
    if (gameOver || dice.length) return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);

    dice = [d1, d2];
    movesLeft = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];

    diceEl.textContent = d1 + " & " + d2 + (d1 === d2 ? " (double)" : "");
    rollBtn.disabled = true;

    selected = null;
    targets = [];

    if (!hasAnyLegalMove()) {
      setStatus(`${nameOf(turn)} rolled ${d1}-${d2}`);
      setFeedback("No legal move available. End the turn.", "danger");
      endBtn.disabled = false;
    } else {
      setStatus(`${nameOf(turn)} to move`);
      setFeedback(
        d1 === d2
          ? "Double rolled. You have four moves available."
          : "Legal targets will appear after selecting a checker.",
        "success",
      );
      endBtn.disabled = true;
    }

    draw();

    if (!gameOver && mode === "cpu" && turn === "B") {
      maybeRunCpuTurn();
    }
  }

  function endTurn() {
    if (gameOver) return;

    if (movesLeft.length && hasAnyLegalMove()) {
      setFeedback("You must use all dice if a legal move exists.", "danger");
      return;
    }

    turn = turn === "W" ? "B" : "W";
    dice = [];
    movesLeft = [];
    selected = null;
    targets = [];
    undoBtn.disabled = true;
    rollBtn.disabled = false;
    endBtn.disabled = true;

    updateHUD();
    setStatus(`${nameOf(turn)} to roll`);
    setFeedback("Roll the dice to begin the turn.", "warning");
    draw();

    if (!gameOver && mode === "cpu" && turn === "B") {
      setTimeout(() => rollDice(), 500);
    }
  }

  /* ---------- simple cpu ---------- */
  function getAllLegalMovesForPlayer() {
    const moves = [];
    if (bar[turn] > 0) {
      const barTargets = legalTargetsFrom("bar");
      for (const t of barTargets) moves.push({ from: "bar", target: t });
      return moves;
    }

    for (let i = 1; i <= 24; i++) {
      if (ownerAt(i) !== turn) continue;
      const ts = legalTargetsFrom(i);
      for (const t of ts) moves.push({ from: i, target: t });
    }
    return moves;
  }

  function cpuStep() {
    if (gameOver || mode !== "cpu" || turn !== "B") return;

    if (!dice.length) {
      rollDice();
      return;
    }

    const moves = getAllLegalMovesForPlayer();

    if (!moves.length) {
      endTurn();
      return;
    }

    // simple heuristic: prefer bear off > hit blot > normal move
    moves.sort((a, b) => {
      const scoreMove = (m) => {
        let s = 0;
        if (m.target.type === "bearoff") s += 100;
        const destOwner = ownerAt(m.target.to);
        const destCount = countAt(m.target.to);
        if (m.target.type !== "bearoff" && destOwner === "W" && destCount === 1)
          s += 50;
        s += m.target.die;
        return s;
      };
      return scoreMove(b) - scoreMove(a);
    });

    const choice = moves[0];
    applyMove(choice.from, choice.target);
  }

  function maybeRunCpuTurn() {
    if (mode !== "cpu" || turn !== "B" || gameOver) return;

    if (!movesLeft.length || !hasAnyLegalMove()) {
      setTimeout(() => endTurn(), 700);
      return;
    }

    setTimeout(() => cpuStep(), 700);
  }

  /* ---------- board drawing ---------- */
  function pointAnchor(i) {
    let col, top;
    if (i >= 13) {
      col = i - 13;
      top = true;
    } else {
      col = 12 - i;
      top = false;
    }

    const x = M + (col >= 6 ? BAR_W : 0) + col * PIP_W + PIP_W / 2;

    if (top) return { x, y: M + 4, down: true };
    return { x, y: H - M - 4, down: false };
  }

  function drawTriangle(x, y, w, h, color, down = true) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w / 2, y + h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w / 2, y - h);
    }
    ctx.closePath();
    ctx.fill();
  }

  function chip(x, y, color, isSelected = false, countLabel = null) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, CHECK_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.stroke();

    if (isSelected) {
      ctx.strokeStyle = getVar("--success");
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, CHECK_R + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (countLabel) {
      ctx.fillStyle = "#0b1220";
      ctx.font = "bold 12px system-ui";
      ctx.fillText(String(countLabel), x - 4, y + 4);
    }
  }

  function getVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }

  function drawBoard() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getVar("--board-bg");
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,.2)";
    ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);

    const barX = M + 6 * PIP_W;
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(barX, M, BAR_W, H - 2 * M);

    for (let i = 0; i < 12; i++) {
      const xL = M + i * PIP_W + (i >= 6 ? BAR_W : 0);
      drawTriangle(
        xL,
        M,
        PIP_W,
        (H - 2 * M) / 2 - RIM,
        i % 2 === 0 ? getVar("--point-a") : getVar("--point-b"),
        true,
      );
      drawTriangle(
        xL,
        H - M,
        PIP_W,
        (H - 2 * M) / 2 - RIM,
        i % 2 === 0 ? getVar("--point-b") : getVar("--point-a"),
        false,
      );
    }

    const right1 = M + 6 * PIP_W + BAR_W + 6 * PIP_W;
    const offX0 = right1 + RIM;

    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(offX0, M, 40, (H - 2 * M) / 2 - RIM);
    ctx.fillRect(offX0, MID_Y + RIM, 40, (H - 2 * M) / 2 - RIM);

    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(
      `${nameOf(turn)} ${movesLeft.length ? "to move" : "to roll"}`,
      M + 6,
      MID_Y - 6,
    );

    if (dice.length) {
      ctx.font = "bold 16px system-ui";
      ctx.fillText(`Moves left: ${movesLeft.join(" ")}`, M + 6, MID_Y + 16);
    }
  }

  function drawCheckers() {
    for (let i = 1; i <= 24; i++) {
      const p = points[i];
      if (!p) continue;

      const { x, y, down } = pointAnchor(i);
      const color =
        p.c === "W" ? getVar("--checker-white") : getVar("--checker-black");
      const n = p.n;

      const drawOne = (yy) => chip(x, yy, color, selected === i);

      if (n <= 5) {
        for (let k = 0; k < n; k++) {
          const yy = down
            ? y + k * STACK_SP + CHECK_R
            : y - k * STACK_SP - CHECK_R;
          drawOne(yy);
        }
      } else {
        for (let k = 0; k < 5; k++) {
          const yy = down
            ? y + k * STACK_SP + CHECK_R
            : y - k * STACK_SP - CHECK_R;
          drawOne(yy);
        }
        const yy = down
          ? y + 5 * STACK_SP + CHECK_R
          : y - 5 * STACK_SP - CHECK_R;
        chip(x, yy, color, selected === i, n);
      }
    }

    const barX = M + 6 * PIP_W + BAR_W / 2;

    for (let i = 0; i < bar.B; i++) {
      chip(
        barX,
        MID_Y - 6 - i * STACK_SP - CHECK_R,
        getVar("--checker-black"),
        selected === "bar" && turn === "B",
      );
    }

    for (let i = 0; i < bar.W; i++) {
      chip(
        barX,
        MID_Y + 6 + i * STACK_SP + CHECK_R,
        getVar("--checker-white"),
        selected === "bar" && turn === "W",
      );
    }

    for (const t of targets) {
      if (t.type === "bearoff") {
        const offY = turn === "W" ? MID_Y + RIM + 30 : M + 30;
        const offX = W - M - 20;
        ctx.strokeStyle = getVar("--success");
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(offX, offY, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        const A = pointAnchor(t.to);
        const yy = A.down ? A.y + CHECK_R : A.y - CHECK_R;
        ctx.strokeStyle = getVar("--success");
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(A.x, yy, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = getVar("--success");
        ctx.font = "bold 12px system-ui";
        ctx.fillText(String(t.die), A.x - 4, yy + 4);
        ctx.lineWidth = 1;
      }
    }
  }

  function draw() {
    drawBoard();
    drawCheckers();
  }

  /* ---------- FIXED click mapping ---------- */
  function getScaledCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;

    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  function hitTest(x, y) {
    const left0 = M;
    const left1 = M + 6 * PIP_W;
    const right0 = left1 + BAR_W;
    const right1 = right0 + 6 * PIP_W;

    let col = -1;

    if (x >= left0 && x < left1) col = Math.floor((x - left0) / PIP_W);
    else if (x >= right0 && x < right1)
      col = Math.floor((x - right0) / PIP_W) + 6;

    if (col !== -1) {
      const topRow = y < MID_Y;
      const point = topRow ? 13 + col : 12 - col;
      return { kind: "point", point };
    }

    const barX0 = M + 6 * PIP_W;
    const barX1 = barX0 + BAR_W;
    if (x >= barX0 && x <= barX1)
      return { kind: "bar", who: y < MID_Y ? "B" : "W" };

    const offX0 = right1 + RIM;
    if (x >= offX0) return { kind: "off", who: y < MID_Y ? "B" : "W" };

    return null;
  }

  function onClick(e) {
    if (gameOver) return;
    if (mode === "cpu" && turn === "B") return;

    const { x, y } = getScaledCanvasCoords(e);

    if (!movesLeft.length) {
      setFeedback("Roll first before selecting a checker.", "danger");
      return;
    }

    const hit = hitTest(x, y);

    if (hit?.kind === "point" && selected === hit.point) {
      selected = null;
      targets = [];
      draw();
      return;
    }

    if (hit?.kind === "bar" && selected === "bar") {
      selected = null;
      targets = [];
      draw();
      return;
    }

    if (hit?.kind === "point" || hit?.kind === "off") {
      const t = targets.find((t) =>
        hit.kind === "point" ? t.to === hit.point : t.type === "bearoff",
      );
      if (t && selected) {
        applyMove(selected, t);
        return;
      }
    }

    if (hit?.kind === "bar") {
      if (bar[turn] === 0) {
        setFeedback(`No ${nameOf(turn)} checkers on the bar.`, "warning");
        return;
      }
      selected = "bar";
      targets = legalTargetsFrom("bar");
      setFeedback("Choose a highlighted entry point.", "success");
      draw();
      return;
    }

    if (hit?.kind === "point") {
      if (ownerAt(hit.point) !== turn) {
        setFeedback(
          `That point belongs to ${ownerAt(hit.point) ? nameOf(ownerAt(hit.point)) : "no one"}.`,
          "danger",
        );
        return;
      }

      if (bar[turn] > 0) {
        setFeedback(
          `${nameOf(turn)} must re-enter from the bar first.`,
          "danger",
        );
        selected = null;
        targets = [];
        draw();
        return;
      }

      selected = hit.point;
      targets = legalTargetsFrom(hit.point);
      setFeedback("Legal targets highlighted in green.", "success");
      draw();
      return;
    }

    selected = null;
    targets = [];
    draw();
  }

  function resetGame() {
    points = Array(26).fill(null);

    setPoint(24, "W", 2);
    setPoint(13, "W", 5);
    setPoint(8, "W", 3);
    setPoint(6, "W", 5);

    setPoint(1, "B", 2);
    setPoint(12, "B", 5);
    setPoint(17, "B", 3);
    setPoint(19, "B", 5);

    bar = { W: 0, B: 0 };
    off = { W: 0, B: 0 };
    turn = "W";
    dice = [];
    movesLeft = [];
    selected = null;
    targets = [];
    history = [];
    gameOver = false;
    mode = modeSelect.value;

    rollBtn.disabled = false;
    endBtn.disabled = true;
    undoBtn.disabled = true;

    updateHUD();
    setStatus(`${nameOf(turn)} to roll`);
    setFeedback("Roll the dice to begin the turn.", "warning");
    sessionNoteEl.textContent =
      mode === "cpu"
        ? "You play White. Black is controlled by CPU."
        : "Local 2-player mode: alternate turns and plan your race carefully.";
    draw();
  }

  /* ---------- events ---------- */
  rollBtn.addEventListener("click", rollDice);
  endBtn.addEventListener("click", endTurn);
  undoBtn.addEventListener("click", () => {
    if (gameOver || !history.length) return;
    restoreState(history.pop());
    undoBtn.disabled = history.length === 0;
    setFeedback(`${nameOf(turn)} turn restored from previous move.`, "warning");
    sessionNoteEl.textContent =
      "Undo gives you a chance to reconsider the move path before ending the turn.";
  });
  resetBtn.addEventListener("click", resetGame);
  modeSelect.addEventListener("change", resetGame);
  canvas.addEventListener("click", onClick);

  resetGame();
} catch (e) {
  showError(e);
}
