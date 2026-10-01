const Input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false },

  // Dokunmatik: sol yarı hareket, sağ yarı nişan+ateş
  moveTouch: null,  // { id, x, y }
  aimTouch: null,   // { id, x, y }
  canvas: null,

  init(canvas) {
    this.canvas = canvas;

    // Klavye
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Fare
    canvas.addEventListener('mousemove', (e) => {
      const p = this._toCanvas(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.pointerType === 'touch') return;
      this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pointer olayları (dokunmatik + kalem)
    canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    canvas.addEventListener('pointermove', (e) => this._onMove(e));
    canvas.addEventListener('pointerup', (e) => this._onUp(e));
    canvas.addEventListener('pointercancel', (e) => this._onUp(e));
    canvas.addEventListener('pointerleave', (e) => this._onUp(e));
  },

  _toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (this.canvas.width / r.width),
      y: (clientY - r.top) * (this.canvas.height / r.height),
    };
  },

  _onDown(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const p = this._toCanvas(e.clientX, e.clientY);
    const half = this.canvas.width / 2;

    if (p.x < half && !this.moveTouch) {
      this.moveTouch = { id: e.pointerId, x: p.x, y: p.y };
    } else if (p.x >= half && !this.aimTouch) {
      this.aimTouch = { id: e.pointerId, x: p.x, y: p.y };
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
    }
  },

  _onMove(e) {
    if (e.pointerType === 'mouse') return;
    const p = this._toCanvas(e.clientX, e.clientY);

    if (this.moveTouch && this.moveTouch.id === e.pointerId) {
      this.moveTouch.x = p.x;
      this.moveTouch.y = p.y;
    }
    if (this.aimTouch && this.aimTouch.id === e.pointerId) {
      this.aimTouch.x = p.x;
      this.aimTouch.y = p.y;
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    }
  },

  _onUp(e) {
    if (e.pointerType === 'mouse') return;
    if (this.moveTouch && this.moveTouch.id === e.pointerId) this.moveTouch = null;
    if (this.aimTouch && this.aimTouch.id === e.pointerId) {
      this.aimTouch = null;
      this.mouse.down = false;
    }
  },

  // Dokunmatik hareketi WASD tuşlarına çevir
  applyTouchMovement(player) {
    if (!this.moveTouch || !player) return;

    const dx = this.moveTouch.x - player.x;
    const dy = this.moveTouch.y - player.y;
    const len = Math.hypot(dx, dy);

    if (len < 15) {
      this.keys['w'] = this.keys['a'] = this.keys['s'] = this.keys['d'] = false;
      return;
    }

    const fx = dx / len;
    const fy = dy / len;

    this.keys['d'] = fx > 0.38;
    this.keys['a'] = fx < -0.38;
    this.keys['s'] = fy > 0.38;
    this.keys['w'] = fy < -0.38;
  },

  reset() {
    this.keys = {};
    this.mouse.down = false;
    this.moveTouch = null;
    this.aimTouch = null;
  },
};
