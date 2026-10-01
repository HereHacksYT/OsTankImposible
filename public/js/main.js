const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

Input.init(canvas);

// --- SKOR SİSTEMİ ---
const SCORES_KEY = 'ostank_scores';

const Scores = {
  load() {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  save(entry) {
    const all = this.load();
    all.unshift(entry);
    const trimmed = all.slice(0, 50);
    try { localStorage.setItem(SCORES_KEY, JSON.stringify(trimmed)); } catch {}
  },
  clear() {
    try { localStorage.removeItem(SCORES_KEY); } catch {}
  },
  formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  },
  formatDate(ts) {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mi}`;
  },
};

const state = {
  mode: 'menu',
  difficulty: null,
  player: null,
  ai: null,
  bullets: [],
  lastTime: 0,
  startTime: 0,
  result: null,
};

function bindTap(el, handler) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handler(e);
  });
}

function startGame(difficulty) {
  Maze.generate();

  const player = new Tank(
    Maze.TILE * (Maze.cols - 4),
    Maze.TILE * (Maze.rows - 2.5),
    '#4aa3ff', true
  );

  const aiTank = new Tank(
    Maze.TILE * 3,
    Maze.TILE * 2.5,
    '#ff4444', false
  );
  aiTank.shootDelay = AI.configs[difficulty]?.shootInterval || 4.0;

  state.player = player;
  state.ai = aiTank;
  state.bullets = [];
  state.difficulty = difficulty;
  state.mode = 'playing';
  state.result = null;
  state.lastTime = performance.now();
  state.startTime = performance.now();

  Input.reset();

  document.getElementById('menu').classList.add('hidden');
  document.getElementById('scores').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');

  requestAnimationFrame(loop);
}

function loop(now) {
  if (state.mode !== 'playing') return;
  const dt = Math.min((now - state.lastTime) / 1000, 0.05);
  state.lastTime = now;
  update(dt);
  render();
  if (state.mode === 'playing') requestAnimationFrame(loop);
}

function update(dt) {
  const p = state.player;
  const a = state.ai;

  // Joystick → WASD tuşlarına çevir
  if (Input.moveJoy.active) {
    const v = Input.getMoveVector();
    Input.keys['a'] = v.x < -0.3;
    Input.keys['d'] = v.x > 0.3;
    Input.keys['w'] = v.y < -0.3;
    Input.keys['s'] = v.y > 0.3;
  }

  // Hız vektörü (AI tahmini için)
  if (p._lastX !== undefined) {
    p._pvx = (p.x - p._lastX) / dt;
    p._pvy = (p.y - p._lastY) / dt;
  }
  p._lastX = p.x;
  p._lastY = p.y;

  p.update(dt, Input.keys);

  // Joystick nişanı (mobilden)
  if (Input.aimJoy.active) {
    const a2 = Input.getAimAngle();
    if (a2 !== null) p.turretAngle = a2;
  }

  a.update(dt, {});

  // AI güncelle → ürettiği mermileri topla (BUG FIX)
  const aiBullets = AI.update(a, p, dt, state.difficulty);
  if (aiBullets && aiBullets.length) state.bullets.push(...aiBullets);

  // Oyuncu ateş: PC (mouse basılı) veya mobil (joystick bırakınca)
  if (Input.mouse.down) {
    const b = p.shoot();
    if (b) state.bullets.push(b);
  }
  if (Input.consumeFire()) {
    const b = p.shoot();
    if (b) state.bullets.push(b);
  }

  // Mermiler
  for (const b of state.bullets) {
    b.update(dt);
    const target = b.owner === 'player' ? a : p;
    if (target.alive) {
      const d = Math.hypot(b.x - target.x, b.y - target.y);
      if (d < target.radius + b.radius) {
        target.takeDamage();
        b.dead = true;
      }
    }
  }

  state.bullets = state.bullets.filter(b => !b.dead);

  if (!p.alive || !a.alive) {
    state.mode = 'over';
    state.result = p.alive ? 'win' : 'lose';
    onGameOver();
  }
}

function render() {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, W, H);

  Maze.draw(ctx);

  for (const b of state.bullets) b.draw(ctx);
  state.ai.draw(ctx);
  state.player.draw(ctx);

  drawJoysticks();
  drawUI();
}

function drawJoysticks() {
  drawJoystick(Input.moveJoy, '74,163,255');
  drawJoystick(Input.aimJoy,  '255,68,68');
}

function drawJoystick(joy, rgb) {
  if (!joy.active) return;

  // Base
  ctx.beginPath();
  ctx.arc(joy.baseX, joy.baseY, Input.JOY_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb},0.12)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},0.55)`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Knob
  ctx.beginPath();
  ctx.arc(joy.knobX, joy.knobY, Input.KNOB_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb},0.65)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},0.95)`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawUI() {
  drawHP(20, 20, state.player.hp, state.player.maxHp, '#4aa3ff', 'SEN');
  drawHP(W - 220, 20, state.ai.hp, state.ai.maxHp, '#ff4444', 'DÜŞMAN');

  // Cooldown metni
  if (state.player.shootCooldown > 0) {
    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      `ATEŞ BEKLEME: ${state.player.shootCooldown.toFixed(1)}s`,
      20, 70
    );
  } else {
    ctx.fillStyle = '#22aa22';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ATEŞ HAZIR', 20, 70);
  }
}

function drawHP(x, y, hp, maxHp, color, label) {
  ctx.fillStyle = '#111';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(label, x, y - 6);
  for (let i = 0; i < maxHp; i++) {
    ctx.fillStyle = i < hp ? color : '#cccccc';
    ctx.fillRect(x + i * 45, y, 40, 20);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + i * 45, y, 40, 20);
  }
}

function onGameOver() {
  const duration = (performance.now() - state.startTime) / 1000;

  Scores.save({
    difficulty: state.difficulty,
    result: state.result,
    duration: Math.round(duration),
    date: Date.now(),
  });

  const el = document.getElementById('gameover');
  const title = document.getElementById('go-title');
  const sub = document.getElementById('go-sub');

  if (state.result === 'win') {
    title.textContent = 'KAZANDIN!';
    title.style.color = '#2288dd';
    sub.textContent = `Süre: ${Scores.formatDuration(duration)} — Ama daha zoru var...`;
  } else {
    title.textContent = 'KAYBETTİN!';
    title.style.color = '#cc1111';
    sub.textContent = `Süre: ${Scores.formatDuration(duration)} — Tekrar dene.`;
  }

  el.classList.remove('hidden');
}

function renderScores() {
  const list = Scores.load();
  const sub = document.getElementById('scores-sub');
  const table = document.getElementById('scores-table');
  const body = document.getElementById('scores-body');

  body.innerHTML = '';

  if (list.length === 0) {
    sub.textContent = 'Henüz oynanmış oyun yok.';
    sub.style.display = 'block';
    table.classList.add('hidden');
    return;
  }

  sub.style.display = 'none';
  table.classList.remove('hidden');

  list.forEach((s, i) => {
    const tr = document.createElement('tr');
    const dLabel = s.difficulty === 'zor' ? 'ZOR'
                 : s.difficulty === 'normal' ? 'NORMAL'
                 : s.difficulty === 'impossible' ? 'İMKANSIZ'
                 : s.difficulty;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="d-${s.difficulty}">${dLabel}</td>
      <td class="${s.result === 'win' ? 'win' : 'lose'}">${s.result === 'win' ? 'KAZANDI' : 'KAYBETTİ'}</td>
      <td>${Scores.formatDuration(s.duration)}</td>
      <td>${Scores.formatDate(s.date)}</td>
    `;
    body.appendChild(tr);
  });
}

// Menü butonları
document.querySelectorAll('.diff').forEach((btn) => {
  bindTap(btn, () => {
    if (btn.classList.contains('locked')) {
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 300);
      return;
    }
    startGame(btn.dataset.diff);
  });
});

bindTap(document.getElementById('scores-btn'), () => {
  renderScores();
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('scores').classList.remove('hidden');
});

bindTap(document.getElementById('scores-back'), () => {
  document.getElementById('scores').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
});

bindTap(document.getElementById('scores-clear'), () => {
  if (confirm('Tüm skorlar silinsin mi?')) {
    Scores.clear();
    renderScores();
  }
});

bindTap(document.getElementById('go-btn'), () => {
  state.mode = 'menu';
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
});

bindTap(document.getElementById('go-again'), () => {
  startGame(state.difficulty);
});
