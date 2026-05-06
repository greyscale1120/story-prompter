setTimeout(function() {
    var fab = document.createElement("button");
    fab.setAttribute("style", "position:fixed!important;bottom:120px!important;right:16px!important;width:50px!important;height:50px!important;background:red!important;z-index:2147483647!important;border-radius:50%!important;color:white!important;font-size:20px!important;border:none!important;cursor:pointer!important;display:block!important;visibility:visible!important;opacity:1!important;");
    fab.textContent = "✦";
    document.body.appendChild(fab);
    alert("插入完成");
}, 8000);
