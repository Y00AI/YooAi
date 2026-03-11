/**
 * @file cyborg-moods.js
 * @description YooAI 智能体灵魂动画 - 情绪配置模块
 * @module YooAI/Canvas/Cyborg/Moods
 * @version 2.0.0
 * @author 王工
 *
 * @dependencies 无
 *
 * @exports
 * - window.CyborgMoods.MOODS - 情绪配置对象
 * - window.CyborgMoods.MOOD_KEYS - 情绪键名列表
 * - window.CyborgMoods.DEFAULT_MOOD - 默认情绪
 */

(function(global) {
  'use strict';

  /**
   * 情绪状态配置对象
   * @type {Object.<string, MoodConfig>}
   */
  const MOODS = {
    sleeping: {
      label: '😴 休眠中',
      status: '待机',
      dots: [1.2, 0.2, 0.2],
      count: 620,
      hues: [220, 240, 260, 200, 210, 250],
      init(p, i) {
        if (i < 200) {
          p.type = 0;
          p.angle = Math.random() * Math.PI * 2;
          p.radius = 12 + Math.random() * 110;
          p.x = p.cx + Math.cos(p.angle) * p.radius;
          p.y = p.cy + Math.sin(p.angle) * p.radius;
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
          p.type = 1;
          p.isStar = true;
          p.x = p.cx + (Math.random() - 0.5) * p.W * 0.95;
          p.y = p.cy + (Math.random() - 0.5) * p.H * 0.95;
          p.hue = 190 + Math.random() * 160;
          p.size = 0.3 + Math.random() * 2.2;
          p.alpha = 0;
          p.life = Math.random() * Math.PI * 2;
          p.lifeSpeed = 0.005 + Math.random() * 0.01;
          p.twinklePhase = Math.random() * Math.PI * 2;
          p.twinkleSpeed = 0.012 + Math.random() * 0.022;
        } else if (i < 520) {
          p.type = 2;
          p.x = p.cx + (Math.random() - 0.5) * 120;
          p.y = p.cy + 20 + Math.random() * 60;
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
          p.type = 3;
          p.angle = Math.random() * Math.PI * 2;
          p.radius = 55 + Math.random() * 55;
          p.x = p.cx + Math.cos(p.angle) * p.radius;
          p.y = p.cy + Math.sin(p.angle) * p.radius * 0.38;
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
        const breath = Math.sin(t * 0.55) * 0.5 + 0.5;
        if (p.type === 0) {
          const breathR = p.radius * (0.88 + breath * 0.24);
          p.angle += p.swirlSpeed * (0.5 + breath * 0.5);
          const tx = p.cx + Math.cos(p.angle) * breathR + Math.sin(p.life * p.wobbleFreq) * p.wobbleAmt * 8;
          const ty = p.cy + Math.sin(p.angle) * breathR * 0.75 + Math.cos(p.life * p.wobbleFreq) * p.wobbleAmt * 4;
          p.x += (tx - p.x) * 0.04;
          p.y += (ty - p.y) * 0.04;
          p.alpha = 0.18 + breath * 0.22 + Math.abs(Math.sin(p.life)) * 0.2;
          p.hue = (p.hue + 0.08) % 360;
        } else if (p.type === 1) {
          p.life += p.twinkleSpeed - p.lifeSpeed;
          p.alpha = 0.15 + Math.abs(Math.sin(p.life + p.twinklePhase)) * 0.35;
          p.x += Math.sin(p.life * 0.1) * 0.04;
          p.y += Math.cos(p.life * 0.08) * 0.03;
        } else if (p.type === 2) {
          p.y -= p.riseSpeed * (0.4 + breath * 0.6);
          p.x += p.driftX + Math.sin(p.life * 0.8) * 0.3;
          const risen = p.birthY - p.y;
          const progress = Math.min(1, risen / p.travelDist);
          p.alpha = progress < 0.2 ? (progress / 0.2) * 0.55 : (1 - progress) * 0.55;
          if (progress >= 1) {
            p.x = p.cx + (Math.random() - 0.5) * 120;
            p.y = p.cy + 20 + Math.random() * 60;
            p.birthY = p.y;
            p.driftX = (Math.random() - 0.5) * 0.2;
            p.hue = 200 + Math.random() * 80;
          }
        } else {
          p.angle += p.swirlSpeed * (0.6 + breath * 0.4);
          const tx = p.cx + Math.cos(p.angle) * p.radius;
          const ty = p.cy + Math.sin(p.angle) * p.radius * 0.35 + Math.sin(p.life * 0.5) * 6;
          p.x += (tx - p.x) * 0.03;
          p.y += (ty - p.y) * 0.03;
          p.hue = (p.hue + 0.12) % 360;
          p.alpha = 0.14 + breath * 0.18 + Math.sin(p.life) * 0.08;
          p.size = 2 + Math.sin(p.life * 0.7) * 2;
        }
      },
      glow: { r: 55, col: 'rgba(80,60,200,0.08)' },
    },
    thinking: {
      label: '🤔 思考中',
      status: '处理中',
      dots: [1, 0.4, 0.2],
      count: 480,
      hues: [180, 200, 220, 160, 170],
      init(p, i) {
        const RINGS = 6;
        const ringCounts = [8, 16, 26, 38, 52, 68];
        const ringRadii = [18, 36, 56, 78, 102, 128];
        let ring = 0, cumulative = 0;
        for (let r = 0; r < RINGS; r++) {
          cumulative += ringCounts[r];
          if (i < cumulative) { ring = r; break; }
          if (r === RINGS - 1) ring = r;
        }
        const ringTotal = ringCounts[ring];
        const ringIdx = i - (cumulative - ringCounts[ring]);
        const targetAngle = (ringIdx / ringTotal) * Math.PI * 2;
        p.ring = ring;
        p.ringIdx = ringIdx;
        p.ringTotal = ringTotal;
        p.targetR = ringRadii[ring];
        p.targetAngle = targetAngle;
        const scatterR = 20 + Math.random() * 130;
        const scatterA = Math.random() * Math.PI * 2;
        p.x = p.cx + Math.cos(scatterA) * scatterR;
        p.y = p.cy + Math.sin(scatterA) * scatterR;
        p.angle = scatterA;
        p.radius = scatterR;
        p.orbitSpeed = (0.003 + ring * 0.0008) * (ring % 2 === 0 ? 1 : -1);
        p.hue = this.hues[ring % this.hues.length] + Math.random() * 20;
        p.sat = 75 + Math.random() * 20;
        p.lit = 58 + Math.random() * 22;
        p.size = 0.8 + Math.random() * (ring < 2 ? 2.5 : 1.8);
        p.alpha = 0;
        p.life = Math.random() * Math.PI * 2;
        p.lifeSpeed = 0.012 + Math.random() * 0.01;
        p.orderDelay = ring * 38 + Math.random() * 25;
        p.orderProgress = 0;
        p.orderAge = 0;
        p.isStar = ring >= 4 && Math.random() < 0.35;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        p.orderAge++;
        if (p.orderAge > p.orderDelay) {
          p.orderProgress = Math.min(1, p.orderProgress + 0.006);
        }
        const op = p.orderProgress;
        p.targetAngle += p.orbitSpeed;
        const tX = p.cx + Math.cos(p.targetAngle) * p.targetR;
        const tY = p.cy + Math.sin(p.targetAngle) * p.targetR;
        const chaos = 1 - op;
        const jitter = chaos * 12;
        const wobble = chaos * (Math.sin(p.life * 2.1 + p.ring) * jitter);
        const wobbleY = chaos * (Math.cos(p.life * 1.8 + p.ring) * jitter);
        const lerpSpeed = 0.015 + op * 0.04;
        p.x += (tX + wobble - p.x) * lerpSpeed;
        p.y += (tY + wobbleY - p.y) * lerpSpeed;
        p.trail = null;
        const baseHue = this.hues[p.ring % this.hues.length];
        p.hue = baseHue + chaos * 40 + Math.sin(p.life + p.ring) * (10 + chaos * 20);
        const lockBoost = op * 0.35;
        p.alpha = 0.2 + lockBoost + Math.abs(Math.sin(p.life)) * (0.4 - op * 0.25);
        p.size = (0.9 + Math.sin(p.life * 2) * 0.4) * (1 + chaos * 0.5);
      },
      glow: { r: 80, col: 'rgba(0,180,255,0.10)' },
    },
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
        p.radius = 6 + p.wave * p.W * 0.44;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.y = p.cy + Math.sin(p.angle) * p.radius;
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
        const px = p.x, py = p.y;
        p.x = p.cx + Math.cos(p.angle) * p.radius + Math.sin(t * 2.5 + p.life) * 1.2;
        p.y = p.cy + Math.sin(p.angle) * p.radius + Math.cos(t * 2 + p.life) * 1.2;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        p.hue = this.hues[p.arm % this.hues.length] + Math.sin(t * 1.5 + p.arm) * 30;
        p.alpha = p.isStar ? 0.5 + Math.abs(Math.sin(p.life * 5)) * 0.5 : 0.4 + Math.sin(p.life) * 0.4;
        p.size = 0.8 + Math.sin(p.life * 3) * 0.6;
      },
      glow: { r: 60, col: 'rgba(0,255,160,0.13)' },
    },
    excited: {
      label: '🥳 激活',
      status: '激活',
      dots: [1, 1, 0.4],
      count: 650,
      hues: [0, 30, 60, 120, 180, 240, 300],
      init(p, i) {
        const a = Math.random() * Math.PI * 2;
        p.speed = 0.8 + Math.random() * 4;
        p.x = p.cx;
        p.y = p.cy;
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
        const cs = Math.cos(p.swirl), sn = Math.sin(p.swirl);
        const nvx = p.vx * cs - p.vy * sn, nvy = p.vx * sn + p.vy * cs;
        const px = p.x, py = p.y;
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
          p.x = p.cx + (Math.random() - 0.5) * 15;
          p.y = p.cy + (Math.random() - 0.5) * 15;
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
    frustrated: {
      label: '😤 异常',
      status: '异常',
      dots: [1, 0.2, 0.1],
      count: 480,
      hues: [0, 8, 18, 350, 340],
      init(p, i) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 80;
        p.x = p.cx + Math.cos(a) * r;
        p.y = p.cy + Math.sin(a) * r;
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
        const px = p.x, py = p.y;
        p.vx += (Math.random() - 0.5) * p.jitter;
        p.vy += (Math.random() - 0.5) * p.jitter;
        p.vx *= 0.89;
        p.vy *= 0.89;
        p.x += p.vx;
        p.y += p.vy;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        const dx = p.cx - p.x, dy = p.cy - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 100) { p.vx += (dx / d) * 0.5; p.vy += (dy / d) * 0.5; }
        p.hue = this.hues[Math.floor(p.life * 1.5) % this.hues.length];
        p.alpha = 0.4 + Math.abs(Math.sin(p.life * 4)) * 0.5;
      },
      glow: { r: 80, col: 'rgba(255,30,0,0.13)' },
    },
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
        p.radius = 10 + p.wave * p.W * 0.46;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.y = p.cy + Math.sin(p.angle) * p.radius;
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
        p.radius = p.baseRadius + Math.sin(t * 1.3 + p.wave * Math.PI * 5) * 22 + Math.sin(p.life) * 7;
        p.radius = Math.max(6, p.radius);
        const px = p.x, py = p.y;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.y = p.cy + Math.sin(p.angle) * p.radius;
        p.trail = { x1: px, y1: py, x2: p.x, y2: p.y };
        p.hue = (p.arm * 120 + p.wave * 180 + t * 35) % 360;
        p.alpha = p.isStar ? 0.45 + Math.abs(Math.sin(p.life * 4)) * 0.5 : 0.35 + Math.sin(p.life) * 0.38;
        p.size = 0.8 + Math.sin(p.life * 1.6) * 0.9 + 0.5;
      },
      glow: { r: 110, col: 'rgba(180,60,255,0.11)' },
    },
    exhausted: {
      label: '🪫 耗尽',
      status: '耗尽',
      dots: [0.1, 0.05, 0.05],
      count: 300,
      hues: [200, 210, 220, 230],
      init(p, i) {
        p.angle = Math.random() * Math.PI * 2;
        p.radius = 8 + Math.random() * 80;
        p.x = p.cx + Math.cos(p.angle) * p.radius;
        p.y = p.cy + Math.sin(p.angle) * p.radius;
        p.vx = 0;
        p.vy = 0;
        p.hue = this.hues[i % this.hues.length] + Math.random() * 20;
        p.sat = 55 + Math.random() * 30;
        p.lit = 50 + Math.random() * 20;
        p.alpha = 0.5 + Math.random() * 0.3;
        p.size = 1 + Math.random() * 2.5;
        p.life = Math.random() * Math.PI * 2;
        p.lifeSpeed = 0.004 + Math.random() * 0.005;
        p.depletionStart = 60 + Math.random() * 420;
        p.depletionAge = 0;
        p.settled = false;
        p.groundY = p.cy + 50 + Math.random() * 60 + (i % 6) * 7;
        p.swirlSpeed = (0.003 + Math.random() * 0.008) * (Math.random() < 0.5 ? 1 : -1);
        p.isStar = false;
        p.trail = null;
      },
      update(p, t) {
        p.life += p.lifeSpeed;
        p.depletionAge++;
        const depleting = p.depletionAge > p.depletionStart;
        const depletionProgress = depleting ? Math.min(1, (p.depletionAge - p.depletionStart) / 180) : 0;
        if (!p.settled) {
          if (!depleting) {
            p.angle += p.swirlSpeed * (1 - depletionProgress * 0.5);
            p.radius += Math.sin(p.life * 0.5) * 0.08;
            p.radius = Math.max(4, p.radius);
            p.x = p.cx + Math.cos(p.angle) * p.radius + Math.sin(p.life * 0.3) * 0.6;
            p.y = p.cy + Math.sin(p.angle) * p.radius + Math.cos(p.life * 0.25) * 0.5;
          } else {
            const orbitStrength = Math.max(0, 1 - depletionProgress * 1.4);
            p.angle += p.swirlSpeed * orbitStrength;
            const gravity = depletionProgress * 0.09;
            p.vy += gravity;
            p.vx *= 0.97;
            const ox = p.cx + Math.cos(p.angle) * p.radius;
            const oy = p.cy + Math.sin(p.angle) * p.radius;
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
              if (Math.abs(p.vy) < 0.1) { p.settled = true; p.vy = 0; p.vx = 0; }
            }
            if (p.x < p.cx - (p.W * 0.45)) { p.x = p.cx - p.W * 0.45; p.vx *= -0.25; }
            if (p.x > p.cx + (p.W * 0.45)) { p.x = p.cx + p.W * 0.45; p.vx *= -0.25; }
          }
        } else {
          p.x += Math.sin(p.life * 0.2) * 0.08;
        }
        const targetSat = Math.max(2, 55 - depletionProgress * 53);
        p.sat += (targetSat - p.sat) * 0.01;
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

  const MOOD_KEYS = Object.keys(MOODS);
  const DEFAULT_MOOD = 'sleeping';

  global.CyborgMoods = {
    MOODS,
    MOOD_KEYS,
    DEFAULT_MOOD
  };

})(typeof window !== 'undefined' ? window : this);
