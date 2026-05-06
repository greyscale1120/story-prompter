// ==UserScript==
// @name         故事推动 NPC 生成器
// @version      1.0.0
// @description  在酒馆中提供多方案剧情推动和世界书NPC生成
// @author       Imola
// ==/UserScript==

(function () {
  "use strict";

  // ============================================================
  // 防重复注入
  // ============================================================
  if (window.__npcGenLoaded) return;
  window.__npcGenLoaded = true;

  // ============================================================
  // 存储
  // ============================================================
  const API_KEY    = "npc_gen_apis";
  const ACTIVE_KEY = "npc_gen_active";
  const NPC_PRE    = "npc_gen_npcs_";

  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
  function load(key, fb) {
    try { const r = localStorage.getItem(key); if (r !== null) return JSON.parse(r); } catch {}
    return fb;
  }

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

  // ============================================================
  // 聊天上下文
  // ============================================================
  function getChatCtx() {
    try {
      const ctx = window.SillyTavern?.getContext?.();
      if (ctx?.chat) return ctx.chat.slice(-20).map((m) => `${m.name}: ${m.mes}`).join("\n");
    } catch {}
    try { return getChatMessages().slice(-20).map((m) => `${m.name}: ${m.message}`).join("\n"); } catch {}
    return "";
  }

  // ============================================================
  // API 调用
  // ============================================================
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

  async function fetchModels(url, key) {
    const base = url.replace(/\/chat\/completions\/?$/, "");
    const res  = await fetch(base + "/v1/models", { headers: { Authorization: "Bearer " + key } });
    const data = await res.json();
    return (data.data || []).map((m) => m.id);
  }

  // ============================================================
  // 生成逻辑
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

  const SYS_SCENE = `你是专业互动小说写手。根据对话上下文生成3个不同走向的剧情续写，只涉及现有主角和角色，不引入新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`;
  const SYS_WORLD = `你是专业互动小说写手。根据对话上下文和世界书NPC设定，生成3个NPC介入剧情的续写方案，NPC必须是设定中已有的角色。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`;
  const SYS_CUSTOM= `你是专业互动小说写手。根据对话上下文创造一个全新NPC，生成3个不同走向的剧情方案，NPC以合理方式介入剧情。格式：【方案一】（先简介NPC，再写剧情）内容 【方案二】内容 【方案三】内容，每个100-200字。`;
  const SYS_WB    = `你是专业角色设计师。根据剧情方案和对话背景，为方案中的NPC生成完整世界书角色档案。
格式（严格输出）：
【角色名】
【性别】
【年龄】
【外貌】
【性格】
【家庭背景】
【人生经历】
【能力与特长】
【弱点与阴暗面】
【与主角的关系】
【惯用台词】
【备注】`;
  const SYS_MIXED = `你是专业互动小说写手。根据对话上下文生成3个融合多种NPC元素的复杂剧情方案，可混合世界书NPC和全新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-250字。`;

  const genScene  = (mood) => callAPI(SYS_SCENE,  `上下文：\n${getChatCtx()}\n\n要求：${mood||"随机"}`);
  const genWorld  = (npc, mood) => callAPI(SYS_WORLD, `上下文：\n${getChatCtx()}\n\n世界书NPC：\n${npc}\n\n要求：${mood||"随机"}`);
  const genCustom = (tr, mood)  => callAPI(SYS_CUSTOM,`上下文：\n${getChatCtx()}\n\nNPC特征：${tr||"完全随机"}\n\n要求：${mood||"随机"}`);
  const genWB     = (sc)        => callAPI(SYS_WB,    `上下文：\n${getChatCtx()}\n\n剧情方案：\n${sc}`);
  const genMixed  = (npc, useW, desc) => callAPI(SYS_MIXED,
    `上下文：\n${getChatCtx()}${useW&&npc?`\n\n世界书NPC（必须使用）：\n${npc}`:""}\n\n要求：${desc||"随机混合"}`);

  // ============================================================
  // 发送到聊天
  // ============================================================
  function sendToChat(text) {
    try { sendMessage(text); return; } catch {}
    try { setInput(text); return; } catch {}
    const inp = document.querySelector("#send_textarea, #chat_input, textarea.chat_input");
    if (inp) { inp.value = text; inp.dispatchEvent(new Event("input", { bubbles: true })); }
  }

  // ============================================================
  // Toast
  // ============================================================
  function showToast(msg, type) {
    try { toast(msg, type); return; } catch {}
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;bottom:160px;right:24px;background:${type==="error"?"#5a1a2e":type==="success"?"#1a3a2e":"#2d2050"};color:#e0d8f0;padding:8px 14px;border-radius:8px;font-size:12px;z-index:999999;pointer-events:none;transition:opacity .4s`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }, 2500);
  }

  // ============================================================
  // 注入样式
  // ============================================================
  function injectStyles() {
    if (document.getElementById("npc-gen-style")) return;
    const s = document.createElement("style");
    s.id = "npc-gen-style";
    s.textContent = `
#npc-gen-fab{position:fixed;bottom:80px;right:20px;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7c5cbf,#4a3580);color:#fff;border:none;cursor:pointer;font-size:22px;box-shadow:0 4px 20px rgba(124,92,191,.5);z-index:999999;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
#npc-gen-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(124,92,191,.7)}
#npc-gen-panel{position:fixed;bottom:140px;right:20px;width:380px;max-height:80vh;background:#1a1626;border:1px solid #3a2d5c;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.6);z-index:999998;display:none;flex-direction:column;overflow:hidden;font-family:'Segoe UI',sans-serif;color:#e0d8f0;font-size:13px}
#npc-gen-panel.open{display:flex}
.npc-ph{background:linear-gradient(135deg,#2d1f4e,#1a1626);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #3a2d5c;flex-shrink:0}
.npc-ph h3{margin:0;font-size:15px;font-weight:600;color:#c4a8ff;letter-spacing:.5px}
.npc-xbtn{background:none;border:none;color:#6b5a8e;cursor:pointer;font-size:18px;padding:0;line-height:1}
.npc-xbtn:hover{color:#ff7aaa}
.npc-tabs{display:flex;background:#120e1f;border-bottom:1px solid #2d2050;flex-shrink:0;overflow-x:auto}
.npc-tab{flex:1;min-width:58px;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:#6b5a8e;cursor:pointer;font-size:11px;text-align:center;white-space:nowrap;transition:color .2s,background .2s;font-family:inherit}
.npc-tab.active{color:#c4a8ff;border-bottom-color:#7c5cbf;background:#1a1626}
.npc-tab:hover{color:#a87fff}
.npc-body{flex:1;overflow-y:auto;padding:16px}
.npc-body::-webkit-scrollbar{width:4px}
.npc-body::-webkit-scrollbar-thumb{background:#3a2d5c;border-radius:2px}
.npc-sec{margin-bottom:14px}
.npc-lbl{font-size:10px;color:#8b7aaa;margin-bottom:5px;text-transform:uppercase;letter-spacing:.8px;font-weight:600}
.npc-inp,.npc-ta,.npc-sel{width:100%;background:#0f0b1a;border:1px solid #2d2050;border-radius:8px;color:#e0d8f0;padding:8px 10px;font-size:13px;box-sizing:border-box;transition:border-color .2s;outline:none;font-family:inherit}
.npc-inp:focus,.npc-ta:focus,.npc-sel:focus{border-color:#7c5cbf}
.npc-ta{resize:vertical;min-height:80px;line-height:1.5}
.npc-sel option{background:#1a1626}
.npc-row{display:flex;gap:6px;align-items:center}
.npc-div{height:1px;background:#2d2050;margin:12px 0}
.npc-btn{padding:8px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .2s}
.npc-primary{background:linear-gradient(135deg,#7c5cbf,#5a3d99);color:#fff;width:100%;padding:10px;font-size:13px;letter-spacing:.5px}
.npc-primary:hover{background:linear-gradient(135deg,#9370d8,#6e4cb8);transform:translateY(-1px)}
.npc-primary:disabled{background:#2d2050;color:#6b5a8e;cursor:not-allowed;transform:none}
.npc-sm{background:#2d2050;color:#c4a8ff;font-size:11px;padding:5px 10px;white-space:nowrap}
.npc-sm:hover{background:#3a2d6e}
.npc-sm:disabled{opacity:.5;cursor:not-allowed}
.npc-danger{background:#3d1a2e;color:#ff7aaa;font-size:11px;padding:5px 10px}
.npc-danger:hover{background:#5a2040}
.npc-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.npc-tag{display:inline-flex;align-items:center;gap:4px;background:#2d2050;border-radius:6px;padding:3px 8px;font-size:11px;color:#c4a8ff}
.npc-tag button{background:none;border:none;color:#ff7aaa;cursor:pointer;padding:0;font-size:12px;line-height:1}
.npc-toggle-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.npc-toggle{position:relative;width:36px;height:20px;flex-shrink:0}
.npc-toggle input{opacity:0;width:0;height:0}
.npc-tslider{position:absolute;inset:0;background:#2d2050;border-radius:20px;cursor:pointer;transition:background .2s}
.npc-tslider::before{content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform .2s}
.npc-toggle input:checked+.npc-tslider{background:#7c5cbf}
.npc-toggle input:checked+.npc-tslider::before{transform:translateX(16px)}
.npc-tlbl{font-size:12px;color:#8b7aaa}
.npc-results{margin-top:12px;display:none}
.npc-results.show{display:block}
.npc-ri{background:#0f0b1a;border:1px solid #2d2050;border-radius:10px;padding:12px;margin-bottom:10px}
.npc-rlbl{font-size:10px;color:#7c5cbf;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:700}
.npc-rtxt{font-size:13px;color:#e0d8f0;line-height:1.6;white-space:pre-wrap;min-height:40px;outline:none;border-radius:4px;padding:2px}
.npc-rtxt:focus{background:#180f2e}
.npc-ract{display:flex;gap:6px;margin-top:8px;justify-content:flex-end;flex-wrap:wrap}
.npc-wb-sec{margin-top:10px;padding-top:10px;border-top:1px solid #2d2050;display:none}
.npc-wb-txt{background:#0a0714;border:1px solid #2d2050;border-radius:8px;padding:10px;font-size:12px;color:#c4a8ff;line-height:1.7;white-space:pre-wrap;max-height:260px;overflow-y:auto;margin-top:6px}
.npc-wb-txt::-webkit-scrollbar{width:3px}
.npc-wb-txt::-webkit-scrollbar-thumb{background:#3a2d5c;border-radius:2px}
.npc-loading{text-align:center;padding:20px;color:#7c5cbf;font-size:13px}
.npc-loading::after{content:'...';animation:ndots 1.2s infinite}
@keyframes ndots{0%,20%{content:'.'}40%,60%{content:'..'}80%,100%{content:'...'}}
.npc-err{color:#ff7aaa;font-size:12px;padding:10px;background:#2a0f1c;border-radius:8px;margin-top:8px}
.npc-api-item{background:#0f0b1a;border:1px solid #2d2050;border-radius:8px;padding:10px;margin-bottom:8px;transition:border-color .2s}
.npc-api-item.active{border-color:#7c5cbf}
.npc-api-name{font-size:13px;font-weight:600;color:#c4a8ff}
.npc-api-url{font-size:11px;color:#6b5a8e;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.npc-api-model{font-size:11px;color:#8b7aaa;margin-top:2px}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // UI 构建
  // ============================================================
  function buildUI() {
    if (document.getElementById("npc-gen-fab")) return;
    injectStyles();

    // FAB
    const fab = document.createElement("button");
    fab.id = "npc-gen-fab";
    fab.title = "故事推动";
    fab.textContent = "✦";
    document.body.appendChild(fab);

    // Panel
    const panel = document.createElement("div");
    panel.id = "npc-gen-panel";
    panel.innerHTML = `
<div class="npc-ph"><h3>✦ 故事推动</h3><button class="npc-xbtn" id="npc-x">✕</button></div>
<div class="npc-tabs">
  <button class="npc-tab active" data-tab="scene">① 纯剧情</button>
  <button class="npc-tab" data-tab="world">② 世界NPC</button>
  <button class="npc-tab" data-tab="custom">③ 自定义NPC</button>
  <button class="npc-tab" data-tab="mixed">④ 混合</button>
  <button class="npc-tab" data-tab="api">⚙ API</button>
</div>
<div class="npc-body">

  <div class="npc-pane" id="pane-scene">
    <div class="npc-sec"><div class="npc-lbl">剧情氛围（可选）</div>
      <input class="npc-inp" id="scene-mood" placeholder="温馨浪漫 / 紧张刺激 / 日常轻松…">
    </div>
    <button class="npc-btn npc-primary" id="scene-gen">生成剧情方案</button>
    <div class="npc-results" id="scene-res"></div>
  </div>

  <div class="npc-pane" id="pane-world" style="display:none">
    <div class="npc-sec"><div class="npc-lbl">已保存NPC（当前角色卡）</div>
      <div class="npc-tags" id="world-tags"></div>
      <div class="npc-row">
        <input class="npc-inp" id="world-name" placeholder="NPC名称">
        <button class="npc-btn npc-sm" id="world-add">添加</button>
      </div>
    </div>
    <div class="npc-sec"><div class="npc-lbl">NPC设定（粘贴后点保存，永久存于此角色卡）</div>
      <textarea class="npc-ta" id="world-text" placeholder="把世界书里的NPC设定粘贴到这里…"></textarea>
      <div style="margin-top:6px"><button class="npc-btn npc-sm" id="world-save">💾 保存设定</button></div>
    </div>
    <div class="npc-div"></div>
    <div class="npc-sec"><div class="npc-lbl">剧情氛围（可选）</div>
      <input class="npc-inp" id="world-mood" placeholder="剑拔弩张 / 久别重逢…">
    </div>
    <button class="npc-btn npc-primary" id="world-gen">生成NPC介入剧情</button>
    <div class="npc-results" id="world-res"></div>
  </div>

  <div class="npc-pane" id="pane-custom" style="display:none">
    <div class="npc-sec"><div class="npc-lbl">NPC特征（可选，留空随机）</div>
      <textarea class="npc-ta" id="custom-traits" style="min-height:60px" placeholder="例：20岁女性，冷淡外表热心内里，长发 / 或留空全部随机"></textarea>
    </div>
    <div class="npc-sec"><div class="npc-lbl">剧情氛围（可选）</div>
      <input class="npc-inp" id="custom-mood" placeholder="搞笑混乱 / 命中注定…">
    </div>
    <button class="npc-btn npc-primary" id="custom-gen">生成NPC + 剧情方案</button>
    <div class="npc-results" id="custom-res"></div>
  </div>

  <div class="npc-pane" id="pane-mixed" style="display:none">
    <div class="npc-toggle-row">
      <label class="npc-toggle"><input type="checkbox" id="mixed-toggle"><span class="npc-tslider"></span></label>
      <span class="npc-tlbl">启用世界书NPC（必须出现）</span>
    </div>
    <div id="mixed-world" style="display:none">
      <div class="npc-sec"><div class="npc-lbl">世界书NPC设定</div>
        <div class="npc-tags" id="mixed-tags"></div>
        <textarea class="npc-ta" id="mixed-npc-text" style="min-height:60px" placeholder="粘贴世界书NPC设定…"></textarea>
      </div>
    </div>
    <div class="npc-sec"><div class="npc-lbl">混合剧情描述（可选）</div>
      <textarea class="npc-ta" id="mixed-desc" style="min-height:60px" placeholder="希望出现神秘陌生人和已有NPC产生冲突，剧情偏悬疑…"></textarea>
    </div>
    <button class="npc-btn npc-primary" id="mixed-gen">生成混合剧情方案</button>
    <div class="npc-results" id="mixed-res"></div>
  </div>

  <div class="npc-pane" id="pane-api" style="display:none">
    <div class="npc-sec"><div class="npc-lbl">已保存的API</div><div id="api-list"></div></div>
    <div class="npc-div"></div>
    <div class="npc-sec"><div class="npc-lbl">添加 / 编辑API</div>
      <input class="npc-inp" id="api-name" placeholder="自定义名称" style="margin-bottom:6px">
      <input class="npc-inp" id="api-url"  placeholder="API地址（https://…/v1/chat/completions）" style="margin-bottom:6px">
      <input class="npc-inp" id="api-key"  type="password" placeholder="API密钥" style="margin-bottom:6px">
      <div class="npc-row" style="margin-bottom:6px">
        <select class="npc-sel" id="api-model-sel" style="flex:1"><option value="">选择模型（或手动输入）</option></select>
        <button class="npc-btn npc-sm" id="api-fetch">拉取模型</button>
      </div>
      <input class="npc-inp" id="api-model" placeholder="模型名称（如：gpt-4o）" style="margin-bottom:8px">
      <div class="npc-row">
        <button class="npc-btn npc-primary" id="api-save" style="flex:1">保存API</button>
        <button class="npc-btn npc-sm" id="api-clear">清空</button>
      </div>
    </div>
  </div>

</div>`;
    document.body.appendChild(panel);

    // ---- 事件绑定 ----
    fab.addEventListener("click", () => panel.classList.toggle("open"));
    document.getElementById("npc-x").addEventListener("click", () => panel.classList.remove("open"));

    // Tab
    panel.querySelectorAll(".npc-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        panel.querySelectorAll(".npc-tab").forEach((t) => t.classList.remove("active"));
        panel.querySelectorAll(".npc-pane").forEach((p) => (p.style.display = "none"));
        tab.classList.add("active");
        document.getElementById("pane-" + tab.dataset.tab).style.display = "block";
        if (tab.dataset.tab === "api")   renderAPIList();
        if (tab.dataset.tab === "world") renderWorldTags();
        if (tab.dataset.tab === "mixed") renderMixedTags();
      });
    });

    // ---- 结果渲染 ----
    function renderResults(cid, opts, showWB) {
      const c = document.getElementById(cid);
      c.classList.add("show");
      c.innerHTML = "";
      ["一","二","三"].forEach((lbl, i) => {
        if (!opts[i]?.trim()) return;
        const item = document.createElement("div");
        item.className = "npc-ri";
        item.innerHTML = `
          <div class="npc-rlbl">方案 ${lbl}</div>
          <div class="npc-rtxt" contenteditable="true">${opts[i].trim()}</div>
          <div class="npc-ract">
            ${showWB ? `<button class="npc-btn npc-sm wb-btn">📖 生成世界书设定</button>` : ""}
            <button class="npc-btn npc-sm send-btn">发送</button>
          </div>
          ${showWB ? `<div class="npc-wb-sec"><div class="npc-lbl" style="margin-top:4px">世界书档案</div><div class="npc-wb-txt"></div><button class="npc-btn npc-sm copy-btn" style="margin-top:6px">📋 复制设定</button></div>` : ""}
        `;
        item.querySelector(".send-btn").addEventListener("click", () => {
          sendToChat(item.querySelector(".npc-rtxt").textContent.trim());
          panel.classList.remove("open");
        });
        if (showWB) {
          const wbBtn  = item.querySelector(".wb-btn");
          const wbSec  = item.querySelector(".npc-wb-sec");
          const wbTxt  = item.querySelector(".npc-wb-txt");
          const cpBtn  = item.querySelector(".copy-btn");
          wbBtn.addEventListener("click", async () => {
            wbBtn.disabled = true; wbBtn.textContent = "生成中…";
            wbSec.style.display = "block"; wbTxt.textContent = "正在生成角色档案…";
            try {
              wbTxt.textContent = await genWB(item.querySelector(".npc-rtxt").textContent.trim());
              wbBtn.textContent = "📖 重新生成";
            } catch (e) {
              wbTxt.textContent = "生成失败：" + e.message;
              wbBtn.textContent = "📖 生成世界书设定";
            }
            wbBtn.disabled = false;
          });
          cpBtn.addEventListener("click", () => {
            const txt = wbTxt.textContent.trim();
            if (!txt) return;
            navigator.clipboard.writeText(txt)
              .then(() => showToast("已复制，可直接粘贴进世界书", "success"))
              .catch(() => {
                const ta = document.createElement("textarea");
                ta.value = txt; ta.style.cssText = "position:fixed;opacity:0";
                document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
                showToast("已复制！", "success");
              });
          });
        }
        c.appendChild(item);
      });
    }

    function setLoading(cid) {
      const c = document.getElementById(cid);
      c.classList.add("show");
      c.innerHTML = `<div class="npc-loading">生成中</div>`;
    }

    // ① 纯剧情
    document.getElementById("scene-gen").addEventListener("click", async () => {
      const btn = document.getElementById("scene-gen");
      btn.disabled = true; setLoading("scene-res");
      try { renderResults("scene-res", parseThree(await genScene(document.getElementById("scene-mood").value.trim()))); }
      catch (e) { document.getElementById("scene-res").innerHTML = `<div class="npc-err">错误：${e.message}</div>`; }
      btn.disabled = false;
    });

    // ② 世界NPC
    function renderWorldTags() {
      const npcs = loadCharNPCs();
      const wrap = document.getElementById("world-tags");
      wrap.innerHTML = "";
      npcs.forEach((n, i) => {
        const t = document.createElement("span"); t.className = "npc-tag";
        t.innerHTML = `${n.name} <button data-i="${i}">×</button>`;
        t.querySelector("button").addEventListener("click", () => { const l = loadCharNPCs(); l.splice(i,1); saveCharNPCs(l); renderWorldTags(); });
        wrap.appendChild(t);
      });
      document.getElementById("world-text").value = npcs.map((n) => n.text).filter(Boolean).join("\n\n---\n\n");
    }

    document.getElementById("world-add").addEventListener("click", () => {
      const inp = document.getElementById("world-name"); const name = inp.value.trim(); if (!name) return;
      const l = loadCharNPCs(); l.push({ name, text: "" }); saveCharNPCs(l); inp.value = ""; renderWorldTags();
    });
    document.getElementById("world-save").addEventListener("click", () => {
      const text = document.getElementById("world-text").value.trim();
      const l = loadCharNPCs();
      if (!l.length) saveCharNPCs([{ name: "NPC设定", text }]);
      else { l[l.length-1].text = text; saveCharNPCs(l); }
      showToast("已永久保存到当前角色卡", "success");
    });
    document.getElementById("world-gen").addEventListener("click", async () => {
      const npcText = document.getElementById("world-text").value.trim();
      if (!npcText) { showToast("请先粘贴世界书NPC设定", "error"); return; }
      const btn = document.getElementById("world-gen");
      btn.disabled = true; setLoading("world-res");
      try { renderResults("world-res", parseThree(await genWorld(npcText, document.getElementById("world-mood").value.trim()))); }
      catch (e) { document.getElementById("world-res").innerHTML = `<div class="npc-err">错误：${e.message}</div>`; }
      btn.disabled = false;
    });

    // ③ 自定义NPC
    document.getElementById("custom-gen").addEventListener("click", async () => {
      const btn = document.getElementById("custom-gen");
      btn.disabled = true; setLoading("custom-res");
      try { renderResults("custom-res", parseThree(await genCustom(document.getElementById("custom-traits").value.trim(), document.getElementById("custom-mood").value.trim())), true); }
      catch (e) { document.getElementById("custom-res").innerHTML = `<div class="npc-err">错误：${e.message}</div>`; }
      btn.disabled = false;
    });

    // ④ 混合
    function renderMixedTags() {
      const npcs = loadCharNPCs();
      const wrap = document.getElementById("mixed-tags"); wrap.innerHTML = "";
      npcs.forEach((n) => { const t = document.createElement("span"); t.className = "npc-tag"; t.textContent = n.name; wrap.appendChild(t); });
      const ta = document.getElementById("mixed-npc-text");
      if (!ta.value) ta.value = npcs.map((n) => n.text).filter(Boolean).join("\n\n---\n\n");
    }
    document.getElementById("mixed-toggle").addEventListener("change", (e) => {
      document.getElementById("mixed-world").style.display = e.target.checked ? "block" : "none";
      if (e.target.checked) renderMixedTags();
    });
    document.getElementById("mixed-gen").addEventListener("click", async () => {
      const useW = document.getElementById("mixed-toggle").checked;
      const npcText = document.getElementById("mixed-npc-text").value.trim();
      if (useW && !npcText) { showToast("请先填写世界书NPC设定", "error"); return; }
      const btn = document.getElementById("mixed-gen");
      btn.disabled = true; setLoading("mixed-res");
      try { renderResults("mixed-res", parseThree(await genMixed(npcText, useW, document.getElementById("mixed-desc").value.trim()))); }
      catch (e) { document.getElementById("mixed-res").innerHTML = `<div class="npc-err">错误：${e.message}</div>`; }
      btn.disabled = false;
    });

    // ⚙ API
    let editIdx = -1;
    function renderAPIList() {
      const apis = loadAPIs(); const ai = loadActive();
      const c = document.getElementById("api-list");
      if (!apis.length) { c.innerHTML = `<div style="color:#6b5a8e;font-size:12px;text-align:center;padding:10px">还没有API，在下方添加</div>`; return; }
      c.innerHTML = "";
      apis.forEach((api, i) => {
        const item = document.createElement("div"); item.className = "npc-api-item" + (i===ai?" active":"");
        item.innerHTML = `<div class="npc-api-name">${api.name}${i===ai?" ✓":""}</div><div class="npc-api-url">${api.url}</div><div class="npc-api-model">模型：${api.model||"未设置"}</div>
          <div class="npc-row" style="margin-top:8px">
            <button class="npc-btn npc-sm use-btn">使用</button>
            <button class="npc-btn npc-sm edit-btn">编辑</button>
            <button class="npc-btn npc-danger del-btn">删除</button>
          </div>`;
        item.querySelector(".use-btn").addEventListener("click",  () => { saveActive(i); renderAPIList(); showToast(`已切换到：${api.name}`,"success"); });
        item.querySelector(".edit-btn").addEventListener("click", () => { editIdx=i; document.getElementById("api-name").value=api.name; document.getElementById("api-url").value=api.url; document.getElementById("api-key").value=api.key; document.getElementById("api-model").value=api.model||""; });
        item.querySelector(".del-btn").addEventListener("click",  () => { const l=loadAPIs(); l.splice(i,1); saveAPIs(l); if(loadActive()>=l.length) saveActive(Math.max(0,l.length-1)); renderAPIList(); });
        c.appendChild(item);
      });
    }
    document.getElementById("api-fetch").addEventListener("click", async () => {
      const url=document.getElementById("api-url").value.trim(), key=document.getElementById("api-key").value.trim();
      if (!url||!key) { showToast("请先填写地址和密钥","error"); return; }
      try {
        showToast("拉取中…","info");
        const models = await fetchModels(url, key);
        const sel = document.getElementById("api-model-sel");
        sel.innerHTML = `<option value="">选择模型</option>`;
        models.forEach((m) => { const o=document.createElement("option"); o.value=o.textContent=m; sel.appendChild(o); });
        showToast(`拉取到 ${models.length} 个模型`,"success");
      } catch(e) { showToast("拉取失败："+e.message,"error"); }
    });
    document.getElementById("api-model-sel").addEventListener("change", (e) => { if(e.target.value) document.getElementById("api-model").value=e.target.value; });
    document.getElementById("api-save").addEventListener("click", () => {
      const name=document.getElementById("api-name").value.trim(), url=document.getElementById("api-url").value.trim(), key=document.getElementById("api-key").value.trim(), model=document.getElementById("api-model").value.trim();
      if (!name||!url||!key) { showToast("名称、地址、密钥不能为空","error"); return; }
      const l=loadAPIs(); const entry={name,url,key,model};
      if (editIdx>=0&&editIdx<l.length) { l[editIdx]=entry; editIdx=-1; } else { l.push(entry); saveActive(l.length-1); }
      saveAPIs(l); renderAPIList(); document.getElementById("api-clear").click(); showToast(`"${name}" 已保存`,"success");
    });
    document.getElementById("api-clear").addEventListener("click", () => {
      ["api-name","api-url","api-key","api-model"].forEach((id) => document.getElementById(id).value="");
      document.getElementById("api-model-sel").innerHTML=`<option value="">选择模型（或手动输入）</option>`; editIdx=-1;
    });
  }

  // ============================================================
  // 入口：轮询等待 body 就绪
  // ============================================================
  function waitAndInit() {
    if (document.getElementById("npc-gen-fab")) return;
    if (document.body && document.body.children.length > 0) {
      buildUI();
      return;
    }
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (document.body && document.body.children.length > 0) {
        clearInterval(t); buildUI();
      } else if (tries > 100) {
        clearInterval(t); buildUI(); // 超时强行插入
      }
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitAndInit);
  } else {
    waitAndInit();
  }
  window.addEventListener("load", () => { if (!document.getElementById("npc-gen-fab")) waitAndInit(); });
  setTimeout(() => { if (!document.getElementById("npc-gen-fab")) waitAndInit(); }, 3000);

})();
