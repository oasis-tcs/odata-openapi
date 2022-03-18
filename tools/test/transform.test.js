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
    assert.equal(result.code, 1);
    assert.match(
      result.stdout,
      /Usage: odata-openapi <options> <source files>/
    );
  });

  it("invalid option", async () => {
    const result = await cmd(["-x"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Unknown option: -x\n");
  });

  it("non-existing file", async () => {
    const result = await cmd(["x"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not found: x\n");
  });

  it("file not XML", async () => {
    const result = await cmd(["test.cmd"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not XML: test.cmd\n");
  });

  it("file not OData", async () => {
    const result = await cmd(["OData-Version.xsl"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not OData: OData-Version.xsl\n");
  });

  it("annotations-v2", async () => {
    const target = "tests/annotations-v2.openapi.json";
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await cmd([
      "-d",
      "--scheme https",
      "--verbose",
      "tests/annotations-v2.xml",
    ]);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.deepStrictEqual(result.stdout.split("\n"), [
      "Checking OData version used in source file: tests/annotations-v2.xml",
      "Source file is OData version: 2.0",
      "Transforming tests/annotations-v2.xml to OData V4, target file: tests/annotations-v2.tmp",
      "Transforming tests/annotations-v2.tmp to OpenAPI 3.0.0, target file: tests/annotations-v2.openapi.json",
      "Removing intermediate file: tests/annotations-v2.tmp",
      "Done.",
      "",
    ]);
    assert.equal(fs.existsSync(target), true);
    const actual = JSON.parse(fs.readFileSync(target, "utf8"));
    const expected = JSON.parse(annoV2);
    assert.deepStrictEqual(actual, expected, "produced OpenAPI");
    fs.unlinkSync(target);
  });

  it("TripPin", async () => {
    const target = "tests/TripPin.openapi.json";
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await cmd(["-dpu", "--scheme https", "tests/TripPin.xml"]);

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
