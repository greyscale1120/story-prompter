setTimeout(function() {
    var fab = document.createElement("button");
    fab.style.cssText = "position:fixed!important;bottom:120px!important;right:16px!important;width:50px!important;height:50px!important;background:red!important;z-index:2147483647!important;border-radius:50%!important;color:white!important;font-size:20px!important;border:none!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;";
    fab.innerHTML = "✦";
    document.body.appendChild(fab);
    fab.onclick = function() { alert("在！"); };
}, 8000);
