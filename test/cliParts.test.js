const assert = require("assert");

const { parseArgs } = require("../lib/cliParts");

describe("CLI parameters", function () {
  it("none", function () {
    assert.deepStrictEqual(parseArgs([]), {
      source: undefined,
      target: undefined,
      options: {},
    });
  });
});
