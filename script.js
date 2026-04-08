const levelConfigs = [
  {
    id: 1,
    size: 3,
    boxRows: 3,
    boxCols: 3,
    highlightBox: false,
    validateBox: false,
    blankCount: 4,
    tokens: ["🐶", "🐱", "🐰"],
  },
  {
    id: 2,
    size: 4,
    boxRows: 2,
    boxCols: 2,
    highlightBox: true,
    validateBox: true,
    blankCount: 8,
    tokens: ["1", "2", "3", "4"],
  },
  {
    id: 3,
    size: 6,
    boxRows: 2,
    boxCols: 3,
    highlightBox: true,
    validateBox: true,
    blankCount: 18,
    tokens: ["1", "2", "3", "4", "5", "6"],
  },
];

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeShuffledRange(n) {
  return shuffleInPlace(Array.from({ length: n }, (_, i) => i));
}

function makeRowOrder(level) {
  if (level.validateBox === false) {
    return makeShuffledRange(level.size);
  }

  const groupCount = level.size / level.boxRows;
  const groupOrder = makeShuffledRange(groupCount);
  const rows = [];

  groupOrder.forEach((group) => {
    const innerOrder = makeShuffledRange(level.boxRows);
    innerOrder.forEach((offset) => rows.push(group * level.boxRows + offset));
  });

  return rows;
}

function makeColOrder(level) {
  if (level.validateBox === false) {
    return makeShuffledRange(level.size);
  }

  const groupCount = level.size / level.boxCols;
  const groupOrder = makeShuffledRange(groupCount);
  const cols = [];

  groupOrder.forEach((group) => {
    const innerOrder = makeShuffledRange(level.boxCols);
    innerOrder.forEach((offset) => cols.push(group * level.boxCols + offset));
  });

  return cols;
}

function getPatternValueIndex(level, row, col) {
  if (level.validateBox === false) {
    return (row + col) % level.size;
  }

  return (
    (level.boxCols * (row % level.boxRows) + Math.floor(row / level.boxRows) + col) %
    level.size
  );
}

function generateRandomLevel(levelConfig) {
  const tokenOrder = [...levelConfig.tokens];
  const rowOrder = makeRowOrder(levelConfig);
  const colOrder = makeColOrder(levelConfig);
  shuffleInPlace(tokenOrder);

  const solution = rowOrder.map((row) =>
    colOrder.map((col) => tokenOrder[getPatternValueIndex(levelConfig, row, col)]),
  );

  const puzzle = solution.map((row) => [...row]);
  const total = levelConfig.size * levelConfig.size;
  const blankCount = Math.min(levelConfig.blankCount ?? Math.floor(total * 0.5), total - 1);
  const positions = makeShuffledRange(total);

  for (let i = 0; i < blankCount; i += 1) {
    const pos = positions[i];
    const r = Math.floor(pos / levelConfig.size);
    const c = pos % levelConfig.size;
    puzzle[r][c] = "";
  }

  return {
    ...levelConfig,
    solution,
    puzzle,
  };
}

const levels = levelConfigs.map((config) => generateRandomLevel(config));

const state = levels.map((lv) => ({
  selected: null,
  current: lv.puzzle.map((row) => [...row]),
  completed: false,
}));

const audio = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  bgmStarted: false,
  bgmStopped: false,
  bgmTimer: null,
  bgmNextTime: 0,
  bgmStep: 0,
  tempo: 108,
  melody: [523.25, 659.25, 783.99, 659.25, 698.46, 659.25, 587.33, null],
  unlockHintEl: null,
  autoRetryTimer: null,
  voiceClips: { amazing: null, unbelievable: null },
  voiceReady: { amazing: false, unbelievable: false },

  ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.24;
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.65;
      this.sfxGain.gain.value = 1;
      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  },

  initVoiceClips() {
    const setupClip = (key, src) => {
      const clip = new Audio(src);
      clip.preload = "auto";
      clip.volume = 0.95;
      clip.addEventListener("canplaythrough", () => {
        this.voiceReady[key] = true;
      });
      clip.addEventListener("error", () => {
        this.voiceReady[key] = false;
      });
      this.voiceClips[key] = clip;
      clip.load();
    };

    setupClip("amazing", "./assets/audio/amazing.mp3");
    setupClip("unbelievable", "./assets/audio/unbelievable.mp3");
  },

  showUnlockHint() {
    if (this.unlockHintEl || this.bgmStopped) {
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "audio-unlock-hint";
    btn.textContent = "点我开启声音";
    btn.addEventListener("click", () => {
      this.playClick();
      this.unlock();
    });
    document.body.appendChild(btn);
    this.unlockHintEl = btn;
  },

  hideUnlockHint() {
    if (!this.unlockHintEl) {
      return;
    }
    this.unlockHintEl.remove();
    this.unlockHintEl = null;
  },

  syncUnlockHint() {
    if (this.bgmStopped) {
      this.hideUnlockHint();
      return;
    }

    if (this.ctx && this.ctx.state === "running" && this.bgmStarted) {
      this.hideUnlockHint();
    } else {
      this.showUnlockHint();
    }
  },

  startAutoRetry() {
    if (this.autoRetryTimer) {
      return;
    }

    this.autoRetryTimer = window.setInterval(() => {
      if (this.bgmStopped) {
        window.clearInterval(this.autoRetryTimer);
        this.autoRetryTimer = null;
        return;
      }

      this.unlock();
      if (this.ctx && this.ctx.state === "running" && this.bgmStarted) {
        window.clearInterval(this.autoRetryTimer);
        this.autoRetryTimer = null;
        this.hideUnlockHint();
      }
    }, 1200);
  },

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    ctx.resume().catch(() => {});
    if (!this.bgmStarted && !this.bgmStopped) {
      this.startBgm();
    }
    this.syncUnlockHint();
  },

  playToneAt(freq, duration, startTime, options = {}) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.bgmGain || !this.sfxGain) {
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const attack = options.attack ?? 0.008;
    const release = options.release ?? duration;
    const volume = options.volume ?? 0.06;

    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(freq, startTime);
    if (options.detune) {
      osc.detune.setValueAtTime(options.detune, startTime);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + release);

    const targetBus = options.bus === "bgm" ? this.bgmGain : this.sfxGain;

    osc.connect(gain);
    gain.connect(targetBus);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  },

  playTone(freq, duration, options = {}) {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    this.playToneAt(freq, duration, ctx.currentTime, options);
  },

  startBgm() {
    const ctx = this.ensureContext();
    if (!ctx || this.bgmStarted || this.bgmStopped) {
      return;
    }
    if (ctx.state !== "running") {
      this.syncUnlockHint();
      return;
    }

    this.bgmStarted = true;
    this.bgmNextTime = ctx.currentTime + 0.05;
    this.bgmStep = 0;

    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx) {
        return;
      }
      if (this.ctx.state !== "running") {
        this.syncUnlockHint();
        return;
      }

      const lookAhead = 0.3;
      const beat = 60 / this.tempo / 2;

      while (this.bgmNextTime < this.ctx.currentTime + lookAhead) {
        const note = this.melody[this.bgmStep % this.melody.length];
        if (note) {
          this.playToneAt(note, 0.24, this.bgmNextTime, {
            type: "triangle",
            volume: 0.028,
            attack: 0.01,
            release: 0.22,
            bus: "bgm",
          });
        }

        if (this.bgmStep % 4 === 0) {
          this.playToneAt(261.63, 0.3, this.bgmNextTime, {
            type: "sine",
            volume: 0.02,
            attack: 0.01,
            release: 0.28,
            bus: "bgm",
          });
        }

        this.bgmNextTime += beat;
        this.bgmStep += 1;
      }
    }, 80);
  },

  stopBgm() {
    this.bgmStopped = true;
    if (this.bgmTimer) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.bgmStarted = false;
    this.hideUnlockHint();
    if (this.autoRetryTimer) {
      window.clearInterval(this.autoRetryTimer);
      this.autoRetryTimer = null;
    }

    if (this.ctx && this.bgmGain) {
      const t = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(t);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, t);
      this.bgmGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    }
  },

  playClick() {
    this.playTone(930, 0.06, {
      type: "square",
      volume: 0.045,
      attack: 0.003,
      release: 0.05,
    });
  },

  playCorrect() {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const t = ctx.currentTime;
    this.playToneAt(660, 0.08, t, { type: "triangle", volume: 0.07, release: 0.07 });
    this.playToneAt(880, 0.12, t + 0.09, { type: "triangle", volume: 0.08, release: 0.11 });
  },

  playWrong() {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const t = ctx.currentTime;
    this.playToneAt(320, 0.09, t, { type: "sawtooth", volume: 0.07, release: 0.08 });
    this.playToneAt(220, 0.12, t + 0.1, { type: "sawtooth", volume: 0.08, release: 0.11 });
  },

  playVoiceClip(name) {
    const clip = this.voiceClips[name];
    if (!clip || !this.voiceReady[name]) {
      return false;
    }

    clip.currentTime = 0;
    const playTask = clip.play();
    if (playTask && typeof playTask.catch === "function") {
      playTask.catch(() => {});
    }
    return true;
  },

  playAmazing() {
    if (this.playVoiceClip("amazing")) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const t = ctx.currentTime;
    const run = [783.99, 987.77, 1174.66, 1318.51, 1567.98];
    run.forEach((note, i) => {
      this.playToneAt(note, 0.11, t + i * 0.065, {
        type: "triangle",
        volume: 0.12,
        attack: 0.004,
        release: 0.1,
      });
    });

    [1318.51, 1567.98, 1975.53].forEach((note) => {
      this.playToneAt(note, 0.2, t + 0.34, {
        type: "sine",
        volume: 0.08,
        attack: 0.003,
        release: 0.18,
      });
    });
  },

  playUnbelievable() {
    if (this.playVoiceClip("unbelievable")) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const t = ctx.currentTime;
    const leapRun = [659.25, 783.99, 1046.5, 1174.66, 1567.98, 1760];
    leapRun.forEach((note, i) => {
      this.playToneAt(note, 0.1, t + i * 0.055, {
        type: "triangle",
        volume: 0.125,
        attack: 0.004,
        release: 0.09,
      });
    });

    [1318.51, 1567.98, 1975.53].forEach((note) => {
      this.playToneAt(note, 0.26, t + 0.34, {
        type: "sine",
        volume: 0.09,
        attack: 0.004,
        release: 0.24,
      });
    });

    [2093, 2637.02].forEach((note, i) => {
      this.playToneAt(note, 0.18, t + 0.58 + i * 0.05, {
        type: "triangle",
        volume: 0.08,
        attack: 0.003,
        release: 0.16,
      });
    });
  },
};

function setupAudioUnlock() {
  const unlockAudio = () => audio.unlock();

  window.addEventListener("load", () => {
    audio.unlock();
    audio.startAutoRetry();
  });
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("touchstart", unlockAudio, { passive: true });
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      unlockAudio();
    }
  });
}

function init() {
  audio.initVoiceClips();
  setupAudioUnlock();
  audio.unlock();
  audio.startAutoRetry();

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
      cell.addEventListener("click", () => {
        audio.playClick();
        selectCell(levelIndex, r, c);
      });
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
    btn.addEventListener("click", () => {
      audio.playClick();
      placeToken(levelIndex, token);
    });
    choicesEl.appendChild(btn);
  });
}

function bindNextButton(level, levelIndex) {
  if (levelIndex < levels.length - 1) {
    const nextBtn = document.getElementById(`next-${level.id}`);
    nextBtn.addEventListener("click", () => {
      audio.playClick();
      showLevel(levelIndex + 1);
    });
    return;
  }

  const finishBtn = document.getElementById("finish-3");
  finishBtn.addEventListener("click", () => {
    audio.playClick();
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
  const isValid = isMoveValid(levelIndex, row, col, token);

  paintBoard(levelIndex);
  if (isValid) {
    audio.playCorrect();
  } else {
    audio.playWrong();
  }
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
    audio.playAmazing();
    message.textContent = "恭喜过关！准备进入下一关吧！";
    document.getElementById(`next-${level.id}`).classList.remove("hidden");
  } else {
    audio.stopBgm();
    audio.playUnbelievable();
    message.textContent = "恭喜你，所有关卡都完成啦！";
    document.getElementById("finish-3").classList.remove("hidden");
  }
}

init();
