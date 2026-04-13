<template>
  <canvas ref="canvas" class="city-bg" />
</template>

<script setup lang="ts">
// ============================================================================
// Animated Neon City background
// ----------------------------------------------------------------------------
// Parallax city skyline rendered on canvas:
//   * 3 depth layers with silhouettes (far / mid / near)
//   * Windows that light up and switch off at random
//   * Street lamps that flicker
//   * Neon rooftop signs that glitch / flicker
//   * Drifting drones / aircraft lights across the sky
//   * Subtle moon glow + atmospheric haze
// ============================================================================

const canvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;

interface Window2D {
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
  color: string;          // tint when on
  nextToggle: number;     // t at which to flip state
}

interface Building {
  x: number;
  width: number;
  height: number;
  baseColor: string;      // silhouette fill
  windows: Window2D[];
  sign?: NeonSign;
  antenna?: boolean;
}

interface NeonSign {
  text: string;
  color: string;
  x: number;
  y: number;
  size: number;
  phase: number;          // flicker phase
  glitchUntil: number;    // time until this sign "glitches off"
}

interface StreetLamp {
  x: number;
  y: number;
  color: string;
  flicker: number;        // 0..1 brightness multiplier
  nextFlicker: number;
}

interface Drone {
  x: number;
  y: number;
  vx: number;
  color: string;
  blink: number;
  size: number;
}

const NEON_PALETTE = [
  "#ff2bd6", // hot pink
  "#00e5ff", // cyan
  "#b347ff", // purple
  "#ffae00", // amber
  "#00ff9c", // green
  "#ff3860", // red
];

const WINDOW_COLORS = [
  "rgba(255, 220, 120, 0.9)", // warm
  "rgba(200, 230, 255, 0.85)", // cool
  "rgba(255, 180, 100, 0.9)",  // amber
  "rgba(180, 255, 230, 0.8)",  // mint
];

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const SIGN_WORDS = [
  "BANK", "RAMEN", "TOKYO", "NEON", "LOFT", "24H",
  "CLUB", "FINANZ", "KREDIT", "CASH", "LIFE", "OS",
  "電", "円", "BAR", "HOTEL",
];

onMounted(() => {
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext("2d")!;

  let width = 0;
  let height = 0;
  let horizon = 0;

  // Build layers — regenerated on resize
  let farBuildings: Building[] = [];
  let midBuildings: Building[] = [];
  let nearBuildings: Building[] = [];
  let lamps: StreetLamp[] = [];
  let drones: Drone[] = [];

  const buildWindows = (
    bx: number,
    bw: number,
    bh: number,
    topY: number,
    density: number,
    litChance: number,
  ): Window2D[] => {
    const cols = Math.max(2, Math.floor(bw / (8 + Math.random() * 6)));
    const rows = Math.max(3, Math.floor(bh / (10 + Math.random() * 8)));
    const padX = bw * 0.12;
    const padY = bh * 0.08;
    const cellW = (bw - padX * 2) / cols;
    const cellH = (bh - padY * 2) / rows;
    const winW = cellW * 0.55;
    const winH = cellH * 0.55;
    const out: Window2D[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // sprinkle density — skip some cells
        if (Math.random() > density) continue;
        const x = bx + padX + c * cellW + (cellW - winW) / 2;
        const y = topY + padY + r * cellH + (cellH - winH) / 2;
        out.push({
          x,
          y,
          w: winW,
          h: winH,
          on: Math.random() < litChance,
          color: pick(WINDOW_COLORS),
          nextToggle: Math.random() * 20 + 2,
        });
      }
    }
    return out;
  };

  const buildLayer = (
    count: number,
    minH: number,
    maxH: number,
    minW: number,
    maxW: number,
    yBase: number,
    silhouette: string,
    windowDensity: number,
    litChance: number,
    signChance: number,
  ): Building[] => {
    const buildings: Building[] = [];
    let x = -30;
    while (x < width + 30 && buildings.length < count) {
      const w = minW + Math.random() * (maxW - minW);
      const h = minH + Math.random() * (maxH - minH);
      const topY = yBase - h;
      const b: Building = {
        x,
        width: w,
        height: h,
        baseColor: silhouette,
        windows: buildWindows(x, w, h, topY, windowDensity, litChance),
        antenna: Math.random() < 0.3,
      };
      if (Math.random() < signChance && w > 40) {
        const text = pick(SIGN_WORDS);
        b.sign = {
          text,
          color: pick(NEON_PALETTE),
          x: x + w / 2,
          y: topY + Math.min(20, h * 0.15),
          size: Math.max(10, Math.min(22, w * 0.18)),
          phase: Math.random() * Math.PI * 2,
          glitchUntil: 0,
        };
      }
      buildings.push(b);
      x += w - 2; // slight overlap so skyline reads as continuous
    }
    return buildings;
  };

  const buildLamps = (): StreetLamp[] => {
    const out: StreetLamp[] = [];
    const lampY = horizon + (height - horizon) * 0.55;
    const spacing = 90 + Math.random() * 40;
    for (let x = 30; x < width; x += spacing + Math.random() * 30) {
      out.push({
        x,
        y: lampY,
        color: Math.random() < 0.3 ? "#ff7a00" : "#fff1b0",
        flicker: 1,
        nextFlicker: Math.random() * 5,
      });
    }
    return out;
  };

  const buildDrones = (): Drone[] => {
    const out: Drone[] = [];
    for (let i = 0; i < 6; i++) {
      out.push({
        x: Math.random() * width,
        y: 40 + Math.random() * (horizon * 0.6),
        vx: 0.3 + Math.random() * 0.7,
        color: Math.random() < 0.5 ? "#ff3b3b" : "#6bf",
        blink: Math.random() * 10,
        size: 1.5 + Math.random() * 1.5,
      });
    }
    return out;
  };

  const buildScene = () => {
    horizon = height * 0.62;
    farBuildings = buildLayer(
      40,
      60,
      130,
      28,
      60,
      horizon + 20,
      "#1a1330",
      0.5,
      0.25,
      0.05,
    );
    midBuildings = buildLayer(
      30,
      90,
      210,
      40,
      90,
      horizon + 50,
      "#120c26",
      0.7,
      0.35,
      0.18,
    );
    nearBuildings = buildLayer(
      18,
      140,
      300,
      60,
      140,
      horizon + 120,
      "#0a0618",
      0.8,
      0.45,
      0.35,
    );
    lamps = buildLamps();
    drones = buildDrones();
  };

  const resize = () => {
    width = el.parentElement?.clientWidth ?? window.innerWidth;
    height = el.parentElement?.clientHeight ?? window.innerHeight;
    el.width = width;
    el.height = height;
    buildScene();
  };
  resize();
  window.addEventListener("resize", resize);

  const drawSky = (t: number) => {
    // vertical gradient — deep purple/navy to horizon pink glow
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#08031a");
    grad.addColorStop(0.55, "#1a0938");
    grad.addColorStop(0.85, "#3a0f4e");
    grad.addColorStop(1, "#1a0620");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // stars
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const sx = (i * 97.3) % width;
      const sy = (i * 53.1) % (horizon * 0.9);
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.5 + i));
      ctx.globalAlpha = 0.4 * tw;
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.restore();

    // moon
    const moonX = width * 0.82;
    const moonY = height * 0.18;
    const moonR = 38;
    ctx.save();
    const moonGrad = ctx.createRadialGradient(
      moonX, moonY, 0,
      moonX, moonY, moonR * 3,
    );
    moonGrad.addColorStop(0, "rgba(255, 210, 235, 0.35)");
    moonGrad.addColorStop(0.3, "rgba(255, 170, 210, 0.12)");
    moonGrad.addColorStop(1, "rgba(255, 120, 190, 0)");
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe6f3";
    ctx.shadowBlur = 30;
    ctx.shadowColor = "rgba(255, 180, 220, 0.8)";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // horizon haze
    const haze = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 80);
    haze.addColorStop(0, "rgba(255, 80, 180, 0)");
    haze.addColorStop(0.5, "rgba(200, 60, 180, 0.25)");
    haze.addColorStop(1, "rgba(80, 20, 100, 0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 60, width, 140);
  };

  const drawBuilding = (b: Building, t: number) => {
    const topY = b.x; // never; placeholder to silence lint — real top below
    const bTopY = horizon + 120 - b.height;
    // silhouette — use building's own derived topY
    const actualTopY = (() => {
      // Derive base line from layer color — cheap lookup instead of storing yBase
      if (b.baseColor === "#1a1330") return horizon + 20 - b.height;
      if (b.baseColor === "#120c26") return horizon + 50 - b.height;
      return horizon + 120 - b.height;
    })();
    const baseY = actualTopY + b.height;

    ctx.fillStyle = b.baseColor;
    ctx.fillRect(b.x, actualTopY, b.width, b.height);

    // roof detail
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(b.x, actualTopY, b.width, 2);

    // antenna
    if (b.antenna) {
      ctx.fillStyle = b.baseColor;
      ctx.fillRect(b.x + b.width * 0.5 - 1, actualTopY - 14, 2, 14);
      // blinking tip
      const blink = Math.sin(t * 4 + b.x) > 0.5 ? 1 : 0.1;
      ctx.fillStyle = `rgba(255, 50, 50, ${blink})`;
      ctx.fillRect(b.x + b.width * 0.5 - 1.5, actualTopY - 15, 3, 3);
    }

    // windows — Y positions were captured at build time relative to original topY.
    // Since our buildLayer sets the real topY via yBase - h, they're already right.
    for (const w of b.windows) {
      if (w.nextToggle <= t) {
        // Slight bias: unlit windows more likely to stay off
        const turnOn = Math.random() < 0.25;
        const turnOff = Math.random() < 0.35;
        if (w.on && turnOff) w.on = false;
        else if (!w.on && turnOn) w.on = true;
        w.nextToggle = t + 2 + Math.random() * 25;
      }
      if (w.on) {
        // subtle flicker
        const f = 0.85 + 0.15 * Math.sin(t * 20 + w.x);
        ctx.globalAlpha = f;
        ctx.fillStyle = w.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = w.color;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    }

    // neon sign
    if (b.sign) {
      const s = b.sign;
      // occasional glitch
      if (t > s.glitchUntil && Math.random() < 0.001) {
        s.glitchUntil = t + 0.15 + Math.random() * 0.25;
      }
      const glitching = t < s.glitchUntil;
      const flicker = glitching
        ? Math.random() < 0.5 ? 0 : 0.3
        : 0.75 + 0.25 * Math.sin(t * 6 + s.phase);
      ctx.save();
      ctx.globalAlpha = flicker;
      ctx.font = `bold ${s.size}px "Courier New", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowBlur = 16;
      ctx.shadowColor = s.color;
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.x, actualTopY - 4);
      // inner bright
      ctx.shadowBlur = 2;
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = flicker * 0.6;
      ctx.fillText(s.text, s.x, actualTopY - 4);
      ctx.restore();
    }
  };

  const drawLamps = (t: number) => {
    for (const lamp of lamps) {
      if (lamp.nextFlicker <= t) {
        lamp.flicker = Math.random() < 0.15
          ? 0.1 + Math.random() * 0.2        // big dim dropout
          : 0.75 + Math.random() * 0.25;     // steady-ish
        lamp.nextFlicker = t + 0.05 + Math.random() * 1.8;
      }
      const intensity = lamp.flicker;

      // pole
      ctx.fillStyle = "#0a0814";
      ctx.fillRect(lamp.x - 1, lamp.y, 2, 40);
      // lamp head
      ctx.save();
      ctx.globalAlpha = intensity;
      const grad = ctx.createRadialGradient(
        lamp.x, lamp.y, 0,
        lamp.x, lamp.y, 40,
      );
      grad.addColorStop(0, lamp.color);
      grad.addColorStop(0.3, `${lamp.color}88`);
      grad.addColorStop(1, `${lamp.color}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 12;
      ctx.shadowColor = lamp.color;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const drawDrones = (t: number) => {
    for (const d of drones) {
      d.x += d.vx;
      if (d.x > width + 20) {
        d.x = -20;
        d.y = 40 + Math.random() * (horizon * 0.6);
      }
      d.blink += 0.1;
      const on = Math.sin(d.blink) > 0;
      ctx.save();
      ctx.globalAlpha = on ? 0.9 : 0.25;
      ctx.shadowBlur = 10;
      ctx.shadowColor = d.color;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const drawGround = () => {
    // ground/street base
    const g = ctx.createLinearGradient(0, horizon + 120, 0, height);
    g.addColorStop(0, "#08041a");
    g.addColorStop(1, "#04020f");
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon + 120, width, height - horizon - 120);

    // reflective street sheen
    ctx.save();
    ctx.globalAlpha = 0.15;
    const streetGrad = ctx.createLinearGradient(0, horizon + 130, 0, height);
    streetGrad.addColorStop(0, "rgba(255, 80, 200, 0.4)");
    streetGrad.addColorStop(1, "rgba(0, 200, 255, 0)");
    ctx.fillStyle = streetGrad;
    ctx.fillRect(0, horizon + 130, width, height - horizon - 130);
    ctx.restore();
  };

  const frame = (now: number) => {
    const t = now / 1000;
    drawSky(t);

    for (const b of farBuildings) drawBuilding(b, t);
    for (const b of midBuildings) drawBuilding(b, t);

    drawGround();

    for (const b of nearBuildings) drawBuilding(b, t);
    drawLamps(t);
    drawDrones(t);

    animId = requestAnimationFrame(frame);
  };

  animId = requestAnimationFrame(frame);

  onUnmounted(() => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
  });
});
</script>

<style scoped>
.city-bg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  opacity: 0.55;
}
</style>
