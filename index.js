// ==UserScript==
// @name         故事推动 NPC 生成器
// @version      1.1.2
// @description  完整合体最终版：包含所有逻辑、提示词与强力注入
// @author       Imola
// ==/UserScript==

(function () {
  "use strict";

  if (window.__npcGenLoaded) return;
  window.__npcGenLoaded = true;

  // ============================================================
  // 1. 存储与基础逻辑
  // ============================================================
  const API_KEY    = "npc_gen_apis";
  const ACTIVE_KEY = "npc_gen_active";
  const NPC_PRE    = "npc_gen_npcs_";

  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
  function load(key, fb) { try { const r = localStorage.getItem(key); if (r !== null) return JSON.parse(r); } catch {} return fb; }

  function charKey() {
    try {
      const ctx = window.SillyTavern?.getContext?.();
      if (ctx) return ctx.name2 || ctx.characterId || "default";
      return document.querySelector(".ch_name, #char_name_display")?.textContent?.trim() || "default";
    } catch { return "default"; }
  }

  const saveAPIs      = (v) => save(API_KEY, v);
  const loadAPIs      = ()  => load(API_KEY, []);
  const saveActive    = (v) => save(ACTIVE_KEY, v);
  const loadActive    = ()  => load(ACTIVE_KEY, 0);
  const saveCharNPCs  = (v) => save(NPC_PRE + charKey(), v);
  const loadCharNPCs  = ()  => load(NPC_PRE + charKey(), []);

  function getChatCtx() {
    try {
      const ctx = window.SillyTavern?.getContext?.();
      if (ctx?.chat) return ctx.chat.slice(-20).map((m) => `${m.name}: ${m.mes}`).join("\n");
    } catch {}
    return "";
  }

  async function callAPI(sys, usr) {
    const apis = loadAPIs();
    const api  = apis[loadActive()];
    if (!api) throw new Error("没有配置API，请先在⚙API页添加");
    const res  = await fetch(api.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + api.key },
      body: JSON.stringify({
        model: api.model || "gpt-4o",
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        max_tokens: 2000,
        temperature: 0.9,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices?.[0]?.message?.content || "";
  }

  // ============================================================
  // 2. 核心提示词（大脑）
  // ============================================================
  const SYS_SCENE = `你是专业互动小说写手。根据对话上下文生成3个不同走向的剧情续写，只涉及现有主角和角色，不引入新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`;
  const SYS_WORLD = `你是专业互动小说写手。根据对话上下文和世界书NPC设定，生成3个NPC介入剧情的续写方案，NPC必须是设定中已有的角色。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`;
  const SYS_CUSTOM= `你是专业互动小说写手。根据对话上下文创造一个全新NPC，生成3个不同走向的剧情方案，NPC以合理方式介入剧情。格式：【方案一】（先简介NPC，再写剧情）内容 【方案二】内容 【方案三】内容，每个100-200字。`;
  const SYS_WB    = `你是专业角色设计师。根据剧情方案和对话背景，为方案中的NPC生成完整世界书角色档案。格式：【角色名】【性别】【年龄】【外貌】【性格】【家庭背景】【人生经历】【能力与特长】【弱点与阴暗面】【与主角的关系】【惯用台词】【备注】`;
  const SYS_MIXED = `你是专业互动小说写手。根据对话上下文生成3个融合多种NPC元素的复杂剧情方案，可混合世界书NPC和全新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-250字。`;

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
    return [raw.trim(), "", ""];
  }

  // ============================================================
  // 3. UI 样式与注入（身体）
  // ============================================================
  function injectEverything() {
    if (document.getElementById("npc-gen-fab")) return;

    const style = document.createElement("style");
    style.textContent = `
      #npc-gen-fab{position:fixed;bottom:80px;right:20px;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7c5cbf,#4a3580);color:#fff;border:none;cursor:pointer;font-size:22px;box-shadow:0 4px 20px rgba(124,92,191,.5);z-index:999999;display:flex;align-items:center;justify-content:center;transition:transform .2s}
      #npc-gen-panel{position:fixed;bottom:140px;right:20px;width:380px;max-height:80vh;background:#1a1626;border:1px solid #3a2d5c;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.6);z-index:999998;display:none;flex-direction:column;overflow:hidden;color:#e0d8f0;font-family:sans-serif}
      #npc-gen-panel.open{display:flex}
      .npc-ph{background:linear-gradient(135deg,#2d1f4e,#1a1626);padding:14px;display:flex;justify-content:space-between;border-bottom:1px solid #3a2d5c}
      .npc-tabs{display:flex;background:#120e1f;border-bottom:1px solid #2d2050}
      .npc-tab{flex:1;padding:10px;background:none;border:none;color:#6b5a8e;cursor:pointer;font-size:11px}
      .npc-tab.active{color:#c4a8ff;border-bottom:2px solid #7c5cbf}
      .npc-body{padding:16px;overflow-y:auto;flex:1}
      .npc-primary{background:linear-gradient(135deg,#7c5cbf,#5a3d99);color:#fff;width:100%;padding:10px;border-radius:8px;border:none;cursor:pointer;margin-top:10px}
      .npc-ri{background:#0f0b1a;border:1px solid #2d2050;border-radius:10px;padding:12px;margin-bottom:10px}
      .npc-rtxt{font-size:13px;line-height:1.6;margin-top:5px;white-space:pre-wrap}
      .npc-inp,.npc-ta{width:100%;background:#0f0b1a;border:1px solid #2d2050;border-radius:8px;color:#fff;padding:8px;box-sizing:border-box;margin-bottom:10px}
    `;
    document.head.appendChild(style);

    const fab = document.createElement("button");
    fab.id = "npc-gen-fab"; fab.innerHTML = "✦";
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.id = "npc-gen-panel";
    panel.innerHTML = `
      <div class="npc-ph"><span>✦ 故事推动</span><button id="npc-x" style="background:none;border:none;color:#fff;cursor:pointer">✕</button></div>
      <div class="npc-tabs">
        <button class="npc-tab active" data-tab="scene">纯剧情</button>
        <button class="npc-tab" data-tab="api">⚙ API</button>
      </div>
      <div class="npc-body" id="npc-pane-content">
        <div id="pane-scene">
          <input class="npc-inp" id="scene-mood" placeholder="剧情氛围...">
          <button class="npc-primary" id="scene-gen">生成剧情方案</button>
          <div id="scene-res" style="margin-top:15px"></div>
        </div>
        <div id="pane-api" style="display:none">
          <input class="npc-inp" id="api-name" placeholder="名称">
          <input class="npc-inp" id="api-url" placeholder="URL">
          <input class="npc-inp" id="api-key" type="password" placeholder="Key">
          <input class="npc-inp" id="api-model" placeholder="Model">
          <button class="npc-primary" id="api-save">保存API</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // 简单交互绑定
    fab.onclick = () => panel.classList.toggle("open");
    document.getElementById("npc-x").onclick = () => panel.classList.remove("open");
    
    document.getElementById("scene-gen").onclick = async () => {
      const resDiv = document.getElementById("scene-res");
      resDiv.innerHTML = "生成中...";
      try {
        const raw = await callAPI(SYS_SCENE, `上下文：\n${getChatCtx()}\n要求：${document.getElementById("scene-mood").value}`);
        const opts = parseThree(raw);
        resDiv.innerHTML = opts.map(opt => `<div class="npc-ri"><div class="npc-rtxt">${opt}</div></div>`).join("");
      } catch(e) { resDiv.innerHTML = "失败：" + e.message; }
    };
    
    document.getElementById("api-save").onclick = () => {
      const entry = {
        name: document.getElementById("api-name").value,
        url: document.getElementById("api-url").value,
        key: document.getElementById("api-key").value,
        model: document.getElementById("api-model").value
      };
      saveAPIs([entry]); saveActive(0);
      alert("API已保存！");
    };

    // Tab切换逻辑
    panel.querySelectorAll(".npc-tab").forEach(tab => {
      tab.onclick = () => {
        panel.querySelectorAll(".npc-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const isApi = tab.dataset.tab === 'api';
        document.getElementById("pane-scene").style.display = isApi ? "none" : "block";
        document.getElementById("pane-api").style.display = isApi ? "block" : "none";
      }
    });
  }

  // 4. 强力启动检查
  if (document.readyState === 'complete') { injectEverything(); } 
  else { window.addEventListener('load', injectEverything); }
  setTimeout(injectEverything, 3000); // 兜底防止某些环境加载过慢

})();
