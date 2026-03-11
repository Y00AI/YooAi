/**
 * @file floating-bits.js
 * @description 浮游装饰效果模块 - 创建和管理背景浮游符号动画
 * @module YooAI/UI/FloatingBits
 * @version 2.0.0
 * @author 李工
 *
 * @dependencies
 * - 无外部依赖
 * - 需要 CSS 样式支持（.bit 类动画）
 *
 * @exports
 * - window.YooAI.FloatingBits.init() - 初始化浮游装饰
 * - window.YooAI.FloatingBits.createBit(char, options) - 创建单个浮游元素
 * - window.YooAI.FloatingBits.clear() - 清除所有浮游元素
 *
 * @example
 * // 初始化浮游装饰
 * YooAI.FloatingBits.init();
 *
 * // 自定义创建浮游元素
 * YooAI.FloatingBits.createBit('◆', {
 *   color: 'rgba(100,220,220,.4)',
 *   duration: 20,
 *   delay: 5
 * });
 */

(function() {
  'use strict';

  // 默认配置
  const DEFAULT_CONFIG = {
    containerId: 'bits',
    symbols: ['◆', '◇', '✦', '△', '✧', '⟡'],
    symbolsPerChar: 3,
    colors: [
      'rgba(100,220,220,.4)',
      'rgba(245,130,105,.4)',
      'rgba(247,195,155,.4)',
      'rgba(242,165,195,.4)',
      'rgba(249,228,140,.4)'
    ],
    durationRange: [18, 22], // 动画持续时间范围（秒）
    delayRange: [0, 30],     // 动画延迟范围（秒）
    sizeRange: [8, 18]       // 字体大小范围（像素）
  };

  // 状态
  let isInitialized = false;
  let container = null;
  let createdBits = [];

  /**
   * 获取随机值
   * @param {Array} range - [min, max] 范围
   * @returns {number} 随机值
   */
  function randomInRange(range) {
    return range[0] + Math.random() * (range[1] - range[0]);
  }

  /**
   * 获取随机颜色
   * @returns {string} 颜色字符串
   */
  function getRandomColor() {
    return DEFAULT_CONFIG.colors[Math.floor(Math.random() * DEFAULT_CONFIG.colors.length)];
  }

  /**
   * 创建单个浮游元素
   * @param {string} char - 要显示的字符
   * @param {object} options - 配置选项
   * @param {string} options.color - 颜色
   * @param {number} options.duration - 动画持续时间（秒）
   * @param {number} options.delay - 动画延迟（秒）
   * @param {number} options.size - 字体大小（像素）
   * @param {number} options.left - 左边位置（百分比）
   * @returns {HTMLElement|null} 创建的元素或 null
   */
  function createBit(char, options = {}) {
    if (!container) {
      container = document.getElementById(DEFAULT_CONFIG.containerId);
      if (!container) {
        console.warn('[FloatingBits] Container not found:', DEFAULT_CONFIG.containerId);
        return null;
      }
    }

    const bit = document.createElement('div');
    bit.className = 'bit';
    bit.textContent = char;

    // 应用配置或随机值
    const duration = options.duration ?? randomInRange(DEFAULT_CONFIG.durationRange);
    const delay = options.delay ?? randomInRange(DEFAULT_CONFIG.delayRange);
    const size = options.size ?? randomInRange(DEFAULT_CONFIG.sizeRange);
    const color = options.color ?? getRandomColor();
    const left = options.left ?? (Math.random() * 100);

    bit.style.cssText = `
      left: ${left}vw;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      font-size: ${size}px;
      color: ${color};
    `;

    container.appendChild(bit);
    createdBits.push(bit);

    return bit;
  }

  /**
   * 初始化浮游装饰
   * 创建所有浮游符号元素
   */
  function init() {
    if (isInitialized) {
      console.warn('[FloatingBits] Already initialized');
      return;
    }

    container = document.getElementById(DEFAULT_CONFIG.containerId);
    if (!container) {
      console.warn('[FloatingBits] Container not found:', DEFAULT_CONFIG.containerId);
      return;
    }

    // 为每个符号创建多个实例
    DEFAULT_CONFIG.symbols.forEach((char) => {
      for (let i = 0; i < DEFAULT_CONFIG.symbolsPerChar; i++) {
        createBit(char);
      }
    });

    isInitialized = true;
    console.log('[FloatingBits] Initialized with', createdBits.length, 'bits');
  }

  /**
   * 清除所有浮游元素
   */
  function clear() {
    createdBits.forEach(bit => {
      if (bit.parentNode) {
        bit.parentNode.removeChild(bit);
      }
    });
    createdBits = [];
    isInitialized = false;
  }

  /**
   * 获取当前状态
   * @returns {object} 状态对象
   */
  function getState() {
    return {
      initialized: isInitialized,
      bitCount: createdBits.length,
      container: container
    };
  }

  // === EXPOSE TO GLOBAL NAMESPACE ===
  window.YooAI = window.YooAI || {};

  window.YooAI.FloatingBits = {
    init,
    createBit,
    clear,
    getState,
    // 暴露配置供外部修改
    config: DEFAULT_CONFIG
  };

})();
