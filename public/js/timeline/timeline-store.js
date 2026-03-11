/**
 * @file timeline-store.js
 * @description 时间线状态存储模块 - 管理时间线的状态变量和核心操作方法
 * @module YooAI/Timeline/Store
 * @version 2.0.0
 * @author 李工
 *
 * @dependencies
 * - 无外部依赖（纯状态管理）
 *
 * @exports
 * - window.YooAI.TimelineStore.tlTasks - 任务计数
 * - window.YooAI.TimelineStore.tlMsgs - 消息计数
 * - window.YooAI.TimelineStore.tlTools - 工具调用计数
 * - window.YooAI.TimelineStore.tlErrors - 错误计数
 * - window.YooAI.TimelineStore.tlTotalTokens - 总令牌数
 * - window.YooAI.TimelineStore.tlSessionTokens - 会话令牌数
 * - window.YooAI.TimelineStore.tlSessionStart - 会话开始时间
 * - window.YooAI.TimelineStore.tlCurrentTask - 当前任务对象
 * - window.YooAI.TimelineStore.tlTimerInterval - 计时器引用
 * - window.YooAI.TimelineStore.tlStartSession() - 开始会话计时
 * - window.YooAI.TimelineStore.tlStartTask(label) - 开始新任务
 * - window.YooAI.TimelineStore.tlCommitTask() - 提交当前任务
 * - window.YooAI.TimelineStore.tlAddTag(tag) - 添加标签到当前任务
 * - window.YooAI.TimelineStore.tlAddTool() - 增加工具调用计数
 * - window.YooAI.TimelineStore.tlAddError() - 增加错误计数
 * - window.YooAI.TimelineStore.tlAddTokens(n) - 增加令牌计数
 * - window.YooAI.TimelineStore.resetStats() - 重置所有统计
 * - window.YooAI.TimelineStore.getState() - 获取当前状态快照
 *
 * @example
 * // 开始新任务
 * YooAI.TimelineStore.tlStartTask('处理用户请求');
 *
 * // 添加标签和统计
 * YooAI.TimelineStore.tlAddTag('agent');
 * YooAI.TimelineStore.tlAddTool();
 * YooAI.TimelineStore.tlAddTokens(150);
 *
 * // 提交任务
 * YooAI.TimelineStore.tlCommitTask();
 */

(function() {
  'use strict';

  // === TIMELINE STATE ===
  let tlTasks = 0;
  let tlMsgs = 0;
  let tlTools = 0;
  let tlErrors = 0;
  let tlTotalTokens = 0;
  let tlSessionTokens = 0;
  let tlSessionStart = null;
  let tlCurrentTask = null;
  let tlTimerInterval = null;

  // Constants
  const TASK_DEBOUNCE = 5000;
  const TASK_DURATION_MS = 120000;

  /**
   * 开始会话计时
   * 初始化会话开始时间并启动计时器更新 UI
   */
  function tlStartSession() {
    if (tlSessionStart) return;
    tlSessionStart = Date.now();
    tlTimerInterval = setInterval(() => {
      if (!tlSessionStart) return;
      const s = Math.floor((Date.now() - tlSessionStart) / 1000);
      const m = Math.floor(s / 60), sec = s % 60;
      const timerEl = document.getElementById('sessionTimer');
      if (timerEl) {
        timerEl.textContent = String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      }
    }, 1000);
  }

  /**
   * 开始新任务
   * 如果当前有任务且未超过防抖时间，则更新当前任务；否则提交旧任务并创建新任务
   * @param {string} label - 任务标签/标题
   * @returns {object|null} 创建的任务对象，如果复用当前任务则返回 null
   */
  function tlStartTask(label) {
    const now = Date.now();

    // 防抖：如果当前任务在 TASK_DEBOUNCE 内有更新，则复用
    if (tlCurrentTask && (now - tlCurrentTask.lastMs) < TASK_DEBOUNCE) {
      tlCurrentTask.lastMs = now;
      return null;
    }

    // 提交之前的任务
    if (tlCurrentTask) {
      if (typeof YooAI !== 'undefined' && YooAI.TimelineStore) {
        YooAI.TimelineStore.tlCommitTask();
      }
    }

    // 创建新任务
    tlCurrentTask = {
      label: label || '处理中...',
      startMs: now,
      lastMs: now,
      tools: 0,
      errors: 0,
      tokens: 0,
      tags: new Set(),
      el: null
    };

    // 通知任务进度模块
    if (typeof YooAI !== 'undefined' && YooAI.TaskProgress) {
      YooAI.TaskProgress.start(now);
    }

    tlStartSession();

    return tlCurrentTask;
  }

  /**
   * 提交当前任务
   * 将当前任务标记为完成，更新统计，并触发渲染更新
   */
  function tlCommitTask() {
    if (!tlCurrentTask) return;

    const t = tlCurrentTask;
    tlCurrentTask = null;
    tlTasks++;

    // 通知任务进度模块
    if (typeof YooAI !== 'undefined' && YooAI.TaskProgress) {
      YooAI.TaskProgress.done();
    }

    // 更新任务计数 UI
    const tlTasksEl = document.getElementById('tlTasks');
    if (tlTasksEl) tlTasksEl.textContent = tlTasks;

    // 更新令牌率 UI
    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) {
      tlTokenRateEl.textContent = tlTasks > 0 ? Math.round(tlTotalTokens / tlTasks) : 0;
    }

    // 更新任务元素的活跃状态
    if (t.el) {
      t.el.classList.remove('tl-active');
      // 通知渲染器更新
      if (typeof YooAI !== 'undefined' && YooAI.TimelineRenderer) {
        YooAI.TimelineRenderer.renderEntry(t.el, t, false);
      }
    }
  }

  /**
   * 添加标签到当前任务
   * @param {string} tag - 标签名称（如 'agent', 'chat'）
   */
  function tlAddTag(tag) {
    if (tlCurrentTask) {
      tlCurrentTask.tags.add(tag);
      tlCurrentTask.lastMs = Date.now();
    }
  }

  /**
   * 增加工具调用计数
   */
  function tlAddTool() {
    if (tlCurrentTask) {
      tlCurrentTask.tools++;
      tlCurrentTask.lastMs = Date.now();
    }
    tlTools++;

    const tlToolsEl = document.getElementById('tlTools');
    if (tlToolsEl) tlToolsEl.textContent = tlTools;
  }

  /**
   * 增加错误计数
   */
  function tlAddError() {
    if (tlCurrentTask) {
      tlCurrentTask.errors++;
      tlCurrentTask.lastMs = Date.now();
    }
    tlErrors++;

    const tlErrorsEl = document.getElementById('tlErrors');
    if (tlErrorsEl) tlErrorsEl.textContent = tlErrors;
  }

  /**
   * 增加令牌计数
   * @param {number} n - 增加的令牌数量
   */
  function tlAddTokens(n) {
    tlTotalTokens += n;
    tlSessionTokens += n;

    if (tlCurrentTask) {
      tlCurrentTask.tokens += n;
    }

    // 更新令牌计数 UI
    const el = document.getElementById('tokenCount');
    if (el) {
      if (tlTotalTokens >= 1000) {
        const k = tlTotalTokens / 1000;
        el.textContent = (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + 'k';
      } else {
        el.textContent = tlTotalTokens;
      }
      el.classList.remove('token-flash');
      void el.offsetWidth; // 触发重绘
      el.classList.add('token-flash');
    }

    // 更新令牌率 UI
    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) {
      tlTokenRateEl.textContent = tlTasks > 0 ? Math.round(tlTotalTokens / tlTasks) : 0;
    }
  }

  /**
   * 重置所有统计数据
   */
  function resetStats() {
    tlTasks = 0;
    tlMsgs = 0;
    tlTools = 0;
    tlErrors = 0;
    tlTotalTokens = 0;
    tlSessionTokens = 0;
    tlCurrentTask = null;
  }

  /**
   * 获取当前状态快照
   * @returns {object} 状态快照对象
   */
  function getState() {
    return {
      tasks: tlTasks,
      messages: tlMsgs,
      tools: tlTools,
      errors: tlErrors,
      totalTokens: tlTotalTokens,
      sessionTokens: tlSessionTokens,
      sessionStart: tlSessionStart,
      currentTask: tlCurrentTask
    };
  }

  // === EXPOSE TO GLOBAL NAMESPACE ===
  window.YooAI = window.YooAI || {};

  window.YooAI.TimelineStore = {
    // State (read-only through getState)
    get tlTasks() { return tlTasks; },
    set tlTasks(v) { tlTasks = v; },
    get tlMsgs() { return tlMsgs; },
    set tlMsgs(v) { tlMsgs = v; },
    get tlTools() { return tlTools; },
    set tlTools(v) { tlTools = v; },
    get tlErrors() { return tlErrors; },
    set tlErrors(v) { tlErrors = v; },
    get tlTotalTokens() { return tlTotalTokens; },
    set tlTotalTokens(v) { tlTotalTokens = v; },
    get tlSessionTokens() { return tlSessionTokens; },
    get tlSessionStart() { return tlSessionStart; },
    get tlCurrentTask() { return tlCurrentTask; },
    set tlCurrentTask(v) { tlCurrentTask = v; },
    get tlTimerInterval() { return tlTimerInterval; },

    // Methods
    tlStartSession,
    tlStartTask,
    tlCommitTask,
    tlAddTag,
    tlAddTool,
    tlAddError,
    tlAddTokens,
    resetStats,
    getState,

    // Constants
    TASK_DEBOUNCE,
    TASK_DURATION_MS
  };

})();
