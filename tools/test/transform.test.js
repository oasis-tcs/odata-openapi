const assert = require("assert");
const exec = require("child_process").exec;
const fs = require("fs");
const path = require("path");

describe("CLI", function () {
  this.timeout(20000);

  const annoV2 = fs.readFileSync("tests/annotations-v2.openapi3.json", "utf8");
  const tripPin = fs.readFileSync("tests/TripPin.openapi3.json", "utf8");

  it("help", async () => {
    const result = await cmd(["-h"]);
    assert.equal(result.code, 0);
    assert.match(
      result.stdout,
      /Usage: odata-openapi <options> <source files>/
    );
  });

  it("invalid option", async () => {
    const result = await cmd(["-x"]);
    // assert.equal(result.code, 1);
    assert.equal(result.stderr, "Unknown option: -x\n");
  });

  it("annotations-v2", async () => {
    const target = "tests/annotations-v2.openapi.json";
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await cmd([
      "-d",
      "--scheme https",
      "tests/annotations-v2.xml",
    ]);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(target), true);
    const actual = JSON.parse(fs.readFileSync(target, "utf8"));
    const expected = JSON.parse(annoV2);
    assert.deepStrictEqual(actual, expected, "produced OpenAPI");
    fs.unlinkSync(target);
  });

  it("TripPin", async () => {
    const target = "tests/TripPin.openapi.json";
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await cmd(["-dp", "--scheme https", "tests/TripPin.xml"]);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(target), true);
    const actual = fs.readFileSync(target, "utf8").split("\n");
    actual.push("");
    assert.deepStrictEqual(actual, tripPin.split("\r\n"), "produced OpenAPI");
    fs.unlinkSync(target);
  });
});

function cmd(args, cwd) {
  return new Promise((resolve) => {
    exec(
      `node ${path.resolve("./transform.js")} ${args.join(" ")}`,
      { cwd },
      (error, stdout, stderr) => {
        resolve({
          code: error && error.code ? error.code : 0,
          error,
          stdout,
          stderr,
        });
      }
    );
  });
}
