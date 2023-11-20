const assert = require("assert");

const { paths, operations, schemas } = require("./utilities");

const { csdl2openapi } = require("odata-openapi");

describe("Keep", function () {
  it("Keep one of two unconnected entity sets", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        ET: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
          complex: { $Type: "this.CT" },
          simple: { $Type: "this.TD" },
        },
        CT: {
          $Kind: "ComplexType",
          foo: {},
        },
        TD: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        ET2: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
          complex: { $Type: "this.CT2" },
          simple: { $Type: "this.TD2" },
        },
        CT2: {
          $Kind: "ComplexType",
          foo: {},
        },
        TD2: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          Set: { $Collection: true, $Type: "this.ET" },
          Set2: { $Collection: true, $Type: "this.ET2" },
        },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/Set/{id}": { get: {}, patch: {}, delete: {} },
      },
      components: {
        schemas: {
          "this.ET": {},
          "this.ET-create": {},
          "this.ET-update": {},
          "this.CT": {},
          "this.CT-create": {},
          "this.CT-update": {},
          "this.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, { rootResourcesToKeep: ["Set"] });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
  });
  it("Keep one of two connected entity sets, stub the association", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        ET: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
          complex: { $Type: "this.CT" },
          simple: { $Type: "this.TD" },
          two: { $Kind: "NavigationProperty", $Type: "this.ET2" },
          twoMany: {
            $Kind: "NavigationProperty",
            $Type: "this.ET2",
            $Collection: true,
          },
          twoOptional: {
            $Kind: "NavigationProperty",
            $Type: "this.ET2",
            $Nullable: true,
          },
        },
        CT: {
          $Kind: "ComplexType",
          foo: {},
        },
        TD: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        ET2: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
          complex: { $Type: "this.CT2" },
          simple: { $Type: "this.TD2" },
        },
        CT2: {
          $Kind: "ComplexType",
          foo: {},
        },
        TD2: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          Set: { $Collection: true, $Type: "this.ET" },
          Set2: { $Collection: true, $Type: "this.ET2" },
        },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/Set/{id}": { get: {}, patch: {}, delete: {} },
      },
      components: {
        schemas: {
          "this.ET": {
            title: "ET",
            type: "object",
            properties: {
              id: { type: "string" },
              complex: { $ref: "#/components/schemas/this.CT" },
              simple: { $ref: "#/components/schemas/this.TD" },
              two: { $ref: "#/components/schemas/stub" },
              twoMany: {
                type: "array",
                items: { $ref: "#/components/schemas/stub" },
              },
              "twoMany@count": { $ref: "#/components/schemas/count" },
              twoOptional: {
                nullable: true,
                allOf: [{ $ref: "#/components/schemas/stub" }],
              },
            },
          },
          "this.ET-create": {
            title: "ET (for create)",
            type: "object",
            properties: {
              id: { type: "string" },
              complex: { $ref: "#/components/schemas/this.CT-create" },
              simple: { $ref: "#/components/schemas/this.TD" },
              two: { $ref: "#/components/schemas/entityReference" },
            },
            required: ["id"],
          },
          "this.ET-update": {
            title: "ET (for update)",
            type: "object",
            properties: {
              complex: { $ref: "#/components/schemas/this.CT-update" },
              simple: { $ref: "#/components/schemas/this.TD" },
            },
          },
          "this.CT": {},
          "this.CT-create": {},
          "this.CT-update": {},
          "this.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, { rootResourcesToKeep: ["Set"] });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
    assert.deepStrictEqual(
      actual.components.schemas.stub,
      { title: "Stub object", type: "object" },
      "Stub object",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.ET"],
      expected.components.schemas["this.ET"],
      "read structure",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.ET-create"],
      expected.components.schemas["this.ET-create"],
      "create structure",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.ET-update"],
      expected.components.schemas["this.ET-update"],
      "update structure",
    );
  });
});
