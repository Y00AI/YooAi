/**
 * @file mood-system.js
 * @description 情绪系统模块 - 管理智能体情绪状态、渲染情绪UI、处理情绪事件
 * @module YooAI/Core/MoodSystem
 * @version 2.0.0
 * @author 张工
 *
 * @dependencies
 * - Gateway (gateway.js) - 用于检查连接状态
 *
 * @exports
 * - window.MoodSystem.init() - 初始化情绪系统
 * - window.MoodSystem.onEvent(deltas) - 触发情绪变化
 * - window.MoodSystem.renderMood() - 渲染情绪UI
 * - window.MoodSystem.getState() - 获取当前情绪状态
 * - window.MoodSystem.setState(state) - 设置情绪状态
 * - window.MoodSystem.setAgentBusy(busy) - 设置智能体忙碌状态
 * - window.MoodSystem.isAgentBusy() - 获取智能体忙碌状态
 * - window.MoodSystem.onIdle(callback) - 注册空闲回调
 *
 * @example
 * // 初始化情绪系统
 * MoodSystem.init();
 *
 * // 触发情绪变化
 * MoodSystem.onEvent({ vibe: +5, brain: -0.5, chaos: +8 });
 *
 * // 获取当前状态
 * const state = MoodSystem.getState();
 * console.log(state.moodVibe, state.moodEnergy);
 *
 * @architecture
 * 情绪状态变量 (0-100):
 * - moodAct: 活跃度
 * - moodVibe: 心情值
 * - moodBrain: 大脑活跃度
 * - moodFocus: 专注度
 * - moodEnergy: 能量值
 */

(function() {
  'use strict';

  // === MOOD STATE (all 0-100) ===
  let moodAct = 10;      // 活跃度
  let moodVibe = 50;     // 心情值
  let moodBrain = 50;    // 大脑活跃度
  let moodFocus = 80;    // 专注度
  let moodEnergy = 100;  // 能量值

  // === EVENT TRACKING ===
  let eventBurst = 0;
  let lastEventTime = 0;
  let agentBusy = false;

  // 空闲回调
  const idleCallbacks = [];

  // === UTILITY FUNCTIONS ===

  /**
   * 限制数值在指定范围内
   * @param {number} v - 值
   * @param {number} mn - 最小值
   * @param {number} mx - 最大值
   * @returns {number} 限制后的值
   */
  function clamp(v, mn, mx) {
    return Math.max(mn, Math.min(mx, v));
  }

  // === MOOD RENDERING ===

  /**
   * 渲染情绪UI
   * 更新情绪条、表情、文字描述和粒子动画
   */
  function renderMood() {
    const actBar = document.getElementById('actBar');
    const vibeBar = document.getElementById('vibeBar');
    const chaosBar = document.getElementById('chaosBar');
    const energyBar = document.getElementById('energyBar');

    if (actBar) actBar.style.width = moodAct + '%';
    if (vibeBar) vibeBar.style.width = moodVibe + '%';
    if (chaosBar) chaosBar.style.width = moodFocus + '%';
    if (energyBar) energyBar.style.width = moodEnergy + '%';

    // 计算情绪表情和描述
    let emoji, name, sub;
    if (!agentBusy && moodAct < 20) {
      emoji = '😴'; name = '休眠中'; sub = '等待任务中~';
    } else if (!agentBusy) {
      emoji = '😌'; name = '休息中'; sub = '任务完成~';
    } else if (moodEnergy < 5) {
      emoji = '🪫'; name = '精疲力竭'; sub = '能量耗尽...';
    } else if (moodFocus < 12) {
      emoji = '🤯'; name = '不知所措'; sub = '任务太重了...';
    } else if (moodVibe < 25) {
      emoji = '😤'; name = '艰难中'; sub = '情况有点棘手...';
    } else if (moodBrain > 80) {
      emoji = '🤔'; name = '深思中'; sub = '深度推理模式...';
    } else if (moodAct > 80) {
      emoji = '🎯'; name = '专注中'; sub = '全神贯注！';
    } else if (moodVibe > 75) {
      emoji = '✨'; name = '状态极佳'; sub = '感觉很好！';
    } else {
      emoji = '🤔'; name = '思考中...'; sub = '正在处理...';
    }

    const moodEmoji = document.getElementById('moodEmoji');
    const moodName = document.getElementById('moodName');
    const moodSub = document.getElementById('moodSub');

    if (moodEmoji) moodEmoji.textContent = emoji;
    if (moodName) moodName.textContent = name;
    if (moodSub) moodSub.textContent = sub;

    // 更新粒子动画状态
    if (window._setCyborgMood) {
      window._soulEnergy = moodEnergy;
      if (!agentBusy && moodEnergy < 5) window._setCyborgMood('exhausted');
      else if (!agentBusy) window._setCyborgMood('sleeping');
      else if (moodFocus < 12) window._setCyborgMood('frustrated');
      else if (moodVibe > 75) window._setCyborgMood('vibing');
      else if (moodBrain > 75) window._setCyborgMood('thinking');
      else if (moodAct > 75) window._setCyborgMood('focused');
      else if (moodVibe > 55) window._setCyborgMood('excited');
      else window._setCyborgMood('thinking');
    }
  }

  /**
   * 处理情绪事件
   * @param {Object} deltas - 情绪变化量
   * @param {number} [deltas.brain] - 大脑活跃度变化
   * @param {number} [deltas.vibe] - 心情变化
   * @param {number} [deltas.chaos] - 混乱度变化（会降低专注度）
   */
  function onEvent(deltas = {}) {
    const now = Date.now();
    const wasIdle = !agentBusy;
    lastEventTime = now;
    eventBurst++;
    agentBusy = true;

    moodAct = clamp(moodAct + 18, 10, 100);

    if (wasIdle) { moodBrain = 100; moodFocus = 80; }
    if (deltas.brain != null) moodBrain = clamp(moodBrain + deltas.brain, 0, 100);
    if (deltas.vibe != null) moodVibe = clamp(moodVibe + deltas.vibe, 0, 100);
    if (deltas.chaos != null) moodFocus = clamp(moodFocus - deltas.chaos, 0, 100);

    moodEnergy = clamp(moodEnergy - 0.3, 0, 100);
    renderMood();
  }

  /**
   * 情绪时钟更新
   * 定期更新情绪状态，处理空闲恢复
   */
  function moodTick() {
    if (typeof Gateway !== 'undefined' && !Gateway.isConnected()) return;

    const now = Date.now();
    const idleMs = now - lastEventTime;
    const IDLE_THRESHOLD = 8000;

    // 检测空闲状态
    if (idleMs > IDLE_THRESHOLD && agentBusy) {
      // 触发空闲回调
      idleCallbacks.forEach(cb => {
        try { cb(); } catch (e) { console.error('[MoodSystem] Idle callback error:', e); }
      });

      agentBusy = false;
      moodAct = clamp(moodAct - 40, 10, 100);
      moodFocus = clamp(moodFocus + 20, 0, 100);
      moodBrain = clamp(moodBrain - 20, 20, 100);
      moodVibe = clamp(moodVibe - 10, 40, 100);
      renderMood();
      return;
    }

    // 忙碌状态下的情绪衰减
    if (agentBusy) {
      moodVibe = clamp(moodVibe + 1, 0, 100);
      moodBrain = clamp(moodBrain - 0.4, 0, 100);
      moodEnergy = clamp(moodEnergy - 0.4, 0, 100);
      moodFocus = clamp(moodFocus - 0.2, 0, 100);
      renderMood();
      return;
    }

    // 空闲状态下的情绪恢复
    if (!agentBusy) {
      moodAct = clamp(moodAct - 3, 10, 100);
      moodVibe = clamp(moodVibe + (moodVibe < 50 ? 1 : -1), 40, 60);
      moodBrain = clamp(moodBrain + 1, 20, 100);
      moodFocus = clamp(moodFocus + 1, 0, 100);
      if (moodAct < 20) moodEnergy = clamp(moodEnergy + 3, 0, 100);
      renderMood();
    }
  }

  // === PUBLIC API ===

  /**
   * 初始化情绪系统
   */
  function init() {
    // 启动情绪时钟
    setInterval(moodTick, 500);
    console.log('[MoodSystem] Initialized');
  }

  /**
   * 获取当前情绪状态
   * @returns {Object} 情绪状态对象
   */
  function getState() {
    return {
      moodAct,
      moodVibe,
      moodBrain,
      moodFocus,
      moodEnergy,
      agentBusy,
      eventBurst,
      lastEventTime
    };
  }

  /**
   * 设置情绪状态
   * @param {Object} state - 情绪状态对象
   */
  function setState(state) {
    if (state.moodAct != null) moodAct = clamp(state.moodAct, 0, 100);
    if (state.moodVibe != null) moodVibe = clamp(state.moodVibe, 0, 100);
    if (state.moodBrain != null) moodBrain = clamp(state.moodBrain, 0, 100);
    if (state.moodFocus != null) moodFocus = clamp(state.moodFocus, 0, 100);
    if (state.moodEnergy != null) moodEnergy = clamp(state.moodEnergy, 0, 100);
    renderMood();
  }

  /**
   * 设置智能体忙碌状态
   * @param {boolean} busy - 是否忙碌
   */
  function setAgentBusy(busy) {
    agentBusy = busy;
    if (busy) {
      lastEventTime = Date.now();
    }
    renderMood();
  }

  /**
   * 获取智能体忙碌状态
   * @returns {boolean} 是否忙碌
   */
  function isAgentBusy() {
    return agentBusy;
  }

  /**
   * 注册空闲回调
   * @param {Function} callback - 空闲时调用的回调函数
   */
  function onIdle(callback) {
    if (typeof callback === 'function') {
      idleCallbacks.push(callback);
    }
  }

  // 暴露到全局命名空间
  window.MoodSystem = {
    init,
    onEvent,
    renderMood,
    getState,
    setState,
    setAgentBusy,
    isAgentBusy,
    onIdle,
    // 暴露工具函数
    clamp
  };

})();
