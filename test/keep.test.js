const assert = require("assert");

//TODO:
// keep action import and function import: keep parameter and response types

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

  it("Keep one of two connected entity sets, keep containment, stub non-containment", function () {
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
          contained: {
            $Kind: "NavigationProperty",
            $Type: "this.CET",
            $ContainsTarget: true,
          },
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
        CET: {
          $Kind: "EntityType",
          data: {},
        },
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
        "/Set/{id}/contained": { get: {}, patch: {} },
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
              contained: { $ref: "#/components/schemas/this.CET" },
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
              contained: { $ref: "#/components/schemas/this.CET-create" },
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
          "this.CET": {},
          "this.CET-create": {},
          "this.CET-update": {},
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

  it("Keep non-containment navigation to contained entity", function () {
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
          bestOfContained: {
            $Kind: "NavigationProperty",
            $Type: "this.CET",
            $Nullable: true,
          },
          contained: {
            $Kind: "NavigationProperty",
            $Type: "this.CET",
            $Collection: true,
            $ContainsTarget: true,
          },
        },
        CET: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
          bestOfContained: {
            $Kind: "NavigationProperty",
            $Type: "this.CET2",
            $Nullable: true,
          },
          contained: {
            $Kind: "NavigationProperty",
            $Type: "this.CET2",
            $Collection: true,
            $ContainsTarget: true,
          },
        },
        CET2: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
        },
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          Set: { $Collection: true, $Type: "this.ET" },
        },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/Set/{id}": { get: {}, patch: {}, delete: {} },
        "/Set/{id}/bestOfContained": { get: {} },
        "/Set/{id}/contained": { get: {}, post: {} },
        "/Set/{id}/contained/{id_1}": { get: {}, patch: {}, delete: {} },
        "/Set/{id}/contained/{id_1}/bestOfContained": { get: {} },
        "/Set/{id}/contained/{id_1}/contained": { get: {}, post: {} },
        "/Set/{id}/contained/{id_1}/contained/{id_2}": {
          get: {},
          patch: {},
          delete: {},
        },
      },
      components: {
        schemas: {
          "this.ET": {
            title: "ET",
            type: "object",
            properties: {
              id: { type: "string" },
              bestOfContained: {
                allOf: [{ $ref: "#/components/schemas/this.CET" }],
                nullable: true,
              },
              contained: {
                type: "array",
                items: { $ref: "#/components/schemas/this.CET" },
              },
              "contained@count": { $ref: "#/components/schemas/count" },
            },
          },
          "this.ET-create": {
            title: "ET (for create)",
            type: "object",
            properties: {
              id: { type: "string" },
              contained: {
                type: "array",
                items: { $ref: "#/components/schemas/this.CET-create" },
              },
            },
            required: ["id"],
          },
          "this.ET-update": {
            title: "ET (for update)",
            type: "object",
          },
          "this.CET": {
            title: "CET",
            type: "object",
            properties: {
              id: { type: "string" },
              bestOfContained: {
                allOf: [{ $ref: "#/components/schemas/this.CET2" }],
                nullable: true,
              },
              contained: {
                type: "array",
                items: { $ref: "#/components/schemas/this.CET2" },
              },
              "contained@count": { $ref: "#/components/schemas/count" },
            },
          },
          "this.CET-create": {},
          "this.CET-update": {},
          "this.CET2": {},
          "this.CET2-create": {},
          "this.CET2-update": {},
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
    assert.deepStrictEqual(
      actual.components.schemas["this.CET"],
      expected.components.schemas["this.CET"],
      "read structure of component entity type",
    );
  });

  it("keep function import with all overloads and their parameter and return types", function () {
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
        },
        TD: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        fun: [
          { $Kind: "Function", $ReturnType: { $Type: "this.ET" } },
          {
            $Kind: "Function",
            $Parameter: [{ $Name: "in", $Type: "this.TD" }],
            $ReturnType: { $Collection: true, $MaxLength: 20 },
          },
        ],
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          Set: { $Collection: true, $Type: "this.ET" },
          Fun: { $Function: "this.fun" },
        },
      },
    };
    const expected = {
      paths: {
        "/Fun()": { get: {} },
        "/Fun(in={in})": { get: {} },
      },
      components: {
        schemas: {
          "this.ET": {},
          "this.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, { rootResourcesToKeep: ["Fun"] });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
  });
});
