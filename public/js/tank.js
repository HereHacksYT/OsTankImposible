// Mermi hızı — global sabit (ai.js de kullanıyor)
const BULLET_SPEED = 150; // oyuncu hızıyla aynı (px/sn)

class Tank {
  constructor(x, y, color, isPlayer) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.color = color;
    this.isPlayer = isPlayer;

    this.bodyAngle = 0;
    this.turretAngle = 0;

    this.speed = 130;
    this.rotSpeed = 6;
    this.turretRotSpeed = 7;

    this.hp = 3;
    this.maxHp = 3;

    this.shootCooldown = 0;
    this.shootDelay = isPlayer ? 5.0 : 2.0;

    this.alive = true;

    this.aiMoveF = 0;
    this.aiMoveS = 0;
    this.aiTurretAngle = undefined;
  }

  update(dt, keys) {
    if (!this.alive) return;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);

    let moveF = 0, moveS = 0;

    if (this.isPlayer) {
      // Klavye (PC)
      if (keys['w']) moveF += 1;
      if (keys['s']) moveF -= 1;
      if (keys['a']) moveS -= 1;
      if (keys['d']) moveS += 1;

      // Fare nişanı (PC) — sadece mouse aktifse
      if (Input.mouseActive && !Input.aimJoy.active) {
        this.turretAngle = Math.atan2(
          Input.mouse.y - this.y,
          Input.mouse.x - this.x
        );
      }
    } else {
      moveF = this.aiMoveF;
      moveS = this.aiMoveS;
      if (this.aiTurretAngle !== undefined) {
        const diff = this.angleDiff(this.turretAngle, this.aiTurretAngle);
        const step = Math.sign(diff) * Math.min(Math.abs(diff), this.turretRotSpeed * dt);
        this.turretAngle += step;
      }
    }

    if (moveF !== 0 || moveS !== 0) {
      const len = Math.hypot(moveF, moveS);
      const dx = moveS / len;
      const dy = -moveF / len;

      const targetAngle = Math.atan2(dy, dx);
      const diff = this.angleDiff(this.bodyAngle, targetAngle);
      const step = Math.sign(diff) * Math.min(Math.abs(diff), this.rotSpeed * dt);
      this.bodyAngle += step;

      const vx = dx * this.speed * dt;
      const vy = dy * this.speed * dt;

      const nx = this.x + vx;
      if (!Maze.circleHitsWall(nx, this.y, this.radius)) this.x = nx;

      const ny = this.y + vy;
      if (!Maze.circleHitsWall(this.x, ny, this.radius)) this.y = ny;
    }
  }

  angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  shoot() {
    if (this.shootCooldown > 0 || !this.alive) return null;
    this.shootCooldown = this.shootDelay;

    const muzzle = this.radius + 12;
    const bx = this.x + Math.cos(this.turretAngle) * muzzle;
    const by = this.y + Math.sin(this.turretAngle) * muzzle;

    return new Bullet(
      bx, by,
      Math.cos(this.turretAngle) * BULLET_SPEED,
      Math.sin(this.turretAngle) * BULLET_SPEED,
      this.isPlayer ? 'player' : 'ai'
    );
  }

  takeDamage() {
    this.hp--;
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.save();
    ctx.rotate(this.bodyAngle);
    ctx.fillStyle = this.color;
    ctx.fillRect(-14, -12, 28, 24);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-14, -12, 28, 24);
    ctx.restore();

    ctx.save();
    ctx.rotate(this.turretAngle);
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, -3, 26, 6);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Cooldown göstergesi (oyuncu için)
    if (this.isPlayer && this.shootCooldown > 0) {
      const pct = 1 - (this.shootCooldown / this.shootDelay);
      ctx.beginPath();
      ctx.arc(0, 0, 22, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * pct);
      ctx.strokeStyle = pct >= 1 ? '#44dd44' : '#ffaa22';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (this.isPlayer) {
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.strokeStyle = '#44dd44';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }
}
