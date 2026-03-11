/**
 * @file cyborg-core.js
 * @description YooAI 智能体灵魂动画 - 画布核心模块
 * @module YooAI/Canvas/Cyborg/Core
 * @version 2.0.0
 * @author 王工
 *
 * @dependencies
 * - CyborgMoods (cyborg-moods.js)
 * - CyborgEffects (cyborg-effects.js)
 * - CyborgParticles (cyborg-particles.js)
 *
 * @global
 * - window._setCyborgMood(moodKey) - 设置情绪状态
 * - window._brainFire(start, len) - 触发神经元激活 (占位符)
 * - window._soulEnergy - 能量值 (0-100, 可读写)
 * - window._cyborgReady - 就绪标志 (boolean)
 */

(function(global) {
  'use strict';

  /**
   * 初始化智能体灵魂画布
   */
  function initCyborgCanvas() {
    const canvas = document.getElementById('cyborgCanvas');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');

    // 检查依赖
    if (typeof CyborgMoods === 'undefined' || typeof CyborgEffects === 'undefined') {
      console.error('[CyborgCore] Missing dependencies: CyborgMoods or CyborgEffects');
      return null;
    }

    const MOODS = CyborgMoods.MOODS;
    const DEFAULT_MOOD = CyborgMoods.DEFAULT_MOOD;

    // 画布尺寸状态
    let W = 300, H = 340, cx = W / 2, cy = H / 2 + 10;

    function resize() {
      W = canvas.offsetWidth || 300;
      H = canvas.offsetHeight || 340;
      canvas.width = W * window.devicePixelRatio;
      canvas.height = H * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      cx = W / 2;
      cy = H / 2 + 10;
    }

    resize();
    window.addEventListener('resize', function() {
      resize();
    });

    // 创建特效渲染器
    const effects = CyborgEffects.createEffectRenderer(ctx);

    // 粒子系统状态
    let currentMood = DEFAULT_MOOD;
    let t = 0;
    let transAlpha = 1;
    let transitioning = false;
    global._soulEnergy = 100;

    // 粒子池
    let particles = [];
    let burstStars = [];

    /**
     * 生成粒子池
     */
    function spawnParticles(moodKey) {
      const m = MOODS[moodKey] || MOODS.sleeping;
      particles = Array.from({ length: m.count }, function(_, i) {
        const p = CyborgParticles.createBaseParticle(cx, cy);
        p.cx = cx;
        p.cy = cy;
        p.W = W;
        p.H = H;
        m.init(p, i);
        return p;
      });
    }

    // 初始化爆发星池
    burstStars = CyborgParticles.createBurstPool(cx, cy, CyborgParticles.BURST_COUNT);

    // 初始化粒子
    spawnParticles(DEFAULT_MOOD);
    global._cyborgReady = true;

    /**
     * 设置情绪状态（全局 API）
     */
    global._setCyborgMood = function(moodKey) {
      if (moodKey === currentMood && moodKey !== 'exhausted') return;
      currentMood = moodKey;
      const m = MOODS[moodKey] || MOODS.sleeping;
      transitioning = true;
      transAlpha = 1;
      setTimeout(function() {
        spawnParticles(moodKey);
        transitioning = false;
        transAlpha = 0;
      }, 300);
      const ge = function(id) { return document.getElementById(id); };
      if (ge('cyborgStatus')) ge('cyborgStatus').textContent = m.status;
      if (ge('cyborgMood')) ge('cyborgMood').textContent = m.label;
      const dc = ['rgba(160,240,240,', 'rgba(249,228,154,', 'rgba(249,160,112,'];
      const dots = ge('cyborgDots') ? ge('cyborgDots').children : null;
      if (dots) {
        for (let i = 0; i < dots.length; i++) {
          const v = m.dots[i];
          dots[i].style.background = dc[i] + v + ')';
          dots[i].style.boxShadow = v > 0.5 ? '0 0 6px ' + dc[i] + '0.8)' : 'none';
        }
      }
    };

    // Placeholder for brain fire
    global._brainFire = function(start, len) {
      // Brain fire animation is handled by a separate canvas module
    };

    /**
     * 主渲染循环
     */
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
          const dx = p.trail.x2 - p.trail.x1;
          const dy = p.trail.y2 - p.trail.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.3) continue;
          effects.drawRay(
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
        ctx.save();
        for (const ring in thinkRingMap) {
          const rp = thinkRingMap[ring];
          if (rp.length < 2) continue;
          rp.sort(function(a, b) { return a.targetAngle - b.targetAngle; });
          for (let i = 0; i < rp.length; i++) {
            const a = rp[i];
            const b = rp[(i + 1) % rp.length];
            const lineAlpha = Math.min(a.orderProgress, b.orderProgress) * 0.18 * tA;
            if (lineAlpha < 0.02) continue;
            ctx.globalAlpha = lineAlpha;
            ctx.strokeStyle = 'hsl(' + a.hue + ',70%,75%)';
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
          effects.drawGlowDot(p.x, p.y, p.size, p.hue, p.sat, p.lit, a * 0.6);
        } else if (isSleeping && p.type === 2) {
          ctx.save();
          ctx.globalAlpha = a * 0.7;
          const wg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          wg.addColorStop(0, 'hsla(' + p.hue + ',' + p.sat + '%,88%,1)');
          wg.addColorStop(1, 'hsla(' + p.hue + ',' + p.sat + '%,70%,0)');
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 2.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = wg;
          ctx.fill();
          ctx.restore();
        } else if (isSleeping && p.type === 3) {
          effects.drawGlowDot(p.x, p.y, p.size * 1.6, p.hue, p.sat, p.lit, a * 0.65);
        } else if (p.isStar) {
          effects.drawStar(p.x, p.y, p.size * 1.8, p.hue, 90, 85, a);
          ctx.save();
          ctx.globalAlpha = a * 0.15;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = 'hsl(' + p.hue + ',80%,80%)';
          ctx.fill();
          ctx.restore();
        } else {
          effects.drawGlowDot(p.x, p.y, p.size, p.hue, p.sat || 80, p.lit || 65, a);
        }
      }

      // Burst energy stars (sleeping mode only)
      if (isSleeping) {
        const breath = Math.sin(t * 0.55) * 0.5 + 0.5;
        for (let ring = 0; ring < 3; ring++) {
          const ringPhase = (t * 0.55 + ring * Math.PI * 0.66) % (Math.PI * 2);
          const ringR = Math.max(1, 20 + Math.sin(ringPhase) * 32 + ring * 12);
          const ringA = (0.03 + breath * 0.04) * (1 - ring * 0.28) * tA;
          if (ringA > 0.005) {
            ctx.save();
            ctx.globalAlpha = ringA;
            ctx.strokeStyle = 'hsl(' + (220 + ring * 18) + ',60%,72%)';
            ctx.lineWidth = 1.2 - ring * 0.3;
            ctx.beginPath();
            ctx.ellipse(cx, cy, ringR, ringR * 0.72, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        const energy = global._soulEnergy || 0;
        const burstRate = Math.max(0, (energy - 35) / 65);
        if (burstRate > 0.05 && Math.random() < burstRate * 0.18) {
          const b = burstStars.find(function(b) { return !b.active; });
          if (b) {
            const a2 = Math.random() * Math.PI * 2;
            const r2 = 3 + Math.random() * 28 * burstRate;
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
        for (let i = 0; i < burstStars.length; i++) {
          const b = burstStars[i];
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
          effects.drawStar(b.x, b.y, b.size * 1.5, b.hue, 90, 85, b.alpha * tA);
        }
      }

      // Shooting rays from core (active moods)
      if (!isDrained && !isSleeping) {
        const rayCount = currentMood === 'excited' ? 12 : currentMood === 'focused' ? 8 : 5;
        const rayLen = currentMood === 'excited' ? W * 0.48 : W * 0.32;
        const rayAlpha = currentMood === 'excited' ? 0.12 : currentMood === 'focused' ? 0.09 : 0.06;
        const coreHue = (t * 40) % 360;
        for (let i = 0; i < rayCount; i++) {
          const ra = t * 0.25 + i * (Math.PI * 2 / rayCount) + Math.sin(t * 0.8 + i) * 0.3;
          const rLen = rayLen * (0.7 + Math.sin(t * 1.5 + i * 1.3) * 0.3);
          effects.drawRay(
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
          'hsla(' + coreH + ',' + (isDrained ? 15 : 95) + '%,' + (isDrained ? 45 : 99) + '%,' + (pulse * (r < 6 ? 0.8 : 0.35)) + ')'
        );
        cg.addColorStop(
          0.6,
          'hsla(' + ((coreH + 60) % 360) + ',' + (isDrained ? 10 : 88) + '%,' + (isDrained ? 35 : 72) + '%,' + (pulse * 0.18) + ')'
        );
        cg.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();
      }
    }

    // 启动渲染循环
    draw();

    // 返回控制器
    return {
      setMood: function(moodKey) { global._setCyborgMood(moodKey); },
      getMood: function() { return currentMood; },
      getEnergy: function() { return global._soulEnergy; },
      setEnergy: function(val) { global._soulEnergy = val; },
      isReady: function() { return global._cyborgReady; },
    };
  }

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCyborgCanvas);
  } else {
    initCyborgCanvas();
  }

  global.CyborgCore = {
    init: initCyborgCanvas
  };

})(typeof window !== 'undefined' ? window : this);
