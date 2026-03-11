/**
 * @file canvas-bg.js
 * @description YooAI 背景浮游粒子动画 - 创建沉浸式的背景氛围效果
 * @module YooAI/CanvasBg
 * @version 2.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - Canvas 元素 ID: bgCanvas
 *
 * @exports
 * - initBg(canvasId) - 初始化背景动画
 *
 * @example
 * // 在 DOM 加载后初始化
 * document.addEventListener('DOMContentLoaded', () => {
 *   initBg('bgCanvas');
 * });
 *
 * @architecture
 * 粒子系统:
 * - 80个浮游粒子
 * - 随机大小、位置、速度
 * - 半透明渐变效果
 *
 * 颜色方案:
 * - 青色: rgba(100, 220, 220, 0.4)
 * - 橙色: rgba(245, 130, 105, 0.4)
 * - 粉色: rgba(247, 195, 155, 0.4)
 * - 玫红: rgba(242, 165, 195, 0.4)
 * - 金色: rgba(249, 228, 140, 0.4)
 */

(function(global) {
  'use strict';

  let animationId = null;
  let resizeHandler = null;

  /**
   * Initialize background particle animation
   * @param {string} canvasId - Canvas element ID (default: 'bgCanvas')
   */
  function initBg(canvasId) {
    canvasId = canvasId || 'bgCanvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('initBg: Canvas element not found with id:', canvasId);
      return;
    }

    const ctx = canvas.getContext('2d');
    let W, H;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();

    // Remove previous resize handler if exists
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
    }
    resizeHandler = resize;
    window.addEventListener('resize', resize);

    const COUNT = 80;
    const particles = Array.from({ length: COUNT }, function() {
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.1,
        size: 1.5 + Math.random() * 3.5,
        hue: Math.random() * 360,
        hueSpeed: 0.3 + Math.random() * 0.5,
        alpha: 0.1 + Math.random() * 0.35,
        alphaSpeed: 0.003 + Math.random() * 0.005,
        alphaDir: 1,
        phase: Math.random() * Math.PI * 2,
        wobble: 0.2 + Math.random() * 0.4
      };
    });

    function draw() {
      animationId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.hue = (p.hue + p.hueSpeed) % 360;
        p.phase += 0.008;
        p.x += p.vx + Math.sin(p.phase) * p.wobble;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        // Breathe alpha
        p.alpha += p.alphaSpeed * p.alphaDir;
        if (p.alpha > 0.45 || p.alpha < 0.05) p.alphaDir *= -1;

        // Prismatic glow - two layered circles
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        grd.addColorStop(0, 'hsla(' + p.hue + ', 100%, 80%, ' + p.alpha + ')');
        grd.addColorStop(0.4, 'hsla(' + ((p.hue + 40) % 360) + ', 90%, 65%, ' + (p.alpha * 0.5) + ')');
        grd.addColorStop(1, 'hsla(' + ((p.hue + 80) % 360) + ', 80%, 50%, 0)');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Bright core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue + ', 100%, 92%, ' + (p.alpha * 1.5) + ')';
        ctx.fill();
      }
    }

    // Cancel any existing animation
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    draw();
  }

  /**
   * Stop the background animation
   */
  function stopBg() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
  }

  // Export to global scope
  global.initBg = initBg;
  global.stopBg = stopBg;

})(typeof window !== 'undefined' ? window : this);
