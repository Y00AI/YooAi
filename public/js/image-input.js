/**
 * @file image-input.js
 * @description YooAI 图片输入模块 - 处理拖拽、粘贴、选择图片及预览功能
 * @module YooAI/ImageInput
 * @version 1.0.0
 * @author YooAI Team
 *
 * @dependencies
 * - 无外部依赖，纯浏览器 API
 *
 * @exports
 * - ImageInput.init() - 初始化事件监听
 * - ImageInput.triggerFileInput() - 触发文件选择对话框
 * - ImageInput.remove(index) - 移除指定索引的图片
 * - ImageInput.clearAll() - 清空所有待发送图片
 * - ImageInput.getPendingImages() - 获取待发送图片数组（Base64格式）
 * - ImageInput.hasImages() - 是否有待发送图片
 *
 * @example
 * // 初始化
 * ImageInput.init();
 *
 * // 检查是否有图片
 * if (ImageInput.hasImages()) {
 *   const images = ImageInput.getPendingImages();
 *   // 发送图片...
 * }
 *
 * @constraints
 * - 最多5张图片
 * - 单张图片最大10MB
 * - 支持格式：image/jpeg, image/png, image/gif, image/webp
 */

(function(global) {
  'use strict';

  // ========== 常量配置 ==========
  const CONFIG = {
    MAX_COUNT: 5,           // 最大图片数量
    MAX_SIZE: 10 * 1024 * 1024, // 单张最大10MB
    MAX_WIDTH: 1920,        // 压缩后最大宽度
    QUALITY: 0.8,           // 压缩质量
    ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  };

  // ========== 状态 ==========
  let pendingImages = [];   // 存储待发送图片 { blob, url, name, size }
  let isInitialized = false;

  // ========== DOM 元素引用 ==========
  let inputElement = null;
  let previewContainer = null;
  let fileInputElement = null;

  /**
   * 初始化图片输入模块
   * @param {Object} options - 配置选项
   * @param {HTMLElement} options.input - 输入框元素
   * @param {HTMLElement} options.previewContainer - 预览容器元素
   */
  function init(options = {}) {
    if (isInitialized) {
      console.warn('[ImageInput] 已初始化，跳过重复初始化');
      return;
    }

    // 获取或创建 DOM 元素
    inputElement = options.input || document.getElementById('chatInput');
    previewContainer = options.previewContainer || document.getElementById('imagePreviewContainer');

    if (!inputElement) {
      console.error('[ImageInput] 未找到输入框元素');
      return;
    }

    // 创建隐藏的文件输入元素
    createFileInput();

    // 创建预览容器（如果不存在）
    if (!previewContainer) {
      previewContainer = createPreviewContainer();
    }

    // 绑定事件
    setupDragAndDrop();
    setupPasteHandler();

    isInitialized = true;
    console.log('[ImageInput] 初始化完成');
  }

  /**
   * 创建隐藏的文件输入元素
   */
  function createFileInput() {
    fileInputElement = document.createElement('input');
    fileInputElement.type = 'file';
    fileInputElement.accept = CONFIG.ACCEPTED_TYPES.join(',');
    fileInputElement.multiple = true;
    fileInputElement.style.display = 'none';
    fileInputElement.addEventListener('change', handleFileSelect);
    document.body.appendChild(fileInputElement);
  }

  /**
   * 创建预览容器
   * @returns {HTMLElement} 预览容器元素
   */
  function createPreviewContainer() {
    const container = document.createElement('div');
    container.id = 'imagePreviewContainer';
    container.className = 'image-preview-container';

    // 插入到输入框之前
    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
      inputArea.insertBefore(container, inputArea.firstChild);
    } else {
      inputElement.parentNode.insertBefore(container, inputElement);
    }

    return container;
  }

  /**
   * 设置拖拽事件
   */
  function setupDragAndDrop() {
    if (!inputElement) return;

    const dropZone = inputElement.closest('.chat-input-area') || inputElement;

    // 阻止默认拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(eventName) {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    // 拖拽进入/离开视觉反馈
    ['dragenter', 'dragover'].forEach(function(eventName) {
      dropZone.addEventListener(eventName, function() {
        dropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(function(eventName) {
      dropZone.addEventListener(eventName, function() {
        dropZone.classList.remove('drag-over');
      }, false);
    });

    // 处理放置
    dropZone.addEventListener('drop', handleDrop, false);
  }

  /**
   * 阻止默认事件
   * @param {Event} e - 事件对象
   */
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * 处理拖拽放置
   * @param {DragEvent} e - 拖拽事件
   */
  function handleDrop(e) {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }

  /**
   * 设置粘贴事件处理器
   */
  function setupPasteHandler() {
    document.addEventListener('paste', handlePaste, false);
  }

  /**
   * 处理粘贴事件
   * @param {ClipboardEvent} e - 粘贴事件
   */
  function handlePaste(e) {
    // 如果焦点不在输入框，不处理
    if (document.activeElement !== inputElement) {
      return;
    }

    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processFiles([file]);
        }
        break;
      }
    }
  }

  /**
   * 处理文件选择
   * @param {Event} e - 变更事件
   */
  function handleFileSelect(e) {
    const files = e.target && e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // 清空 input 以允许重复选择同一文件
    e.target.value = '';
  }

  /**
   * 触发文件选择对话框
   */
  function triggerFileInput() {
    if (!isInitialized) {
      init();
    }
    if (fileInputElement) {
      fileInputElement.click();
    }
  }

  /**
   * 处理文件列表
   * @param {FileList|Array<File>} files - 文件列表
   */
  async function processFiles(files) {
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];

      // 检查数量限制
      if (pendingImages.length >= CONFIG.MAX_COUNT) {
        showNotification('最多只能添加 ' + CONFIG.MAX_COUNT + ' 张图片', 'warning');
        break;
      }

      // 验证文件
      const validation = validateFile(file);
      if (!validation.valid) {
        showNotification(validation.error, 'error');
        continue;
      }

      try {
        // 压缩图片
        const compressed = await compressImage(file);

        // 创建预览 URL
        const url = URL.createObjectURL(compressed.blob);

        // 添加到待发送列表（不可变操作）
        pendingImages = pendingImages.concat([{
          blob: compressed.blob,
          url: url,
          name: file.name,
          size: compressed.blob.size,
          originalSize: file.size
        }]);

        // 更新预览
        renderPreviews();

      } catch (err) {
        console.error('[ImageInput] 处理图片失败:', err);
        showNotification('处理图片失败: ' + err.message, 'error');
      }
    }
  }

  /**
   * 验证文件
   * @param {File} file - 文件对象
   * @returns {Object} 验证结果 { valid: boolean, error?: string }
   */
  function validateFile(file) {
    // 检查类型
    if (CONFIG.ACCEPTED_TYPES.indexOf(file.type) === -1) {
      return {
        valid: false,
        error: '不支持的图片格式，请使用 JPG、PNG、GIF 或 WebP'
      };
    }

    // 检查大小
    if (file.size > CONFIG.MAX_SIZE) {
      return {
        valid: false,
        error: '图片大小超过限制（最大 ' + (CONFIG.MAX_SIZE / 1024 / 1024) + 'MB）'
      };
    }

    return { valid: true };
  }

  /**
   * 压缩图片
   * @param {File} file - 原始文件
   * @returns {Promise<{blob: Blob, width: number, height: number}>}
   */
  function compressImage(file) {
    return new Promise(function(resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = function() {
        URL.revokeObjectURL(url);

        // 计算压缩后的尺寸
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > CONFIG.MAX_WIDTH) {
          const ratio = CONFIG.MAX_WIDTH / width;
          width = CONFIG.MAX_WIDTH;
          height = Math.round(height * ratio);
        }

        // 创建 canvas 进行压缩
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为 Blob
        canvas.toBlob(
          function(blob) {
            if (blob) {
              resolve({ blob: blob, width: width, height: height });
            } else {
              reject(new Error('Canvas toBlob 失败'));
            }
          },
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          CONFIG.QUALITY
        );
      };

      img.onerror = function() {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };

      img.src = url;
    });
  }

  /**
   * 渲染预览列表
   */
  function renderPreviews() {
    if (!previewContainer) return;

    // 清空现有预览
    while (previewContainer.firstChild) {
      previewContainer.removeChild(previewContainer.firstChild);
    }

    if (pendingImages.length === 0) {
      previewContainer.style.display = 'none';
      return;
    }

    previewContainer.style.display = 'flex';

    // 创建预览项
    for (let i = 0; i < pendingImages.length; i++) {
      const item = createPreviewItem(pendingImages[i], i);
      previewContainer.appendChild(item);
    }

    // 添加清空按钮（如果有多个图片）
    if (pendingImages.length > 1) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'image-preview-clear-all';
      clearBtn.textContent = '清空全部';
      clearBtn.onclick = clearAll;
      previewContainer.appendChild(clearBtn);
    }
  }

  /**
   * 创建单个预览项
   * @param {Object} img - 图片信息
   * @param {number} index - 索引
   * @returns {HTMLElement} 预览项元素
   */
  function createPreviewItem(img, index) {
    const item = document.createElement('div');
    item.className = 'image-preview-item';

    // 缩略图
    const thumbnail = document.createElement('img');
    thumbnail.className = 'image-preview-thumbnail';
    thumbnail.src = img.url;
    thumbnail.alt = img.name;

    // 删除按钮
    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-preview-remove';
    removeBtn.textContent = '\u00D7'; // &times; 的 Unicode
    removeBtn.title = '移除图片';
    removeBtn.onclick = function() {
      remove(index);
    };

    // 大小信息
    const sizeInfo = document.createElement('div');
    sizeInfo.className = 'image-preview-size';
    sizeInfo.textContent = formatSize(img.size);

    item.appendChild(thumbnail);
    item.appendChild(removeBtn);
    item.appendChild(sizeInfo);

    return item;
  }

  /**
   * 移除指定索引的图片
   * @param {number} index - 图片索引
   */
  function remove(index) {
    if (index < 0 || index >= pendingImages.length) return;

    // 释放 URL 对象
    const img = pendingImages[index];
    if (img.url) {
      URL.revokeObjectURL(img.url);
    }

    // 创建新数组（不可变操作）
    pendingImages = pendingImages.slice(0, index).concat(pendingImages.slice(index + 1));

    renderPreviews();
  }

  /**
   * 清空所有待发送图片
   */
  function clearAll() {
    // 释放所有 URL 对象
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      if (img.url) {
        URL.revokeObjectURL(img.url);
      }
    }

    pendingImages = [];
    renderPreviews();
  }

  /**
   * 获取待发送图片数组（Data URL格式）
   * @returns {Promise<Array<{dataUrl: string, filename: string, type: string}>>}
   */
  async function getPendingImages() {
    const results = [];

    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      try {
        const dataUrl = await blobToBase64(img.blob);
        results.push({
          dataUrl: dataUrl,
          filename: img.name,
          type: img.blob.type
        });
      } catch (err) {
        console.error('[ImageInput] 转换图片失败:', err);
      }
    }

    return results;
  }

  /**
   * Blob 转 Data URL (Base64)
   * @param {Blob} blob - Blob 对象
   * @returns {Promise<string>} 完整的 data URL 字符串 (data:image/xxx;base64,...)
   */
  function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() {
        // 返回完整的 data URL 格式，后端 parseDataUrl 期望此格式
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 是否有待发送图片
   * @returns {boolean}
   */
  function hasImages() {
    return pendingImages.length > 0;
  }

  /**
   * 获取图片数量
   * @returns {number}
   */
  function getCount() {
    return pendingImages.length;
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的字符串
   */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * 显示通知（简单实现）
   * @param {string} message - 消息内容
   * @param {string} type - 类型 (info/warning/error)
   */
  function showNotification(message, type = 'info') {
    console.log('[ImageInput][' + type + '] ' + message);

    // 可以集成到现有的通知系统
    // 这里使用更友好的提示方式
    if (type === 'error' || type === 'warning') {
      const hint = document.querySelector('.chat-hint');
      if (hint) {
        const originalText = hint.textContent;
        hint.textContent = message;
        hint.style.color = type === 'error' ? '#f9a98e' : '#f9e49a';
        setTimeout(function() {
          hint.textContent = originalText;
          hint.style.color = '';
        }, 3000);
      }
    }
  }

  // ========== 公开 API ==========
  window.ImageInput = {
    init: init,
    triggerFileInput: triggerFileInput,
    remove: remove,
    clearAll: clearAll,
    getPendingImages: getPendingImages,
    hasImages: hasImages,
    getCount: getCount
  };

})(typeof window !== 'undefined' ? window : this);
