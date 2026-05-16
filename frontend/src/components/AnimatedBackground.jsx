import { useEffect, useRef } from "react";

export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;
    let W, H, t = 0;

    const STARS = [];
    const PARTICLES = [];
    const ORBS = [];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function rand(min, max) { return Math.random() * (max - min) + min; }

    function initStars() {
      STARS.length = 0;
      for (let i = 0; i < 180; i++) {
        STARS.push({
          x: rand(0, W), y: rand(0, H),
          r: rand(0.3, 1.4),
          alpha: rand(0.2, 0.9),
          twinkle: rand(0.5, 2),
          phase: rand(0, Math.PI * 2),
        });
      }
    }

    function initParticles() {
      PARTICLES.length = 0;
      for (let i = 0; i < 60; i++) {
        PARTICLES.push({
          x: rand(0, W), y: rand(0, H),
          vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25),
          r: rand(1, 2),
          alpha: rand(0.3, 0.8),
        });
      }
    }

    function initOrbs() {
      ORBS.length = 0;
      const colors = [
        [240, 192, 64],   // gold
        [74, 158, 255],   // blue
        [34, 211, 160],   // teal
      ];
      for (let i = 0; i < 3; i++) {
        ORBS.push({
          x: rand(W * 0.1, W * 0.9),
          y: rand(H * 0.1, H * 0.9),
          r: rand(200, 380),
          color: colors[i],
          speed: rand(0.0003, 0.0008),
          phase: rand(0, Math.PI * 2),
        });
      }
    }

    resize();
    initStars();
    initParticles();
    initOrbs();

    function draw() {
      t += 0.01;
      ctx.clearRect(0, 0, W, H);

      // ── Base background ──────────────────────────────────
      ctx.fillStyle = "#010205";
      ctx.fillRect(0, 0, W, H);

      // ── Ambient orbs (aurora effect) ─────────────────────
      ORBS.forEach((orb) => {
        const ox = orb.x + Math.sin(t * orb.speed * 100 + orb.phase) * 120;
        const oy = orb.y + Math.cos(t * orb.speed * 80 + orb.phase * 1.3) * 80;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.r);
        const [r, gr, b] = orb.color;
        g.addColorStop(0, `rgba(${r},${gr},${b},0.06)`);
        g.addColorStop(0.4, `rgba(${r},${gr},${b},0.025)`);
        g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });

      // ── Fine grid ─────────────────────────────────────────
      ctx.strokeStyle = "rgba(240,192,64,0.03)";
      ctx.lineWidth = 0.5;
      const gs = 70;
      for (let x = 0; x < W; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // ── Stars ─────────────────────────────────────────────
      STARS.forEach((s) => {
        const a = s.alpha * (0.6 + 0.4 * Math.sin(t * s.twinkle + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      });

      // ── Particle connections ──────────────────────────────
      for (let i = 0; i < PARTICLES.length; i++) {
        for (let j = i + 1; j < PARTICLES.length; j++) {
          const dx = PARTICLES[i].x - PARTICLES[j].x;
          const dy = PARTICLES[i].y - PARTICLES[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(240,192,64,${(1 - dist / 130) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(PARTICLES[i].x, PARTICLES[i].y);
            ctx.lineTo(PARTICLES[j].x, PARTICLES[j].y);
            ctx.stroke();
          }
        }
      }

      // ── Particles ─────────────────────────────────────────
      PARTICLES.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,192,64,${p.alpha})`;
        ctx.fill();
      });

      // ── Vignette ─────────────────────────────────────────
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.9);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,5,0.65)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      animId = requestAnimationFrame(draw);
    }

    draw();

    function onResize() { resize(); initStars(); initParticles(); initOrbs(); }
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: "#010205",
        pointerEvents: "none",
      }}
    />
  );
}
