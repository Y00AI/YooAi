/**
 * @file timeline-renderer.js
 * @description 时间线渲染器模块 - 负责时间线条目的渲染、统计更新和历史加载
 * @module YooAI/Timeline/Renderer
 * @version 2.0.0
 * @author 李工
 *
 * @dependencies
 * - YooAI.TimelineStore (timeline-store.js) - 时间线状态存储
 * - YooAI.TimelineUtils (timeline-utils.js) - 时间线工具函数
 * - Gateway (gateway.js) - WebSocket 连接管理
 *
 * @exports
 * - window.YooAI.TimelineRenderer.renderEntry(el, task, active) - 渲染单个时间线条目
 * - window.YooAI.TimelineRenderer.addEntry(task, active) - 添加新条目到列表
 * - window.YooAI.TimelineRenderer.updateStats() - 更新统计显示
 * - window.YooAI.TimelineRenderer.loadHistory() - 加载时间线历史
 * - window.YooAI.TimelineRenderer.renderGroup(list, group) - 渲染时间线分组
 *
 * @example
 * // 渲染单个条目
 * const el = document.createElement('div');
 * YooAI.TimelineRenderer.renderEntry(el, task, true);
 *
 * // 更新统计
 * YooAI.TimelineRenderer.updateStats();
 *
 * // 加载历史
 * await YooAI.TimelineRenderer.loadHistory();
 */

(function() {
  'use strict';

  // === HELPERS ===

  /**
   * 获取 TimelineStore 引用
   */
  function getStore() {
    return window.YooAI?.TimelineStore;
  }

  /**
   * 获取 TimelineUtils 引用
   */
  function getUtils() {
    return window.YooAI?.TimelineUtils;
  }

  // === RENDER FUNCTIONS ===

  /**
   * 渲染单个时间线条目
   * @param {HTMLElement} el - 条目容器元素
   * @param {object} task - 任务对象
   * @param {boolean} active - 是否为活跃状态
   */
  function renderEntry(el, task, active) {
    const Utils = getUtils();

    // 活跃任务显示圆点，历史任务显示实际持续时间
    const dur = active ? '●' : (Utils ? Utils.formatDuration((task.lastMs || task.startMs) - task.startMs) : formatDurationFallback((task.lastMs || task.startMs) - task.startMs));

    // 获取图标
    const icon = Utils ? Utils.getTaskIcon(task) : getTaskIconFallback(task);

    // 获取时间
    const time = Utils ? Utils.formatTime(task.startMs) : new Date(task.startMs).toTimeString().slice(0, 8);

    // Clear and rebuild using DOM methods
    el.textContent = '';

    // Icon
    const iconEl = document.createElement('div');
    iconEl.className = 'tl-icon';
    iconEl.textContent = icon;
    el.appendChild(iconEl);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'tl-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'tl-title';
    titleEl.textContent = task.label;
    bodyEl.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'tl-meta';

    // Add tags
    if (task.tags) {
      for (const tag of task.tags) {
        const tagEl = document.createElement('span');
        tagEl.className = 'tl-tag ' + tag;
        tagEl.textContent = tag.toUpperCase();
        metaEl.appendChild(tagEl);
      }
    }

    // Add tool count
    if (task.tools > 0) {
      const toolEl = document.createElement('span');
      toolEl.className = 'tl-tag tool';
      toolEl.textContent = task.tools + ' tool' + (task.tools > 1 ? 's' : '');
      metaEl.appendChild(toolEl);
    }

    // Add error count
    if (task.errors > 0) {
      const errEl = document.createElement('span');
      errEl.className = 'tl-tag error';
      errEl.textContent = task.errors + ' err';
      metaEl.appendChild(errEl);
    }

    bodyEl.appendChild(metaEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'tl-time';
    timeEl.textContent = time;
    bodyEl.appendChild(timeEl);

    el.appendChild(bodyEl);

    // Right side
    const rightEl = document.createElement('div');
    rightEl.className = 'tl-right';

    const durEl = document.createElement('div');
    durEl.className = 'tl-dur';
    durEl.textContent = dur;
    rightEl.appendChild(durEl);

    if (task.tokens > 0) {
      const Utils = getUtils();
      const tokEl = document.createElement('span');
      tokEl.className = 'tl-tokens';
      const tokenDisplay = Utils ? Utils.formatTokenCount(task.tokens) : (task.tokens >= 1000 ? (task.tokens / 1000).toFixed(1) + 'k' : task.tokens);
      tokEl.textContent = '+' + tokenDisplay + ' tok';
      rightEl.appendChild(tokEl);
    }

    el.appendChild(rightEl);
  }

  /**
   * 添加新条目到时间线列表
   * @param {object} task - 任务对象
   * @param {boolean} active - 是否为活跃状态
   * @returns {HTMLElement|null} 创建的元素或 null
   */
  function addEntry(task, active) {
    // 移除空状态提示
    const empty = document.getElementById('tlEmpty');
    if (empty) empty.remove();

    const list = document.getElementById('timelineList');
    if (!list) return null;

    const el = document.createElement('div');
    el.className = 'tl-entry' + (active ? ' tl-active' : '');
    renderEntry(el, task, active);
    list.insertBefore(el, list.firstChild);

    // 限制最大条目数
    while (list.children.length > 50) {
      list.removeChild(list.lastChild);
    }

    return el;
  }

  /**
   * 更新时间线统计显示
   */
  function updateStats() {
    const Store = getStore();
    if (!Store) return;

    const tlTasksEl = document.getElementById('tlTasks');
    if (tlTasksEl) tlTasksEl.textContent = Store.tlTasks;

    const tlMsgsEl = document.getElementById('tlMsgs');
    if (tlMsgsEl) tlMsgsEl.textContent = Store.tlMsgs;

    const tlToolsEl = document.getElementById('tlTools');
    if (tlToolsEl) tlToolsEl.textContent = Store.tlTools;

    const tlErrorsEl = document.getElementById('tlErrors');
    if (tlErrorsEl) tlErrorsEl.textContent = Store.tlErrors;

    // 令牌/任务率
    const tlTokenRateEl = document.getElementById('tlTokenRate');
    if (tlTokenRateEl) {
      if (Store.tlTasks > 0) {
        const averageToken = Math.round(Store.tlTotalTokens / Store.tlTasks);
        const Utils = getUtils();
        if (Utils) {
          tlTokenRateEl.textContent = Utils.formatTokenCount(averageToken);
        } else {
          if (averageToken >= 1000) {
            const k = averageToken / 1000;
            tlTokenRateEl.textContent = (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + 'k';
          } else {
            tlTokenRateEl.textContent = averageToken;
          }
        }
      }
    }

    // 总令牌数
    const tokenCountEl = document.getElementById('tokenCount');
    if (tokenCountEl) {
      const Utils = getUtils();
      if (Utils) {
        tokenCountEl.textContent = Utils.formatTokenCount(Store.tlTotalTokens);
      } else {
        if (Store.tlTotalTokens >= 1000) {
          const k = Store.tlTotalTokens / 1000;
          tokenCountEl.textContent = (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + 'k';
        } else {
          tokenCountEl.textContent = Store.tlTotalTokens;
        }
      }
    }
  }

  /**
   * 渲染单个时间线分组
   * @param {HTMLElement} list - 时间线列表容器
   * @param {object} group - 分组对象
   */
  function renderGroup(list, group) {
    const Store = getStore();
    const Utils = getUtils();

    // 从用户消息提取标签
    const userItem = group.items.find(i => i.type === 'message' && i.subtype === 'user');
    let label = '';

    if (userItem && userItem.text) {
      if (Utils) {
        label = Utils.extractLabelFromContent(String(userItem.text));
      } else {
        label = extractLabelFallback(String(userItem.text));
      }
    } else if (group.hasAssistant) {
      label = '✨ Agent 响应';
    } else {
      label = '✨ 活动';
    }

    // 构建标签集合
    const tags = new Set();
    if (group.tools > 0) {
      tags.add('agent');
    }
    if (group.hasUser) {
      tags.add('chat');
    }

    // 创建任务对象
    const task = {
      label: label,
      startMs: group.startMs || Date.now(),
      lastMs: group.endMs || group.startMs || Date.now(),
      tools: group.tools || 0,
      errors: group.errors || 0,
      tokens: (group.tokens && group.tokens.total) || 0,
      tags: tags,
      el: null
    };

    // 渲染条目
    const el = document.createElement('div');
    el.className = 'tl-entry';
    renderEntry(el, task, false);
    list.insertBefore(el, list.firstChild);

    // 更新统计
    if (Store) {
      Store.tlTasks++;
      Store.tlMsgs += (group.items && group.items.filter(i => i.type === 'message').length) || 0;
      Store.tlTools += group.tools || 0;
      Store.tlErrors += group.errors || 0;
      Store.tlTotalTokens += (group.tokens && group.tokens.total) || 0;
    }

    // 更新统计显示
    updateStats();
  }

  /**
   * 加载时间线历史
   * @param {string} sessionKey - 会话键
   */
  async function loadHistory(sessionKey) {
    const Store = getStore();

    try {
      // 调用后端 API 获取时间线数据
      const response = await fetch(`/api/timeline/${encodeURIComponent(sessionKey || 'main')}`);
      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.error) {
        console.error('[Timeline] API error:', data.error);
        return;
      }

      // 清空现有时间线
      const list = document.getElementById('timelineList');
      if (!list) {
        return;
      }
      list.textContent = '';

      // 重置统计变量
      if (Store) {
        Store.resetStats();
      }

      // 移除空状态提示
      const empty = document.getElementById('tlEmpty');
      if (empty) empty.remove();

      const timeline = data.timeline || [];
      const conversations = data.conversations || [];
      const stats = data.stats || {};

      // 按对话分组时间线项目
      const groups = [];
      let currentGroup = null;

      for (const item of timeline) {
        if (!item || typeof item !== 'object') continue;

        // 用户消息开始新分组
        if (item.type === 'message' && item.subtype === 'user') {
          if (currentGroup && currentGroup.items.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = {
            startMs: item.timestamp || Date.now(),
            endMs: item.timestamp || Date.now(),
            items: [item],
            hasUser: true,
            hasAssistant: false,
            tools: 0,
            errors: 0,
            tokens: { input: 0, output: 0, total: 0 }
          };
        } else if (currentGroup) {
          // 添加到当前分组
          currentGroup.items.push(item);
          currentGroup.endMs = item.timestamp || currentGroup.endMs;

          if (item.type === 'message' && item.subtype === 'assistant') {
            currentGroup.hasAssistant = true;
          } else if (item.type === 'tool') {
            currentGroup.tools++;
          } else if (item.type === 'error') {
            currentGroup.errors++;
          }

          // 累加 tokens
          if (item.tokens) {
            currentGroup.tokens.input += item.tokens.input || 0;
            currentGroup.tokens.output += item.tokens.output || 0;
            currentGroup.tokens.total += item.tokens.total || 0;
          }
        }
      }

      // 添加最后一个分组
      if (currentGroup && currentGroup.items.length > 0) {
        groups.push(currentGroup);
      }

      // 只显示最近 20 个分组
      const recentGroups = groups.slice(-20);

      // 渲染每个分组
      for (const group of recentGroups) {
        try {
          renderGroup(list, group);
        } catch (renderErr) {
          console.error('[Timeline] Error rendering group:', renderErr);
        }
      }

      // 更新统计显示
      updateStats();

    } catch (err) {
      console.error('[Timeline] Failed to load timeline history:', err.message, err.stack);
    }
  }

  // === FALLBACK FUNCTIONS (when Utils not available) ===

  function formatDurationFallback(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's';
  }

  function getTaskIconFallback(task) {
    if (task.errors > 0) return '⚠️';
    if (task.tags && task.tags.has('agent')) return '🤖';
    if (task.tags && task.tags.has('chat')) return '💬';
    return '✨';
  }

  function extractLabelFallback(text) {
    if (!text) return '✨ 活动';
    if (text.startsWith('Read HEARTBEAT.md')) return '💓 心跳检查';
    const snippet = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim().slice(0, 40);
    return snippet ? '💬 ' + snippet + (text.length > 40 ? '…' : '') : '💬 用户消息';
  }

  // === EXPOSE TO GLOBAL NAMESPACE ===
  window.YooAI = window.YooAI || {};

  window.YooAI.TimelineRenderer = {
    renderEntry,
    addEntry,
    updateStats,
    loadHistory,
    renderGroup
  };

})();
