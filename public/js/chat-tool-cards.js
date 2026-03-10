/**
 * YooAI Chat - Tool Cards
 * 工具卡片组件：工具调用、工具结果
 */

const ChatToolCards = (function() {
  const SHORT_OUTPUT_THRESHOLD = 80;

  // 工具图标映射
  const TOOL_ICONS = {
    read: '📄',
    write: '✏️',
    grep: '🔍',
    glob: '📁',
    bash: '💻',
    webSearch: '🌐',
    edit: '📝',
    notebook: '📓',
    default: '🔧'
  };

  /**
   * 获取工具图标
   * @param {string} name - 工具名称
   * @returns {string} 图标字符
   */
  function getToolIcon(name) {
    if (!name) return TOOL_ICONS.default;

    // 标准化工具名称（转小写，移除特殊字符）
    const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');

    // 直接匹配
    if (TOOL_ICONS[normalizedName]) {
      return TOOL_ICONS[normalizedName];
    }

    // 模糊匹配
    for (const key of Object.keys(TOOL_ICONS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return TOOL_ICONS[key];
      }
    }

    return TOOL_ICONS.default;
  }

  /**
   * 格式化参数预览
   * @param {Object|string} args - 参数对象或字符串
   * @returns {string} 格式化后的预览文本
   */
  function formatArgsPreview(args) {
    if (!args) return '';

    let argsObj = args;
    if (typeof args === 'string') {
      try {
        argsObj = JSON.parse(args);
      } catch (e) {
        // 如果不是JSON，直接返回字符串
        return args.length > 50 ? args.slice(0, 50) + '...' : args;
      }
    }

    // 提取关键参数
    const previewParts = [];

    // 常见参数名称映射
    const keyParams = ['file_path', 'path', 'pattern', 'command', 'query', 'url', 'content'];

    for (const key of keyParams) {
      if (argsObj[key]) {
        let value = String(argsObj[key]);
        if (value.length > 40) {
          value = value.slice(0, 40) + '...';
        }
        previewParts.push(value);
        break; // 只显示第一个匹配的关键参数
      }
    }

    return previewParts.join(' ') || JSON.stringify(argsObj).slice(0, 50);
  }

  /**
   * 创建工具调用卡片
   * @param {Object} options - 选项
   * @param {string} options.name - 工具名称
   * @param {Object|string} options.args - 工具参数
   * @param {string} options.status - 状态 (pending/completed)
   * @returns {HTMLElement} 卡片元素
   */
  function createToolCallCard({ name, args, status = 'pending' }) {
    const card = document.createElement('div');
    card.className = 'tool-card tool-call';
    card.dataset.toolName = name;
    card.dataset.status = status;

    const icon = getToolIcon(name);
    const argsPreview = formatArgsPreview(args);

    card.innerHTML = `
      <div class="tool-card-header">
        <span class="tool-card-icon">${icon}</span>
        <span class="tool-card-name">${escapeHtml(name)}</span>
        <span class="tool-card-status ${status}">${status === 'pending' ? '...' : 'done'}</span>
      </div>
      ${argsPreview ? `<div class="tool-card-args">${escapeHtml(argsPreview)}</div>` : ''}
    `;

    return card;
  }

  /**
   * 创建工具结果卡片
   * @param {Object} options - 选项
   * @param {string} options.name - 工具名称
   * @param {string} options.text - 输出文本
   * @param {boolean} options.success - 是否成功
   * @returns {HTMLElement} 卡片元素
   */
  function createToolResultCard({ name, text, success = true }) {
    const card = document.createElement('div');
    card.className = 'tool-card tool-result';
    card.dataset.toolName = name;
    card.dataset.success = success;

    const icon = getToolIcon(name);
    const output = text || '';
    const outputLength = output.length;

    // 判断输出类型
    const isShortOutput = outputLength > 0 && outputLength < SHORT_OUTPUT_THRESHOLD;
    const isLongOutput = outputLength >= SHORT_OUTPUT_THRESHOLD;
    const hasNoOutput = outputLength === 0;

    // 生成唯一ID
    const cardId = 'tool-result-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    card.dataset.cardId = cardId;

    let outputHtml = '';

    if (hasNoOutput) {
      // 无输出：显示 Completed
      outputHtml = `
        <div class="tool-card-output no-output">
          <span class="completed-text">Completed</span>
        </div>
      `;
    } else if (isShortOutput) {
      // 短输出：内联显示
      outputHtml = `
        <div class="tool-card-output inline">
          <pre>${escapeHtml(output)}</pre>
        </div>
      `;
    } else {
      // 长输出：折叠显示
      const previewText = output.slice(0, SHORT_OUTPUT_THRESHOLD) + '...';
      outputHtml = `
        <div class="tool-card-output collapsed">
          <div class="output-preview">
            <pre>${escapeHtml(previewText)}</pre>
          </div>
          <div class="output-full" style="display: none;">
            <pre>${escapeHtml(output)}</pre>
          </div>
          <button class="tool-card-toggle" data-expanded="false">
            <span class="toggle-expand">Show all</span>
            <span class="toggle-collapse" style="display: none;">Collapse</span>
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="tool-card-header">
        <span class="tool-card-icon">${icon}</span>
        <span class="tool-card-name">${escapeHtml(name)}</span>
        <span class="tool-card-status completed">${success ? 'done' : 'error'}</span>
      </div>
      ${outputHtml}
    `;

    // 绑定展开/折叠事件
    if (isLongOutput) {
      const toggleBtn = card.querySelector('.tool-card-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          toggleOutput(card);
        });
      }
    }

    return card;
  }

  /**
   * 切换输出展开/折叠
   * @param {HTMLElement} cardEl - 卡片元素
   */
  function toggleOutput(cardEl) {
    const outputEl = cardEl.querySelector('.tool-card-output');
    if (!outputEl) return;

    const previewEl = outputEl.querySelector('.output-preview');
    const fullEl = outputEl.querySelector('.output-full');
    const toggleBtn = outputEl.querySelector('.tool-card-toggle');
    const expandSpan = toggleBtn?.querySelector('.toggle-expand');
    const collapseSpan = toggleBtn?.querySelector('.toggle-collapse');

    if (!previewEl || !fullEl || !toggleBtn) return;

    const isExpanded = toggleBtn.dataset.expanded === 'true';

    if (isExpanded) {
      // 折叠
      previewEl.style.display = 'block';
      fullEl.style.display = 'none';
      if (expandSpan) expandSpan.style.display = 'inline';
      if (collapseSpan) collapseSpan.style.display = 'none';
      toggleBtn.dataset.expanded = 'false';
    } else {
      // 展开
      previewEl.style.display = 'none';
      fullEl.style.display = 'block';
      if (expandSpan) expandSpan.style.display = 'none';
      if (collapseSpan) collapseSpan.style.display = 'inline';
      toggleBtn.dataset.expanded = 'true';
    }
  }

  /**
   * HTML转义
   * @param {string} text - 原始文本
   * @returns {string} 转义后的文本
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 判断内容是否包含工具内容
   * @param {Array|Object|string} content - 消息内容
   * @returns {boolean} 是否包含工具内容
   */
  function hasToolContent(content) {
    if (!content) return false;

    // 如果是数组（结构化内容）
    if (Array.isArray(content)) {
      return content.some(item =>
        item.type === 'tool_use' ||
        item.type === 'tool_result' ||
        item.type === 'tool_call'
      );
    }

    // 如果是对象
    if (typeof content === 'object') {
      return content.type === 'tool_use' ||
             content.type === 'tool_result' ||
             content.type === 'tool_call';
    }

    // 如果是字符串，检查是否包含工具标记
    if (typeof content === 'string') {
      return content.includes('[TOOL_CALL]') ||
             content.includes('[TOOL_RESULT]') ||
             content.includes('tool_use') ||
             content.includes('tool_result');
    }

    return false;
  }

  /**
   * 渲染带工具的内容
   * @param {Array|Object|string} contentItems - 内容项
   * @returns {HTMLElement} 渲染后的容器
   */
  function renderContentWithTools(contentItems) {
    const container = document.createElement('div');
    container.className = 'tool-content-container';

    // 处理字符串内容
    if (typeof contentItems === 'string') {
      container.textContent = contentItems;
      return container;
    }

    // 处理数组内容
    const items = Array.isArray(contentItems) ? contentItems : [contentItems];

    for (const item of items) {
      if (!item) continue;

      let el = null;

      switch (item.type) {
        case 'tool_use':
        case 'tool_call':
          el = createToolCallCard({
            name: item.name || item.tool_name,
            args: item.input || item.arguments || item.args,
            status: 'completed'
          });
          break;

        case 'tool_result':
          el = createToolResultCard({
            name: item.tool_name || item.name,
            text: item.content || item.output || item.result,
            success: item.is_error !== true
          });
          break;

        case 'text':
        default:
          // 文本内容
          if (item.text || typeof item === 'string') {
            const textEl = document.createElement('div');
            textEl.className = 'tool-text-content';
            textEl.textContent = item.text || item;
            el = textEl;
          }
          break;
      }

      if (el) {
        container.appendChild(el);
      }
    }

    return container;
  }

  /**
   * 解析消息内容中的工具调用
   * @param {string} content - 消息内容
   * @returns {Array} 解析后的内容项数组
   */
  function parseToolContent(content) {
    if (!content || typeof content !== 'string') {
      return [{ type: 'text', text: String(content || '') }];
    }

    const items = [];
    let lastIndex = 0;

    // 匹配工具调用标记 [TOOL_CALL:名称](参数)
    const toolCallRegex = /\[TOOL_CALL:([^\]]+)\]\(([^)]*)\)/g;
    // 匹配工具结果标记 [TOOL_RESULT:名称](输出)
    const toolResultRegex = /\[TOOL_RESULT:([^\]]+)\]\(([^)]*)\)/g;

    // 先处理工具调用
    let match;
    while ((match = toolCallRegex.exec(content)) !== null) {
      // 添加之前的文本
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index).trim();
        if (text) {
          items.push({ type: 'text', text });
        }
      }

      items.push({
        type: 'tool_call',
        name: match[1],
        args: match[2]
      });

      lastIndex = match.index + match[0].length;
    }

    // 处理工具结果
    lastIndex = 0;
    while ((match = toolResultRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index).trim();
        if (text) {
          items.push({ type: 'text', text });
        }
      }

      items.push({
        type: 'tool_result',
        name: match[1],
        text: match[2]
      });

      lastIndex = match.index + match[0].length;
    }

    // 如果没有找到任何工具标记，返回原始内容
    if (items.length === 0) {
      return [{ type: 'text', text: content }];
    }

    // 添加剩余文本
    if (lastIndex < content.length) {
      const text = content.slice(lastIndex).trim();
      if (text) {
        items.push({ type: 'text', text });
      }
    }

    return items;
  }

  // Public API
  return {
    createToolCallCard,
    createToolResultCard,
    renderContentWithTools,
    hasToolContent,
    getToolIcon,
    formatArgsPreview,
    toggleOutput,
    parseToolContent,
    SHORT_OUTPUT_THRESHOLD
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatToolCards;
}
