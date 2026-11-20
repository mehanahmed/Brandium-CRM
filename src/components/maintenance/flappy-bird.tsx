"use client";

import { useEffect, useRef, useState } from "react";

// Logical size; the canvas is scaled to its box and to the screen's pixel density.
const W = 360;
const H = 480;
const GROUND = 44;
const BIRD_X = 96;
const BIRD_R = 13;
const GRAVITY = 1500; // px/s²
const FLAP = -430; // px/s
const SPEED = 150; // px/s
const PIPE_W = 58;
const GAP = 140;
const PIPE_EVERY = 1.45; // seconds between pipes
const BEST_KEY = "brandium_flappy_best";

type Pipe = { x: number; gapY: number; scored: boolean };
type Phase = "ready" | "playing" | "over";

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

/** Flappy Bird for the maintenance screen. Tap, click, Space or ↑ to flap. */
export function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  // All game state lives in a ref so the animation loop never re-renders React
  const game = useRef({
    phase: "ready" as Phase,
    y: H / 2,
    vy: 0,
    pipes: [] as Pipe[],
    spawn: 0,
    score: 0,
    groundX: 0,
    t: 0,
  });

  useEffect(() => setBest(readBest()), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const g = game.current;
    const setGamePhase = (p: Phase) => {
      g.phase = p;
    };

    const reset = () => {
      g.y = H / 2;
      g.vy = 0;
      g.pipes = [];
      g.spawn = 0.6;
      g.score = 0;
      setScore(0);
    };

    const flap = () => {
      if (g.phase === "over") {
        reset();
        setGamePhase("ready");
        return;
      }
      if (g.phase === "ready") setGamePhase("playing");
      g.vy = FLAP;
    };

    const crash = () => {
      setGamePhase("over");
      if (g.score > readBest()) {
        try {
          localStorage.setItem(BEST_KEY, String(g.score));
        } catch {
          // storage blocked: the best score just isn't kept
        }
        setBest(g.score);
      }
    };

    const update = (dt: number) => {
      g.t += dt;
      if (g.phase !== "over") g.groundX = (g.groundX - SPEED * dt) % 24;
      if (g.phase === "ready") {
        g.y = H / 2 + Math.sin(g.t * 4) * 8; // idle bob
        return;
      }
      if (g.phase === "over" && g.y >= H - GROUND - BIRD_R) return;

      g.vy += GRAVITY * dt;
      g.y = Math.max(BIRD_R, g.y + g.vy * dt);
      if (g.y >= H - GROUND - BIRD_R) {
        g.y = H - GROUND - BIRD_R;
        if (g.phase === "playing") crash();
        return;
      }
      if (g.phase !== "playing") return;

      g.spawn -= dt;
      if (g.spawn <= 0) {
        g.spawn = PIPE_EVERY;
        const min = 70;
        const max = H - GROUND - 70 - GAP;
        g.pipes.push({ x: W, gapY: min + Math.random() * (max - min), scored: false });
      }
      for (const p of g.pipes) {
        p.x -= SPEED * dt;
        if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.scored = true;
          g.score += 1;
          setScore(g.score);
        }
        // Circle vs the two pipe rectangles (closest-point test)
        const cx = Math.max(p.x, Math.min(BIRD_X, p.x + PIPE_W));
        for (const [top, bottom] of [
          [0, p.gapY],
          [p.gapY + GAP, H - GROUND],
        ] as const) {
          const cy = Math.max(top, Math.min(g.y, bottom));
          if ((BIRD_X - cx) ** 2 + (g.y - cy) ** 2 < (BIRD_R - 2) ** 2) crash();
        }
      }
      g.pipes = g.pipes.filter((p) => p.x + PIPE_W > -10);
    };

    const draw = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0b3364");
      sky.addColorStop(1, "#3b6ea5");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Clouds drifting slowly
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let i = 0; i < 4; i++) {
        const span = W + 120;
        const x = ((((i * 120 - g.t * 18) % span) + span) % span) - 60;
        ctx.beginPath();
        ctx.ellipse(x, 70 + i * 55, 46, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of g.pipes) {
        for (const [y, h, capY] of [
          [0, p.gapY, p.gapY - 18],
          [p.gapY + GAP, H - GROUND - p.gapY - GAP, p.gapY + GAP],
        ] as const) {
          ctx.fillStyle = "#67B239";
          ctx.fillRect(p.x, y, PIPE_W, h);
          ctx.fillStyle = "#5aa030";
          ctx.fillRect(p.x + PIPE_W - 10, y, 10, h);
          ctx.fillStyle = "#7ac142";
          ctx.fillRect(p.x - 4, capY, PIPE_W + 8, 18);
        }
      }

      // Ground
      ctx.fillStyle = "#d9c38a";
      ctx.fillRect(0, H - GROUND, W, GROUND);
      ctx.fillStyle = "#67B239";
      ctx.fillRect(0, H - GROUND, W, 8);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let x = g.groundX; x < W; x += 24) ctx.fillRect(x, H - GROUND + 14, 12, 4);

      // Bird, tilted by its speed
      ctx.save();
      ctx.translate(BIRD_X, g.y);
      ctx.rotate(Math.max(-0.5, Math.min(1.2, g.vy / 600)));
      ctx.fillStyle = "#f6c23e";
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0a500";
      ctx.beginPath();
      ctx.ellipse(-4, 3 + Math.sin(g.t * 20) * 2, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(5, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a2e5c";
      ctx.beginPath();
      ctx.arc(6.5, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef6c2f";
      ctx.beginPath();
      ctx.moveTo(BIRD_R - 2, 0);
      ctx.lineTo(BIRD_R + 7, 3);
      ctx.lineTo(BIRD_R - 2, 6);
      ctx.fill();
      ctx.restore();

      // Score
      ctx.textAlign = "center";
      ctx.font = "bold 40px system-ui, sans-serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(10,46,92,0.8)";
      ctx.fillStyle = "#fff";
      if (g.phase !== "ready") {
        ctx.strokeText(String(g.score), W / 2, 64);
        ctx.fillText(String(g.score), W / 2, 64);
      }
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.lineWidth = 4;
      const message =
        g.phase === "ready"
          ? "Tap or press Space to fly"
          : g.phase === "over"
            ? "Game over · tap to retry"
            : "";
      if (message) {
        ctx.strokeText(message, W / 2, H / 2 + 70);
        ctx.fillText(message, W / 2, H / 2 + 70);
      }
    };

    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      // Cap the step so a background tab does not make the bird jump through pipes
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      update(dt);
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      flap();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      flap();
    };
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="w-full max-w-90">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Flappy Bird game. Press Space or tap to flap."
        className="block aspect-3/4 w-full touch-none select-none rounded-xl shadow-lg cursor-pointer"
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground" aria-live="polite">
        <span>Score: {score}</span>
        <span>Best: {Math.max(best, score)}</span>
      </div>
    </div>
  );
}
