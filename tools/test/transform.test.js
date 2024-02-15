const assert = require("node:assert");
const { exec } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

describe("CLI", function () {
  this.timeout(20000);

  it("help", async () => {
    const result = await cmd(["-h"]);
    assert.equal(result.code, 1);
    assert.match(
      result.stdout,
      /Usage: odata-openapi <options> <source files>/,
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
    const result = await cmd(["build.ps1"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not XML: build.ps1\n");
  });

  it("file not OData", async () => {
    const result = await cmd(["OData-Version.xsl"]);
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Source file not OData: OData-Version.xsl\n");
  });

  it("annotations-v2 as swagger", async () => {
    const target = "tests/annotations-v2.openapi.json";
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await cmd([
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
      const result = await cmd([
        "-dp",
        "-t",
        `tests/${base}.openapi3.json`,
        `tests/${base}.xml`,
      ]);
      assert.equal(result.code, 0);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, "");
      assert.equal(fs.existsSync(target), true);
    });
  }
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
      },
    );
  });
}
