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
      $EntityContainer: "Schema.Container",
      Schema: {
        $Alias: "this",
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
          "Schema.ET": {},
          "Schema.ET-create": {},
          "Schema.ET-update": {},
          "Schema.CT": {},
          "Schema.CT-create": {},
          "Schema.CT-update": {},
          "Schema.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Set"],
      diagram: true,
    });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[ET{bg:lightslategray}],[ET]++-[CT],[ET]++-[TD],[Set%20{bg:lawngreen}]++-*>[ET])",
      "ER diagram",
    );
  });

  it("Keep one of two navigation-connected entity sets, keep containment, stub non-containment", function () {
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
              two: { type: "object", description: "Stub for this.ET2" },
              twoMany: {
                type: "array",
                items: { type: "object", description: "Stub for this.ET2" },
              },
              "twoMany@count": { $ref: "#/components/schemas/count" },
              twoOptional: {
                nullable: true,
                type: "object",
                description: "Stub for this.ET2",
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
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Set"],
      diagram: true,
    });
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
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[ET{bg:lightslategray}],[ET]++-[CT],[ET]++-[TD],[ET]++->[CET{bg:lightslategray}],[ET]->[ET2{bg:lightslategray}],[ET]-*>[ET2{bg:lightslategray}],[ET]-0..1>[ET2{bg:lightslategray}],[CET{bg:lightslategray}],[Set%20{bg:lawngreen}]++-*>[ET])",
      "ER diagram",
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
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Set"],
      diagram: true,
    });
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
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[ET{bg:lightslategray}],[ET]-0..1>[CET{bg:lightslategray}],[ET]++-*>[CET{bg:lightslategray}],[CET{bg:lightslategray}],[CET]-0..1>[CET2{bg:lightslategray}],[CET]++-*>[CET2{bg:lightslategray}],[CET2{bg:lightslategray}],[Set%20{bg:lawngreen}]++-*>[ET])",
      "ER diagram",
    );
  });

  it("keep function import with all unbound overloads and their parameter and return types", function () {
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
        },
        ET2: {
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
            $ReturnType: { $Type: "this.ET" },
          },
          {
            $Kind: "Function",
            $IsBound: true,
            $Parameter: [{ $Name: "in", $Type: "this.ET" }],
            $ReturnType: { $Type: "this.ET2" },
          },
        ],
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          Set: { $Collection: true, $Type: "this.ET" },
          Set2: { $Collection: true, $Type: "this.ET2" },
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
          "this.CET": {},
          "this.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Fun"],
      diagram: true,
    });
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
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[ET{bg:lightslategray}],[ET]-0..1>[CET{bg:lightslategray}],[ET]++-*>[CET{bg:lightslategray}],[CET{bg:lightslategray}],[Fun{bg:lawngreen}]->[ET])",
      "ER diagram",
    );
  });

  it("keep action import and its unbound overload with parameter and return types", function () {
    const csdl = {
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
        },
        TD: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        act: [
          {
            $Kind: "Action",
            $Parameter: [{ $Name: "in", $Type: "this.TD" }],
            $ReturnType: { $Type: "this.ET", $Collection: true },
          },
        ],
        Container: {
          Set: { $Collection: true, $Type: "this.ET" },
          Act: { $Action: "this.act" },
        },
      },
    };
    const expected = {
      paths: {
        "/Act": { post: {} },
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
          "this.CET": {},
          "this.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Act"],
      diagram: true,
    });
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
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[ET{bg:lightslategray}],[ET]-0..1>[CET{bg:lightslategray}],[ET]++-*>[CET{bg:lightslategray}],[CET{bg:lightslategray}],[Act{bg:lawngreen}]-*>[ET],[Act]in->[TD])",
      "ER diagram",
    );
  });

  it("keep function import with primitive return type", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        TD: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.DateTimeOffset" },
        fun: [{ $Kind: "Function", $ReturnType: { $Type: "this.TD" } }],
        Container: {
          Fun: { $Function: "this.fun" },
        },
      },
    };
    const expected = {
      paths: {
        "/Fun()": { get: {} },
      },
      components: {
        schemas: {
          "this.TD": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Fun"],
      diagram: true,
    });
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
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[Fun{bg:lawngreen}]->[TD])",
      "ER diagram",
    );
  });

  it("Stub bound action and function return entity types that are not kept", function () {
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
          data: {},
        },
        ET2: {
          $Kind: "EntityType",
          $Key: ["id"],
          id: {},
          data: {},
        },
        act: [
          {
            $Kind: "Action",
            $IsBound: true,
            $Parameter: [{ $Name: "in", $Type: "this.ET" }],
            $ReturnType: { $Type: "this.ET2" },
          },
        ],
        fun: [
          {
            $Kind: "Function",
            $IsBound: true,
            $Parameter: [{ $Name: "in", $Type: "this.ET" }],
            $ReturnType: { $Type: "this.ET2" },
          },
        ],
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
        "/Set/{id}/this.act": { post: {} },
        "/Set/{id}/this.fun()": { get: {} },
      },
      components: {
        schemas: {
          "this.ET": {
            title: "ET",
            type: "object",
            properties: {
              id: { type: "string" },
              data: { type: "string" },
            },
          },
          "this.ET-create": {
            title: "ET (for create)",
            type: "object",
            properties: {
              id: { type: "string" },
              data: { type: "string" },
            },
            required: ["id"],
          },
          "this.ET-update": {
            title: "ET (for update)",
            type: "object",
            properties: {
              data: { type: "string" },
            },
          },
        },
      },
    };
    const actual = csdl2openapi(csdl, {
      rootResourcesToKeep: ["Set"],
      diagram: true,
    });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/Set/{id}/this.act"].post.responses["200"].content[
        "application/json"
      ].schema,
      { type: "object", description: "Stub for this.ET2" },
      "stubbed action return type",
    );
    assert.deepStrictEqual(
      actual.paths["/Set/{id}/this.fun()"].get.responses["200"].content[
        "application/json"
      ].schema,
      { type: "object", description: "Stub for this.ET2" },
      "stubbed function return type",
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
    const diagram = actual.info.description.split("\n")[3];
    assert.strictEqual(
      diagram,
      "![ER Diagram](https://yuml.me/diagram/class/[ET{bg:lightslategray}],[Set%20{bg:lawngreen}]++-*>[ET])",
      "ER diagram",
    );
  });
});
