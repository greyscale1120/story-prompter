// ==UserScript==
// @name         故事推动 NPC 生成器
// @version      1.1.5
// @description  模仿 sillytavernDIARY 挂载逻辑的完美版
// @author       Imola
// ==/UserScript==

// 使用酒馆自带的 jQuery 确保 100% 页面加载后执行
$(document).ready(function () {
    
    // 1. 防重复加载
    if (window.__npcGenLoaded) return;
    window.__npcGenLoaded = true;

    // ============================================================
    // 存储与基础逻辑
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
            return $(".ch_name, #char_name_display").text()?.trim() || "default";
        } catch { return "default"; }
    }

    const saveAPIs      = (v) => save(API_KEY, v);
    const loadAPIs      = ()  => load(API_KEY, []);
    const saveActive    = (v) => save(ACTIVE_KEY, v);
    const loadActive    = ()  => load(ACTIVE_KEY, 0);

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

    // 提示词
    const SYS_SCENE = `你是专业互动小说写手。根据对话上下文生成3个不同走向的剧情续写，只涉及现有主角和角色，不引入新NPC。格式：【方案一】内容 【方案二】内容 【方案三】内容，每个100-200字。`;

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
    // UI 与日记同款挂载逻辑
    // ============================================================
    function initUI() {
        if ($("#npc-gen-fab").length > 0) return;

        // 1. 注入 CSS 样式
        const style = `
            <style id="npc-gen-style">
                #npc-gen-fab {
                    position: fixed !important;
                    bottom: 95px !important; /* 调整高度避免和其它图标打架 */
                    right: 20px !important;
                    width: 45px !important;
                    height: 45px !important;
                    border-radius: 50% !important;
                    background: linear-gradient(135deg, #7c5cbf, #4a3580) !important;
                    color: white !important;
                    z-index: 999999 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    font-size: 20px !important;
                    border: none !important;
                    box-shadow: 0 4px 15px rgba(124, 92, 191, 0.4) !important;
                }
                #npc-gen-panel {
                    position: fixed; bottom: 155px; right: 20px;
                    width: 360px; max-height: 75vh;
                    background: #1a1626; border: 1px solid #3a2d5c;
                    border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);
                    z-index: 999998; display: none; flex-direction: column;
                    overflow: hidden; color: #e0d8f0; font-family: sans-serif;
                }
                #npc-gen-panel.open { display: flex; }
                .npc-ph { background: linear-gradient(135deg,#2d1f4e,#1a1626); padding: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #3a2d5c; }
                .npc-tabs { display: flex; background: #120e1f; border-bottom: 1px solid #2d2050; }
                .npc-tab { flex: 1; padding: 8px; background: none; border: none; color: #6b5a8e; cursor: pointer; font-size: 11px; }
                .npc-tab.active { color: #c4a8ff; border-bottom: 2px solid #7c5cbf; }
                .npc-body { padding: 12px; overflow-y: auto; flex: 1; }
                .npc-primary { background: linear-gradient(135deg,#7c5cbf,#5a3d99); color: #fff; width: 100%; padding: 8px; border-radius: 6px; border: none; cursor: pointer; margin-top: 8px; }
                .npc-ri { background: #0f0b1a; border: 1px solid #2d2050; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
                .npc-rtxt { font-size: 12px; line-height: 1.5; margin-top: 4px; white-space: pre-wrap; }
                .npc-inp, .npc-ta { width: 100%; background: #0f0b1a; border: 1px solid #2d2050; border-radius: 6px; color: #fff; padding: 6px; box-sizing: border-box; margin-bottom: 8px; }
            </style>
        `;
        $('head').append(style);

        // 2. 注入悬浮按钮和面板到 body 里（模仿日记插件防遮挡逻辑）
        const fab = $('<button id="npc-gen-fab">✦</button>');
        const panel = $(`
            <div id="npc-gen-panel">
                <div class="npc-ph"><span>✦ 故事推动</span><button id="npc-x" style="background:none;border:none;color:#fff;cursor:pointer">✕</button></div>
                <div class="npc-tabs">
                    <button class="npc-tab active" data-tab="scene">纯剧情</button>
                    <button class="npc-tab" data-tab="api">⚙ API</button>
                </div>
                <div class="npc-body">
                    <div id="pane-scene">
                        <input class="npc-inp" id="scene-mood" placeholder="剧情氛围...">
                        <button class="npc-primary" id="scene-gen">生成剧情方案</button>
                        <div id="scene-res" style="margin-top:10px"></div>
                    </div>
                    <div id="pane-api" style="display:none">
                        <input class="npc-inp" id="api-name" placeholder="名称">
                        <input class="npc-inp" id="api-url" placeholder="URL">
                        <input class="npc-inp" id="api-key" type="password" placeholder="Key">
                        <input class="npc-inp" id="api-model" placeholder="Model">
                        <button class="npc-primary" id="api-save">保存API</button>
                    </div>
                </div>
            </div>
        `);

        $('body').append(fab).append(panel);

        // 3. 事件绑定
        fab.on('click', function () {
            panel.toggleClass('open');
        });

        $('#npc-x').on('click', function () {
            panel.removeClass('open');
        });

        $('#scene-gen').on('click', async function () {
            const resDiv = $("#scene-res");
            resDiv.html("生成中...");
            try {
                const raw = await callAPI(SYS_SCENE, `上下文：\n${getChatCtx()}\n要求：${$("#scene-mood").val()}`);
                const opts = parseThree(raw);
                resDiv.html(opts.map(opt => `<div class="npc-ri"><div class="npc-rtxt">${opt}</div></div>`).join(""));
            } catch (e) {
                resDiv.html("失败：" + e.message);
            }
        });

        $('#api-save').on('click', function () {
            const entry = {
                name: $("#api-name").val(),
                url: $("#api-url").val(),
                key: $("#api-key").val(),
                model: $("#api-model").val()
            };
            saveAPIs([entry]);
            saveActive(0);
            alert("API已保存！");
        });

        $('.npc-tab').on('click', function () {
            $('.npc-tab').removeClass('active');
            $(this).add('active');
            const isApi = $(this).data('tab') === 'api';
            $("#pane-scene").toggle(!isApi);
            $("#pane-api").toggle(isApi);
        });

        console.log("故事推动 NPC 生成器挂载成功！");
    }

    // 4. 执行初始化
    initUI();
});
