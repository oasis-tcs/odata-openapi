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
});
