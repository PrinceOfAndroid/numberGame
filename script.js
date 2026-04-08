const levels = [
  {
    id: 1,
    size: 3,
    boxRows: 3,
    boxCols: 3,
    highlightBox: false,
    validateBox: false,
    tokens: ["🐶", "🐱", "🐰"],
    solution: [
      ["🐶", "🐱", "🐰"],
      ["🐱", "🐰", "🐶"],
      ["🐰", "🐶", "🐱"],
    ],
    puzzle: [
      ["🐶", "", "🐰"],
      ["", "🐰", ""],
      ["🐰", "", "🐱"],
    ],
  },
  {
    id: 2,
    size: 4,
    boxRows: 2,
    boxCols: 2,
    tokens: ["1", "2", "3", "4"],
    solution: [
      ["1", "2", "3", "4"],
      ["3", "4", "1", "2"],
      ["2", "1", "4", "3"],
      ["4", "3", "2", "1"],
    ],
    puzzle: [
      ["1", "", "", "4"],
      ["", "4", "1", ""],
      ["2", "", "4", ""],
      ["", "3", "", "1"],
    ],
  },
  {
    id: 3,
    size: 6,
    boxRows: 2,
    boxCols: 3,
    tokens: ["1", "2", "3", "4", "5", "6"],
    solution: [
      ["1", "2", "3", "4", "5", "6"],
      ["4", "5", "6", "1", "2", "3"],
      ["2", "3", "4", "5", "6", "1"],
      ["5", "6", "1", "2", "3", "4"],
      ["3", "4", "5", "6", "1", "2"],
      ["6", "1", "2", "3", "4", "5"],
    ],
    puzzle: [
      ["1", "", "3", "", "5", ""],
      ["", "5", "", "1", "", "3"],
      ["2", "", "", "5", "6", ""],
      ["", "6", "", "", "3", "4"],
      ["3", "", "5", "", "", "2"],
      ["", "1", "", "3", "", "5"],
    ],
  },
];

const state = levels.map((lv) => ({
  selected: null,
  current: lv.puzzle.map((row) => [...row]),
  completed: false,
}));

function init() {
  levels.forEach((level, idx) => {
    renderBoard(level, idx);
    renderChoices(level, idx);
    bindNextButton(level, idx);
  });
}

function renderBoard(level, levelIndex) {
  const boardEl = document.getElementById(`board-${level.id}`);
  boardEl.innerHTML = "";

  for (let r = 0; r < level.size; r += 1) {
    for (let c = 0; c < level.size; c += 1) {
      const value = state[levelIndex].current[r][c];
      const fixed = level.puzzle[r][c] !== "";
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.textContent = value;

      if (r % level.boxRows === 0) {
        cell.classList.add("box-top");
      }
      if (c % level.boxCols === 0) {
        cell.classList.add("box-left");
      }
      if (r === level.size - 1) {
        cell.classList.add("box-bottom");
      }
      if (c === level.size - 1) {
        cell.classList.add("box-right");
      }

      if (fixed) {
        cell.classList.add("fixed");
      }
      cell.addEventListener("click", () => selectCell(levelIndex, r, c));
      boardEl.appendChild(cell);
    }
  }
}

function renderChoices(level, levelIndex) {
  const choicesEl = document.getElementById(`choices-${level.id}`);
  choicesEl.innerHTML = "";

  level.tokens.forEach((token) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = token;
    btn.addEventListener("click", () => placeToken(levelIndex, token));
    choicesEl.appendChild(btn);
  });
}

function bindNextButton(level, levelIndex) {
  if (levelIndex < levels.length - 1) {
    const nextBtn = document.getElementById(`next-${level.id}`);
    nextBtn.addEventListener("click", () => showLevel(levelIndex + 1));
    return;
  }

  const finishBtn = document.getElementById("finish-3");
  finishBtn.addEventListener("click", () => {
    const message = document.getElementById("message-3");
    message.textContent = "你太棒啦，三关全部通过！";
  });
}

function showLevel(indexToShow) {
  const screens = document.querySelectorAll(".level-screen");
  screens.forEach((screen, idx) => {
    screen.classList.toggle("active", idx === indexToShow);
  });
}

function selectCell(levelIndex, row, col) {
  const level = levels[levelIndex];
  if (level.puzzle[row][col] !== "" || state[levelIndex].completed) {
    return;
  }

  state[levelIndex].selected = { row, col };
  paintBoard(levelIndex);
}

function placeToken(levelIndex, token) {
  const currentState = state[levelIndex];
  if (!currentState.selected || currentState.completed) {
    return;
  }

  const { row, col } = currentState.selected;
  currentState.current[row][col] = token;

  paintBoard(levelIndex);
  checkCompletion(levelIndex);
}

function paintBoard(levelIndex) {
  const level = levels[levelIndex];
  const boardEl = document.getElementById(`board-${level.id}`);
  const cells = [...boardEl.querySelectorAll(".cell")];
  const selected = state[levelIndex].selected;

  cells.forEach((cell) => {
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    const value = state[levelIndex].current[r][c];
    const fixed = level.puzzle[r][c] !== "";

    cell.textContent = value;
    cell.classList.remove("selected", "highlight", "correct", "wrong");

    if (!selected) {
      return;
    }

    if (selected.row === r && selected.col === c) {
      cell.classList.add("selected");
    }

    if (isRelatedCell(level, selected, r, c)) {
      cell.classList.add("highlight");
    }

    if (!fixed && value !== "") {
      if (isMoveValid(levelIndex, r, c, value)) {
        cell.classList.add("correct");
      } else {
        cell.classList.add("wrong");
      }
    }
  });
}

function isRelatedCell(level, selected, row, col) {
  if (selected.row === row || selected.col === col) {
    return true;
  }

  if (level.highlightBox === false) {
    return false;
  }

  const boxStartRow = Math.floor(selected.row / level.boxRows) * level.boxRows;
  const boxStartCol = Math.floor(selected.col / level.boxCols) * level.boxCols;

  return (
    row >= boxStartRow &&
    row < boxStartRow + level.boxRows &&
    col >= boxStartCol &&
    col < boxStartCol + level.boxCols
  );
}

function isMoveValid(levelIndex, row, col, value) {
  const level = levels[levelIndex];
  const board = state[levelIndex].current;

  for (let c = 0; c < level.size; c += 1) {
    if (c !== col && board[row][c] === value) {
      return false;
    }
  }

  for (let r = 0; r < level.size; r += 1) {
    if (r !== row && board[r][col] === value) {
      return false;
    }
  }

  if (level.validateBox !== false) {
    const boxStartRow = Math.floor(row / level.boxRows) * level.boxRows;
    const boxStartCol = Math.floor(col / level.boxCols) * level.boxCols;

    for (let r = boxStartRow; r < boxStartRow + level.boxRows; r += 1) {
      for (let c = boxStartCol; c < boxStartCol + level.boxCols; c += 1) {
        if (r === row && c === col) {
          continue;
        }
        if (board[r][c] === value) {
          return false;
        }
      }
    }
  }

  return true;
}

function checkCompletion(levelIndex) {
  const level = levels[levelIndex];
  const currentState = state[levelIndex];

  for (let r = 0; r < level.size; r += 1) {
    for (let c = 0; c < level.size; c += 1) {
      if (currentState.current[r][c] === "") {
        return;
      }
      if (!isMoveValid(levelIndex, r, c, currentState.current[r][c])) {
        return;
      }
    }
  }

  currentState.completed = true;
  currentState.selected = null;
  paintBoard(levelIndex);
  showPassResult(levelIndex);
}

function showPassResult(levelIndex) {
  const level = levels[levelIndex];
  const message = document.getElementById(`message-${level.id}`);

  if (levelIndex < levels.length - 1) {
    message.textContent = "恭喜过关！准备进入下一关吧！";
    document.getElementById(`next-${level.id}`).classList.remove("hidden");
  } else {
    message.textContent = "恭喜你，所有关卡都完成啦！";
    document.getElementById("finish-3").classList.remove("hidden");
  }
}

init();
