/**
 * @file cyborg-particles.js
 * @description YooAI 智能体灵魂动画 - 粒子系统模块
 * @module YooAI/Canvas/Cyborg/Particles
 * @version 2.0.0
 * @author 王工
 *
 * @dependencies
 * - CyborgMoods (cyborg-moods.js)
 *
 * @exports
 * - window.CyborgParticles.createBaseParticle(cx, cy) - 创建基础粒子
 */

(function(global) {
  'use strict';

  const BURST_COUNT = 45;

  /**
   * 创建基础粒子对象
   * @param {number} cx - 中心 X
   * @param {number} cy - 中心 Y
   * @returns {Object} 粒子对象
   */
  function createBaseParticle(cx, cy) {
    return {
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
      cx: 0,
      cy: 0,
      W: 0,
      H: 0,
    };
  }

  /**
   * 创建爆发能量星池
   * @param {number} cx - 中心 X
   * @param {number} cy - 中心 Y
   * @param {number} count - 数量
   * @returns {Array} 爆发星数组
   */
  function createBurstPool(cx, cy, count) {
    count = count || BURST_COUNT;
    return Array.from({ length: count }, function() {
      return {
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
      };
    });
  }

  global.CyborgParticles = {
    createBaseParticle,
    createBurstPool,
    BURST_COUNT
  };

})(typeof window !== 'undefined' ? window : this);
