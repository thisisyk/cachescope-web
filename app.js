const $ = id => document.getElementById(id);
let lang = "zh", worker, ready = false, busy = false, seq = 0, pending = null, result = null, snapshot = "";
const say = (zh, en) => { $("status").textContent = lang === "zh" ? zh : en; };
function translate() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-zh]").forEach(el => { el.textContent = el.dataset[lang]; });
}
function buttons() {
  $("preview").disabled = !ready || busy || !$("input").value.trim();
  $("copy").disabled = busy || !result || (result.changed && !$("review").checked);
  $("review").disabled = !result || busy;
  $("export").disabled = !result;
}
function invalidate() {
  result = null; $("candidate").value = ""; $("review").checked = false;
  for (const id of ["before","after","reduction"]) $(id).textContent = "—";
  $("strategy").textContent = ""; buttons();
}
function request(action, values = {}) {
  busy = true; const id = ++seq; pending = { id, action, text: $("input").value };
  buttons(); worker.postMessage({ id, action, ...values });
}
$("language").onchange = () => { lang = $("language").value; translate(); };
$("agree").onchange = () => { $("initialize").disabled = !$("agree").checked; };
$("initialize").onclick = () => {
  if (!$("agree").checked || worker) return;
  $("initialize").disabled = true;
  worker = new Worker("./worker.mjs", { type: "module" });
  worker.onerror = () => { say("引擎加载失败，请刷新重试。", "Engine failed to load. Refresh to retry."); busy = false; buttons(); };
  worker.onmessage = async ({ data }) => {
    if (!pending || data.id !== pending.id) return;
    const action = pending.action, input = pending.text; pending = null; busy = false;
    if (data.error) { say("处理失败：" + data.error, "Failed: " + data.error); buttons(); return; }
    if (data.ready) {
      ready = true; $("consent").hidden = true;
      say("本地引擎已就绪。", "Local engine ready."); buttons(); return;
    }
    if (input !== $("input").value) { invalidate(); say("输入已变化，请重新检测。", "Input changed. Preview again."); return; }
    if (action === "preview") {
      result = data.result; snapshot = input; $("candidate").value = result.candidate;
      $("before").textContent = result.local_before ?? "—"; $("after").textContent = result.local_after ?? "—";
      $("reduction").textContent = result.local_reduction == null ? "—" : (100*result.local_reduction).toFixed(1)+"%";
      $("strategy").textContent = result.strategy;
      say(result.changed ? "请核对候选后复制。" : "未找到适用的更短候选，保留原文。",
          result.changed ? "Review the candidate before copying." : "No applicable shorter candidate; original retained.");
    } else if (action === "confirm") {
      if (!["confirmed","original_retained"].includes(data.result.status)) {
        invalidate(); say("确认已过期，请重新检测。", "Preview expired. Check again."); return;
      }
      try { await navigator.clipboard.writeText(data.result.text); say("已复制。", "Copied."); }
      catch { $("candidate").focus(); $("candidate").select(); say("请按 Ctrl+C 复制已选中的内容。", "Press Ctrl+C to copy the selected text."); }
    }
    buttons();
  };
  say("首次加载运行时中，请稍候…", "Loading the runtime for first use…"); request("init");
};
$("input").oninput = invalidate;
$("review").onchange = buttons;
$("preview").onclick = () => { invalidate(); request("preview", { text: $("input").value }); say("本地检查中…", "Checking locally…"); };
$("copy").onclick = () => {
  if (!result || snapshot !== $("input").value) return;
  request("confirm", { text: snapshot, approved: !result.changed || $("review").checked });
};
$("example").onclick = () => {
  $("input").value = (lang === "zh" ? "读取以下数据并返回 amount。\n" : "Read this data and return amount.\n") +
    "```json\n{\n    \"amount\": 123,\n    \"active\": false,\n    \"description\": \"Example record\"\n}\n```";
  invalidate();
};
$("export").onclick = () => {
  if (!result) return;
  const {candidate, ...metrics} = result;
  const report = {...metrics, platform_declared: $("platform").value, measurement: "local_cl100k_estimate", subscription_savings_verified: false};
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)], {type:"application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = "cachescope-result.json"; a.click(); URL.revokeObjectURL(url);
};
function tab(team) {
  $("team").hidden = !team; $("personal").hidden = team; $("consent").hidden = team || ready;
  $("teamTab").classList.toggle("selected",team); $("personalTab").classList.toggle("selected",!team);
}
$("teamTab").onclick = () => tab(true); $("personalTab").onclick = () => tab(false);
translate(); buttons();
