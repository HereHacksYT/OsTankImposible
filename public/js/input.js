// Klavye + mouse girdisi
const Input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false },

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });

    canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  reset() {
    this.keys = {};
    this.mouse.down = false;
  }
};
