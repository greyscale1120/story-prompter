setTimeout(function() {
    var fab = document.createElement("div");
    fab.setAttribute("style", "position:fixed!important;bottom:120px!important;right:16px!important;width:50px!important;height:50px!important;background:red!important;z-index:2147483647!important;border-radius:50%!important;color:white!important;font-size:20px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important;opacity:1!important;");
    fab.textContent = "https://i.postimg.cc/J4gfJCzt/2026042603074339.png";
    document.body.appendChild(fab);
    alert("div插入完成");
}, 8000);
