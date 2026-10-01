// Labirent üretimi ve duvar kontrolü
const Maze = {
  TILE: 40,
  cols: 24,
  rows: 16,
  grid: [],

  generate() {
    let attempts = 0;
    do {
      this._generateRaw();
      attempts++;
    } while (!this.isConnected() && attempts < 25);
  },

  _generateRaw() {
    const { cols, rows } = this;
    this.grid = [];

    // Kenarlar duvar, içerisi boş
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) row.push(1);
        else row.push(0);
      }
      this.grid.push(row);
    }

    // İçeriye rastgele bloklar
    const count = 32;
    for (let i = 0; i < count; i++) {
      const x = 1 + Math.floor(Math.random() * (cols - 2));
      const y = 1 + Math.floor(Math.random() * (rows - 2));
      if (this.grid[y][x] === 0) this.grid[y][x] = 1;
    }

    // Spawn bölgelerini temizle
    this.clearArea(2, 1, 3, 2);              // AI: sol-üst
    this.clearArea(cols - 5, rows - 3, 3, 2); // Oyuncu: sağ-alt
  },

  clearArea(x, y, w, h) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (j > 0 && j < this.rows - 1 && i > 0 && i < this.cols - 1) {
          this.grid[j][i] = 0;
        }
      }
    }
  },

  // İki spawn arasında yol var mı? (flood fill)
  isConnected() {
    const start = { x: 3, y: 2 };
    const end = { x: this.cols - 4, y: this.rows - 3 };
    if (this.grid[start.y][start.x] === 1) return false;
    if (this.grid[end.y][end.x] === 1) return false;

    const visited = new Set();
    const stack = [start];
    const key = (p) => p.x + ',' + p.y;

    while (stack.length) {
      const p = stack.pop();
      if (visited.has(key(p))) continue;
      visited.add(key(p));
      if (p.x === end.x && p.y === end.y) return true;

      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of dirs) {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        if (this.grid[ny][nx] === 1) continue;
        if (visited.has(nx + ',' + ny)) continue;
        stack.push({ x: nx, y: ny });
      }
    }
    return false;
  },

  isWallTile(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return true;
    return this.grid[cy][cx] === 1;
  },

  isWallAt(px, py) {
    const cx = Math.floor(px / this.TILE);
    const cy = Math.floor(py / this.TILE);
    return this.isWallTile(cx, cy);
  },

  // Daire duvara temas ediyor mu? (4 köşe kontrolü)
  circleHitsWall(px, py, r) {
    return (
      this.isWallAt(px - r, py - r) ||
      this.isWallAt(px + r, py - r) ||
      this.isWallAt(px - r, py + r) ||
      this.isWallAt(px + r, py + r)
    );
  },

  draw(ctx) {
    const T = this.TILE;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === 1) {
          ctx.fillStyle = '#2a2a3a';
          ctx.fillRect(x * T, y * T, T, T);
          ctx.strokeStyle = '#4a4a6a';
          ctx.lineWidth = 2;
          ctx.strokeRect(x * T + 1, y * T + 1, T - 2, T - 2);
        }
      }
    }
  }
};
