"use strict";

const byId = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const fmt = (value) =>
  Number.isFinite(value) ? String(Number(value.toPrecision(5))) : "—";
const slots = ["a", "b"];
const logs = { a: null, b: null };
const versions = { a: 0, b: 0 };
const pending = new Set();

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function invalidate() {
  byId("results").hidden = true;
  byId("summary").replaceChildren();
  byId("note").value = "";
}

function selectField(slot, key, label, choices, selected) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const select = document.createElement("select");
  select.id = slot + "-" + key;
  for (const [value, text] of choices) select.add(new Option(text, value));
  select.value = selected;
  select.addEventListener("change", invalidate);
  wrapper.append(select);
  return wrapper;
}

function setLog(slot, data) {
  logs[slot] = data;
  const area = byId("map-" + slot);
  area.replaceChildren();
  byId("name-" + slot).textContent = data
    ? data.name + " · " + data.rows.length + " 行"
    : "尚未导入";
  byId("clear-b").hidden = !logs.b;
  invalidate();
  if (!data) return;
  const headers = data.headers;
  const choices = headers.map((h) => [h, h]);
  const time =
    headers.find((h) => /^(?:time|timestamp|t)(?:$|[_ (])|时间/i.test(h)) ||
    headers[0];
  const target =
    headers.find(
      (h) => h !== time && /target|setpoint|reference|目标/i.test(h),
    ) || "";
  const available = headers.filter((h) => h !== time && h !== target);
  const actual =
    available.find((h) => /actual|measured|response|实测/i.test(h)) ||
    available[0] ||
    "";
  area.append(
    selectField(slot, "time", "时间列", choices, time),
    selectField(
      slot,
      "scale",
      "时间单位",
      [
        ["1", "秒"],
        ["0.001", "毫秒"],
        ["0.000001", "微秒"],
      ],
      "1",
    ),
    selectField(slot, "actual", "实测列", choices, actual),
    selectField(
      slot,
      "target",
      "目标列（可选）",
      [["", "无目标列"], ...choices],
      target,
    ),
  );
}

for (const slot of slots) {
  byId("file-" + slot).addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const version = ++versions[slot];
    event.target.value = "";
    pending.add(slot);
    setLog(slot, null);
    byId("analyze").disabled = true;
    byId("error").textContent = "";
    try {
      if (file.size > 10 * 1024 * 1024) throw Error("每份文件上限为 10 MiB。");
      const data = Vento.parseCSV(await file.text());
      if (versions[slot] !== version) return;
      if (data.headers.length < 2) throw Error("需要时间列和实测列。");
      const other = slot === "a" ? "b" : "a";
      if (logs[other]?.demo) setLog(other, null);
      if (byId("unit").dataset.demo) {
        byId("unit").value = "";
        delete byId("unit").dataset.demo;
      }
      setLog(slot, { ...data, name: file.name });
    } catch (error) {
      if (versions[slot] === version)
        byId("error").textContent = file.name + "：" + error.message;
    } finally {
      if (versions[slot] === version) pending.delete(slot);
      byId("analyze").disabled = pending.size > 0;
    }
  });
}

function makeSummary(results) {
  const { a, b } = results;
  const columns = Object.entries(results);
  const metrics = [
    ["count", "有效行"],
    ["invalid", "无效行"],
    ["duplicates", "重复时间戳"],
    ["backwards", "原始顺序中的逆序跳变"],
    ["gaps", "大间隔（超过正间隔中位数的 3 倍）"],
    ["duration", "时长 / s"],
    ["medianDt", "正时间间隔中位数 / s"],
  ];
  if (columns.some(([, r]) => r.rmse !== undefined))
    metrics.push(
      ["rmse", "RMSE"],
      ["mae", "MAE"],
      ["p95", "绝对误差 P95"],
      ["max", "最大绝对误差"],
      ["tailBias", "尾段平均偏差"],
    );
  const legend = columns
    .map(([s, r]) => {
      const actual = s === "a" ? "紫色实线" : "蓝色实线";
      const target = s === "a" ? "灰色虚线" : "橙色虚线";
      return (
        s.toUpperCase() +
        " 实测为" +
        actual +
        (r.rmse !== undefined ? "，目标为" + target : "")
      );
    })
    .join("；");
  const mapping = columns
    .map(
      ([s]) =>
        "<p><b>实验 " +
        s.toUpperCase() +
        "</b> · " +
        esc(logs[s].name) +
        " · 时间：" +
        esc(byId(s + "-time").value) +
        "（" +
        esc(byId(s + "-scale").selectedOptions[0].text) +
        "）" +
        " · 实测：" +
        esc(byId(s + "-actual").value) +
        " · 目标：" +
        esc(byId(s + "-target").value || "无") +
        "</p>",
    )
    .join("");
  return (
    mapping +
    "<p>信号单位：" +
    esc(byId("unit").value.trim() || "未注明") +
    "</p>" +
    makeChart(a, b) +
    "<p>" +
    legend +
    "。各曲线以本次实验最早有效时间为零点。</p>" +
    '<div class="table-wrap"><table><thead><tr><th>指标</th>' +
    columns.map(([s]) => "<th>实验 " + s.toUpperCase() + "</th>").join("") +
    "</tr></thead><tbody>" +
    metrics
      .map(
        ([key, label]) =>
          "<tr><th>" +
          label +
          "</th>" +
          columns.map(([, r]) => "<td>" + fmt(r[key]) + "</td>").join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div><p>误差为实测减目标，按有效样本等权计算；尾段取按时间排序的最后 10%。大间隔仅作标记。曲线可能抽样，指标使用全部有效行。</p>"
  );
}

function analyze() {
  invalidate();
  try {
    if (!logs.a) throw Error("请先导入实验 A 或载入示例。");
    const results = {};
    for (const s of slots) {
      if (!logs[s]) continue;
      results[s] = Vento.analyze(
        logs[s].rows,
        {
          time: byId(s + "-time").value,
          actual: byId(s + "-actual").value,
          target: byId(s + "-target").value,
        },
        Number(byId(s + "-scale").value),
      );
    }
    byId("summary").innerHTML = makeSummary(results);
    byId("results").hidden = false;
    byId("error").textContent = "";
  } catch (error) {
    byId("error").textContent = error.message;
  }
}

byId("analyze").onclick = analyze;
byId("demo").onclick = () => {
  for (const s of slots) {
    versions[s]++;
    setLog(s, {
      ...Vento.parseCSV(demoCSV(s)),
      name: "合成示例 " + s.toUpperCase(),
      demo: true,
    });
  }
  pending.clear();
  byId("analyze").disabled = false;
  byId("unit").value = "rad";
  byId("unit").dataset.demo = "true";
  analyze();
};
byId("clear-b").onclick = () => setLog("b", null);
byId("unit").oninput = () => {
  delete byId("unit").dataset.demo;
  invalidate();
};
byId("sample").onclick = () =>
  download("synthetic-baseline.csv", demoCSV("a"), "text/csv;charset=utf-8");
byId("export").onclick = () => {
  if (byId("results").hidden) return;
  const title = esc(byId("title").value.trim() || "实验日志对比");
  const note = esc(byId("note").value.trim());
  const report =
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    title +
    "</title><style>body{font:16px/1.65 system-ui;max-width:1000px;margin:auto;padding:1rem;color:#172840}svg{width:100%}th,td{padding:.4rem;text-align:left;border-bottom:1px solid #ddd}p{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>" +
    title +
    "</h1>" +
    byId("summary").innerHTML +
    (note ? "<h2>人工复核说明</h2><p>" + note + "</p>" : "") +
    "</html>";
  download("experiment-report.html", report, "text/html;charset=utf-8");
};
