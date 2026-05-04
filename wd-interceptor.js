;"use strict";
console.log("[WD] 攔截器腳本已載入");
(function() {
  if (window.__web3DefenseInjected) return;
  window.__web3DefenseInjected = true;
  var DISPATCH_REQUEST = "WEB3_DEFENSE_DISPATCH_REQUEST";
  var DISPATCH_RESPONSE = "WEB3_DEFENSE_DISPATCH_RESPONSE";
  var requestIdCounter = 0;
  function generateRequestId() { requestIdCounter++; return "wd_" + Date.now() + "_" + requestIdCounter; }
  function getChainId() { try { var p = window.ethereum; if (p && p.chainId) { var r = p.chainId; return typeof r === "number" ? "0x" + r.toString(16) : String(r); } } catch (e) {} return "0x1"; }
  function injectProxy() {
    var provider = window.ethereum;
    if (!provider || provider.isWeb3Defense) return;
    var methods = ["eth_sendTransaction","eth_sign","personal_sign","eth_signTypedData","eth_signTypedData_v1","eth_signTypedData_v3","eth_signTypedData_v4","wallet_sendCalls"];
    var original = provider.request.bind(provider);
    provider.request = function(args) {
      var method = args && args.method;
      if (!method || methods.indexOf(method) === -1) return original(args);
      var intercepted = { id: generateRequestId(), method: method, params: args && args.params ? args.params : [{}], chainId: getChainId(), hostname: window.location.hostname, timestamp: Date.now() };
      return new Promise(function(resolve, reject) {
        var done = false;
        var to = setTimeout(function() { if (!done) { done = true; resolve(original(args)); } }, 30000 + Math.random() * 5000);
        function onR(e) {
          if (done) return; var r = e.detail;
          if (!r || r.requestId !== intercepted.id) return;
          if (r.decision.action === "PENDING") return;
          clearTimeout(to); done = true; document.removeEventListener(DISPATCH_RESPONSE, onR);
          if (r.decision.action === "BLOCK") { var err = new Error("\u26a0\ufe0f Web3 Defense \u5df2\u62e6\u622a\u6b64\u4ea4\u6613\uff0c\u98a8\u96aa\u5206\u6578\uff1a" + (r.decision.assessment ? r.decision.assessment.riskScore : "?") + "/100\n\u8acb\u5728\u5f48\u7a97\u4e2d\u67e5\u770b\u8a73\u7d30\u98a8\u96aa\u5831\u544a"); err.name = "Web3DefenseBlocked"; reject(err); }
          else resolve(original(args));
        }
        document.addEventListener(DISPATCH_RESPONSE, onR);
        document.dispatchEvent(new CustomEvent(DISPATCH_REQUEST, { detail: intercepted }));
      });
    };
    Object.defineProperty(provider, "isWeb3Defense", { value: true });
    console.log("[WD] \u62e6\u622a\u5668\u5df2\u5305\u88dd ethereum");
  }
  function tryInject() {
    if (window.ethereum) { injectProxy(); return; }
    window.addEventListener("ethereum#initialized", function() { injectProxy(); });
    var a = 0, iv = setInterval(function() { a++; if (window.ethereum) { injectProxy(); clearInterval(iv); } else if (a > 50) clearInterval(iv); }, 100);
  }
  tryInject();
})();
