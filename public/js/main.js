const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

Input.init(canvas);

const state = {
  mode: 'menu',       // 'menu' | 'playing' | 'over'
  difficulty: null,
  player: null,
  ai: null,
  bullets: [],
  lastTime: 0,
  result: null,
};

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
  aiTank.shootDelay = AI.configs[difficulty]?.shootInterval || 1.5;

  state.player = player;
  state.ai = aiTank;
  state.bullets = [];
  state.difficulty = difficulty;
  state.mode = 'playing';
  state.result = null;
  state.lastTime = performance.now();

  Input.reset();
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');

  requestAnimationFrame(loop);
}

function loop(now) {
  if (state.mode !== 'playing') return;

  const dt = Math.min((now - state.lastTime) / 1000, 0.05);
  state.lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  const p = state.player;
  const a = state.ai;

  // Oyuncunun hız vektörünü kaydet (AI tahmini için)
  if (p._lastX !== undefined) {
    p._pvx = (p.x - p._lastX) / dt;
    p._pvy = (p.y - p._lastY) / dt;
  }
  p._lastX = p.x;
  p._lastY = p.y;

  p.update(dt, Input.keys);
  a.update(dt, {});

  AI.update(a, p, dt, state.difficulty);

  // Oyuncu ateş
  if (Input.mouse.down) {
    const b = p.shoot();
    if (b) state.bullets.push(b);
  }

  // Mermileri güncelle + çarpışma
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

  // Oyun bitti mi?
  if (!p.alive || !a.alive) {
    state.mode = 'over';
    state.result = p.alive ? 'win' : 'lose';
    showGameOver();
  }
}

function render() {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, W, H);

  Maze.draw(ctx);

  for (const b of state.bullets) b.draw(ctx);
  state.ai.draw(ctx);
  state.player.draw(ctx);

  drawUI();
}

function drawUI() {
  drawHP(20, 20, state.player.hp, state.player.maxHp, '#4aa3ff', 'SEN');
  drawHP(W - 220, 20, state.ai.hp, state.ai.maxHp, '#ff4444', 'DÜŞMAN');
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

function showGameOver() {
  const el = document.getElementById('gameover');
  const title = document.getElementById('go-title');
  const sub = document.getElementById('go-sub');

  if (state.result === 'win') {
    title.textContent = 'KAZANDIN!';
    title.style.color = '#2288dd';
    sub.textContent = 'Ama daha zoru var...';
  } else {
    title.textContent = 'KAYBETTİN!';
    title.style.color = '#cc1111';
    sub.textContent = 'Tekrar dene.';
  }

  el.classList.remove('hidden');
}

// Menü butonları
document.querySelectorAll('.diff').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('locked')) {
      // İmkansız: hiçbir şey olmasın, sadece salla
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 300);
      return;
    }
    startGame(btn.dataset.diff);
  });
});

document.getElementById('go-btn').addEventListener('click', () => {
  state.mode = 'menu';
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
});
