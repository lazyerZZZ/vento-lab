"use strict";
function makeChart(a, b) {
  const all = [...a.points, ...(b?.points ?? [])];
  let lo = Infinity,
    hi = -Infinity;
  for (const p of all) {
    lo = Math.min(lo, p.actual, p.target ?? p.actual);
    hi = Math.max(hi, p.actual, p.target ?? p.actual);
  }
  let span = hi - lo || 1;
  lo -= span * 0.12;
  hi += span * 0.12;
  const W = 1000,
    H = 350,
    L = 62,
    R = 20,
    T = 20,
    B = 45,
    xmax = Math.max(a.duration, b?.duration ?? 0) || 1;
  const x = (t) => L + (t / xmax) * (W - L - R),
    y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  let svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    W +
    " " +
    H +
    '" role="img" aria-label="实验目标和实测曲线">';
  for (let i = 0; i <= 4; i++) {
    let v = lo + ((hi - lo) * i) / 4,
      yy = y(v),
      xx = x((xmax * i) / 4);
    svg +=
      '<path d="M' +
      L +
      " " +
      yy +
      "H" +
      (W - R) +
      '" stroke="#e5ebf3"/><text x="' +
      (L - 8) +
      '" y="' +
      (yy + 4) +
      '" text-anchor="end" font-size="12" fill="#5c6b7e">' +
      esc(fmt(v)) +
      '</text><text x="' +
      xx +
      '" y="' +
      (H - 20) +
      '" text-anchor="middle" font-size="12" fill="#5c6b7e">' +
      esc(fmt((xmax * i) / 4)) +
      "</text>";
  }
  function path(d, key, color, dash) {
    if (d.points[0][key] === null) return "";
    let pts = [],
      step = Math.max(1, Math.ceil(d.points.length / 1500));
    for (let i = 0; i < d.points.length; i += step) pts.push(d.points[i]);
    if (pts.at(-1) !== d.points.at(-1)) pts.push(d.points.at(-1));
    return (
      '<path d="' +
      pts
        .map(
          (p, i) =>
            (i ? "L" : "M") +
            x(p.t - d.points[0].t).toFixed(2) +
            " " +
            y(p[key]).toFixed(2),
        )
        .join(" ") +
      '" stroke="' +
      color +
      '" fill="none" stroke-width="2" ' +
      (dash ? 'stroke-dasharray="5 5"' : "") +
      "/>"
    );
  }
  svg +=
    path(a, "target", "#35445b", true) + path(a, "actual", "#9670cf", false);
  if (b)
    svg +=
      path(b, "target", "#b96521", true) + path(b, "actual", "#2865ef", false);
  return (
    svg +
    '<text x="500" y="347" text-anchor="middle" fill="#5c6b7e" font-size="12">相对时间 / s</text></svg>'
  );
}
