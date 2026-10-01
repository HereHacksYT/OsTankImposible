// Mermi: duvarlardan seker, 7 sn sonra yok olur
class Bullet {
  constructor(x, y, vx, vy, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner; // 'player' | 'ai'
    this.radius = 4;
    this.life = 7;
    this.dead = false;
    this.trail = [];
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // İz kaydı
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();

    // X ekseni: hız * dt (saniye cinsinden!)
    const nx = this.x + this.vx * dt;
    if (Maze.circleHitsWall(nx, this.y, this.radius)) {
      this.vx = -this.vx;
    } else {
      this.x = nx;
    }

    // Y ekseni
    const ny = this.y + this.vy * dt;
    if (Maze.circleHitsWall(this.x, ny, this.radius)) {
      this.vy = -this.vy;
    } else {
      this.y = ny;
    }
  }

  draw(ctx) {
    // İz
    ctx.strokeStyle = 'rgba(255, 200, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Mermi
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
