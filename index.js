setTimeout(function() {
    var fab = document.createElement("button");
    fab.style.cssText = "position:fixed!important;bottom:120px!important;right:16px!important;width:50px!important;height:50px!important;background:red!important;z-index:2147483647!important;border-radius:50%!important;color:white!important;font-size:20px!important;border:none!important;cursor:pointer!important;";
    fab.innerHTML = "✦";
    document.body.appendChild(fab);
    alert("插入了，现在有" + document.body.children.length + "个元素");
}, 8000);
