window.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const fab = document.createElement("button");
        fab.id = "npc-gen-fab";
        fab.style.cssText = "position:fixed!important;bottom:120px!important;right:16px!important;width:50px!important;height:50px!important;background:red!important;z-index:2147483647!important;border-radius:50%!important;color:white!important;font-size:20px!important;border:none!important;cursor:pointer!important;";
        fab.innerHTML = "✦";
        document.body.appendChild(fab);
    }, 5000);
});
