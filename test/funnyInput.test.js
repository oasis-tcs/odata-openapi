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
});
