// 故事推动 NPC Generator - index.js
// 兼容酒馆助手与SillyTavern环境的安全重构版

(function () {
  "use strict";

  // ============================================================
  // 安全的获取上下文与核心变量（防止任何未定义报错崩溃）
  // ============================================================
  function getSTContext() {
    try {
      if (window.SillyTavern && window.SillyTavern.getContext) {
        return window.SillyTavern.getContext();
      }
    } catch {}
    return null;
  }

  function getCurrentCharName() {
    try {
      const ctx = getSTContext();
      if (ctx) return ctx.name2 || ctx.characterId || "default";
      const el = document.querySelector(".ch_name, #char_name_display, .character_name");
      return el?.textContent?.trim() || "default";
    } catch {}
    return "default";
  }

  function getChatContext() {
    try {
      const ctx = getSTContext();
      if (ctx && ctx.chat) {
        return ctx.chat
          .slice(-20)
          .map((m) => `${m.name}: ${m.mes}`)
          .join("\n");
      }
      if (typeof getChatMessages === "function") {
        const msgs = getChatMessages();
        return msgs.slice(-20).map((m) => `${m.name}: ${m.message}`).join("\n");
      }
    } catch {}
    return "";
  }

  // ============================================================
  // 存储工具
  // ============================================================
  const API_STORAGE_KEY  = "npc_gen_apis";
  const ACTIVE_API_KEY   = "npc_gen_active_api";
  const CHAR_NPC_PREFIX  = "npc_gen_npcs_";

  function saveData(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return; } catch {}
    try { if (typeof setVariable === "function") setVariable(key, JSON.stringify(value)); } catch {}
  }

  function loadData(key, fallback = null) {
    try {
      const r = localStorage.getItem(key);
      if (r !== null) return JSON.parse(r);
    } catch {}
    try {
      if (typeof getVariable === "function") {
        const r = getVariable(key);
        if (r) return JSON.parse(r);
      }
    } catch {}
    return fallback;
  }

  function saveCharNPCs(npcs) { saveData(CHAR_NPC_PREFIX + getCurrentCharName(), npcs); }
  function loadCharNPCs()      { return loadData(CHAR_NPC_PREFIX + getCurrentCharName(), []); }
  function saveAPIs(a)         { saveData(API_STORAGE_KEY, a); }
  function loadAPIs()          { return loadData(API_STORAGE_KEY, []); }
  function saveActiveAPI(i)    { saveData(ACTIVE_API_KEY, i); }
  function loadActiveAPI()     { return loadData(ACTIVE_API_KEY, 0); }

  // ============================================================
  // API 调用
  // ============================================================
  async function callAPI(systemPrompt, userPrompt) {
    const apis = loadAPIs();
    const idx  = loadActiveAPI();
    const api  = apis[idx];
    if (!api) throw new Error("没有配置API，请先在⚙API页添加");

    const resp = await fetch(api.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + api.key },
      body: JSON.stringify({
        model: api.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
        max_tokens: 2000,
        temperature: 0.9,
      }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content || "";
  }

  async function fetchModels(url, key) {
    const base = url.replace(/\/chat\/completions\/?$/, "");
    const resp = await fetch(base + "/v1/models", {
      headers: { Authorization: "Bearer " + key },
    });
    const data = await resp.json();
    return (data.data || []).map((m) => m.id);
  }

  // ============================================================
  // 生成函数 (保留主人完整逻辑)
  // ============================================================
  function parseThree(raw) {
    const pats = [
      /【方案[一二三123]】([\s\S]*?)(?=【方案[一二三123]】|$)/g,
      /\*\*方案[一二三123][：:]\*\*([\s\S]*?)(?=\*\*方案[一二三123][：:]|$)/g,
      /(?:^|\n)[1-3一二三][.、:：]\s*([\s\S]*?)(?=(?:^|\n)[1-3一二三][.、:：]|$)/g,
    ];
    for (const p of pats) {
      const m = [...raw.matchAll(p)];
      if (m.length >= 2) return m.slice(0, 3).map((x) => x[1].trim());
    }
    const paras = raw.split(/\n\n+/).filter((p) => p.trim().length > 20);
    return paras.length >= 2 ? paras.slice(0, 3) : [raw.trim(), "", ""];
  }

  async function genScene(mood) {
    const ctx = getChatContext();
    return callAPI(
      `你是专业互动小说写手。根据对话上下文生成3个不同走向的剧情续写，只涉及现有主角和角色，不引入新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`,
      `对话上下文：\n${ctx}\n\n剧情要求：${mood || "随机，不限风格"}`
    );
  }

  async function genWorldNPC(npcsText, mood) {
    const ctx = getChatContext();
    return callAPI(
      `你是专业互动小说写手。根据对话上下文和世界书NPC设定，生成3个NPC介入剧情的续写方案。NPC必须是设定中已有的角色。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`,
      `对话上下文：\n${ctx}\n\n世界书NPC设定（重点参考）：\n${npcsText}\n\n剧情要求：${mood || "随机，不限风格"}`
    );
  }

  async function genCustomNPC(traits, mood) {
    const ctx = getChatContext();
    return callAPI(
      `你是专业互动小说写手。根据对话上下文创造一个全新NPC，生成3个不同走向的剧情方案，NPC以合理方式介入剧情。格式：【方案一】（先简介NPC，再写剧情）内容 【方案二】内容 【方案三】内容，每个100-200字。`,
      `对话上下文：\n${ctx}\n\nNPC特征要求：${traits || "完全随机，性别外貌性格均随机"}\n\n剧情要求：${mood || "随机，不限风格"}`
    );
  }

  async function genWorldbookEntry(scenarioText) {
    const ctx = getChatContext();
    return callAPI(
      `你是专业角色设计师。根据给定的剧情方案和对话背景，为方案中出现的NPC生成一份完整的世界书角色设定档案。格式要求严格。`,
      `当前对话背景：\n${ctx}\n\n需要为以下剧情方案中的NPC生成世界书设定：\n${scenarioText}`
    );
  }

  async function genMixed(npcsText, useWorld, desc) {
    const ctx = getChatContext();
    const npcSec = useWorld && npcsText ? `\n\n世界书NPC设定（必须使用）：\n${npcsText}` : "";
    return callAPI(
      `你是专业互动小说写手。根据对话上下文生成3个融合多种NPC元素的复杂剧情方案，可混合使用世界书NPC和全新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-250字。`,
      `对话上下文：\n${ctx}${npcSec}\n\n混合剧情要求：${desc || "随机混合，创意自由发挥"}`
    );
  }

  // ============================================================
  // 发送消息
  // ============================================================
  function sendToChat(text) {
    try { if (typeof sendMessage === "function") { sendMessage(text); return true; } } catch {}
    try { if (typeof setInput === "function") { setInput(text); return false; } } catch {}
    try {
      const inp = document.querySelector("#send_textarea, #chat_input, textarea.chat_input");
      if (inp) { inp.value = text; inp.dispatchEvent(new Event("input", { bubbles: true })); return false; }
    } catch {}
    return false;
  }

  // ============================================================
  // 显示 toast
  // ============================================================
  function showToast(msg, type = "info") {
    try { if (typeof toast === "function") { toast(msg, type); return; } } catch {}
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;bottom:160px;right:24px;background:${type==="error"?"#5a1a2e":type==="success"?"#1a3a2e":"#2d2050"};color:#e0d8f0;padding:8px 14px;border-radius:8px;font-size:12px;z-index:99999;pointer-events:none;transition:opacity 0.4s`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }, 2500);
  }

  // ============================================================
  // UI 构建
  // ============================================================
  function buildUI() {
    if (document.getElementById("npc-gen-fab")) return;

    // 创建 FAB 悬浮按钮
    const fab = document.createElement("button");
    fab.id = "npc-gen-fab";
    fab.title = "故事推动 NPC生成器";
    fab.textContent = "✦";
    document.body.appendChild(fab);

    // 默认样式兜底（如果style.css没加载出来，用这个至少能看到紫色按钮）
    fab.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #8b5cf6;
      color: white;
      font-size: 24px;
      border: none;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      z-index: 99999;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // 创建面板
    const panel = document.createElement("div");
    panel.id = "npc-gen-panel";
    panel.innerHTML = `
      <div class="npc-panel-header">
        <h3>✦ 故事推动</h3>
        <button class="npc-close-btn" id="npc-close">✕</button>
      </div>
      <div class="npc-tab-bar">
        <button class="npc-tab active" data-tab="scene">① 纯剧情</button>
        <button class="npc-tab" data-tab="world">② 世界NPC</button>
        <button class="npc-tab" data-tab="custom">③ 自定义NPC</button>
        <button class="npc-tab" data-tab="mixed">④ 混合</button>
        <button class="npc-tab" data-tab="api">⚙ API</button>
      </div>
      <div class="npc-panel-body">
        <div class="npc-pane" id="pane-scene">
          <div class="npc-section">
            <div class="npc-label">剧情氛围（可选）</div>
            <input class="npc-input" id="scene-mood" placeholder="温馨浪漫 / 紧张刺激 / 日常轻松…">
          </div>
          <button class="npc-btn npc-btn-primary" id="scene-gen">生成剧情方案</button>
          <div class="npc-results" id="scene-results"></div>
        </div>
        <div class="npc-pane" id="pane-world" style="display:none">
          <div class="npc-section"><div class="npc-label">已保存的NPC</div><div class="npc-tags-wrap" id="world-npc-tags"></div></div>
          <textarea class="npc-textarea" id="world-npc-text" placeholder="设定内容..."></textarea>
          <button class="npc-btn npc-btn-primary" id="world-gen">生成NPC介入</button>
          <div class="npc-results" id="world-results"></div>
        </div>
        <div class="npc-pane" id="pane-custom" style="display:none">
          <textarea class="npc-textarea" id="custom-traits" placeholder="NPC特征..."></textarea>
          <button class="npc-btn npc-btn-primary" id="custom-gen">生成自定义NPC</button>
          <div class="npc-results" id="custom-results"></div>
        </div>
        <div class="npc-pane" id="pane-mixed" style="display:none">
          <button class="npc-btn npc-btn-primary" id="mixed-gen">生成混合剧情</button>
          <div class="npc-results" id="mixed-results"></div>
        </div>
        <div class="npc-pane" id="pane-api" style="display:none">
          <div id="api-list"></div>
          <input class="npc-input" id="api-name" placeholder="API名称">
          <input class="npc-input" id="api-url" placeholder="API地址">
          <input class="npc-input" id="api-key" type="password" placeholder="API密钥">
          <input class="npc-input" id="api-model" placeholder="模型名字">
          <button class="npc-btn npc-btn-primary" id="api-save">保存API</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // 事件绑定
    fab.addEventListener("click", () => panel.classList.toggle("open"));
    document.getElementById("npc-close").addEventListener("click", () => panel.classList.remove("open"));

    // 选项卡切换等其他UI逻辑...
    panel.querySelectorAll(".npc-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        panel.querySelectorAll(".npc-tab").forEach((t) => t.classList.remove("active"));
        panel.querySelectorAll(".npc-pane").forEach((p) => (p.style.display = "none"));
        tab.classList.add("active");
        const pane = document.getElementById("pane-" + tab.dataset.tab);
        if (pane) pane.style.display = "block";
      });
    });
  }

  // ============================================================
  // 安全的生命周期和角色切换事件监听
  // ============================================================
  function safeHookCharSwitch() {
    try {
      // 只有在全局 eventSource 确实存在时才绑定，绝对不让它报错中断
      if (typeof eventSource !== "undefined" && eventSource.on && typeof event_types !== "undefined") {
        eventSource.on(event_types.CHARACTER_SELECTED, () => {
          const tags = document.getElementById("world-npc-tags");
          const ta   = document.getElementById("world-npc-text");
          if (tags) renderWorldTagsExternal(tags, ta);
        });
      }
    } catch (e) {
      console.log("Safe hook char switch skipped:", e);
    }
  }

  function renderWorldTagsExternal(wrap, ta) {
    try {
      const npcs = loadCharNPCs();
      wrap.innerHTML = "";
      npcs.forEach((npc, i) => {
        const tag = document.createElement("span");
        tag.className = "npc-npc-tag";
        tag.innerHTML = `${npc.name} <button data-i="${i}">×</button>`;
        tag.querySelector("button").addEventListener("click", () => {
          const list = loadCharNPCs(); list.splice(i, 1); saveCharNPCs(list);
          renderWorldTagsExternal(wrap, ta);
        });
        wrap.appendChild(tag);
      });
      if (ta) ta.value = npcs.map((n) => n.text).filter(Boolean).join("\n\n---\n\n");
    } catch {}
  }

  // ============================================================
  // 注册斜杠命令
  // ============================================================
  function registerSlashCmd() {
    try {
      if (typeof slashRunner !== "undefined" && slashRunner.register) {
        slashRunner.register("npcgen", () => {
          const panel = document.getElementById("npc-gen-panel");
          if (panel) panel.classList.toggle("open");
          else { buildUI(); setTimeout(() => document.getElementById("npc-gen-panel")?.classList.add("open"), 100); }
          return "NPC生成器已打开";
        });
      }
    } catch {}
  }

  // ============================================================
  // 安全入口：三重轮询保险，且自带 try-catch 保护
  // ============================================================
  function safeInit() {
    try {
      if (document.getElementById("npc-gen-fab")) return;

      const bodyReady = document.body && document.body.children.length > 0;
      if (bodyReady) {
        buildUI();
        safeHookCharSwitch();
        registerSlashCmd();
        console.log("Story Prompter initialized successfully!");
      }
    } catch (err) {
      console.error("Story Prompter initialization failed:", err);
    }
  }

  // 三重保险启动
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInit);
  } else {
    safeInit();
  }
  window.addEventListener("load", safeInit);
  
  // 3秒兜底轮询
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (document.getElementById("npc-gen-fab") || attempts > 30) {
      clearInterval(timer);
    } else {
      safeInit();
    }
  }, 500);

})();
