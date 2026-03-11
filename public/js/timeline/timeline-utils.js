/**
 * @file timeline-utils.js
 * @description 时间线工具函数模块 - 提供时间格式化、图标获取、标签提取等工具方法
 * @module YooAI/Timeline/Utils
 * @version 2.0.0
 * @author 李工
 *
 * @dependencies
 * - 无外部依赖
 *
 * @exports
 * - window.YooAI.TimelineUtils.formatDuration(ms) - 格式化持续时间
 * - window.YooAI.TimelineUtils.formatTime(ms) - 格式化时间戳为时间字符串
 * - window.YooAI.TimelineUtils.getTaskIcon(task) - 获取任务图标
 * - window.YooAI.TimelineUtils.extractLabelFromContent(content) - 从内容提取显示标签
 * - window.YooAI.TimelineUtils.extractTextFromContent(content) - 从消息内容提取纯文本
 * - window.YooAI.TimelineUtils.isHeartbeatMessage(text) - 判断是否为心跳消息
 * - window.YooAI.TimelineUtils.formatTokenCount(count) - 格式化令牌数量显示
 * - window.YooAI.TimelineUtils.getTagPriority(tag) - 获取标签优先级
 *
 * @example
 * // 格式化持续时间
 * const dur = YooAI.TimelineUtils.formatDuration(1500); // "1.5s"
 *
 * // 获取任务图标
 * const icon = YooAI.TimelineUtils.getTaskIcon({ errors: 0, tags: new Set(['agent']) }); // "🤖"
 *
 * // 提取显示标签
 * const label = YooAI.TimelineUtils.extractLabelFromContent('Read HEARTBEAT.md'); // "心跳检查"
 */

(function() {
  'use strict';

  /**
   * 格式化持续时间
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化的时间字符串
   */
  function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's';
  }

  /**
   * 格式化时间戳为时间字符串
   * @param {number} ms - 毫秒时间戳
   * @returns {string} HH:MM:SS 格式的时间字符串
   */
  function formatTime(ms) {
    return new Date(ms).toTimeString().slice(0, 8);
  }

  /**
   * 获取任务图标
   * 优先级：错误 > 有工具调用(Agent) > 聊天 > 默认
   * @param {object} task - 任务对象
   * @param {number} task.errors - 错误数量
   * @param {Set} task.tags - 标签集合
   * @returns {string} emoji 图标
   */
  function getTaskIcon(task) {
    if (task.errors > 0) return '⚠️';
    if (task.tags && task.tags.has('agent')) return '🤖';
    if (task.tags && task.tags.has('chat')) return '💬';
    return '✨';
  }

  /**
   * 从消息内容提取纯文本
   * @param {string|Array|object} content - 消息内容
   * @returns {string} 提取的纯文本
   */
  function extractTextFromContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter(item => item && (item.type === 'text' || typeof item === 'string'))
        .map(item => item.text || item || '')
        .join('');
    }
    return '';
  }

  /**
   * 判断是否为心跳消息
   * @param {string} text - 消息文本
   * @returns {boolean} 是否为心跳消息
   */
  function isHeartbeatMessage(text) {
    if (!text) return false;
    if (text.startsWith('Read HEARTBEAT.md')) return true;
    if (text.startsWith('Sender (untrusted metadata)') && !text.match(/\[[A-Za-z]+ \d{4}-\d{2}-\d{2} \d{2}:\d{2} GMT[+-]?\d+\]\s*.+$/s)) {
      return true;
    }
    return false;
  }

  /**
   * 从内容提取显示标签
   * 处理心跳消息和用户输入格式
   * @param {string} text - 原始文本
   * @param {number} maxLength - 最大显示长度
   * @returns {string} 提取的显示标签
   */
  function extractLabelFromContent(text, maxLength = 40) {
    if (!text) return '✨ 活动';

    let displayText = String(text);

    // 检查是否是心跳消息
    if (isHeartbeatMessage(displayText)) {
      return '💓 心跳检查';
    }

    // 尝试提取用户实际输入的内容
    // 格式：[Wed 2026-03-11 14:26 GMT+8] 用户输入内容
    const userInputMatch = displayText.match(/\[[A-Za-z]+ \d{4}-\d{2}-\d{2} \d{2}:\d{2} GMT[+-]?\d+\]\s*(.+)$/s);
    if (userInputMatch && userInputMatch[1]) {
      displayText = userInputMatch[1].trim();
    }

    // 清理控制字符并截取
    const snippet = displayText
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      .trim()
      .slice(0, maxLength);

    if (!snippet) return '💬 用户消息';

    return '💬 ' + snippet + (displayText.length > maxLength ? '…' : '');
  }

  /**
   * 格式化令牌数量显示
   * @param {number} count - 令牌数量
   * @returns {string} 格式化的字符串
   */
  function formatTokenCount(count) {
    if (count >= 1000) {
      const k = count / 1000;
      return (k >= 10 ? k.toFixed(1) : k.toFixed(2)) + 'k';
    }
    return String(count);
  }

  /**
   * 获取标签优先级（数值越大优先级越高）
   * @param {string} tag - 标签名称
   * @returns {number} 优先级数值
   */
  function getTagPriority(tag) {
    const priorities = {
      'error': 100,
      'agent': 80,
      'tool': 60,
      'chat': 40,
      'default': 0
    };
    return priorities[tag] || priorities['default'];
  }

  /**
   * 按优先级排序标签
   * @param {Set|Array} tags - 标签集合
   * @returns {Array} 排序后的标签数组
   */
  function sortTagsByPriority(tags) {
    if (!tags) return [];
    const tagArray = Array.from(tags);
    return tagArray.sort((a, b) => getTagPriority(b) - getTagPriority(a));
  }

  // === EXPOSE TO GLOBAL NAMESPACE ===
  window.YooAI = window.YooAI || {};

  window.YooAI.TimelineUtils = {
    formatDuration,
    formatTime,
    getTaskIcon,
    extractTextFromContent,
    extractLabelFromContent,
    isHeartbeatMessage,
    formatTokenCount,
    getTagPriority,
    sortTagsByPriority
  };

})();
