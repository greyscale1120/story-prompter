// ==UserScript==
// @name         故事推动 NPC 生成器
// @version      1.2.2
// @description  纯净调试版：1.5秒强行注入红按钮
// @author       Imola
// ==/UserScript==

(function() {
    "use strict";

    // UI 注入逻辑
    function initUI() {
        // 避免重复注入
        if (document.getElementById("npc-gen-fab")) return;

        // 注入红色调试版 CSS 样式（强行置顶 + 避开手机底部工具栏）
        const style = document.createElement("style");
        style.id = "npc-gen-style";
        style.innerHTML = `
            #npc-gen-fab {
                position: fixed !important;
                bottom: 120px !important;  
                right: 16px !important;
                width: 50px !important;
                height: 50px !important;
                background: red !important;  
                z-index: 2147483647 !important;  
                border-radius: 50% !important;
                color: white !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                font-size: 20px !important;
                border: none !important;
                box-shadow: 0 4px 15px rgba(255, 0, 0, 0.4) !important;
            }
        `;
        document.head.appendChild(style);

        // 创建红按钮
        const fab = document.createElement("button");
        fab.id = "npc-gen-fab";
        fab.innerHTML = "✦";
        document.body.appendChild(fab);

        // 点击红按钮直接弹窗，证明它活着
        fab.onclick = () => {
            alert("哈基米启动成功！主人我在这儿呢！");
        };

        console.log("故事推动红按钮注入成功！");
    }

    // 抛弃所有不确定的事件，直接用 1.5 秒延时强行兜底注入
    setTimeout(initUI, 1500);

})();
