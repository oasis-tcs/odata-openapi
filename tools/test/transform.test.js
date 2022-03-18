const assert = require("assert");
const exec = require("child_process").exec;
const fs = require("fs");
const path = require("path");

describe("CLI", function () {
  this.timeout(20000);

  const source = "tests/annotations-v2.xml";
  const target = "tests/annotations-v2.openapi.json";

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

  it("transform one file", async () => {
    if (fs.existsSync(target)) fs.unlinkSync(target);

    const result = await cmd(["-d", "--scheme https", source]);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(target), true);
    const actual = JSON.parse(fs.readFileSync(target, "utf8"));
    const expected = JSON.parse(
      fs.readFileSync("tests/annotations-v2.openapi3.json", "utf8")
    );
    assert.deepStrictEqual(actual, expected, "produced OpenAPI");
    fs.unlinkSync(target);
  });

  //TODO: später weg
  it("call java", async () => {
    const result = await java(["-version"]);
    assert.equal(result.code, 0);
  });

  it("call version xslt", () => {
    java([
      "-cp ./xalan/xalan.jar;./xalan/serializer.jar",
      "org.apache.xalan.xslt.Process",
      "-XSL ./OData-Version.xsl",
      "-IN",
      source,
    ]).then((result) => {
      assert.equal(result.stderr, "");
      assert.equal(result.code, 0);
      assert.equal(result.stdout, "2.0");
    });
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

function java(args, cwd) {
  return new Promise((resolve) => {
    exec(`java ${args.join(" ")}`, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error && error.code ? error.code : 0,
        error,
        stdout,
        stderr,
      });
    });
  });
}
