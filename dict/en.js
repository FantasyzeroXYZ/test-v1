// ==UserScript==
// @name         VAMplayer - 英语多词典扩展(白色主题版)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  为VAMplayer提供多词典查询支持，自定义白色主题，支持多个词典并以标签页形式展示
// @author       VAMplayer User
// @match        http://localhost:3000/*
// @match        http://127.0.0.1:3000/*
// @match        *://*/*
// @match        https://fantasyzeroxyz.github.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      dict.cn
// @connect      dict.eudic.net
// @connect      dictionary.cambridge.org
// @connect      urbandictionary.com
// @connect      m.youdao.com
// ==/UserScript==

(function() {
    'use strict';

    console.log('[VAMplayer词典脚本] 英语多词典扩展(白色主题版)已加载，等待查询请求...');

    // 添加自定义CSS样式
    const style = document.createElement('style');
    style.textContent = `
        /* 自定义白色主题样式 */
        .vam-dict-custom-container {
            width: 100%;
            height: 100%;
            position: relative;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            overflow: hidden;
        }

        .vam-dict-settings-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 8px 12px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .vam-dict-settings-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .vam-dict-settings-btn:active {
            transform: translateY(0);
        }

        .vam-dict-tabs-container {
            margin: 0;
            padding: 50px 15px 0 15px;
            border-bottom: 2px solid #e2e8f0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            background: white;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .vam-dict-tabs {
            display: flex;
            list-style: none;
            padding: 0;
            margin: 0;
            min-width: min-content;
            flex-wrap: nowrap;
            gap: 2px;
        }

        .vam-dict-tab-btn {
            padding: 10px 20px;
            border: 2px solid transparent;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            background: #f1f5f9;
            color: #64748b;
            cursor: pointer;
            transition: all 0.3s ease;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 80px;
            font-size: 13px;
            font-weight: 500;
            letter-spacing: 0.3px;
            position: relative;
        }

        .vam-dict-tab-btn:hover {
            background: #e2e8f0;
            color: #475569;
        }

        .vam-dict-tab-btn.active {
            background: white;
            border-color: #e2e8f0 #e2e8f0 white #e2e8f0;
            color: #1e293b;
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
            font-weight: 600;
        }

        .vam-dict-contents {
            height: calc(100% - 70px);
            overflow-y: auto;
            padding: 20px;
            background: white;
        }

        /* 词典内容容器样式 - 修改保持原有结构 */
        .dict-content-wrapper {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }

        /* 保持欧路词典原有显示结构 */
        .eudic-content-container {
            font-family: Arial, sans-serif;
            line-height: 1.5;
        }

        .eudic-content-container * {
            max-width: 100%;
            display: inline-block;
            vertical-align: middle;
        }

        .eudic-content-container img {
            display: inline-block;
            vertical-align: middle;
            margin: 0 2px;
            height: auto;
            max-height: 20px;
        }

        .eudic-content-container br {
            display: block;
            content: "";
            margin-top: 5px;
        }

        .eudic-content-container .exp,
        .eudic-content-container .def {
            display: inline;
            white-space: normal;
            word-wrap: break-word;
        }

        .dict-header {
            border-bottom: 2px solid;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }

        .dict-title {
            margin: 0;
            font-size: 22px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .dict-subtitle {
            color: #64748b;
            font-size: 14px;
            margin-top: 4px;
        }

        .dict-section {
            margin-bottom: 25px;
        }

        .section-title {
            color: #334155;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .definition-item {
            margin-bottom: 12px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid;
            transition: all 0.3s ease;
        }

        .definition-item:hover {
            background: #f1f5f9;
            transform: translateX(2px);
        }

        .definition-number {
            display: inline-block;
            background: #6366f1;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            text-align: center;
            line-height: 24px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
        }

        .definition-content {
            color: #1e293b;
            line-height: 1.6;
            font-size: 14px;
            white-space: normal;
            word-wrap: break-word;
        }

        /* 欧路词典特定样式 - 保持文本图片混排 */
        .eudic-definition-content {
            display: inline;
            white-space: normal;
            word-wrap: break-word;
        }

        .eudic-definition-content img {
            display: inline-block;
            vertical-align: middle;
            margin: 0 2px;
            height: 20px;
            width: auto;
        }

        .example-box {
            margin-top: 10px;
            padding: 12px;
            background: #fff7ed;
            border-radius: 6px;
            border-left: 3px solid #f97316;
            font-style: italic;
            color: #92400e;
        }

        .footer {
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            color: #94a3b8;
            font-size: 12px;
        }

        .loading-container {
            text-align: center;
            padding: 40px;
            color: #64748b;
        }

        .loading-spinner {
            font-size: 24px;
            color: #6366f1;
            margin-bottom: 15px;
        }

        .error-container {
            text-align: center;
            padding: 30px;
            border-radius: 10px;
            background: #fef2f2;
            border: 1px solid #fecaca;
        }

        .error-title {
            color: #dc2626;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .error-message {
            color: #991b1b;
            font-size: 14px;
        }

        /* 响应式调整 */
        @media (max-width: 768px) {
            .vam-dict-tab-btn {
                padding: 8px 12px;
                min-width: 60px;
                font-size: 12px;
            }

            .dict-content-wrapper {
                padding: 15px;
            }

            .dict-title {
                font-size: 18px;
            }
        }

        /* 设置面板样式 - 修改调整按钮样式 */
        .dict-settings-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }

        .dict-settings-content {
            background: white;
            padding: 25px;
            border-radius: 12px;
            width: 500px;
            max-width: 90%;
            max-height: 80%;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }

        .dict-settings-title {
            margin-top: 0;
            color: #1e293b;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .dict-settings-subtitle {
            color: #64748b;
            font-size: 13px;
            margin-bottom: 20px;
        }

        .dict-settings-item {
            display: flex;
            align-items: center;
            padding: 14px;
            margin-bottom: 10px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            cursor: move;
            transition: all 0.3s ease;
        }

        .dict-settings-item:hover {
            background: #f1f5f9;
            transform: translateY(-2px);
        }

        .dict-settings-item.dragging {
            opacity: 0.5;
        }

        .dict-settings-drag-handle {
            margin-right: 12px;
            color: #94a3b8;
            font-size: 14px;
            cursor: grab;
        }

        .dict-settings-drag-handle:active {
            cursor: grabbing;
        }

        .dict-settings-checkbox {
            margin-right: 12px;
            width: 18px;
            height: 18px;
            accent-color: #6366f1;
        }

        .dict-settings-label {
            flex: 1;
            cursor: pointer;
        }

        .dict-settings-name {
            font-weight: 500;
            color: #1e293b;
            margin-bottom: 2px;
        }

        .dict-settings-id {
            font-size: 11px;
            color: #94a3b8;
        }

        .dict-settings-buttons {
            display: flex;
            gap: 6px;
            margin-left: 10px;
        }

        /* 修改调整按钮样式 */
        .dict-settings-adjust-btn {
            padding: 6px 10px;
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
        }

        .dict-settings-adjust-btn:hover:not(:disabled) {
            background: #6366f1;
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
        }

        .dict-settings-adjust-btn:active:not(:disabled) {
            transform: translateY(0);
        }

        .dict-settings-adjust-btn:disabled {
            background: #f8fafc;
            color: #cbd5e1;
            cursor: not-allowed;
            opacity: 0.5;
        }

        .dict-settings-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }

        .dict-settings-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.3s ease;
        }

        .dict-settings-btn.cancel {
            background: #f1f5f9;
            color: #64748b;
        }

        .dict-settings-btn.cancel:hover {
            background: #e2e8f0;
        }

        .dict-settings-btn.save {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
        }

        .dict-settings-btn.save:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
    `;
    document.head.appendChild(style);

    // 默认词典配置
    const DEFAULT_DICTIONARIES = {
        haici: {
            name: '海词词典',
            enabled: true,
            order: 1,
            color: '#3b82f6',
            icon: 'book',
            search: function(query) { return this.instance.search(query); }
        },
        eudic: {
            name: '欧路词典',
            enabled: true,
            order: 2,
            color: '#10b981',
            icon: 'graduation-cap',
            search: function(query) { return this.instance.search(query); }
        },
        cambridge: {
            name: '剑桥词典',
            enabled: true,
            order: 3,
            color: '#f59e0b',
            icon: 'university',
            search: function(query) { return this.instance.search(query); }
        },
        urban: {
            name: 'Urban Dict',
            enabled: true,
            order: 4,
            color: '#ef4444',
            icon: 'theater-masks',
            search: function(query) { return this.instance.search(query); }
        },
        youdao: {
            name: '有道词典',
            enabled: true,
            order: 5,
            color: '#8b5cf6',
            icon: 'language',
            search: function(query) { return this.instance.search(query); }
        }
    };

    // 词典类定义
    class Dictionary {
        constructor(name, color, icon) {
            this.name = name;
            this.color = color;
            this.icon = icon;
            this.isSearching = false;
        }

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        addFooter(source) {
            return `
                <div class="footer">
                    <i class="fas fa-database"></i> 数据来源: ${source} &nbsp;|&nbsp;
                    <i class="fas fa-clock"></i> 更新时间: ${new Date().toLocaleTimeString()}
                </div>
            `;
        }

        showLoading(query) {
            return `
                <div class="loading-container">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <div style="margin-top: 10px;">
                        正在查询 ${this.name}...
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">
                        搜索词: "${this.escapeHtml(query)}"
                    </div>
                </div>
            `;
        }

        showError(title, message, type = 'info') {
            const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
            return `
                <div class="error-container">
                    <div style="font-size: 20px; color: #dc2626; margin-bottom: 10px;">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="error-title">${this.escapeHtml(title)}</div>
                    <div class="error-message">${this.escapeHtml(message)}</div>
                </div>
            `;
        }
    }

    // 海词词典类
    class HaiciDict extends Dictionary {
        constructor() {
            super('海词词典', '#3b82f6', 'book');
        }

        async search(query) {
            if (this.isSearching) return;
            this.isSearching = true;

            try {
                const url = `https://dict.cn/${encodeURIComponent(query)}`;
                const html = await this.fetchUrl(url);
                return this.processResponse(html, query);
            } catch (error) {
                return this.showError('查询失败', error.message, 'error');
            } finally {
                this.isSearching = false;
            }
        }

        fetchUrl(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
                    onload: function(response) {
                        if (response.status === 200) resolve(response.responseText);
                        else reject(new Error(`HTTP错误: ${response.status}`));
                    },
                    onerror: function() { reject(new Error('无法连接到海词词典')); },
                    ontimeout: function() { reject(new Error('连接海词词典超时')); }
                });
            });
        }

        processResponse(html, query) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                return this.extractContent(doc, query);
            } catch (err) {
                console.error('解析错误:', err);
                return this.showError('解析错误', `处理页面内容时出错: ${err.message}`, 'error');
            }
        }

        extractContent(doc, query) {
            let content = `<div class="dict-content-wrapper" style="border-color: ${this.color}">`;

            // 单词标题
            const word = doc.querySelector('.dict-basic-ul .keyword')?.textContent.trim() || query;
            content += `
                <div class="dict-header" style="border-color: ${this.color}">
                    <div class="dict-title">
                        <i class="fas fa-${this.icon}" style="color: ${this.color}"></i>
                        ${this.escapeHtml(word)}
                    </div>
                    <div class="dict-subtitle">${this.name} - 海量词典数据</div>
                </div>
            `;

            // 词义
            const defs = doc.querySelectorAll('.dict-basic-ul li');
            if (defs.length > 0) {
                content += `<div class="dict-section">
                    <div class="section-title">
                        <i class="fas fa-list"></i> 词义解析
                    </div>`;

                defs.forEach((li, idx) => {
                    const cloned = li.cloneNode(true);
                    [...cloned.childNodes].filter(n => n.nodeType === Node.COMMENT_NODE).forEach(n => n.remove());
                    cloned.querySelectorAll('ins, script, .adsbygoogle').forEach(a => a.remove());

                    const pos = cloned.querySelector('.pos')?.textContent.trim() || '';
                    const trans = cloned.querySelector('.def')?.textContent.trim() || cloned.textContent.trim();

                    if(trans) {
                        content += `
                            <div class="definition-item" style="border-color: ${this.color}">
                                <span class="definition-number">${idx + 1}</span>
                                <div class="definition-content">
                                    <strong>${this.escapeHtml(pos)}</strong> ${this.escapeHtml(trans)}
                                </div>
                            </div>
                        `;
                    }
                });
                content += `</div>`;
            }

            content += this.addFooter('海词词典');
            content += `</div>`;
            return content;
        }
    }

    // 欧路词典类 - 修改保持原有文本图片结构
    class EudicDict extends Dictionary {
        constructor() {
            super('欧路词典', '#10b981', 'graduation-cap');
        }

        async search(query) {
            if (this.isSearching) return;
            this.isSearching = true;

            try {
                const url = `https://dict.eudic.net/dicts/en/${encodeURIComponent(query)}`;
                const html = await this.fetchUrl(url);
                return this.processResponse(html, query);
            } catch (error) {
                return this.showError('查询失败', error.message, 'error');
            } finally {
                this.isSearching = false;
            }
        }

        fetchUrl(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
                    onload: function(response) {
                        if (response.status === 200) resolve(response.responseText);
                        else reject(new Error(`HTTP错误: ${response.status}`));
                    },
                    onerror: function() { reject(new Error('无法连接到欧路词典')); },
                    ontimeout: function() { reject(new Error('连接欧路词典超时')); }
                });
            });
        }

        processResponse(html, query) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                return this.extractContent(doc, query);
            } catch (err) {
                console.error('解析错误:', err);
                return this.showError('解析错误', err.message, 'error');
            }
        }

        extractContent(doc, query) {
            let content = `<div class="dict-content-wrapper" style="border-color: ${this.color}">`;

            // 单词标题
            const word = doc.querySelector('.expHead a')?.textContent.trim() || query;
            content += `
                <div class="dict-header" style="border-color: ${this.color}">
                    <div class="dict-title">
                        <i class="fas fa-${this.icon}" style="color: ${this.color}"></i>
                        ${this.escapeHtml(word)}
                    </div>
                    <div class="dict-subtitle">${this.name} - 专业词典释义</div>
                </div>
            `;

            // 英汉释义 - 保持原有HTML结构，不修改布局
            const expFCchild = doc.querySelector('#ExpFCchild');
            if (expFCchild) {
                const items = expFCchild.querySelectorAll('ol li');
                if (items.length > 0) {
                    content += `<div class="dict-section">
                        <div class="section-title">
                            <i class="fas fa-list"></i> 英汉释义
                        </div>`;

                    items.forEach((li, idx) => {
                        // 克隆元素并清理不需要的内容
                        const cloned = li.cloneNode(true);

                        // 移除广告等不需要的元素
                        cloned.querySelectorAll('ins, script, .adsbygoogle, iframe, .ads').forEach(el => el.remove());

                        // 修复图片链接
                        const images = cloned.querySelectorAll('img');
                        images.forEach(img => {
                            if (img.src.startsWith('/')) {
                                img.src = 'https://dict.eudic.net' + img.getAttribute('src');
                            }
                        });

                        // 获取清理后的HTML，保持原有布局
                        let itemHtml = cloned.innerHTML.trim();

                        // 清理额外的空白和换行，但保持原有的内联布局
                        itemHtml = itemHtml
                            .replace(/\s+/g, ' ')
                            .replace(/>\s+</g, '><')
                            .trim();

                        if (itemHtml) {
                            content += `
                                <div class="definition-item" style="border-color: ${this.color}">
                                    <span class="definition-number">${idx + 1}</span>
                                    <div class="definition-content eudic-definition-content">
                                        ${itemHtml}
                                    </div>
                                </div>
                            `;
                        }
                    });
                    content += `</div>`;
                }
            }

            content += this.addFooter('欧路词典');
            content += `</div>`;
            return content;
        }
    }

    // 剑桥词典类
    class CambridgeDict extends Dictionary {
        constructor() {
            super('剑桥词典', '#f59e0b', 'university');
        }

        async search(query) {
            if (this.isSearching) return;
            this.isSearching = true;

            try {
                const url = `https://dictionary.cambridge.org/zhs/%E8%AF%8D%E5%85%B8/%E8%8B%B1%E8%AF%AD/${encodeURIComponent(query.toLowerCase())}`;
                const html = await this.fetchUrl(url);
                return this.processResponse(html, query);
            } catch (error) {
                return this.showError('查询失败', error.message, 'error');
            } finally {
                this.isSearching = false;
            }
        }

        fetchUrl(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
                    onload: function(response) {
                        if (response.status === 200) resolve(response.responseText);
                        else reject(new Error(`HTTP错误: ${response.status}`));
                    },
                    onerror: function() { reject(new Error('无法连接到剑桥词典')); },
                    ontimeout: function() { reject(new Error('连接剑桥词典超时')); }
                });
            });
        }

        processResponse(html, query) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const notFound = doc.querySelector('.empty-message, [data-title="无此词条"]');
                if (notFound) {
                    return this.showError('未找到', `在剑桥词典中未找到单词 "${query}"`, 'error');
                }
                return this.extractContent(doc, query);
            } catch (err) {
                console.error('解析错误:', err);
                return this.showError('解析错误', `处理页面内容时出错: ${err.message}`, 'error');
            }
        }

        extractContent(doc, query) {
            let content = `<div class="dict-content-wrapper" style="border-color: ${this.color}">`;

            // 单词 / 发音 / 词性
            const word = doc.querySelector('h1.hw, .headword')?.textContent.trim() || query;
            const pron = doc.querySelector('.pron.dpron, .dpron')?.textContent.trim() || '';
            const pos = doc.querySelector('.pos.dpos, .dpos')?.textContent.trim() || '';

            content += `
                <div class="dict-header" style="border-color: ${this.color}">
                    <div class="dict-title">
                        <i class="fas fa-${this.icon}" style="color: ${this.color}"></i>
                        ${this.escapeHtml(word)}
                    </div>
                    <div class="dict-subtitle">
                        ${pos ? `<span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; margin-right: 10px;">${this.escapeHtml(pos)}</span>` : ''}
                        ${pron ? `<span style="color: #64748b;"><i class="fas fa-volume-up"></i> ${this.escapeHtml(pron)}</span>` : ''}
                    </div>
                </div>
            `;

            // 词义 + B2等级
            const defs = doc.querySelectorAll('.def-block');
            let seq = 1;
            let seenSentences = new Set();

            if (defs.length > 0) {
                content += `<div class="dict-section">
                    <div class="section-title">
                        <i class="fas fa-align-left"></i> 剑桥词典释义
                    </div>`;

                defs.forEach(defBlock => {
                    const levelElem = defBlock.querySelector('.dlevel');
                    const level = levelElem ? levelElem.textContent.trim() : '';
                    const defElem = defBlock.querySelector('.def');
                    if(!defElem) return;
                    const defText = defElem.textContent.trim();
                    if(!defText) return;

                    content += `<div class="definition-item" style="border-color: ${this.color}">
                        <span class="definition-number">${seq}</span>
                        <div class="definition-content">
                            ${this.escapeHtml(defText)}
                            ${level ? `<span style="background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-size: 12px;">${this.escapeHtml(level)}</span>` : ''}
                        </div>`;

                    // 例句去重
                    const examples = defBlock.querySelectorAll('.examp .eg');
                    examples.forEach(ex => {
                        const text = ex.textContent.trim();
                        if(text && !seenSentences.has(text)) {
                            content += `<div class="example-box">
                                <i class="fas fa-quote-left"></i> ${this.escapeHtml(text)}
                            </div>`;
                            seenSentences.add(text);
                        }
                    });

                    content += `</div>`;
                    seq++;
                });
                content += `</div>`;
            }

            content += this.addFooter('剑桥词典');
            content += `</div>`;
            return content;
        }
    }

    // Urban Dictionary类
    class UrbanDict extends Dictionary {
        constructor() {
            super('Urban Dictionary', '#ef4444', 'theater-masks');
        }

        async search(query) {
            if (this.isSearching) return;
            this.isSearching = true;

            try {
                const url = `https://www.urbandictionary.com/define.php?term=${encodeURIComponent(query)}`;
                const html = await this.fetchUrl(url);
                return this.processResponse(html, query);
            } catch (error) {
                return this.showError('查询失败', error.message, 'error');
            } finally {
                this.isSearching = false;
            }
        }

        fetchUrl(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
                    onload: function(response) {
                        if (response.status === 200) resolve(response.responseText);
                        else reject(new Error(`HTTP错误: ${response.status}`));
                    },
                    onerror: function() { reject(new Error('无法连接到Urban Dictionary')); },
                    ontimeout: function() { reject(new Error('连接Urban Dictionary超时')); }
                });
            });
        }

        processResponse(html, query) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');

                if (html.includes("There aren't any definitions for") || html.includes("No results found for")) {
                    return this.showError('未找到', `在Urban Dictionary中未找到单词 "${query}"`, 'error');
                }

                return this.extractContent(doc, query);
            } catch (err) {
                console.error('解析错误:', err);
                return this.showError('解析错误', `处理页面内容时出错: ${err.message}`, 'error');
            }
        }

        extractContent(doc, query) {
            let content = `<div class="dict-content-wrapper" style="border-color: ${this.color}">`;

            const defsAll = doc.querySelectorAll('[data-defid]');
            const defs = Array.from(defsAll).filter(def => {
                const word = def.querySelector('.word')?.textContent.trim();
                const meaning = def.querySelector('.meaning')?.textContent.trim();
                return word && meaning;
            });

            if (defs.length === 0) return null;

            content += `
                <div class="dict-header" style="border-color: ${this.color}">
                    <div class="dict-title">
                        <i class="fas fa-${this.icon}" style="color: ${this.color}"></i>
                        ${this.escapeHtml(query)}
                    </div>
                    <div class="dict-subtitle">
                        Urban Dictionary - 找到 ${defs.length} 个定义
                    </div>
                </div>
            `;

            defs.slice(0, 5).forEach((def, idx) => {
                const word = def.querySelector('.word')?.textContent.trim() || query;
                const meaning = def.querySelector('.meaning')?.textContent.trim() || '';
                const example = def.querySelector('.example')?.textContent.trim() || '';
                const upvotes = def.querySelector('.up .count')?.textContent.trim() || '0';
                const downvotes = def.querySelector('.down .count')?.textContent.trim() || '0';
                const contributor = def.querySelector('.contributor')?.textContent.replace('by','').trim() || 'Unknown';

                content += `<div class="definition-item" style="border-color: ${this.color}">
                    <span class="definition-number">${idx+1}</span>
                    <div class="definition-content">
                        <div style="font-weight: 600; color: #1e293b; margin-bottom: 5px;">${this.escapeHtml(word)}</div>
                        <div>${this.escapeHtml(meaning)}</div>
                        ${example ? `<div class="example-box">
                            <i class="fas fa-quote-left"></i> ${this.escapeHtml(example)}
                        </div>` : ''}
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
                            <span style="margin-right: 15px;"><i class="fas fa-thumbs-up" style="color: #10b981;"></i> ${this.escapeHtml(upvotes)}</span>
                            <span style="margin-right: 15px;"><i class="fas fa-thumbs-down" style="color: #ef4444;"></i> ${this.escapeHtml(downvotes)}</span>
                            <span><i class="fas fa-user-edit"></i> ${this.escapeHtml(contributor)}</span>
                        </div>
                    </div>
                </div>`;
            });

            content += this.addFooter('Urban Dictionary');
            content += `</div>`;
            return content;
        }
    }

    // 有道词典类
    class YoudaoDict extends Dictionary {
        constructor() {
            super('有道词典', '#8b5cf6', 'language');
        }

        async search(query) {
            if (this.isSearching) return;
            this.isSearching = true;

            try {
                const url = `https://m.youdao.com/dict?le=eng&q=${encodeURIComponent(query)}`;
                const html = await this.fetchUrl(url);
                return this.processResponse(html, query);
            } catch (error) {
                return this.showError('查询失败', error.message, 'error');
            } finally {
                this.isSearching = false;
            }
        }

        fetchUrl(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
                    onload: function(response) {
                        if (response.status === 200) resolve(response.responseText);
                        else reject(new Error(`HTTP错误: ${response.status}`));
                    },
                    onerror: function() { reject(new Error('无法连接到有道词典')); },
                    ontimeout: function() { reject(new Error('连接有道词典超时')); }
                });
            });
        }

        processResponse(html, query) {
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                return this.extractContent(doc, query);
            } catch (err) {
                console.error('解析错误:', err);
                return this.showError('解析错误', `处理页面内容时出错: ${err.message}`, 'error');
            }
        }

        extractContent(doc, query) {
            let content = `<div class="dict-content-wrapper" style="border-color: ${this.color}">`;

            content += `
                <div class="dict-header" style="border-color: ${this.color}">
                    <div class="dict-title">
                        <i class="fas fa-${this.icon}" style="color: ${this.color}"></i>
                        ${this.escapeHtml(query)}
                    </div>
                    <div class="dict-subtitle">${this.name} - 智能翻译引擎</div>
                </div>
            `;

            // 提取主要内容区
            const mainContent = doc.querySelector('#content');
            if (!mainContent) {
                return this.showError('未找到内容', `在有道词典中未找到"${query}"的相关释义`, 'error');
            }

            // 移除不需要的元素
            const selectorsToRemove = ['.header', '.footer', '.advertisement', '#download_guide', '.download-banner', 'header', 'nav'];
            selectorsToRemove.forEach(sel => {
                const els = mainContent.querySelectorAll(sel);
                els.forEach(el => el.remove());
            });

            // 调整图片链接
            const imgs = mainContent.querySelectorAll('img');
            imgs.forEach(img => {
                if (img.src.startsWith('/')) {
                    img.src = 'https://m.youdao.com' + img.getAttribute('src');
                }
            });

            content += `<div style="color: #334155; line-height: 1.6;">
                ${mainContent.innerHTML}
            </div>`;

            content += this.addFooter('有道词典');
            content += `</div>`;
            return content;
        }
    }

    // 词典管理器
    class DictionaryManager {
        constructor() {
            this.tabContainer = null;
            this.contentContainer = null;
            this.activeTab = null;
            this.currentQuery = '';
            this.dictionaries = this.loadSettings();
            this.initializeDictionaryInstances();
        }

        loadSettings() {
            const saved = GM_getValue('dictionarySettings');
            if (saved) {
                const merged = {...DEFAULT_DICTIONARIES};
                for (const [key, config] of Object.entries(saved)) {
                    if (merged[key]) {
                        merged[key] = {...merged[key], ...config};
                    }
                }
                return merged;
            }
            return DEFAULT_DICTIONARIES;
        }

        saveSettings() {
            GM_setValue('dictionarySettings', this.dictionaries);
        }

        initializeDictionaryInstances() {
            this.dictionaries.haici.instance = new HaiciDict();
            this.dictionaries.eudic.instance = new EudicDict();
            this.dictionaries.cambridge.instance = new CambridgeDict();
            this.dictionaries.urban.instance = new UrbanDict();
            this.dictionaries.youdao.instance = new YoudaoDict();
        }

        createTabInterface() {
            // 创建标签页和内容容器
            let container = `
                <div class="vam-dict-custom-container">
                    <!-- 设置按钮 -->
                    <button id="vam-dict-settings-btn" class="vam-dict-settings-btn">
                        <i class="fas fa-cog"></i> 设置
                    </button>

                    <!-- 标签页容器 -->
                    <div class="vam-dict-tabs-container">
                        <ul class="vam-dict-tabs" id="vam-dict-tabs">
                            <!-- 标签页将在这里动态生成 -->
                        </ul>
                    </div>

                    <!-- 内容容器 -->
                    <div class="vam-dict-contents" id="vam-dict-contents">
                        <!-- 词典内容将在这里动态生成 -->
                    </div>
                </div>
            `;

            return container;
        }

        createTabAndContent(tabId, contentId, dictName, color, isActive = false) {
            // 创建标签页
            const tabItem = document.createElement('li');
            tabItem.id = tabId;

            const tabButton = document.createElement('button');
            tabButton.className = `vam-dict-tab-btn ${isActive ? 'active' : ''}`;
            tabButton.innerHTML = dictName;
            tabButton.style.borderBottomColor = color;

            tabButton.addEventListener('click', () => this.switchTab(tabId, contentId));
            tabItem.appendChild(tabButton);

            const tabsList = document.querySelector('#vam-dict-tabs');
            if (tabsList) {
                tabsList.appendChild(tabItem);
            }

            // 创建内容区域
            const contentDiv = document.createElement('div');
            contentDiv.id = contentId;
            contentDiv.style.cssText = `
                display: ${isActive ? 'block' : 'none'};
                height: 100%;
                overflow-y: auto;
            `;

            const contentsContainer = document.querySelector('#vam-dict-contents');
            if (contentsContainer) {
                contentsContainer.appendChild(contentDiv);
            }

            if (isActive) {
                this.activeTab = { tabId, contentId };
            }
        }

        switchTab(tabId, contentId) {
            // 隐藏所有内容
            const allContents = document.querySelectorAll('#vam-dict-contents > div');
            allContents.forEach(div => {
                div.style.display = 'none';
            });

            // 重置所有标签样式
            const allTabs = document.querySelectorAll('#vam-dict-tabs .vam-dict-tab-btn');
            allTabs.forEach(button => {
                button.classList.remove('active');
            });

            // 显示选中内容
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.style.display = 'block';
            }

            // 高亮选中标签
            const activeButton = document.querySelector(`#${tabId} .vam-dict-tab-btn`);
            if (activeButton) {
                activeButton.classList.add('active');
            }

            this.activeTab = { tabId, contentId };
        }

        updateContent(contentId, html) {
            const contentDiv = document.getElementById(contentId);
            if (contentDiv) {
                contentDiv.innerHTML = html;
            }
        }

        async searchAllDictionaries(query) {
            this.currentQuery = query;

            // 获取启用的词典并按顺序排序
            const enabledDicts = Object.entries(this.dictionaries)
                .filter(([key, config]) => config.enabled)
                .sort((a, b) => a[1].order - b[1].order);

            if (enabledDicts.length === 0) {
                const noDictHtml = `
                    <div style="text-align:center; padding:60px 20px; color: #64748b;">
                        <div style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <h3 style="margin: 0 0 10px 0; color: #334155; font-size: 18px;">未选择任何词典</h3>
                        <p style="margin: 0; font-size: 14px;">请点击右上角的"设置"按钮启用至少一个词典</p>
                    </div>
                `;
                this.updateContent('vam-dict-contents', noDictHtml);
                return;
            }

            // 清空之前的标签页和内容
            const tabsList = document.querySelector('#vam-dict-tabs');
            const contentsContainer = document.querySelector('#vam-dict-contents');
            if (tabsList) tabsList.innerHTML = '';
            if (contentsContainer) contentsContainer.innerHTML = '';

            // 创建标签页和内容区域
            enabledDicts.forEach(([key, config], index) => {
                const tabId = `tab-${key}`;
                const contentId = `content-${key}`;
                this.createTabAndContent(tabId, contentId, config.name, config.color, index === 0);
                this.updateContent(contentId, config.instance.showLoading(query));
            });

            // 并发查询所有词典
            const promises = enabledDicts.map(async ([key, config]) => {
                const contentId = `content-${key}`;

                try {
                    const content = await config.instance.search(query);
                    this.updateContent(contentId, content);
                    return { key, success: true };
                } catch (error) {
                    console.error(`词典 ${key} 查询失败:`, error);
                    this.updateContent(contentId, config.instance.showError('查询失败', error.message, 'error'));
                    return { key, success: false, error };
                }
            });

            await Promise.allSettled(promises);

            // 激活第一个标签页
            const firstEnabledKey = enabledDicts[0][0];
            this.switchTab(`tab-${firstEnabledKey}`, `content-${firstEnabledKey}`);
        }

        showSettingsPanel() {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'dict-settings-modal';

            const modalContent = document.createElement('div');
            modalContent.className = 'dict-settings-content';

            modalContent.innerHTML = `
                <h3 class="dict-settings-title">
                    <i class="fas fa-sliders-h"></i> 词典设置
                </h3>
                <div class="dict-settings-subtitle">
                    拖拽排序，勾选启用/禁用词典。长按拖动可调整顺序。
                </div>
                <div id="dict-settings-list" style="margin-bottom:20px;"></div>
                <div class="dict-settings-actions">
                    <button id="dict-settings-cancel" class="dict-settings-btn cancel">取消</button>
                    <button id="dict-settings-save" class="dict-settings-btn save">保存设置</button>
                </div>
            `;

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            this.populateSettingsList(modalContent);

            // 事件监听
            document.getElementById('dict-settings-cancel').addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            document.getElementById('dict-settings-save').addEventListener('click', () => {
                this.saveSettingsFromUI();
                document.body.removeChild(modal);
                // 重新加载设置
                this.dictionaries = this.loadSettings();
                this.initializeDictionaryInstances();
                // 重新查询当前单词
                if (this.currentQuery) {
                    this.searchAllDictionaries(this.currentQuery);
                }
            });

            // 点击模态框外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        }

        populateSettingsList(modal) {
            const listContainer = document.getElementById('dict-settings-list');
            listContainer.innerHTML = '';

            // 按顺序排序
            const sortedDicts = Object.entries(this.dictionaries)
                .sort((a, b) => a[1].order - b[1].order);

            sortedDicts.forEach(([key, config], index) => {
                const item = document.createElement('div');
                item.className = 'dict-settings-item';
                item.dataset.key = key;

                item.innerHTML = `
                    <div style="display:flex; align-items:center; flex:1;">
                        <div class="dict-settings-drag-handle">
                            <i class="fas fa-bars"></i>
                        </div>
                        <label class="dict-settings-label">
                            <input type="checkbox" ${config.enabled ? 'checked' : ''}
                                class="dict-settings-checkbox" onchange="event.stopPropagation()">
                            <div>
                                <div class="dict-settings-name">${config.name}</div>
                                <div class="dict-settings-id">词典ID: ${key}</div>
                            </div>
                        </label>
                    </div>
                    <div class="dict-settings-buttons">
                        <button class="dict-settings-adjust-btn move-up" ${index === 0 ? 'disabled' : ''} title="上移">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button class="dict-settings-adjust-btn move-down" ${index === sortedDicts.length - 1 ? 'disabled' : ''} title="下移">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                    </div>
                `;

                // 拖拽事件
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', key);
                    item.classList.add('dragging');
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                });

                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                });

                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const draggedKey = e.dataTransfer.getData('text/plain');
                    this.reorderItems(draggedKey, key);
                });

                // 上下移动按钮事件 - 使用新的调整按钮样式
                const moveUpBtn = item.querySelector('.move-up');
                const moveDownBtn = item.querySelector('.move-down');

                moveUpBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.moveItemUp(key);
                });

                moveDownBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.moveItemDown(key);
                });

                listContainer.appendChild(item);
            });
        }

        reorderItems(draggedKey, targetKey) {
            if (draggedKey === targetKey) return;

            const dictEntries = Object.entries(this.dictionaries);
            const draggedIndex = dictEntries.findIndex(([key]) => key === draggedKey);
            const targetIndex = dictEntries.findIndex(([key]) => key === targetKey);

            // 重新排序
            const [draggedItem] = dictEntries.splice(draggedIndex, 1);
            dictEntries.splice(targetIndex, 0, draggedItem);

            // 更新order
            dictEntries.forEach(([key], index) => {
                this.dictionaries[key].order = index + 1;
            });

            this.populateSettingsList(document.querySelector('#dict-settings-list').parentElement);
        }

        moveItemUp(key) {
            const currentOrder = this.dictionaries[key].order;
            if (currentOrder <= 1) return;

            // 找到前一个项目
            const prevKey = Object.keys(this.dictionaries).find(k => this.dictionaries[k].order === currentOrder - 1);
            if (prevKey) {
                this.dictionaries[key].order = currentOrder - 1;
                this.dictionaries[prevKey].order = currentOrder;
                this.populateSettingsList(document.querySelector('#dict-settings-list').parentElement);
            }
        }

        moveItemDown(key) {
            const currentOrder = this.dictionaries[key].order;
            const maxOrder = Math.max(...Object.values(this.dictionaries).map(d => d.order));

            if (currentOrder >= maxOrder) return;

            // 找到后一个项目
            const nextKey = Object.keys(this.dictionaries).find(k => this.dictionaries[k].order === currentOrder + 1);
            if (nextKey) {
                this.dictionaries[key].order = currentOrder + 1;
                this.dictionaries[nextKey].order = currentOrder;
                this.populateSettingsList(document.querySelector('#dict-settings-list').parentElement);
            }
        }

        saveSettingsFromUI() {
            const items = document.querySelectorAll('#dict-settings-list > .dict-settings-item');
            items.forEach((item, index) => {
                const key = item.dataset.key;
                const checkbox = item.querySelector('.dict-settings-checkbox');

                if (this.dictionaries[key]) {
                    this.dictionaries[key].enabled = checkbox.checked;
                    this.dictionaries[key].order = index + 1;
                }
            });

            this.saveSettings();
        }
    }

    // 全局词典管理器实例
    let dictionaryManager = null;

    // 监听VAMplayer的消息
    window.addEventListener('message', async function(event) {
        if (event.data && event.data.type === 'VAM_SEARCH_REQUEST') {
            const { word, lang } = event.data.payload;
            console.log(`[VAMplayer词典脚本] 收到查询请求: ${word}, 语言: ${lang}`);

            // 创建词典管理器实例
            dictionaryManager = new DictionaryManager();

            // 创建标签页界面
            const tabInterface = dictionaryManager.createTabInterface();

            // 发送响应给VAMplayer
            window.postMessage({
                type: 'VAM_SEARCH_RESPONSE',
                payload: {
                    html: tabInterface,
                    error: null
                }
            }, '*');

            // 等待DOM更新后执行查询
            setTimeout(() => {
                dictionaryManager.searchAllDictionaries(word);

                // 添加设置按钮事件监听
                setTimeout(() => {
                    const settingsBtn = document.getElementById('vam-dict-settings-btn');
                    if (settingsBtn) {
                        settingsBtn.addEventListener('click', () => {
                            dictionaryManager.showSettingsPanel();
                        });
                    }
                }, 100);
            }, 100);
        }
    });

    console.log('[VAMplayer词典脚本] 脚本已就绪，等待VAMplayer查询请求...');

})();