const assert = require("node:assert");
const { exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

describe("CLI", function () {
  this.timeout(20000);

  it("help", async () => {
    const result = await transform(["-h"]);
    assert.equal(result.code, 1);
    assert.match(
      result.stdout,
      /Usage: odata-openapi <options> <source files>/,
    );
  });

  it("invalid option", async () => {
    const result = await transform(["-x"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Unknown option: -x\n");
  });

  it("non-existing file", async () => {
    const result = await transform(["x"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not found: x\n");
  });

  it("file not XML", async () => {
    const result = await transform(["build.ps1"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not XML: build.ps1\n");
  });

  it("file not OData", async () => {
    const result = await transform(["OData-Version.xsl"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not OData: OData-Version.xsl\n");
  });

  it("annotations-v2 as swagger", async () => {
    const target = "tests/annotations-v2.openapi.json";
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await transform([
      "-du",
      "--scheme https",
      "--verbose",
      "-o 2.0",
      "tests/annotations-v2.xml",
    ]);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.deepStrictEqual(result.stdout.split("\n"), [
      "Checking OData version used in source file: tests/annotations-v2.xml",
      "Source file is OData version: 2.0",
      "Transforming tests/annotations-v2.xml to OData V4, target file: tests/annotations-v2.tmp",
      "Transforming tests/annotations-v2.tmp to OpenAPI 2.0, target file: tests/annotations-v2.openapi.json",
      "Deleting unused schemas",
      "Writing target file: tests/annotations-v2.openapi.json",
      "Removing intermediate file: tests/annotations-v2.tmp",
      "Done.",
      "",
    ]);
    assert.equal(fs.existsSync(target), true);
    const actual = JSON.parse(fs.readFileSync(target, "utf8"));
    const expected = JSON.parse(
      fs.readFileSync("tests/annotations-v2.swagger.json", "utf8"),
    );
    assert.deepStrictEqual(actual, expected, "produced OpenAPI");
    fs.unlinkSync(target);
  });

  const tests = fs.readdirSync("tests").filter((fn) => fn.endsWith(".xml"));
  for (const t of tests) {
    const base = path.basename(t, ".xml");
    it(base, async () => {
      const target = `tests/${base}.openapi3.json`;
      if (fs.existsSync(target)) fs.unlinkSync(target);
      const result = await transform([
        "-dp",
        "-t",
        target,
        `tests/${base}.xml`,
      ]);
      assert.equal(result.code, 0);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, "");
      assert.equal(fs.existsSync(target), true);

      const d = await diff(target);
      assert.equal(d.code, 0);
      if (d.stdout !== "") {
        console.log(d.stdout);
        assert.fail("git diff");
      }
    });
  }
});

function transform(args, cwd) {
  return new Promise((resolve) => {
    exec(
      `node ${path.resolve("./transform.js")} ${args.join(" ")}`,
      { cwd },
      (error, stdout, stderr) => {
        resolve({
          code: error?.code || 0,
          error,
          stdout,
          stderr,
        });
      },
    );
  });
}

function diff(file) {
  return new Promise((resolve) => {
    exec(`git diff ${file}`, {}, (error, stdout, stderr) => {
      resolve({
        code: error?.code || 0,
        error,
        stdout,
        stderr,
      });
    });
  });
}
