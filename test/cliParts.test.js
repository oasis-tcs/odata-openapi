const assert = require("assert");

const { parseArgs } = require("../lib/cliParts");

describe("CLI parameters", function () {
  it("no arguments", function () {
    const args = parseArgs([]);
    assert.deepStrictEqual(args.unknown, []);
    assert.match(args.usage, /Usage:/);
  });

  it("help", function () {
    const args = parseArgs(["-h"]);
    assert.deepStrictEqual(args.unknown, []);
    assert.match(args.usage, /Usage:/);

    const args2 = parseArgs(["--help", "foo"]);
    assert.deepStrictEqual(args2.unknown, []);
    assert.match(args2.usage, /Usage:/);
  });

  it("unknown option", function () {
    const args = parseArgs(["--do-not-know", "foo", "--whatever", "bar"]);
    assert.deepStrictEqual(args.unknown, ["--do-not-know", "--whatever"]);
    assert.match(args.usage, /Usage:/);
  });

  it("just the source", function () {
    assert.deepStrictEqual(parseArgs(["foo"]), {
      source: "foo",
      target: "foo.openapi3.json",
      options: {},
    });

    assert.deepStrictEqual(parseArgs([".foo"]), {
      source: ".foo",
      target: ".foo.openapi3.json",
      options: {},
    });

    assert.deepStrictEqual(parseArgs(["foo.bar"]), {
      source: "foo.bar",
      target: "foo.openapi3.json",
      options: {},
    });
  });

  it("source and target", function () {
    assert.deepStrictEqual(parseArgs(["foo", "-t", "bar"]), {
      source: "foo",
      target: "bar",
      options: {},
    });

    assert.deepStrictEqual(parseArgs(["-t", "bar", "foo"]), {
      source: "foo",
      target: "bar",
      options: {},
    });
  });

  it("two sources", function () {
    const args = parseArgs(["foo", "bar"]);
    assert.deepStrictEqual(args.unknown, []);
    assert.match(args.usage, /Usage:/);
  });

  it("pretty", function () {
    assert.deepStrictEqual(parseArgs(["foo", "-p"]).options, {
      pretty: true,
    });
    assert.deepStrictEqual(parseArgs(["--pretty", "foo"]).options, {
      pretty: true,
    });
  });

  it("all flags on", function () {
    assert.deepStrictEqual(parseArgs(["-dp", "foo"]).options, {
      diagram: true,
      pretty: true,
    });
    assert.deepStrictEqual(parseArgs(["-d", "-p", "foo"]).options, {
      diagram: true,
      pretty: true,
    });
    assert.deepStrictEqual(
      parseArgs(["--diagram", "--pretty", "foo"]).options,
      {
        diagram: true,
        pretty: true,
      },
    );
  });

  it("service root", function () {
    assert.deepStrictEqual(
      parseArgs([
        "--scheme",
        "http",
        "--host",
        "localhost",
        "--basePath",
        "/root",
        "foo",
      ]).options,
      {
        scheme: "http",
        host: "localhost",
        basePath: "/root",
      },
    );
  });

  it("title & description & skip batch", function () {
    assert.deepStrictEqual(
      parseArgs([
        "--title",
        "Title",
        "--description",
        "Description",
        "--skipBatchPath",
        "foo",
      ]).options,
      {
        defaultTitle: "Title",
        defaultDescription: "Description",
        skipBatchPath: true,
      },
    );
  });

  it("openapi-version", function () {
    assert.deepStrictEqual(parseArgs(["-o", "4.0", "foo"]).options, {
      openapiVersion: "4.0",
    });
    assert.deepStrictEqual(
      parseArgs(["--openapi-version", "4.0", "foo"]).options,
      {
        openapiVersion: "4.0",
      },
    );
  });

  it("recursion levels", function () {
    assert.deepStrictEqual(parseArgs(["--levels", "42", "foo"]).options, {
      maxLevels: 42,
    });
    assert.deepStrictEqual(parseArgs(["--levels", "max", "foo"]).options, {});
  });

  it("root resources to keep", function () {
    assert.deepStrictEqual(parseArgs(["--keep", "one", "foo"]).options, {
      rootResourcesToKeep: ["one"],
    });
    assert.deepStrictEqual(
      parseArgs(["--keep", "first", "--keep", "second", "foo"]).options,
      { rootResourcesToKeep: ["first", "second"] },
    );
  });
});
