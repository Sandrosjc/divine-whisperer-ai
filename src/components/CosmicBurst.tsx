import { useEffect, useRef } from "react";

/** Full-screen golden supernova + star rain, then fades out. */
export function CosmicBurst({ name, onDone }: { name: string; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = (c.width = window.innerWidth), H = (c.height = window.innerHeight);
    const css = getComputedStyle(document.documentElement);
    const gold = css.getPropertyValue("--gold").trim() || "oklch(0.78 0.13 85)";
    const hues = [gold, "oklch(0.85 0.1 60)", "oklch(0.75 0.15 320)", "oklch(0.8 0.12 220)", "oklch(0.95 0.03 90)"];
    type P = { x: number; y: number; vx: number; vy: number; life: number; r: number; col: string; rain?: boolean };
    const ps: P[] = [];
    const cx = W / 2, cy = H / 2;
    const n = reduce ? 60 : 420;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 11 + 1;
      ps.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, r: Math.random() * 2.4 + 0.6, col: hues[i % hues.length] as string });
    }
    let t = 0, raf = 0;
    const loop = () => {
      t++;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      if (t < 18) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, t * 40); g.addColorStop(0, "rgba(255,240,200,0.9)"); g.addColorStop(1, "rgba(212,175,55,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (!reduce && t < 160 && t % 2 === 0) for (let k = 0; k < 6; k++) ps.push({ x: Math.random() * W, y: -10, vx: -1.5, vy: Math.random() * 6 + 4, life: 1, r: Math.random() * 1.6 + 0.4, col: gold, rain: true });
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (!p.rain) { p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.04; p.life -= 0.006; } else p.life -= 0.004;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.rain) { ctx.strokeStyle = p.col; ctx.lineWidth = p.r * 0.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 6, p.y - 20); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      if (t < 260) raf = requestAnimationFrame(loop); else done.current();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 bg-background/80 animate-[fade-out_0.8s_ease-in_3.6s_forwards]">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-5xl text-gold opacity-0 animate-[cosmic-name_3.8s_ease-out_0.3s_forwards] md:text-7xl">{name}</p>
    </div>
  );
}
