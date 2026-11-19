(function (root) {
  "use strict";
  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, "");
    if (text.length > 10 * 1024 * 1024)
      throw Error("文件超过 10 MB，请先截取实验区间。");
    let rows = [],
      row = [],
      field = "",
      quoted = false,
      closed = false;
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            quoted = false;
            closed = true;
          }
        } else field += c;
      } else if (c === '"') {
        if (field || closed) throw Error("CSV 引号位置不正确。");
        quoted = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
        closed = false;
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        field = "";
        closed = false;
      } else {
        if (closed && c.trim()) throw Error("CSV 引号后存在非法字符。");
        if (!closed) field += c;
      }
    }
    if (quoted) throw Error("CSV 引号没有闭合。");
    row.push(field);
    if (row.some((x) => x.trim())) rows.push(row);
    if (rows.length < 2) throw Error("需要表头和至少一行数据。");
    const headers = rows.shift().map((x) => x.trim());
    if (headers.some((x) => !x) || new Set(headers).size !== headers.length)
      throw Error("表头不能为空或重复。");
    let objects = rows.map((r, i) => {
      if (r.length !== headers.length)
        throw Error("第 " + (i + 2) + " 行列数与表头不一致。");
      return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
    });
    return { headers, rows: objects };
  }
  function csvCell(v) {
    let s = String(v ?? "");
    const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(
      s.trim(),
    );
    if (/^\s*[=+@-]/.test(s) && !numeric) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCSV(headers, rows) {
    return (
      "\uFEFF" +
      [
        headers.map(csvCell).join(","),
        ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
      ].join("\r\n")
    );
  }
  function number(v) {
    const s = String(v ?? "").trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  function quantile(a, p) {
    let b = [...a].sort((x, y) => x - y),
      i = (b.length - 1) * p,
      j = Math.floor(i);
    return b[j] + (b[Math.ceil(i)] - b[j]) * (i - j);
  }
  function analyze(rows, map, scale = 1) {
    const keys = [map.time, map.actual, ...(map.target ? [map.target] : [])];
    if (!map.time || !map.actual || new Set(keys).size !== keys.length)
      throw Error("时间、目标和实测列必须不同。");
    if (![1, 0.001, 0.000001].includes(scale)) throw Error("时间单位不支持。");
    let points = [],
      invalid = 0,
      backwards = 0,
      duplicates = 0,
      last = null;
    let seen = new Set();
    for (const r of rows) {
      let t = number(r[map.time]) * scale,
        target = map.target ? number(r[map.target]) : null,
        actual = number(r[map.actual]);
      if (
        !Number.isFinite(t) ||
        !Number.isFinite(actual) ||
        (map.target && !Number.isFinite(target))
      ) {
        invalid++;
        continue;
      }
      if (last !== null && t < last) backwards++;
      if (seen.has(t)) duplicates++;
      seen.add(t);
      last = t;
      points.push({
        t,
        target,
        actual,
        error: map.target ? actual - target : null,
      });
    }
    if (points.length < 3) throw Error("至少需要 3 行有效的时间和信号数据。");
    points.sort((a, b) => a.t - b.t);
    let dt = [];
    for (let i = 1; i < points.length; i++) {
      let d = points[i].t - points[i - 1].t;
      if (d > 0) dt.push(d);
    }
    if (!dt.length) throw Error("时间戳全部相同，无法分析。");
    let med = quantile(dt, 0.5);
    const result = {
      points,
      count: points.length,
      total: rows.length,
      invalid,
      duplicates,
      backwards,
      medianDt: med,
      gaps: dt.filter((x) => x > med * 3).length,
      duration: points.at(-1).t - points[0].t,
    };
    if (!map.target) return result;
    const abs = points.map((p) => Math.abs(p.error)),
      tail = points.slice(-Math.ceil(points.length * 0.1));
    return {
      ...result,
      rmse: Math.sqrt(
        points.reduce((s, p) => s + p.error * p.error, 0) / points.length,
      ),
      mae: abs.reduce((s, x) => s + x, 0) / abs.length,
      p95: quantile(abs, 0.95),
      max: abs.reduce((m, x) => Math.max(m, x), 0),
      tailBias: tail.reduce((s, p) => s + p.error, 0) / tail.length,
    };
  }
  const api = { parseCSV, toCSV, analyze };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Vento = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
