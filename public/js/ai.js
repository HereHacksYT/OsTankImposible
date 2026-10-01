const AI = {
  configs: {
    normal: {
      reactionTime: 0.5,
      aimError: 0.35,
      preferredDist: 260,
      shootInterval: 4.0,   // 5sn oyuncuya karşı 4sn
      leadPrediction: false,
      leadFactor: 0,
    },
    zor: {
      reactionTime: 0.22,
      aimError: 0.12,
      preferredDist: 220,
      shootInterval: 3.0,   // 5sn oyuncuya karşı 3sn
      leadPrediction: true,
      leadFactor: 0.6,
    },
  },

  update(tank, player, dt, difficulty) {
    const newBullets = [];
    if (!tank.alive || !player.alive) return newBullets;

    const cfg = this.configs[difficulty] || this.configs.normal;

    tank._thinkTimer = (tank._thinkTimer || 0) - dt;
    tank._shootTimer = (tank._shootTimer || 0) - dt;

    if (tank._thinkTimer <= 0) {
      tank._thinkTimer = cfg.reactionTime;

      const aim = this.predictAim(tank, player, cfg);
      const err = (Math.random() - 0.5) * 2 * cfg.aimError;
      tank.aiTurretAngle = aim + err;

      const dx = player.x - tank.x;
      const dy = player.y - tank.y;
      const dist = Math.hypot(dx, dy);

      let moveF = 0;
      if (dist > cfg.preferredDist + 60) moveF = 1;
      else if (dist < cfg.preferredDist - 60) moveF = -1;

      if (!tank._strafe || Math.random() < 0.25) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }
      const moveS = tank._strafe * 0.7;

      tank.aiMoveF = moveF;
      tank.aiMoveS = moveS;
    }

    // Ateş (mermi üret → dizide döndür)
    if (tank._shootTimer <= 0) {
      if (this.hasLineOfSight(tank, player)) {
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      } else {
        tank._shootTimer = 0.2;
      }
    }

    return newBullets;
  },

  predictAim(tank, player, cfg) {
    const dx = player.x - tank.x;
    const dy = player.y - tank.y;
    const dist = Math.hypot(dx, dy);
    const time = dist / BULLET_SPEED;

    let px = player.x;
    let py = player.y;

    if (cfg.leadPrediction && player._pvx !== undefined) {
      px += player._pvx * time * cfg.leadFactor;
      py += player._pvy * time * cfg.leadFactor;
    }

    return Math.atan2(py - tank.y, px - tank.x);
  },

  hasLineOfSight(a, b) {
    const steps = 20;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (Maze.isWallAt(x, y)) return false;
    }
    return true;
  },
};
