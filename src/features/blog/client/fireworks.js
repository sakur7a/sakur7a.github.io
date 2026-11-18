export function mountFireworks() {
  const canvas = document.getElementById("J_firework_canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let particles = [];
  const colors = ["#6ee7b7", "#93c5fd", "#fde68a", "#fca5a5"];

  function resize() {
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function spawn() {
    var rect = canvas.getBoundingClientRect();
    var x = Math.random() * rect.width;
    var y = 40 + Math.random() * (rect.height - 80);
    for (var i = 0; i < 18; i += 1) {
      particles.push({
        x: x,
        y: y,
        vx: Math.cos((Math.PI * 2 * i) / 18) * (0.7 + Math.random() * 1.6),
        vy: Math.sin((Math.PI * 2 * i) / 18) * (0.7 + Math.random() * 1.6),
        life: 42,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function tick() {
    var rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (Math.random() < 0.018) spawn();

    particles = particles.filter(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.018;
      p.life -= 1;
      ctx.globalAlpha = Math.max(0, p.life / 42);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      return p.life > 0;
    });

    ctx.globalAlpha = 1;
    window.requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  window.requestAnimationFrame(tick);
}
