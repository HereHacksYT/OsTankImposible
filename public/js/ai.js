const AI = {
  configs: {
    normal: {
      reactionTime: 0.5,
      aimError: 0.35,
      preferredDist: 260,
      shootInterval: 4.0,
      leadPrediction: false,
      leadFactor: 0,
      raycast: false,
    },
    zor: {
      reactionTime: 0.22,
      aimError: 0.12,
      preferredDist: 220,
      shootInterval: 3.0,
      leadPrediction: true,
      leadFactor: 0.6,
      raycast: false,
    },
    impossible: {
      reactionTime: 0.06,
      aimError: 0.02,
      preferredDist: 240,
      shootInterval: 2.5,
      leadPrediction: true,
      leadFactor: 1.0,
      raycast: true,
      raycastInterval: 0.08,
      posInterval: 0.45,
      maxBounces: 3,
      dodge: true,
      speedBoost: 180,
    },
  },

  update(tank, player, dt, difficulty, bullets) {
    const newBullets = [];
    if (!tank.alive || !player.alive) return newBullets;

    const cfg = this.configs[difficulty] || this.configs.normal;

    tank._thinkTimer   = (tank._thinkTimer   || 0) - dt;
    tank._shootTimer   = (tank._shootTimer   || 0) - dt;
    tank._raycastTimer = (tank._raycastTimer || 0) - dt;
    tank._posTimer     = (tank._posTimer     || 0) - dt;

    if (cfg.raycast) {
      this._updateImpossible(tank, player, dt, cfg, newBullets, bullets || []);
    } else {
      this._updateNormal(tank, player, dt, cfg, newBullets);
    }

    return newBullets;
  },

  // ================= İMKANSIZ =================
  _updateImpossible(tank, player, dt, cfg, newBullets, bullets) {
    // Hız artışı
    tank.speed = cfg.speedBoost;

    // === 1) RAYCAST ===
    if (tank._raycastTimer <= 0) {
      tank._raycastTimer = cfg.raycastInterval;
      tank._bestShots = RayCast.findBestShots(
        tank.x, tank.y, player,
        player._pvx || 0, player._pvy || 0,
        cfg.maxBounces, 80
      );
    }

    // === 2) POZİSYON OPTİMİZASYONU (seyrek) ===
    if (tank._posTimer <= 0) {
      tank._posTimer = cfg.posInterval;
      const best = RayCast.findBestPosition(tank, player, bullets, cfg.maxBounces);
      if (best) tank._bestPos = best;
    }

    // === 3) THREAT: gelen mermi var mı? ===
    const enemyBullets = bullets.filter(b => b.owner === 'player');
    let threatened = false;
    if (enemyBullets.length > 0) {
      threatened = RayCast.isDangerousAt(
        tank.x, tank.y, tank.radius + 8,
        enemyBullets, 1.2
      );
    }

    if (threatened) {
      // Güvenli yöne kaç
      const safeDirs = RayCast.findSafeDirections(tank, enemyBullets, 1.2);
      if (safeDirs.length > 0) {
        // En yakın güvenli yön (mevcut yönde devam etmeyi tercih et)
        let bestDir = safeDirs[0];
        let bestScore = Infinity;
        for (const d of safeDirs) {
          const dx = d.x - tank.x;
          const dy = d.y - tank.y;
          // Body angle ile uyum skoru
          const moveAngle = Math.atan2(dy, dx);
          let diff = moveAngle - tank.bodyAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const score = Math.abs(diff);
          if (score < bestScore) {
            bestScore = score;
            bestDir = d;
          }
        }
        const dx = bestDir.x - tank.x;
        const dy = bestDir.y - tank.y;
        const len = Math.hypot(dx, dy) || 1;
        tank.aiMoveF = -dy / len;
        tank.aiMoveS = dx / len;
      } else {
        // Sıkıştık: geri git + strafe
        tank.aiMoveF = -1;
        tank.aiMoveS = (Math.random() < 0.5 ? 1 : -1) * 1.0;
      }

      // Yine de ateş edebiliyorsak et (kaçarken bile)
      if (tank._bestShots && tank._bestShots.length > 0 && tank._shootTimer <= 0) {
        const best = tank._bestShots[0];
        tank.aiTurretAngle = best.angle;
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      }
      return;
    }

    // === 4) ATIŞ VAR MI? ===
    const shots = tank._bestShots || [];

    if (shots.length > 0) {
      const best = shots[0];
      const err = (Math.random() - 0.5) * 2 * cfg.aimError;
      tank.aiTurretAngle = best.angle + err;

      if (tank._shootTimer <= 0) {
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      }

      // Best position'a git (varsa)
      if (tank._bestPos &&
          Math.hypot(tank._bestPos.x - tank.x, tank._bestPos.y - tank.y) > 20) {
        const dx = tank._bestPos.x - tank.x;
        const dy = tank._bestPos.y - tank.y;
        const len = Math.hypot(dx, dy);
        tank.aiMoveF = -dy / len;
        tank.aiMoveS = dx / len;
      } else {
        // Strafe (zor hedef olmak için)
        if (!tank._strafe || Math.random() < 0.08) {
          tank._strafe = Math.random() < 0.5 ? 1 : -1;
        }
        tank.aiMoveF = 0;
        tank.aiMoveS = tank._strafe * 1.0;
      }
    } else {
      // === 5) VURUŞ YOK → OYUNCUYA YAKLAŞ ===
      tank.aiMoveF = 1;
      if (!tank._strafe || Math.random() < 0.12) {
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
      }
      tank.aiMoveS = tank._strafe * 0.6;

      if (tank._thinkTimer <= 0) {
        tank._thinkTimer = cfg.reactionTime;
        tank.aiTurretAngle = Math.atan2(player.y - tank.y, player.x - tank.x);
      }
    }

    // === 6) AKILLI DODGE ===
    // Oyuncunun turret açısı bize bakıyor mu VE ateş edebilir durumda mı?
    if (cfg.dodge && player.shootCooldown < 1.5) {
      const playerToAI = Math.atan2(tank.y - player.y, tank.x - player.x);
      let diff = player.turretAngle - playerToAI;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Oyuncunun bize direkt görüşü var mı?
      const los = this.hasLineOfSight(player, tank);

      if (los && Math.abs(diff) < 0.35) {
        // Ateş edecek! Yana kaç
        tank._strafe = Math.random() < 0.5 ? 1 : -1;
        tank.aiMoveS = tank._strafe * 1.3;
        if (tank.aiMoveF > 0) tank.aiMoveF = -0.4;
      }
    }
  },

  // ================= NORMAL / ZOR =================
  _updateNormal(tank, player, dt, cfg, newBullets) {
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

      tank.aiMoveF = moveF;
      tank.aiMoveS = tank._strafe * 0.7;
    }

    if (tank._shootTimer <= 0) {
      if (this.hasLineOfSight(tank, player)) {
        const b = tank.shoot();
        if (b) newBullets.push(b);
        tank._shootTimer = cfg.shootInterval;
      } else {
        tank._shootTimer = 0.2;
      }
    }
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
