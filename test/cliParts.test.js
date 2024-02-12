const assert = require("assert");

const { parseArguments } = require("../lib/cliParts");

describe("CLI parameters", function () {
  it("no arguments", function () {
    const args = parseArguments([]);
    assert.deepStrictEqual(args.unknown, undefined);
    assert.match(args.usage, /Usage:/);
  });

  it("help", function () {
    const args = parseArguments(["-h"]);
    assert.match(args.usage, /Usage:/);

    const args2 = parseArguments(["--help", "foo"]);
    assert.match(args2.usage, /Usage:/);
  });

  it("unknown option", function () {
    const args = parseArguments(["--do-not-know", "foo", "--whatever", "bar"]);
    assert.match(args.unknown, /--do-not-know/);
    assert.match(args.usage, /Usage:/);
  });

  it("just the source", function () {
    assert.deepStrictEqual(parseArguments(["foo"]), {
      source: "foo",
      target: "foo.openapi3.json",
      options: {},
    });

    assert.deepStrictEqual(parseArguments([".foo"]), {
      source: ".foo",
      target: ".foo.openapi3.json",
      options: {},
    });

    assert.deepStrictEqual(parseArguments(["foo.bar"]), {
      source: "foo.bar",
      target: "foo.openapi3.json",
      options: {},
    });
  });

  it("source and target", function () {
    assert.deepStrictEqual(parseArguments(["foo", "-t", "bar"]), {
      source: "foo",
      target: "bar",
      options: {},
    });

    assert.deepStrictEqual(parseArguments(["-t", "bar", "foo"]), {
      source: "foo",
      target: "bar",
      options: {},
    });
  });

  it("two sources", function () {
    const args = parseArguments(["foo", "bar"]);
    assert.deepStrictEqual(args.unknown, undefined);
    assert.match(args.usage, /Usage:/);
  });

  it("pretty", function () {
    assert.deepStrictEqual(parseArguments(["foo", "-p"]).options, {
      pretty: true,
    });
    assert.deepStrictEqual(parseArguments(["--pretty", "foo"]).options, {
      pretty: true,
    });
  });

  it("all flags on", function () {
    assert.deepStrictEqual(parseArguments(["-dp", "foo"]).options, {
      diagram: true,
      pretty: true,
    });
    assert.deepStrictEqual(parseArguments(["-d", "-p", "foo"]).options, {
      diagram: true,
      pretty: true,
    });
    assert.deepStrictEqual(
      parseArguments(["--diagram", "--pretty", "foo"]).options,
      {
        diagram: true,
        pretty: true,
      },
    );
  });

  it("service root", function () {
    assert.deepStrictEqual(
      parseArguments([
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
      parseArguments([
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
    assert.deepStrictEqual(parseArguments(["-o", "4.0", "foo"]).options, {
      openapiVersion: "4.0",
    });
    assert.deepStrictEqual(
      parseArguments(["--openapi-version", "4.0", "foo"]).options,
      {
        openapiVersion: "4.0",
      },
    );
  });

  it("recursion levels", function () {
    assert.deepStrictEqual(parseArguments(["--levels", "42", "foo"]).options, {
      maxLevels: 42,
    });
    assert.deepStrictEqual(
      parseArguments(["--levels", "max", "foo"]).options,
      {},
    );
  });

  it("root resources to keep", function () {
    assert.deepStrictEqual(parseArguments(["--keep", "one", "foo"]).options, {
      rootResourcesToKeep: ["one"],
    });
    assert.deepStrictEqual(
      parseArguments(["-k", "first", "--keep", "second", "foo"]).options,
      { rootResourcesToKeep: ["first", "second"] },
    );
  });
});
