/**
 * @file session-manager.js
 * @description 会话管理模块 - 管理会话状态、获取会话信息、更新会话UI
 * @module YooAI/Core/SessionManager
 * @version 2.0.0
 * @author 张工
 *
 * @dependencies
 * - Gateway (gateway.js) - WebSocket连接管理，用于发送请求
 * - ChatStatus (chat-status.js) - 状态显示组件
 *
 * @exports
 * - window.SessionManager.init() - 初始化会话管理
 * - window.SessionManager.fetchSessionStatus() - 获取会话状态
 * - window.SessionManager.updateSessionUI(result) - 更新会话UI
 * - window.SessionManager.updateSessionFromKey(sessionKey) - 从key更新会话
 * - window.SessionManager.getCurrentSessionKey() - 获取当前会话key
 * - window.SessionManager.setCurrentSessionKey(key) - 设置当前会话key
 *
 * @example
 * // 初始化会话管理
 * SessionManager.init();
 *
 * // 获取会话状态
 * await SessionManager.fetchSessionStatus();
 *
 * // 从sessionKey更新会话
 * SessionManager.updateSessionFromKey('agent:main:main');
 *
 * @architecture
 * 会话Key格式: "agent:{agentId}:{sessionId}"
 * 例如: "agent:main:main" 或 "agent:main:cron:news"
 */

(function() {
  'use strict';

  // === SESSION STATE ===
  let currentSessionKey = 'agent:main:main'; // 当前活跃的 session key
  let lastStatusResult = null;                // 缓存最后的 status 结果
  let statusPollInterval = null;              // 轮询定时器

  // === PUBLIC API ===

  /**
   * 初始化会话管理
   * 启动状态轮询和连接事件监听
   */
  function init() {
    initStatusPolling();
    console.log('[SessionManager] Initialized');
  }

  /**
   * 初始化状态轮询
   * 每30秒轮询一次会话状态
   */
  function initStatusPolling() {
    // 每30秒轮询会话状态
    statusPollInterval = setInterval(() => {
      if (typeof Gateway !== 'undefined' && Gateway.isConnected()) {
        fetchSessionStatus();
      }
    }, 30000);

    // 监听网关连接事件
    if (typeof Gateway !== 'undefined') {
      Gateway.onMessage((msg) => {
        if (msg.type === 'gateway.connected') {
          // 等待认证完成后获取状态
          setTimeout(() => fetchSessionStatus(), 2000);
        }
      });
    }
  }

  /**
   * 获取会话状态
   * 通过Gateway请求status方法
   * @returns {Promise<Object|null>} 会话状态结果
   */
  async function fetchSessionStatus() {
    try {
      if (typeof Gateway === 'undefined') {
        console.warn('[SessionManager] Gateway not available');
        return null;
      }

      const result = await Gateway.request('status', {});
      updateSessionUI(result);
      return result;
    } catch (err) {
      // 静默处理状态获取失败
      console.warn('[SessionManager] Failed to fetch session status:', err.message);
      return null;
    }
  }

  /**
   * 更新会话UI
   * 根据会话状态更新Token和模型信息显示
   * @param {Object} result - 状态结果
   */
  function updateSessionUI(result) {
    if (!result) return;

    // 缓存结果
    lastStatusResult = result;

    // 从 result.sessions.recent 数组获取当前会话的 token 信息
    const sessions = result.sessions?.recent || [];
    // 找到匹配当前 sessionKey 的会话，或者取第一个
    const current = sessions.find(s => s.key === currentSessionKey) || sessions[0];

    if (current && typeof ChatStatus !== 'undefined') {
      // 字段名是 totalTokens，不是 used
      const used = current.totalTokens || 0;
      const max = current.contextTokens || 204800;
      const percent = current.percentUsed || 0;

      ChatStatus.updateTokens({
        used: used,
        total: max,
        percentUsed: percent
      });

      // 更新模型信息
      if (current.model) {
        ChatStatus.updateModel(current.model);
      }
    }
  }

  /**
   * 从sessionKey更新会话信息
   * 解析sessionKey格式并更新UI
   * @param {string} sessionKey - 会话key，格式: "agent:{agentId}:{sessionId}"
   */
  function updateSessionFromKey(sessionKey) {
    if (!sessionKey) return;

    currentSessionKey = sessionKey;

    // Parse sessionKey format: "agent:main:main" or "agent:main:cron:news"
    const parts = sessionKey.split(':');
    const agentId = parts[1] || 'main';
    const sessionId = parts.slice(2).join(':') || 'main';

    if (typeof ChatStatus !== 'undefined') {
      ChatStatus.updateSession(sessionId);
    }
  }

  /**
   * 获取当前会话key
   * @returns {string} 当前会话key
   */
  function getCurrentSessionKey() {
    return currentSessionKey;
  }

  /**
   * 设置当前会话key
   * @param {string} key - 会话key
   */
  function setCurrentSessionKey(key) {
    if (key) {
      currentSessionKey = key;
    }
  }

  /**
   * 获取缓存的状态结果
   * @returns {Object|null} 最后的状态结果
   */
  function getLastStatusResult() {
    return lastStatusResult;
  }

  /**
   * 停止状态轮询
   */
  function stopPolling() {
    if (statusPollInterval) {
      clearInterval(statusPollInterval);
      statusPollInterval = null;
    }
  }

  /**
   * 重启状态轮询
   */
  function restartPolling() {
    stopPolling();
    initStatusPolling();
  }

  // 暴露到全局命名空间
  window.SessionManager = {
    init,
    fetchSessionStatus,
    updateSessionUI,
    updateSessionFromKey,
    getCurrentSessionKey,
    setCurrentSessionKey,
    getLastStatusResult,
    stopPolling,
    restartPolling
  };

})();
