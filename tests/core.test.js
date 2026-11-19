const assert = require("node:assert/strict");
const V = require("../core.js");
let n = 0;
function test(name, f) {
  f();
  n++;
  console.log("PASS " + name);
}
test("quoted CSV, newline, BOM, CRLF", () => {
  let x = V.parseCSV('\ufeffa,b\r\n"x,y","line1\nline2"\r\n');
  assert.equal(x.rows[0].a, "x,y");
  assert.equal(x.rows[0].b, "line1\nline2");
});
test("reject malformed CSV and duplicate headers", () => {
  assert.throws(() => V.parseCSV("a,b\n1"));
  assert.throws(() => V.parseCSV("a,a\n1,2"));
  assert.throws(() => V.parseCSV('a,b\n"unfinished,2'));
});
test("known errors and units", () => {
  let a = V.analyze(
    [
      { t: "0", r: "0", y: "1" },
      { t: "1000", r: "0", y: "-1" },
      { t: "2000", r: "0", y: "2" },
    ],
    { time: "t", target: "r", actual: "y" },
    0.001,
  );
  assert.equal(a.duration, 2);
  assert.equal(a.rmse, Math.sqrt(2));
  assert.equal(a.mae, 4 / 3);
  assert.equal(a.tailBias, 2);
});
test("blank values excluded, duplicates and ordering detected", () => {
  let a = V.analyze(
    [
      { t: 2, r: 0, y: 0 },
      { t: 1, r: 0, y: 1 },
      { t: 1, r: 0, y: 2 },
      { t: 3, r: "", y: 0 },
    ],
    { time: "t", target: "r", actual: "y" },
  );
  assert.equal(a.invalid, 1);
  assert.equal(a.duplicates, 1);
  assert.equal(a.backwards, 1);
  assert.equal(a.count, 3);
});
test("identical timestamps rejected", () =>
  assert.throws(() =>
    V.analyze(Array(3).fill({ t: 0, r: 0, y: 1 }), {
      time: "t",
      target: "r",
      actual: "y",
    }),
  ));
test("formula injection escaped on export", () => {
  assert.ok(V.toCSV(["x"], [{ x: "=1+1" }]).includes("'=1+1"));
});
test("negative numeric samples survive CSV roundtrip", () => {
  let d = V.parseCSV(
    V.toCSV(
      ["t", "r", "y"],
      [
        { t: 0, r: 0, y: -1 },
        { t: 1, r: 0, y: -2 },
        { t: 2, r: 0, y: -3 },
      ],
    ),
  );
  let a = V.analyze(d.rows, { time: "t", target: "r", actual: "y" });
  assert.equal(a.count, 3);
  assert.equal(a.mae, 2);
  assert.ok(V.toCSV(["x"], [{ x: "-1+2" }]).includes("'-1+2"));
});
test("large arrays do not exceed argument stack", () => {
  const rows = Array.from({ length: 150000 }, (_, i) => ({ t: i, r: 0, y: 1 }));
  const a = V.analyze(rows, { time: "t", target: "r", actual: "y" });
  assert.equal(a.rmse, 1);
  assert.equal(a.max, 1);
});
test("two-column logs with reordered or extra fields", () => {
  const csv = V.parseCSV("unused,temperature,time\nx,18,1\ny,19,2\nz,20,3");
  const value = V.analyze(csv.rows, { time: "time", actual: "temperature" });
  assert.equal(value.count, 3);
  assert.equal(value.points[0].actual, 18);
  assert.equal(value.points[0].target, null);
  assert.equal(value.rmse, undefined);
});
console.log(n + " checks passed");
