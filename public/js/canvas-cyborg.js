/**
 * @file canvas-cyborg.js
 * @description YooAI 智能体灵魂粒子动画 - 基于情绪状态的粒子系统动画
 * @module YooAI/CanvasCyborg
 * @version 2.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - Canvas 元素 ID: cyborgCanvas
 * - 外部变量: window.agentBusy (可选，用于控制动画状态)
 *
 * @global
 * - window._setCyborgMood(moodKey) - 设置情绪状态
 * - window._brainFire(start, len) - 触发神经元激活 (占位符)
 * - window._soulEnergy - 能量值 (0-100, 可读写)
 * - window._cyborgReady - 就绪标志 (boolean)
 *
 * @example
 * // 设置情绪状态
 * window._setCyborgMood('thinking');
 *
 * // 设置能量值
 * window._soulEnergy = 80;
 *
 * @architecture
 * 情绪状态 (7种):
 * - sleeping: 休眠，粒子静止
 * - thinking: 思考，温和脉动
 * - focused: 专注，快速旋转
 * - excited: 兴奋，剧烈运动
 * - frustrated: 沮丧，混乱抖动
 * - vibing: 愉悦，流畅舞动
 * - exhausted: 疲惫，缓慢微弱
 *
 * 粒子系统:
 * - 中心核心 + 环绕粒子
 * - 粒子行为随情绪变化
 * - 背景辉光效果
 */

(function initSoul() {
  const canvas = document.getElementById('cyborgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, cx, cy;
  function resize() {
    W = canvas.offsetWidth || 300;
    H = canvas.offsetHeight || 340;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    cx = W / 2;
    cy = H / 2 + 10;
  }
  resize();
  window.addEventListener('resize', () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resize();
  });

  // ---- DRAW HELPERS ----
  function drawGlowDot(x, y, size, hue, sat, lit, alpha) {
    // Guard against NaN/Infinity
    if (!isFinite(x) || !isFinite(y) || !isFinite(size) || size <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, size);
    g.addColorStop(0, `hsla(${hue},${sat}%,98%,1)`);
    g.addColorStop(0.25, `hsla(${hue},${sat}%,${lit}%,0.9)`);
    g.addColorStop(1, `hsla(${hue},${sat}%,${lit - 10}%,0)`);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function drawStar(x, y, size, hue, sat, lit, alpha) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(size) || size <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    // 4-point cross
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 4);
      const g = ctx.createLinearGradient(0, -size, 0, size);
      g.addColorStop(0, `hsla(${hue},${sat}%,98%,0)`);
      g.addColorStop(0.5, `hsla(${hue},${sat}%,98%,1)`);
      g.addColorStop(1, `hsla(${hue},${sat}%,98%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.18, size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // bright core
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},20%,100%,${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  function drawRay(x1, y1, x2, y2, hue, alpha, width) {
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2) || !isFinite(width)) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, `hsla(${hue},90%,90%,1)`);
    g.addColorStop(1, `hsla(${hue},80%,70%,0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- MOOD CONFIGS ----
  const MOODS = {
    // SLEEPING: dreaming soul — breath rings, drifting wisps, slow constellation orbit, aurora ribbons
    sleeping: {
      label: '😴 休眠中',
      status: '待机',
      dots: [1.2, 0.2, 0.2],
      count: 620,
      hues: [220, 240, 260, 200, 210, 250],
      init(p, i) {
        // Particle types: 0=wisp(orbit), 1=star(twinkle), 2=dreamDrift(float up), 3=aurora(ribbon)
        if (i < 200) {
          // Slow lazy orbit wisps — like thoughts drifting in a dream
          p.type = 0;
          p.angle = Math.random() * Math.PI * 2;
          p.radius = 12 + Math.random() * 110;
          p.x = cx + Math.cos(p.angle) * p.radius;
          p.y = cy + Math.sin(p.angle) * p.radius;
          p.swirlSpeed = (0.001 + Math.random() * 0.005) * (Math.random() < 0.5 ? 1 : -1);
          p.hue = this.hues[i % this.hues.length] + Math.random() * 25;
          p.sat = 55 + Math.random() * 25;
          p.lit = 60 + Math.random() * 20;
          p.size = 0.8 + Math.random() * 3.5;
          p.alpha = 0;
          p.life = Math.random() * Math.PI * 2;
          p.lifeSpeed = 0.003 + Math.random() * 0.006;
          p.wobbleAmt = 0.3 + Math.random() * 0.7;
          p.wobbleFreq = 0.4 + Math.random() * 0.6;
        } else if (i < 400) {
          // Background twinkling stars — fill the whole canvas
          p.type = 1;
          p.isStar = true;
          p.x = cx + (Math.random() - 0.5) * W * 0.95;
          p.y = cy + (Math.random() - 0.5) * H * 0.95;
          p.hue = 190 + Math.random() * 160;
          p.size = 0.3 + Math.random() * 2.2;
          p.alpha = 0;
          p.life = Math.random() * Math.PI * 2;
          p.lifeSpeed = 0.005 + Math.random() * 0.01;
          p.twinklePhase = Math.random() * Math.PI * 2;
          p.twinkleSpeed = 0.012 + Math.random() * 0.022;
        } else if (i < 520) {
          // Dream wisps — float slowly upward and fade like Zzzs
          p.type = 2;
          p.x = cx + (Math.random() - 0.5) * 120;
          p.y = cy + 20 + Math.random() * 60;
          p.startX = p.x;
          p.startY = p.y;
          p.hue = 200 + Math.random() * 80;
          p.sat = 60 + Math.random() * 30;
          p.lit = 65 + Math.random() * 20;
          p.size = 1.2 + Math.random() * 4;
          p.alpha = 0;
          p.life = Math.random() * Math.PI * 2;
          p.lifeSpeed = 0.007 + Math.random() * 0.007;
          p.riseSpeed = 0.12 + Math.random() * 0.28;
          p.driftX = (Math.random() - 0.5) * 0.2;
          p.birthY = p.y;
          p.travelDist = 60 + Math.random() * 80;
        } else {
          // Aurora ribbon particles — slow horizontal sweep at mid-radius
          p.type = 3;
          p.angle = Math.random() * Math.PI * 2;
          p.radius = 55 + Math.random() * 55;
          p.x = cx + Math.cos(p.angle) * p.radius;
          p.y = cy + Math.sin(p.angle) * p.radius * 0.38;
          p.hue = 180 + Math.random() * 90;
          p.sat = 70 + Math.random() * 25;
          p.lit = 55 + Math.random() * 22;
          p.size = 1.5 + Math.random() * 5;
          p.alpha = 0;
          p.life = Math.random() * Math.PI * 2;
          p.lifeSpeed = 0.003 + Math.random() * 0.004;
          p.swirlSpeed = 0.001 + Math.random() * 0.003;
        }
        p.isBurst = false;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        // Global breath: slow sine pulse (period ~6s)
        const breath = Math.sin(t * 0.55) * 0.5 + 0.5; // 0..1

        if (p.type === 0) {
          // Orbit wisps — radius breathes in/out gently
          const breathR = p.radius * (0.88 + breath * 0.24);
          p.angle += p.swirlSpeed * (0.5 + breath * 0.5);
          const tx =
            cx +
            Math.cos(p.angle) * breathR +
            Math.sin(p.life * p.wobbleFreq) * p.wobbleAmt * 8;
          const ty =
            cy +
            Math.sin(p.angle) * breathR * 0.75 +
            Math.cos(p.life * p.wobbleFreq) * p.wobbleAmt * 4;
          p.x += (tx - p.x) * 0.04;
          p.y += (ty - p.y) * 0.04;
          p.alpha = 0.18 + breath * 0.22 + Math.abs(Math.sin(p.life)) * 0.2;
          p.hue = (p.hue + 0.08) % 360;
        } else if (p.type === 1) {
          // Stars — slow twinkle, occasional shimmer
          p.life += p.twinkleSpeed - p.lifeSpeed; // extra twinkle tick
          p.alpha = 0.15 + Math.abs(Math.sin(p.life + p.twinklePhase)) * 0.35;
          // tiny drift
          p.x += Math.sin(p.life * 0.1) * 0.04;
          p.y += Math.cos(p.life * 0.08) * 0.03;
        } else if (p.type === 2) {
          // Dream wisps — rise upward in a gentle sine curve, fade out at top
          p.y -= p.riseSpeed * (0.4 + breath * 0.6);
          p.x += p.driftX + Math.sin(p.life * 0.8) * 0.3;
          const risen = p.birthY - p.y;
          const progress = Math.min(1, risen / p.travelDist);
          // fade in then out
          p.alpha = progress < 0.2 ? (progress / 0.2) * 0.55 : (1 - progress) * 0.55;
          // respawn when fully faded
          if (progress >= 1) {
            p.x = cx + (Math.random() - 0.5) * 120;
            p.y = cy + 20 + Math.random() * 60;
            p.birthY = p.y;
            p.driftX = (Math.random() - 0.5) * 0.2;
            p.hue = 200 + Math.random() * 80;
          }
        } else {
          // Aurora ribbon — slow orbit, squashed ellipse, hue-shifts
          p.angle += p.swirlSpeed * (0.6 + breath * 0.4);
          const tx = cx + Math.cos(p.angle) * p.radius;
          const ty = cy + Math.sin(p.angle) * p.radius * 0.35 + Math.sin(p.life * 0.5) * 6;
          p.x += (tx - p.x) * 0.03;
          p.y += (ty - p.y) * 0.03;
          p.hue = (p.hue + 0.12) % 360;
          p.alpha = 0.14 + breath * 0.18 + Math.sin(p.life) * 0.08;
          p.size = 2 + Math.sin(p.life * 0.7) * 2;
        }
      },
      glow: { r: 55, col: 'rgba(80,60,200,0.08)' },
    },

    // THINKING: particles start scattered, then slowly self-organize into perfect concentric rings
    thinking: {
      label: '🤔 思考中',
      status: '处理中',
      dots: [1, 0.4, 0.2],
      count: 480,
      hues: [180, 200, 220, 160, 170],
      init(p, i) {
        // Each particle belongs to a ring (0–5), evenly distributed
        const RINGS = 6;
        const ringCounts = [8, 16, 26, 38, 52, 68]; // particles per ring
        const ringRadii = [18, 36, 56, 78, 102, 128];
        // Assign ring by cumulative count
        let ring = 0,
          cumulative = 0;
        for (let r = 0; r < RINGS; r++) {
          cumulative += ringCounts[r];
          if (i < cumulative) {
            ring = r;
            break;
          }
          if (r === RINGS - 1) ring = r;
        }
        // Position in ring
        const ringTotal = ringCounts[ring];
        const ringIdx = i - (cumulative - ringCounts[ring]);
        const targetAngle = (ringIdx / ringTotal) * Math.PI * 2;

        // Store target (organized) position
        p.ring = ring;
        p.ringIdx = ringIdx;
        p.ringTotal = ringTotal;
        p.targetR = ringRadii[ring];
        p.targetAngle = targetAngle;

        // Start scattered randomly around canvas
        const scatterR = 20 + Math.random() * 130;
        const scatterA = Math.random() * Math.PI * 2;
        p.x = cx + Math.cos(scatterA) * scatterR;
        p.y = cy + Math.sin(scatterA) * scatterR;

        // Current polar coords (will lerp toward target)
        p.angle = scatterA;
        p.radius = scatterR;

        // Slow clockwise rotation of the whole ring
        p.orbitSpeed = (0.003 + ring * 0.0008) * (ring % 2 === 0 ? 1 : -1);

        p.hue = this.hues[ring % this.hues.length] + Math.random() * 20;
        p.sat = 75 + Math.random() * 20;
        p.lit = 58 + Math.random() * 22;
        p.size = 0.8 + Math.random() * (ring < 2 ? 2.5 : 1.8);
        p.alpha = 0;
        p.life = Math.random() * Math.PI * 2;
        p.lifeSpeed = 0.012 + Math.random() * 0.01;

        // Organisation progress — each particle starts at 0 (chaos) and approaches 1 (order)
        // Stagger by ring so inner rings lock in first
        p.orderDelay = ring * 38 + Math.random() * 25; // frames before this particle starts homing
        p.orderProgress = 0;
        p.orderAge = 0;

        p.isStar = ring >= 4 && Math.random() < 0.35;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        p.orderAge++;

        // Advance order progress after delay
        if (p.orderAge > p.orderDelay) {
          p.orderProgress = Math.min(1, p.orderProgress + 0.006);
        }
        const op = p.orderProgress;

        // Rotate the target angle slowly — whole ring turns
        p.targetAngle += p.orbitSpeed;

        // Target position on perfect ring
        const tX = cx + Math.cos(p.targetAngle) * p.targetR;
        const tY = cy + Math.sin(p.targetAngle) * p.targetR;

        // Chaotic offset — diminishes as order increases
        const chaos = 1 - op;
        const jitter = chaos * 12;
        const wobble = chaos * (Math.sin(p.life * 2.1 + p.ring) * jitter);
        const wobbleY = chaos * (Math.cos(p.life * 1.8 + p.ring) * jitter);

        // Lerp position toward ordered target
        const lerpSpeed = 0.015 + op * 0.04;
        p.x += (tX + wobble - p.x) * lerpSpeed;
        p.y += (tY + wobbleY - p.y) * lerpSpeed;

        p.trail = null; // no trails — the dot positions ARE the pattern

        // Hue: drifts cool-blue when ordered, warmer when chaotic
        const baseHue = this.hues[p.ring % this.hues.length];
        p.hue = baseHue + chaos * 40 + Math.sin(p.life + p.ring) * (10 + chaos * 20);

        // Alpha: brighter once locked in
        const lockBoost = op * 0.35;
        p.alpha = 0.2 + lockBoost + Math.abs(Math.sin(p.life)) * (0.4 - op * 0.25);

        // Size: shrinks slightly as it locks into place (precision)
        p.size = (0.9 + Math.sin(p.life * 2) * 0.4) * (1 + chaos * 0.5);
      },
      glow: { r: 80, col: 'rgba(0,180,255,0.10)' },
    },

    // FOCUSED: 3-arm galaxy swirl shooting rays outward
    focused: {
      label: '🎯 专注中',
      status: '执行中',
      dots: [1, 0.8, 0.2],
      count: 520,
      hues: [150, 170, 130, 180, 120],
      init(p, i) {
        const arms = 3;
        p.arm = i % arms;
        p.wave = Math.floor(i / arms) / (520 / arms);
        p.angle = (p.arm / arms) * Math.PI * 2 + p.wave * Math.PI * 2 * 3;
        p.radius = 6 + p.wave * W * 0.44;
        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius;
        p.hue = this.hues[p.arm % this.hues.length] + p.wave * 30;
        p.sat = 88 + Math.random() * 12;
        p.lit = 60 + Math.random() * 22;
        p.alpha = 0;
        p.size = 0.8 + Math.random() * 2.8;
        p.life = Math.random() * Math.PI * 2;
        p.lifeSpeed = 0.032 + Math.random() * 0.02;
        p.baseR = p.radius;
        p.swirlSpeed = 0.022 + (1 / (p.radius + 4)) * 0.6 + Math.random() * 0.008;
        p.isStar = p.wave > 0.7;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        p.angle += p.swirlSpeed;
        const drag = 1 - p.wave * 0.25;
        p.radius = p.baseR + Math.sin(t * 2.2 + p.wave * Math.PI * 3) * 12 * drag;
        p.radius = Math.max(4, p.radius);
        const px = p.x,
          py = p.y;
        p.x = cx + Math.cos(p.angle) * p.radius + Math.sin(t * 2.5 + p.life) * 1.2;
        p.y = cy + Math.sin(p.angle) * p.radius + Math.cos(t * 2 + p.life) * 1.2;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        p.hue = this.hues[p.arm % this.hues.length] + Math.sin(t * 1.5 + p.arm) * 30;
        p.alpha = p.isStar
          ? 0.5 + Math.abs(Math.sin(p.life * 5)) * 0.5
          : 0.4 + Math.sin(p.life) * 0.4;
        p.size = 0.8 + Math.sin(p.life * 3) * 0.6;
      },
      glow: { r: 60, col: 'rgba(0,255,160,0.13)' },
    },

    // EXCITED: full cosmic burst — rays + fireworks + dense glitter
    excited: {
      label: '🥳 激活',
      status: '激活',
      dots: [1, 1, 0.4],
      count: 650,
      hues: [0, 30, 60, 120, 180, 240, 300],
      init(p, i) {
        const a = Math.random() * Math.PI * 2;
        p.speed = 0.8 + Math.random() * 4;
        p.x = cx;
        p.y = cy;
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
        p.hue = Math.random() * 360;
        p.sat = 90 + Math.random() * 10;
        p.lit = 65 + Math.random() * 20;
        p.alpha = 0.9;
        p.size = 0.8 + Math.random() * 3.5;
        p.life = Math.random() * 80;
        p.maxLife = 40 + Math.random() * 80;
        p.decay = 0.006 + Math.random() * 0.009;
        p.isStar = Math.random() < 0.45;
        p.swirl = (Math.random() - 0.5) * 0.07;
        p.trail = null;
      },
      update(p, t) {
        p.life++;
        const cs = Math.cos(p.swirl),
          sn = Math.sin(p.swirl);
        const nvx = p.vx * cs - p.vy * sn,
          nvy = p.vx * sn + p.vy * cs;
        const px = p.x,
          py = p.y;
        p.vx = nvx * 0.968;
        p.vy = nvy * 0.968;
        p.vy += 0.02;
        p.x += p.vx;
        p.y += p.vy;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        p.hue = (p.hue + 2) % 360;
        p.alpha -= p.decay;
        if (p.life > p.maxLife || p.alpha <= 0.02) {
          const a = Math.random() * Math.PI * 2;
          p.speed = 0.8 + Math.random() * 4;
          p.x = cx + (Math.random() - 0.5) * 15;
          p.y = cy + (Math.random() - 0.5) * 15;
          p.vx = Math.cos(a) * p.speed;
          p.vy = Math.sin(a) * p.speed - 0.3;
          p.hue = Math.random() * 360;
          p.alpha = 0.9;
          p.life = 0;
          p.maxLife = 40 + Math.random() * 80;
          p.isStar = Math.random() < 0.45;
          p.swirl = (Math.random() - 0.5) * 0.07;
        }
      },
      glow: { r: 100, col: 'rgba(255,200,50,0.12)' },
    },

    // FRUSTRATED: red chaotic storm with angry sparks
    frustrated: {
      label: '😤 异常',
      status: '异常',
      dots: [1, 0.2, 0.1],
      count: 480,
      hues: [0, 8, 18, 350, 340],
      init(p, i) {
        const a = Math.random() * Math.PI * 2,
          r = Math.random() * 80;
        p.x = cx + Math.cos(a) * r;
        p.y = cy + Math.sin(a) * r;
        p.vx = (Math.random() - 0.5) * 5;
        p.vy = (Math.random() - 0.5) * 5;
        p.hue = this.hues[i % this.hues.length] + Math.random() * 12;
        p.sat = 90 + Math.random() * 10;
        p.lit = 55 + Math.random() * 20;
        p.alpha = 0;
        p.size = 1 + Math.random() * 3;
        p.life = Math.random() * Math.PI * 2;
        p.lifeSpeed = 0.045 + Math.random() * 0.04;
        p.jitter = 2.2 + Math.random() * 2.5;
        p.isStar = Math.random() < 0.3;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        const px = p.x,
          py = p.y;
        p.vx += (Math.random() - 0.5) * p.jitter;
        p.vy += (Math.random() - 0.5) * p.jitter;
        p.vx *= 0.89;
        p.vy *= 0.89;
        p.x += p.vx;
        p.y += p.vy;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        const dx = cx - p.x,
          dy = cy - p.y,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d > 100) {
          p.vx += (dx / d) * 0.5;
          p.vy += (dy / d) * 0.5;
        }
        p.hue = this.hues[Math.floor(p.life * 1.5) % this.hues.length];
        p.alpha = 0.4 + Math.abs(Math.sin(p.life * 4)) * 0.5;
      },
      glow: { r: 80, col: 'rgba(255,30,0,0.13)' },
    },

    // VIBING: gorgeous triple spiral nebula
    vibing: {
      label: '✨ 最佳状态',
      status: '最佳',
      dots: [0.8, 0.4, 1],
      count: 600,
      hues: [270, 290, 310, 250, 200],
      init(p, i) {
        const arms = 3;
        p.arm = i % arms;
        p.wave = Math.floor(i / arms) / (600 / arms);
        p.angle = (p.arm / arms) * Math.PI * 2 + p.wave * Math.PI * 2 * 3.5;
        p.radius = 10 + p.wave * W * 0.46;
        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius;
        p.hue = (p.arm * 120 + p.wave * 180) % 360;
        p.sat = 88 + Math.random() * 12;
        p.lit = 62 + Math.random() * 22;
        p.alpha = 0;
        p.size = 0.8 + Math.random() * 3;
        p.life = p.wave * Math.PI * 2;
        p.lifeSpeed = 0.014 + Math.random() * 0.009;
        p.baseRadius = p.radius;
        p.swirlSpeed = 0.005 + (1 / (p.radius + 8)) * 0.2;
        p.isStar = p.wave > 0.75;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        p.angle += p.swirlSpeed;
        p.radius =
          p.baseRadius +
          Math.sin(t * 1.3 + p.wave * Math.PI * 5) * 22 +
          Math.sin(p.life) * 7;
        p.radius = Math.max(6, p.radius);
        const px = p.x,
          py = p.y;
        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        p.hue = (p.arm * 120 + p.wave * 180 + t * 35) % 360;
        p.alpha = p.isStar
          ? 0.45 + Math.abs(Math.sin(p.life * 4)) * 0.5
          : 0.35 + Math.sin(p.life) * 0.38;
        p.size = 0.8 + Math.sin(p.life * 1.6) * 0.9 + 0.5;
      },
      glow: { r: 110, col: 'rgba(180,60,255,0.11)' },
    },

    // EXHAUSTED: particles begin orbiting weakly then slowly lose energy, desaturate, and fall to the ground
    exhausted: {
      label: '🪫 耗尽',
      status: '耗尽',
      dots: [0.1, 0.05, 0.05],
      count: 300,
      hues: [200, 210, 220, 230],
      init(p, i) {
        // Start in a loose orbit around centre — like a dying version of thinking/focused
        p.angle = Math.random() * Math.PI * 2;
        p.radius = 8 + Math.random() * 80;
        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius;
        p.vx = 0;
        p.vy = 0;
        p.hue = this.hues[i % this.hues.length] + Math.random() * 20;
        // Start with some colour — will drain to grey over time
        p.sat = 55 + Math.random() * 30;
        p.lit = 50 + Math.random() * 20;
        p.alpha = 0.5 + Math.random() * 0.3;
        p.size = 1 + Math.random() * 2.5;
        p.life = Math.random() * Math.PI * 2;
        p.lifeSpeed = 0.004 + Math.random() * 0.005;
        // Each particle has a personal depletion timer — staggered so they fall one by one
        p.depletionStart = 60 + Math.random() * 420; // frames before this particle starts falling
        p.depletionAge = 0;
        p.settled = false;
        p.groundY = cy + 50 + Math.random() * 60 + (i % 6) * 7;
        p.swirlSpeed = (0.003 + Math.random() * 0.008) * (Math.random() < 0.5 ? 1 : -1);
        p.isStar = false;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        p.depletionAge++;

        const depleting = p.depletionAge > p.depletionStart;
        const depletionProgress = depleting
          ? Math.min(1, (p.depletionAge - p.depletionStart) / 180)
          : 0;

        if (!p.settled) {
          if (!depleting) {
            // Weak orbit — gradually slowing, losing colour
            p.angle += p.swirlSpeed * (1 - depletionProgress * 0.5);
            p.radius += Math.sin(p.life * 0.5) * 0.08;
            p.radius = Math.max(4, p.radius);
            p.x = cx + Math.cos(p.angle) * p.radius + Math.sin(p.life * 0.3) * 0.6;
            p.y = cy + Math.sin(p.angle) * p.radius + Math.cos(p.life * 0.25) * 0.5;
          } else {
            // Losing orbit — gravity kicks in, orbit decays into a fall
            const orbitStrength = Math.max(0, 1 - depletionProgress * 1.4);
            p.angle += p.swirlSpeed * orbitStrength;
            // Gravity grows as orbit strength dies
            const gravity = depletionProgress * 0.09;
            p.vy += gravity;
            p.vx *= 0.97;
            // Blend from orbit position to freefall
            const ox = cx + Math.cos(p.angle) * p.radius;
            const oy = cy + Math.sin(p.angle) * p.radius;
            if (orbitStrength > 0.05) {
              p.x = ox + (p.x - ox) * (1 - depletionProgress * 0.08);
              p.y = oy + (p.y - oy) * (1 - depletionProgress * 0.08);
            }
            p.x += p.vx;
            p.y += p.vy;
            if (p.y >= p.groundY) {
              p.y = p.groundY;
              p.vy *= -0.08;
              p.vx *= 0.4;
              if (Math.abs(p.vy) < 0.1) {
                p.settled = true;
                p.vy = 0;
                p.vx = 0;
              }
            }
            if (p.x < cx - (W * 0.45)) {
              p.x = cx - W * 0.45;
              p.vx *= -0.25;
            }
            if (p.x > cx + W * 0.45) {
              p.x = cx + W * 0.45;
              p.vx *= -0.25;
            }
          }
        } else {
          // Settled — barely breathing micro-drift
          p.x += Math.sin(p.life * 0.2) * 0.08;
        }

        // Saturation drains to near-zero as depletion progresses
        const targetSat = Math.max(2, 55 - depletionProgress * 53);
        p.sat += (targetSat - p.sat) * 0.01;

        // Alpha: bright while orbiting, fades as falling, very dim when settled
        if (p.settled) {
          p.alpha = 0.05 + Math.sin(p.life * 0.3) * 0.04;
        } else if (depleting) {
          p.alpha = Math.max(0.05, 0.4 - depletionProgress * 0.32 + Math.sin(p.life) * 0.08);
        } else {
          p.alpha = 0.3 + Math.abs(Math.sin(p.life)) * 0.25;
        }
      },
      glow: { r: 35, col: 'rgba(40,40,100,0.04)' },
    },
  };

  // ---- PARTICLE POOL ----
  let currentMood = 'sleeping';
  let particles = [];
  let t = 0,
    transAlpha = 1,
    transitioning = false;
  window._soulEnergy = 100;

  // burst energy stars — separate layer on top of sleeping
  const BURST_COUNT = 45;
  let burstStars = Array.from({ length: BURST_COUNT }, () => ({
    active: false,
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
    hue: 0,
    alpha: 0,
    size: 1,
    life: 0,
    maxLife: 40,
  }));

  function spawnParticles(moodKey) {
    const m = MOODS[moodKey];
    particles = Array.from({ length: m.count }, (_, i) => {
      const p = {
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        hue: 200,
        sat: 70,
        lit: 65,
        alpha: 0,
        size: 1.5,
        life: 0,
        lifeSpeed: 0.02,
        isStar: false,
        trail: null,
        settled: false,
        groundY: cy + 80,
      };
      m.init(p, i);
      return p;
    });
  }
  spawnParticles('sleeping');
  window._cyborgReady = true;

  window._setCyborgMood = function (moodKey) {
    // Always re-spawn exhausted so the drain animation restarts fresh
    if (moodKey === currentMood && moodKey !== 'exhausted') return;
    currentMood = moodKey;
    const m = MOODS[moodKey] || MOODS.sleeping;
    transitioning = true;
    transAlpha = 1;
    setTimeout(() => {
      spawnParticles(moodKey);
      transitioning = false;
      transAlpha = 0;
    }, 300);
    const ge = (id) => document.getElementById(id);
    if (ge('cyborgStatus')) ge('cyborgStatus').textContent = m.status;
    if (ge('cyborgMood')) ge('cyborgMood').textContent = m.label;
    const dc = ['rgba(160,240,240,', 'rgba(249,228,154,', 'rgba(249,160,112,'];
    const dots = ge('cyborgDots')?.children;
    if (dots)
      Array.from(dots).forEach((d, i) => {
        const v = m.dots[i];
        d.style.background = dc[i] + v + ')';
        d.style.boxShadow = v > 0.5 ? `0 0 6px ${dc[i]}0.8)` : 'none';
      });
  };

  // Placeholder for brain fire - can be implemented separately
  window._brainFire = function (start, len) {
    // Brain fire animation is handled by a separate canvas module
  };

  // ---- DRAW ----
  function draw() {
    requestAnimationFrame(draw);
    t += 0.016;
    ctx.clearRect(0, 0, W, H);

    const m = MOODS[currentMood] || MOODS.sleeping;
    const isDrained = currentMood === 'exhausted';
    const isSleeping = currentMood === 'sleeping';

    // Ambient nebula glow
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, m.glow.r);
    grd.addColorStop(0, m.glow.col);
    grd.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, m.glow.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Fade during transitions
    const fadeA = transitioning ? Math.max(0, transAlpha - 0.06) : Math.min(1, transAlpha + 0.05);
    transAlpha = fadeA;
    const tA = transitioning ? 1 - transAlpha : transAlpha;

    // Draw light ray trails first (behind particles)
    if (!isDrained && !isSleeping) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.trail) continue;
        const a = p.alpha * tA * 0.5;
        if (a < 0.02) continue;
        const dx = p.trail.x2 - p.trail.x1,
          dy = p.trail.y2 - p.trail.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.3) continue;
        drawRay(
          p.trail.x1,
          p.trail.y1,
          p.trail.x2,
          p.trail.y2,
          p.hue,
          a * 0.6,
          p.size * 0.7
        );
      }
    }

    // Draw particles
    const isThinking = currentMood === 'thinking';
    // For thinking: build per-ring position map for connector lines
    let thinkRingMap = null;
    if (isThinking) {
      thinkRingMap = {};
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.orderProgress > 0.6) {
          if (!thinkRingMap[p.ring]) thinkRingMap[p.ring] = [];
          thinkRingMap[p.ring].push(p);
        }
      }
      // Draw faint ring connector lines first (behind dots)
      ctx.save();
      for (const ring in thinkRingMap) {
        const rp = thinkRingMap[ring];
        if (rp.length < 2) continue;
        // Sort by target angle so lines connect neighbors
        rp.sort((a, b) => a.targetAngle - b.targetAngle);
        for (let i = 0; i < rp.length; i++) {
          const a = rp[i],
            b = rp[(i + 1) % rp.length];
          const lineAlpha = Math.min(a.orderProgress, b.orderProgress) * 0.18 * tA;
          if (lineAlpha < 0.02) continue;
          ctx.globalAlpha = lineAlpha;
          ctx.strokeStyle = `hsl(${a.hue},70%,75%)`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      m.update(p, t);
      const a = p.alpha * tA;
      if (a < 0.01) continue;

      if (isDrained && p.settled) {
        // settled fallen particles — tiny dim dots only
        drawGlowDot(p.x, p.y, p.size, p.hue, p.sat, p.lit, a * 0.6);
      } else if (isSleeping && p.type === 2) {
        // dream wisps — soft elongated upward smear
        ctx.save();
        ctx.globalAlpha = a * 0.7;
        const wg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        wg.addColorStop(0, `hsla(${p.hue},${p.sat}%,88%,1)`);
        wg.addColorStop(1, `hsla(${p.hue},${p.sat}%,70%,0)`);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 2.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = wg;
        ctx.fill();
        ctx.restore();
      } else if (isSleeping && p.type === 3) {
        // aurora ribbon — wide soft oval
        drawGlowDot(p.x, p.y, p.size * 1.6, p.hue, p.sat, p.lit, a * 0.65);
      } else if (p.isStar) {
        drawStar(p.x, p.y, p.size * 1.8, p.hue, 90, 85, a);
        // extra halo
        ctx.save();
        ctx.globalAlpha = a * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue},80%,80%)`;
        ctx.fill();
        ctx.restore();
      } else {
        drawGlowDot(p.x, p.y, p.size, p.hue, p.sat || 80, p.lit || 65, a);
      }
    }

    // Burst energy stars on top (sleeping mode only)
    if (isSleeping) {
      // Breathing pulse rings — slow expand and fade
      const breath = Math.sin(t * 0.55) * 0.5 + 0.5;
      for (let ring = 0; ring < 3; ring++) {
        const ringPhase = (t * 0.55 + ring * Math.PI * 0.66) % (Math.PI * 2);
        const ringR = Math.max(1, 20 + Math.sin(ringPhase) * 32 + ring * 12);
        const ringA = (0.03 + breath * 0.04) * (1 - ring * 0.28) * tA;
        if (ringA > 0.005) {
          ctx.save();
          ctx.globalAlpha = ringA;
          ctx.strokeStyle = `hsl(${220 + ring * 18},60%,72%)`;
          ctx.lineWidth = 1.2 - ring * 0.3;
          ctx.beginPath();
          ctx.ellipse(cx, cy, ringR, ringR * 0.72, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const energy = window._soulEnergy || 0;
      const burstRate = Math.max(0, (energy - 35) / 65);
      // spawn new bursts
      if (burstRate > 0.05 && Math.random() < burstRate * 0.18) {
        const b = burstStars.find((b) => !b.active);
        if (b) {
          const a2 = Math.random() * Math.PI * 2,
            r2 = 3 + Math.random() * 28 * burstRate;
          b.active = true;
          b.x = cx + Math.cos(a2) * r2;
          b.y = cy + Math.sin(a2) * r2;
          const spd = 0.4 + Math.random() * 1.8 * burstRate;
          b.vx = Math.cos(a2) * spd + (Math.random() - 0.5) * 0.5;
          b.vy = Math.sin(a2) * spd - 0.3 * burstRate;
          b.hue = Math.random() * 360;
          b.alpha = burstRate * 0.9;
          b.size = 0.8 + Math.random() * 2 * burstRate;
          b.life = 0;
          b.maxLife = 25 + Math.random() * 40;
        }
      }
      for (const b of burstStars) {
        if (!b.active) continue;
        b.life++;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.96;
        b.vy *= 0.96;
        const progress = b.life / b.maxLife;
        b.alpha = burstRate * (1 - progress) * 0.85;
        if (b.life >= b.maxLife || b.alpha < 0.01) {
          b.active = false;
          continue;
        }
        drawStar(b.x, b.y, b.size * 1.5, b.hue, 90, 85, b.alpha * tA);
      }
    }

    // Shooting rays from core (active moods)
    if (!isDrained && !isSleeping) {
      const rayCount =
        currentMood === 'excited' ? 12 : currentMood === 'focused' ? 8 : 5;
      const rayLen =
        currentMood === 'excited' ? W * 0.48 : W * 0.32;
      const rayAlpha =
        currentMood === 'excited' ? 0.12 : currentMood === 'focused' ? 0.09 : 0.06;
      const coreHue = (t * 40) % 360;
      for (let i = 0; i < rayCount; i++) {
        const ra =
          t * 0.25 + i * (Math.PI * 2 / rayCount) + Math.sin(t * 0.8 + i) * 0.3;
        const rLen = rayLen * (0.7 + Math.sin(t * 1.5 + i * 1.3) * 0.3);
        drawRay(
          cx,
          cy,
          cx + Math.cos(ra) * rLen,
          cy + Math.sin(ra) * rLen,
          (coreHue + i * (360 / rayCount)) % 360,
          rayAlpha,
          0.8 + Math.random() * 0.5
        );
      }
    }

    // Beating core
    const pulse = isDrained ? 0.15 + Math.sin(t * 1) * 0.08 : 0.65 + Math.sin(t * 4.5) * 0.35;
    const coreH = isDrained ? 215 : (t * 45) % 360;
    const coreR = isDrained ? 8 : 20;
    for (let r = coreR; r >= 3; r -= 3) {
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(
        0,
        `hsla(${coreH},${isDrained ? 15 : 95}%,${isDrained ? 45 : 99}%,${pulse * (r < 6 ? 0.8 : 0.35)})`
      );
      cg.addColorStop(
        0.6,
        `hsla(${(coreH + 60) % 360},${isDrained ? 10 : 88}%,${isDrained ? 35 : 72}%,${pulse * 0.18})`
      );
      cg.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = cg;
      ctx.fill();
    }
  }
  draw();
})();
