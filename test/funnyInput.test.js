const assert = require("assert");

const { paths, operations, schemas } = require("./utilities");

const { csdl2openapi } = require("odata-openapi");

describe("Funny input", function () {
  it("Annotation for element in later schema", function () {
    const csdl = {
      $Version: "4.01",
      $EntityContainer: "this.Container",
      this: {
        $Annotations: {
          "two.et": {
            "@Org.OData.Core.V1.Description": "should end up in title",
          },
        },
        Container: {
          es: {
            $Type: "other.et",
            $Collection: true,
          },
        },
      },
      other: {
        $Alias: "two",
        et: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          data: {},
        },
      },
    };
    const expected = {
      paths: {
        "/es": {
          get: {},
          post: {},
        },
        "/es('{key}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/$batch": { post: {} },
      },
      components: {
        schemas: {
          "other.et": {},
          "other.et-create": {},
          "other.et-update": {},
        },
      },
    };
    const messages = [];

    const actual = csdl2openapi(csdl, { messages });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
    assert.deepStrictEqual(messages, [], "messages");

    assert.equal(
      actual.components.schemas["other.et"].title,
      "should end up in title",
    );
  });

  it("Inheritance across schemas", function () {
    const csdl = {
      $Version: "4.01",
      $EntityContainer: "this.Container",
      this: {
        Container: {
          es: {
            $Type: "two.bt",
            $Collection: true,
          },
        },
        et: {
          $Kind: "EntityType",
          $BaseType: "two.bt",
          data: {},
        },
      },
      other: {
        $Alias: "two",
        bt: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
      },
    };
    const expected = {
      paths: {
        "/es": {
          get: {},
          post: {},
        },
        "/es('{key}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/$batch": { post: {} },
      },
      components: {
        schemas: {
          "this.et": {},
          "this.et-create": {},
          "this.et-update": {},
          "other.bt": {},
          "other.bt-create": {},
          "other.bt-update": {},
        },
      },
    };
    const messages = [];

    const actual = csdl2openapi(csdl, { messages });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
    assert.deepStrictEqual(messages, [], "messages");
  });

  it("Action/function import without action/function", function () {
    const csdl = {
      $Version: "4.0",
      $EntityContainer: "this.Container",
      this: {
        Container: {
          ai: {
            $Action: "not.there",
          },
          fi: {
            $Function: "this.ct",
          },
        },
        ct: { $Kind: "ComplexType" },
      },
    };
    const expected = {
      paths: {
        "/$batch": { post: {} },
      },
      components: {
        schemas: {},
      },
    };
    const messages = [];

    const actual = csdl2openapi(csdl, { messages });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
    assert.deepStrictEqual(
      messages,
      [
        "Unknown action not.there in action import ai",
        "Unknown function this.ct in function import fi",
      ],
      "messages",
    );
  });

  it("OData V2 Edm.DateTime and Edm.Time", function () {
    const csdl = {
      $Version: "2.0",
      $EntityContainer: "this.Container",
      this: {
        Container: {
          fi: {
            $Function: "this.f",
          },
        },
        f: [
          {
            $Kind: "Function",
            $Parameter: [],
            $ReturnType: { $Type: "this.ct" },
          },
        ],
        ct: {
          $Kind: "ComplexType",
          date: { $Type: "Edm.DateTime" },
          time: { $Type: "Edm.Time" },
          timeWithMilliSeconds: { $Type: "Edm.Time", $Precision: 3 },
        },
      },
    };
    const expected = {
      paths: {
        "/$batch": { post: {} },
        "/fi": { get: {} },
      },
      components: {
        schemas: {
          "this.ct": {
            type: "object",
            title: "ct",
            properties: {
              date: {
                type: "string",
                example: "/Date(1492098664000)/",
              },
              time: {
                type: "string",
                example: "PT15H51M04S",
              },
              timeWithMilliSeconds: {
                type: "string",
                example: "PT15H51M04.000S",
              },
            },
          },
        },
      },
    };
    const messages = [];

    const actual = csdl2openapi(csdl, { messages });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
    assert.deepStrictEqual(
      actual.components.schemas["this.ct"],
      expected.components.schemas["this.ct"],
      "this.ct",
    );
    assert.deepStrictEqual(messages, [], "messages");
  });
});
