setTimeout(function() {
    alert("5秒到了");
    var fab = document.createElement("div");
    fab.setAttribute("style", "position:fixed!important;bottom:120px!important;right:16px!important;width:50px!important;height:50px!important;background:red!important;z-index:2147483647!important;border-radius:50%!important;color:white!important;font-size:20px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;");
    fab.textContent = "✦";
    document.body.appendChild(fab);
    alert("插入完成，右下角找红球");
}, 5000);
