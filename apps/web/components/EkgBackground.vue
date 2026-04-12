<template>
  <canvas ref="canvas" class="ekg-bg" />
</template>

<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;

interface Dollar {
  x: number;
  y: number;
  vy: number;
  vx: number;
  rotation: number;
  rotSpeed: number;
  opacity: number;
  size: number;
}

onMounted(() => {
  const el = canvas.value;
  if (!el) return;

  const ctx = el.getContext("2d")!;
  let width = 0;
  let height = 0;
  let midY = 0;

  const resize = () => {
    width = el.parentElement?.clientWidth ?? window.innerWidth;
    height = el.parentElement?.clientHeight ?? window.innerHeight;
    el.width = width;
    el.height = height;
    midY = height * 0.5;
  };
  resize();
  window.addEventListener("resize", resize);

  // EKG pattern: flat → small bump → big spike → dip → flat
  const ekgPattern = (t: number): number => {
    const p = t % 1;
    if (p < 0.35) return 0;
    if (p < 0.40) return Math.sin((p - 0.35) / 0.05 * Math.PI) * 8;
    if (p < 0.45) return 0;
    if (p < 0.48) return -((p - 0.45) / 0.03) * 15;
    if (p < 0.52) return -15 + ((p - 0.48) / 0.04) * 95;
    if (p < 0.56) return 80 - ((p - 0.52) / 0.04) * 110;
    if (p < 0.60) return -30 + ((p - 0.56) / 0.04) * 40;
    if (p < 0.65) return 10 * Math.sin((p - 0.60) / 0.05 * Math.PI);
    return 0;
  };

  // Neon color cycle
  const neonColor = (t: number): string => {
    const hue = (t * 40) % 360;
    return `hsl(${hue}, 100%, 60%)`;
  };

  const glowColor = (t: number): string => {
    const hue = (t * 40) % 360;
    return `hsla(${hue}, 100%, 50%, 0.3)`;
  };

  // Dollar particles
  const dollars: Dollar[] = [];
  let lastSpawnT = 0;

  const spawnDollar = (x: number, y: number) => {
    for (let i = 0; i < 2; i++) {
      dollars.push({
        x: x + (Math.random() - 0.5) * 20,
        y,
        vy: 0.3 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.6,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        opacity: 0.7 + Math.random() * 0.3,
        size: 14 + Math.random() * 8,
      });
    }
  };

  // Trail points for the EKG line
  const trailLength = 300;
  const trail: { x: number; y: number }[] = [];

  let time = 0;
  const speed = 0.003;
  const cycleWidth = 250; // pixels per heartbeat cycle

  const draw = () => {
    time += speed;
    ctx.clearRect(0, 0, width, height);

    // Current EKG head position
    const headX = (time * cycleWidth * 60) % (width + 200) - 100;
    const ekgVal = ekgPattern(time * 3);
    const headY = midY - ekgVal;

    // Add to trail
    trail.push({ x: headX, y: headY });
    if (trail.length > trailLength) trail.shift();

    // Spawn dollars at peaks
    if (ekgVal > 50 && time - lastSpawnT > 0.05) {
      spawnDollar(headX, headY);
      lastSpawnT = time;
    }

    // Draw EKG trail with glow
    if (trail.length > 2) {
      // Glow layer
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = glowColor(time);
      ctx.strokeStyle = glowColor(time);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
      ctx.restore();

      // Main line
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = neonColor(time);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 1; i < trail.length; i++) {
        const alpha = i / trail.length;
        const segTime = time - (trail.length - i) * speed;
        ctx.strokeStyle = neonColor(segTime);
        ctx.globalAlpha = alpha * 0.9;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      ctx.restore();

      // Bright dot at head
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 15;
      ctx.shadowColor = neonColor(time);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(headX, headY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Update and draw dollars
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = dollars.length - 1; i >= 0; i--) {
      const d = dollars[i];
      d.y += d.vy;
      d.x += d.vx;
      d.vx += (Math.random() - 0.5) * 0.02; // slight drift
      d.rotation += d.rotSpeed;
      d.opacity -= 0.002;

      if (d.opacity <= 0 || d.y > height + 30) {
        dollars.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      ctx.globalAlpha = d.opacity * 0.6;
      ctx.font = `${d.size}px sans-serif`;
      ctx.fillStyle = "#4ade80";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(74, 222, 128, 0.4)";
      ctx.fillText("$", 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Reset trail when line goes off screen
    if (headX > width + 100) {
      trail.length = 0;
    }

    animId = requestAnimationFrame(draw);
  };

  animId = requestAnimationFrame(draw);

  onUnmounted(() => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
  });
});
</script>

<style scoped>
.ekg-bg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  opacity: 0.35;
}
</style>
