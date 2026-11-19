"use strict";
function demoCSV(which) {
  let rows = [];
  for (let i = 0; i <= 500; i++) {
    const t = i * 0.02,
      target = t < 1 ? 0 : 1,
      u = Math.max(0, t - 1);
    let actual =
      t < 1
        ? 0
        : 1 -
          Math.exp(-u * (which === "a" ? 1.3 : 3.5)) *
            Math.cos(u * (which === "a" ? 5 : 4));
    actual += 0.006 * Math.sin(t * 37);
    rows.push({
      time_s: t.toFixed(3),
      target_rad: target,
      actual_rad: actual.toFixed(6),
    });
  }
  return Vento.toCSV(["time_s", "target_rad", "actual_rad"], rows);
}
