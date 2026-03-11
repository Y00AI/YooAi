/**
 * @file cyborg-effects.js
 * @description YooAI 智能体灵魂动画 - 特效渲染模块
 * @module YooAI/Canvas/Cyborg/Effects
 * @version 2.0.0
 * @author 王工
 *
 * @dependencies 无
 *
 * @exports
 * - window.CyborgEffects.createEffectRenderer(ctx) - 创建特效渲染器
 * - window.CyborgEffects.drawGlowDot(ctx, ...) - 绘制辉光点
 * - window.CyborgEffects.drawStar(ctx, ...) - 绘制星形
 * - window.CyborgEffects.drawRay(ctx, ...) - 绘制光线
 */

(function(global) {
  'use strict';

  /**
   * 创建特效渲染器
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
   * @returns {Object} 特效渲染函数集合
   */
  function createEffectRenderer(ctx) {
    /**
     * 绘制辉光点
     */
    function drawGlowDot(x, y, size, hue, sat, lit, alpha) {
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

    /**
     * 绘制星形（四角十字星）
     */
    function drawStar(x, y, size, hue, sat, lit, alpha) {
      if (!isFinite(x) || !isFinite(y) || !isFinite(size) || size <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
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
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue},20%,100%,${alpha})`;
      ctx.fill();
      ctx.restore();
    }

    /**
     * 绘制光线
     */
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

    return {
      drawGlowDot,
      drawStar,
      drawRay,
    };
  }

  /**
   * 静态方法（直接调用，需要传入 ctx）
   */
  function drawGlowDot(ctx, x, y, size, hue, sat, lit, alpha) {
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

  function drawStar(ctx, x, y, size, hue, sat, lit, alpha) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(size) || size <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
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
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},20%,100%,${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  function drawRay(ctx, x1, y1, x2, y2, hue, alpha, width) {
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

  global.CyborgEffects = {
    createEffectRenderer,
    drawGlowDot,
    drawStar,
    drawRay
  };

})(typeof window !== 'undefined' ? window : this);
