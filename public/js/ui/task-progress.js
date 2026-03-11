/**
 * @file task-progress.js
 * @description 任务进度条模块 - 管理和渲染任务进度条状态
 * @module YooAI/UI/TaskProgress
 * @version 2.0.0
 * @author 李工
 *
 * @dependencies
 * - 无外部依赖
 * - 需要 HTML 元素：#brainBar
 *
 * @exports
 * - window.YooAI.TaskProgress.start(timestamp) - 开始进度条
 * - window.YooAI.TaskProgress.done() - 标记进度完成
 * - window.YooAI.TaskProgress.reset() - 重置进度条
 * - window.YooAI.TaskProgress.render() - 渲染进度条
 * - window.YooAI.TaskProgress.getState() - 获取当前状态
 *
 * @example
 * // 开始任务进度
 * YooAI.TaskProgress.start(Date.now());
 *
 * // 任务完成
 * YooAI.TaskProgress.done();
 *
 * // 手动触发渲染
 * YooAI.TaskProgress.render();
 */

(function() {
  'use strict';

  // === STATE ===
  let taskProgressStart = 0;
  let taskProgressDone = false;

  // === CONSTANTS ===
  const TASK_DURATION_MS = 120000; // 2分钟
  const PROGRESS_COMPLETE_DELAY = 2500; // 完成后重置延迟
  const RENDER_INTERVAL = 500; // 渲染间隔

  // 渐变色配置
  const GRADIENTS = {
    active: 'linear-gradient(90deg,#a0f0f0,#b2ead6,#7de8e8)',
    complete: 'linear-gradient(90deg,#a0f0f0,#b2ead6,#a0ffc8)'
  };

  // 定时器引用
  let renderIntervalId = null;

  /**
   * 渲染任务进度条
   * 根据当前状态更新进度条显示
   */
  function render() {
    const bar = document.getElementById('brainBar');
    if (!bar) return;

    // 完成状态：100% 宽度，完成渐变色
    if (taskProgressDone) {
      bar.style.width = '100%';
      bar.style.background = GRADIENTS.complete;
      return;
    }

    // 未开始状态：0% 宽度
    if (!taskProgressStart) {
      bar.style.width = '0%';
      bar.style.background = GRADIENTS.active;
      return;
    }

    // 进行中状态：计算进度百分比
    const elapsed = Date.now() - taskProgressStart;
    const pct = Math.min(95, (elapsed / TASK_DURATION_MS) * 100);
    bar.style.width = pct + '%';
    bar.style.background = GRADIENTS.active;
  }

  /**
   * 开始进度条
   * @param {number} timestamp - 开始时间戳（可选，默认当前时间）
   */
  function start(timestamp) {
    taskProgressStart = timestamp || Date.now();
    taskProgressDone = false;
    render();

    // 启动定时渲染
    if (!renderIntervalId) {
      renderIntervalId = setInterval(() => {
        if (taskProgressStart && !taskProgressDone) {
          render();
        }
      }, RENDER_INTERVAL);
    }
  }

  /**
   * 标记进度完成
   * 显示完成状态，并在延迟后自动重置
   */
  function done() {
    taskProgressDone = true;
    render();

    // 延迟后重置
    setTimeout(() => {
      reset();
    }, PROGRESS_COMPLETE_DELAY);
  }

  /**
   * 重置进度条
   * 清除状态并重新渲染
   */
  function reset() {
    taskProgressDone = false;
    taskProgressStart = 0;
    render();
  }

  /**
   * 停止定时渲染
   */
  function stopInterval() {
    if (renderIntervalId) {
      clearInterval(renderIntervalId);
      renderIntervalId = null;
    }
  }

  /**
   * 获取当前状态
   * @returns {object} 状态对象
   */
  function getState() {
    let progress = 0;
    if (taskProgressDone) {
      progress = 100;
    } else if (taskProgressStart) {
      const elapsed = Date.now() - taskProgressStart;
      progress = Math.min(95, (elapsed / TASK_DURATION_MS) * 100);
    }

    return {
      start: taskProgressStart,
      done: taskProgressDone,
      progress: progress,
      isActive: !!taskProgressStart && !taskProgressDone
    };
  }

  /**
   * 初始化模块
   * 设置定时渲染并渲染初始状态
   */
  function init() {
    // 初始渲染
    render();

    // 如果没有通过 start() 启动，设置全局定时渲染
    if (!renderIntervalId) {
      renderIntervalId = setInterval(() => {
        if (taskProgressStart && !taskProgressDone) {
          render();
        }
      }, RENDER_INTERVAL);
    }
  }

  // === EXPOSE TO GLOBAL NAMESPACE ===
  window.YooAI = window.YooAI || {};

  window.YooAI.TaskProgress = {
    init,
    start,
    done,
    reset,
    render,
    stopInterval,
    getState,
    // 暴露常量
    TASK_DURATION_MS,
    PROGRESS_COMPLETE_DELAY
  };

})();
