const assert = require("assert");

const { paths, operations, schemas } = require("./utilities");

const { csdl2openapi } = require("odata-openapi");

describe("Annotations", function () {
  it("key-as-segment", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        Type: { $Kind: "EntityType", $Key: ["key"], key: {} },
        Type2: {
          $Kind: "EntityType",
          $Key: ["key1", "key2"],
          key1: {},
          key2: {},
        },
        Container: {
          "@Capabilities.BatchSupport": {
            "@Core.Description": "BatchSupport - Description",
            "@Core.LongDescription": "BatchSupport - LongDescription",
          },
          "@Capabilities.KeyAsSegmentSupported": true,
          Set: { $Collection: true, $Type: "this.Type" },
          Set2: { $Collection: true, $Type: "this.Type2" },
        },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/Set/{key}": { get: {}, patch: {}, delete: {} },
        "/Set2": { get: {}, post: {} },
        "/Set2/{key1}/{key2}": { get: {}, patch: {}, delete: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl);
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.strictEqual(
      actual.paths["/$batch"].post.summary,
      "BatchSupport - Description",
      "Batch summary",
    );
    assert.strictEqual(
      actual.paths["/$batch"].post.description,
      'BatchSupport - LongDescription\n\n*Please note that "Try it out" is not supported for this request.*',
      "Batch description",
    );
  });

  it("computed and optional key", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        ComputedKey: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: { "@Core.Computed": true },
        },
        DefaultedKey: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: { "@Core.ComputedDefaultValue": true },
        },
        PlainKey: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          CK: { $Collection: true, $Type: "this.ComputedKey" },
          DK: { $Collection: true, $Type: "this.DefaultedKey" },
          PK: { $Collection: true, $Type: "this.PlainKey" },
        },
      },
    };
    const expected = {
      paths: {
        "/CK": { get: {}, post: {} },
        "/CK/{key}": { get: {}, patch: {}, delete: {} },
        "/DK": { get: {}, post: {} },
        "/DK/{key}": { get: {}, patch: {}, delete: {} },
        "/PK": { get: {}, post: {} },
        "/PK/{key}": { get: {}, patch: {}, delete: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl);
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.ComputedKey-create"],
      {
        title: "ComputedKey (for create)",
        type: "object",
        // no properties, no required
      },
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.DefaultedKey-create"],
      {
        title: "DefaultedKey (for create)",
        type: "object",
        properties: { key: { type: "string" } },
        // no required
      },
    );
    assert.deepStrictEqual(actual.components.schemas["this.PlainKey-create"], {
      title: "PlainKey (for create)",
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    });
  });

  it("FilterSegmentSupported", function () {
    const csdl = {
      $Version: "4.01",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        whole: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          data: {},
          nav: {
            $Type: "this.part",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
            $Collection: true,
          },
        },
        part: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          data: {},
        },
        Container: {
          filteredDelete: {
            $Type: "this.whole",
            $Collection: true,
            "@Capabilities.DeleteRestrictions": {
              FilterSegmentSupported: true,
            },
            "@Capabilities.NavigationRestrictions": {
              RestrictedProperties: [
                {
                  NavigationProperty: "nav",
                  DeleteRestrictions: {
                    FilterSegmentSupported: true,
                  },
                },
              ],
            },
          },
          filteredUpdate: {
            $Type: "this.whole",
            $Collection: true,
            "@Capabilities.UpdateRestrictions": {
              FilterSegmentSupported: true,
            },
            "@Capabilities.NavigationRestrictions": {
              RestrictedProperties: [
                {
                  NavigationProperty: "nav",
                  UpdateRestrictions: {
                    FilterSegmentSupported: true,
                  },
                },
              ],
            },
          },
        },
      },
    };
    const expected = {
      paths: {
        "/filteredDelete": {
          get: {},
          post: {},
        },
        "/filteredDelete/$filter({filter_expression})/$each": {
          delete: {},
        },
        "/filteredDelete('{key}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/filteredDelete('{key}')/nav": {
          get: {},
          post: {},
        },
        "/filteredDelete('{key}')/nav('{key_1}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/filteredDelete('{key}')/nav/$filter({filter_expression})/$each": {
          delete: {},
        },
        "/filteredUpdate": {
          get: {},
          post: {},
        },
        "/filteredUpdate/$filter({filter_expression})/$each": {
          patch: {},
        },
        "/filteredUpdate('{key}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/filteredUpdate('{key}')/nav": {
          get: {},
          post: {},
        },
        "/filteredUpdate('{key}')/nav('{key_1}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/filteredUpdate('{key}')/nav/$filter({filter_expression})/$each": {
          patch: {},
        },
        "/$batch": { post: {} },
      },
      components: {
        schemas: {
          "this.part": {},
          "this.part-create": {},
          "this.part-update": {},
          "this.whole": {},
          "this.whole-create": {},
          "this.whole-update": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
  });

  it("InsertRestrictions, UpdateRestrictions, ReadRestrictions", function () {
    const csdl = {
      $Version: "4.01",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        noInsert: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: {
            $Type: "this.noInsertPart",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        noInsertPart: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        noUpdate: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: {
            $Type: "this.noUpdatePart",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        noUpdatePart: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        noRead: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: {
            $Type: "this.noReadPart",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        noReadPart: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        nothing: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          navOne: {
            $Type: "this.nothingPart",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
          navMany: {
            $Type: "this.nothingPart",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
            $Collection: true,
          },
        },
        nothingPart: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        Container: {
          noInsert: {
            $Type: "this.noInsert",
            $Collection: true,
            "@Capabilities.InsertRestrictions": {
              Insertable: false,
            },
            "@Capabilities.UpdateRestrictions": {
              UpdateMethod: "PUT",
            },
          },
          noUpdate: {
            $Type: "this.noUpdate",
            $Collection: true,
            "@Capabilities.UpdateRestrictions": {
              Updatable: false,
            },
          },
          noRead: {
            $Type: "this.noRead",
            $Collection: true,
            "@Capabilities.InsertRestrictions": {
              Insertable: false,
            },
            "@Capabilities.ReadRestrictions": {
              Readable: false,
            },
          },
          nothing: {
            $Type: "this.nothing",
            $Collection: true,
            "@Capabilities.InsertRestrictions": {
              Insertable: false,
            },
            "@Capabilities.ReadRestrictions": {
              Readable: false,
            },
            "@Capabilities.UpdateRestrictions": {
              Updatable: false,
            },
            "@Capabilities.DeleteRestrictions": {
              Deletable: false,
            },
            "@Capabilities.NavigationRestrictions": {
              RestrictedProperties: [
                {
                  NavigationProperty: "navMany",
                  InsertRestrictions: { Insertable: false },
                  ReadRestrictions: { Readable: false },
                  UpdateRestrictions: { Updatable: false },
                  DeleteRestrictions: { Deletable: false },
                },
                {
                  NavigationProperty: "navOne",
                  ReadRestrictions: { Readable: false },
                  UpdateRestrictions: { Updatable: false },
                },
              ],
            },
          },
        },
      },
    };
    const expected = {
      paths: {
        "/noInsert": {
          get: {},
        },
        "/noInsert('{key}')": {
          get: {},
          put: {},
          delete: {},
        },
        "/noInsert('{key}')/nav": {
          get: {},
          patch: {},
        },
        "/noUpdate": {
          get: {},
          post: {},
        },
        "/noUpdate('{key}')": {
          get: {},
          delete: {},
        },
        "/noUpdate('{key}')/nav": {
          get: {},
          patch: {},
        },
        "/noRead('{key}')": {
          patch: {},
          delete: {},
        },
        "/noRead('{key}')/nav": {
          get: {},
          patch: {},
        },
        "/$batch": { post: {} },
      },
      components: {
        schemas: {
          "this.noInsert": {},
          "this.noInsert-update": {},
          "this.noInsertPart": {},
          "this.noInsertPart-update": {},
          "this.noRead-update": {},
          "this.noReadPart": {},
          "this.noReadPart-update": {},
          "this.noUpdate": {},
          "this.noUpdate-create": {},
          "this.noUpdatePart": {},
          "this.noUpdatePart-create": {},
          "this.noUpdatePart-update": {},
        },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
  });

  it("type definition with @JSON.Schema", function () {
    const csdl = {
      $EntityContainer: "jsonExamples.Container",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.JSON.V1", $Alias: "JSON" },
          ],
        },
      },
      jsonExamples: {
        Container: {
          single: { $Type: "jsonExamples.single" },
          f: { $Function: "jsonExamples.func" },
        },
        single: {
          $Kind: "EntityType",
          stream1: { $Type: "jsonExamples.typeDefinitionOld" },
          stream2: { $Type: "jsonExamples.typeDefinitionNew", $MaxLength: 10 },
        },
        typeDefinitionOld: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.Stream",
          "@JSON.Schema":
            '{"type":"object","additionalProperties":false,"patternProperties":{"^[\\\\w\\\\.\\\\-\\\\/]+$":{"type":"string"}}}',
        },
        typeDefinitionNew: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.Stream",
          "@JSON.Schema": {
            type: "object",
            additionalProperties: false,
            patternProperties: { "^[\\w\\.\\-\\/]+$": { type: "string" } },
          },
        },
        func: [
          {
            $Kind: "Function",
            $Parameter: [
              { $Name: "first", $Type: "jsonExamples.typeDefinitionNew" },
              {
                $Name: "second",
                $Type: "Edm.Stream",
                "@JSON.Schema": { type: "array", items: { type: "string" } },
              },
            ],
            $ReturnType: {
              $Type: "Edm.Stream",
              "@JSON.Schema": { type: "array" },
            },
          },
        ],
      },
    };
    const openapi = csdl2openapi(csdl, {});
    assert.deepStrictEqual(
      openapi.components.schemas["jsonExamples.typeDefinitionOld"],
      {
        title: "typeDefinitionOld",
        type: "object",
        additionalProperties: false,
        patternProperties: {
          "^[\\w\\.\\-\\/]+$": { type: "string" },
        },
      },
      "JSON property old-style",
    );
    assert.deepStrictEqual(
      openapi.components.schemas["jsonExamples.typeDefinitionNew"],
      {
        title: "typeDefinitionNew",
        type: "object",
        additionalProperties: false,
        patternProperties: {
          "^[\\w\\.\\-\\/]+$": { type: "string" },
        },
      },
      "JSON property new-style",
    );
    assert.deepStrictEqual(
      openapi.components.schemas["jsonExamples.single"].properties.stream2,
      {
        maxLength: 10,
        allOf: [
          { $ref: "#/components/schemas/jsonExamples.typeDefinitionNew" },
        ],
      },
      "MaxLength",
    );
    assert.deepStrictEqual(
      openapi.paths["/f(first=@first,second=@second)"].get.parameters,
      [
        {
          name: "@first",
          required: true,
          description:
            "This is URL-encoded JSON of type jsonExamples.typeDefinitionNew, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
          in: "query",
          example: "{}",
          schema: {
            title: "typeDefinitionNew",
            type: "object",
            additionalProperties: false,
            patternProperties: {
              "^[\\w\\.\\-\\/]+$": { type: "string" },
            },
          },
        },
        {
          name: "@second",
          required: true,
          description:
            "This is URL-encoded JSON of type Edm.Stream, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
          in: "query",
          example: "{}",
          schema: { type: "array", items: { type: "string" } },
        },
      ],
      "stream parameters of function",
    );
    assert.deepStrictEqual(
      openapi.paths["/f(first=@first,second=@second)"].get.responses[200]
        .content["application/json"],
      { schema: { type: "array" } },
      "stream return type of function",
    );
  });

  it("type definition with @Org.OData.JSON.V1.Schema", function () {
    const csdl = {
      $EntityContainer: "jsonExamples.Container",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1" },
            { $Namespace: "Org.OData.JSON.V1" },
          ],
        },
      },
      jsonExamples: {
        Container: {
          single: { $Type: "jsonExamples.single" },
        },
        single: {
          $Kind: "EntityType",
          stream1: { $Type: "jsonExamples.typeDefinitionOld" },
          stream2: { $Type: "jsonExamples.typeDefinitionNew" },
        },
        typeDefinitionOld: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.Stream",
          "@Org.OData.JSON.V1.Schema":
            '{"type":"object","additionalProperties":false,"patternProperties":{"^[\\\\w\\\\.\\\\-\\\\/]+$":{"type":"string"}}}',
        },
        typeDefinitionNew: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.Stream",
          "@Org.OData.JSON.V1.Schema": {
            type: "object",
            additionalProperties: false,
            patternProperties: { "^[\\w\\.\\-\\/]+$": { type: "string" } },
          },
        },
      },
    };
    const openapi = csdl2openapi(csdl, {});
    assert.deepStrictEqual(
      openapi.components.schemas["jsonExamples.typeDefinitionOld"],
      {
        title: "typeDefinitionOld",
        type: "object",
        additionalProperties: false,
        patternProperties: {
          "^[\\w\\.\\-\\/]+$": { type: "string" },
        },
      },
      "JSON property old-style",
    );
    assert.deepStrictEqual(
      openapi.components.schemas["jsonExamples.typeDefinitionNew"],
      {
        title: "typeDefinitionNew",
        type: "object",
        additionalProperties: false,
        patternProperties: {
          "^[\\w\\.\\-\\/]+$": { type: "string" },
        },
      },
      "JSON property new-style",
    );
  });

  it("BatchSupport/Supported:false", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      this: {
        Type: { $Kind: "EntityType", $Key: ["key"], key: {} },
        Container: {
          "@Capabilities.BatchSupport": { Supported: false },
          Set: { $Collection: true, $Type: "this.Type" },
        },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/Set('{key}')": { get: {}, patch: {}, delete: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
  });

  it("delta link, no $batch", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capa" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        ET: { $Kind: "EntityType", $Key: ["key"], key: {} },
        Container: {
          Set: {
            $Type: "this.ET",
            $Collection: true,
            "@Capa.ChangeTracking": { Supported: true },
          },
          "@Capa.BatchSupported": false,
        },
      },
    };
    const expected = {
      paths: {
        "/Set": {
          get: {},
          post: {},
        },
        "/Set('{key}')": { get: {}, patch: {}, delete: {} },
      },
    };
    const expectedGetResponseProperties = {
      "@odata.count": {
        $ref: "#/components/schemas/count",
      },
      value: {
        type: "array",
        items: {
          $ref: "#/components/schemas/this.ET",
          //TODO:delta
        },
      },
      "@odata.deltaLink": {
        example:
          "/service-root/Set?$deltatoken=opaque server-generated token for fetching the delta",
        type: "string",
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/Set"].get.responses[200].content["application/json"].schema
        .properties,
      expectedGetResponseProperties,
      "get list with delta",
    );
  });

  it("FilterRestrictions, NavigationRestrictions, SearchRestrictions, and SortRestrictions", function () {
    const csdl = {
      $Version: "4.01",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        thing: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: { $Type: "Edm.Int32" },
          one: { $DefaultValue: "def" },
          two: {},
          nav: {
            $Type: "this.thing",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        Container: {
          things: {
            $Type: "this.thing",
            $Collection: true,
            "@Capabilities.FilterRestrictions": {
              "@Core.Description": "Filtering has some restrictions here.",
              RequiredProperties: ["two"],
            },
            "@Capabilities.NavigationRestrictions": {
              RestrictedProperties: [
                {
                  NavigationProperty: "nav",
                  Navigability: "Single",
                },
              ],
            },
            "@Capabilities.SearchRestrictions": {
              "@Core.Description": "Searching has some restrictions here.",
              Searchable: true,
            },
            "@Capabilities.SortRestrictions": {
              "@Core.Description": "Sorting has some restrictions here.",
              NonSortableProperties: ["one"],
            },
          },
        },
      },
    };
    const expected = {
      paths: {
        "/things": {
          get: {
            summary: "Get entities from things",
            tags: ["things"],
            parameters: [
              { $ref: "#/components/parameters/top" },
              { $ref: "#/components/parameters/skip" },
              {
                in: "query",
                name: "search",
                schema: { type: "string" },
                description: "Searching has some restrictions here.",
              },
              {
                in: "query",
                name: "filter",
                schema: { type: "string" },
                description:
                  "Filtering has some restrictions here.\n\nRequired filter properties:\n- two",
              },
              { $ref: "#/components/parameters/count" },
              {
                in: "query",
                name: "orderby",
                description: "Sorting has some restrictions here.",
                explode: false,
                schema: {
                  type: "array",
                  uniqueItems: true,
                  items: {
                    type: "string",
                    enum: ["key", "key desc", "two", "two desc"],
                  },
                },
              },
              {
                in: "query",
                name: "select",
                description:
                  "Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)",
                explode: false,
                schema: {
                  type: "array",
                  uniqueItems: true,
                  items: {
                    type: "string",
                    enum: ["key", "one", "two"],
                  },
                },
              },
              {
                in: "query",
                name: "expand",
                description:
                  "Expand related entities, see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)",
                explode: false,
                schema: {
                  type: "array",
                  uniqueItems: true,
                  items: {
                    type: "string",
                    enum: ["*", "nav"],
                  },
                },
              },
            ],
            responses: {
              200: {
                description: "Retrieved entities",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      title: "Collection of thing",
                      properties: {
                        "@count": {
                          $ref: "#/components/schemas/count",
                        },
                        value: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/this.thing",
                          },
                        },
                      },
                    },
                  },
                },
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
          post: {},
        },
        "/things({key})": {
          get: {},
          patch: {},
          delete: {},
        },
        "/things({key})/nav": {
          get: {},
          patch: {},
        },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/things"].get,
      expected.paths["/things"].get,
      "GET things",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.thing"].properties.one,
      { type: "string", default: "def" },
      "Property with default value",
    );
  });

  it("ExpandRestrictions", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        root: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: { $Type: "Edm.Int32" },
          one: {},
          two: {},
          nav: {
            $Type: "this.child",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
          no_expand: {
            $Type: "this.child",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        child: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          one: {},
          two: {},
          nav: {
            $Type: "this.grandchild",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
          no_expand: {
            $Type: "this.grandchild",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        grandchild: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        Container: {
          roots: {
            $Type: "this.root",
            $Collection: true,
            "@Capabilities.ExpandRestrictions": {
              "@Core.Description": "Expanding has some restrictions here.",
              NonExpandableProperties: [
                "no_expand",
                "nav/no_expand",
                "no_expand/no_expand",
              ],
            },
          },
        },
      },
    };
    const expectedExpands = {
      "/roots": ["*", "nav"],
      "/roots({key})": ["*", "nav"],
      "/roots({key})/nav": ["*", "nav"],
      "/roots({key})/no_expand": ["*", "nav"],
    };

    const actual = csdl2openapi(csdl, {});

    const actualExpands = {};
    for (const [path, item] of Object.entries(actual.paths)) {
      const expand =
        item.get &&
        item.get.parameters &&
        item.get.parameters.find((param) => param.name === "expand");
      if (expand) {
        actualExpands[path] = expand.schema.items.enum;
      }
    }
    assert.deepStrictEqual(actualExpands, expectedExpands, "expands");
    assert.strictEqual(
      actual.paths["/roots"].get.parameters.find(
        (item) => item.name == "expand",
      ).description,
      "Expanding has some restrictions here.",
      "expand description",
    );
  });

  it("Default Namespace", function () {
    const csdl = {
      $Version: "4.01",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        "@Core.DefaultNamespace": true,
        root: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
        },
        act: [
          {
            $Kind: "Action",
            $Parameter: [{ $Name: "in", $Type: "this.root" }],
            $ReturnType: { $Type: "this.root" },
          },
          {
            $Kind: "Action",
            $IsBound: true,
            $Parameter: [{ $Name: "in", $Type: "this.root" }],
          },
          {
            $Kind: "Action",
            $IsBound: true,
            $Parameter: [
              { $Name: "in", $Type: "this.root", $Collection: true },
              { $Name: "other" },
            ],
          },
        ],
        func: [
          {
            $Kind: "Function",
            $IsBound: true,
            $Parameter: [{ $Name: "in", $Type: "this.root" }],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $IsBound: true,
            $Parameter: [
              { $Name: "in", $Type: "this.root", $Collection: true },
            ],
            $ReturnType: {},
          },
        ],
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          roots: {
            $Type: "this.root",
            $Collection: true,
          },
          act: { $Action: "this.act" },
        },
        $Annotations: {
          "this.act": {
            "@Core.Description":
              "Annotations targeting all overloads are currently ignored",
          },
          "this.act(Collection(this.root))": {
            "@Core.Description": "Act!",
          },
        },
      },
    };

    const expected = {
      paths: {
        "/$batch": { post: {} },
        "/act": { post: {} },
        "/roots": { get: {}, post: {} },
        "/roots/act": {
          post: {
            summary: "Act!",
            tags: ["roots"],
            requestBody: {
              description: "Action parameters",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { other: { type: "string" } },
                  },
                },
              },
            },
            responses: {
              204: {
                description: "Success",
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
        },
        "/roots/func": { get: {} },
        "/roots/{key}": { get: {}, patch: {}, delete: {} },
        "/roots/{key}/act": { post: {} },
        "/roots/{key}/func": { get: {} },
      },
    };

    const messages = [];
    const actual = csdl2openapi(csdl, { diagram: true, messages });

    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/roots/act"].post,
      expected.paths["/roots/act"].post,
      "POST /roots/act",
    );
    assert.deepStrictEqual(
      actual.info.description.split("\n"),
      [
        "This service is located at [https://localhost/service-root/](https://localhost/service-root/)",
        "",
        "## Entity Data Model",
        "![ER Diagram](https://yuml.me/diagram/class/[root{bg:lightslategray}],[act{bg:lawngreen}]->[root],[act]in->[root],[roots%20{bg:lawngreen}]++-*>[root])",
        "",
        "### Legend",
        "![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type{bg:whitesmoke}],[ComplexType],[EntityType{bg:lightslategray}],[EntitySet/Singleton/Operation{bg:lawngreen}])",
      ],
      "diagram",
    );
    assert.deepStrictEqual(
      messages,
      ["Ignoring annotations targeting all overloads of 'this.act'"],
      "messages",
    );
  });

  it("Deep update on container level", function () {
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
        root: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          one: {},
          two: {},
          children: {
            $Type: "this.child",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
            $Collection: true,
          },
        },
        child: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          one: {},
          two: {},
          nav: {
            $Type: "this.grandchild",
            $Kind: "NavigationProperty",
            $ContainsTarget: true,
          },
        },
        grandchild: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          one: {},
          two: {},
        },
        Container: {
          "@Capabilities.KeyAsSegmentSupported": true,
          "@Capabilities.DeepUpdateSupport": { Supported: true },
          roots: {
            $Type: "this.root",
            $Collection: true,
          },
        },
      },
    };

    const expected = {
      paths: {
        "/$batch": { post: {} },
        "/roots": { get: {}, post: {} },
        "/roots/{key}": { get: {}, patch: {}, delete: {} },
        "/roots/{key}/children": { get: {}, post: {} },
        "/roots/{key}/children/{key_1}": { get: {}, patch: {}, delete: {} },
        "/roots/{key}/children/{key_1}/nav": { get: {}, patch: {} },
      },
      components: {
        schemas: {
          "this.root-update": {
            type: "object",
            title: "root (for update)",
            properties: {
              one: { type: "string" },
              two: { type: "string" },
              children: {
                type: "array",
                items: { $ref: "#/components/schemas/this.child-create" },
              },
            },
          },
          "this.child-update": {
            type: "object",
            title: "child (for update)",
            properties: {
              one: { type: "string" },
              two: { type: "string" },
              nav: { $ref: "#/components/schemas/this.grandchild-create" },
            },
          },
        },
      },
    };

    const actual = csdl2openapi(csdl, {});

    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.root-update"],
      expected.components.schemas["this.root-update"],
      "root update structure",
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.child-update"],
      expected.components.schemas["this.child-update"],
      "child update structure",
    );
  });

  it("Unknown authorization type", function () {
    const csdl = {
      $Version: "4.0",
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Authorization.V1", $Alias: "Auth" },
          ],
        },
      },
      "auth.example": {
        $Alias: "self",
        Person: {
          $Kind: "EntityType",
          $Key: ["ID"],
          ID: {},
          Name: {
            $Nullable: true,
          },
        },
        Container: {
          $Kind: "EntityContainer",
          People: {
            $Collection: true,
            $Type: "self.Person",
          },
          "@Auth.Authorizations": [
            {
              "@odata.type": "foo",
              Name: "should-be-ignored",
              Description: "Unknown Authentication Scheme",
              KeyName: "x-api-key",
              Location: "Header",
            },
            {
              "@odata.type":
                "https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Authorization.V1.xml#Auth.ApiKey",
              Name: "api_key",
              Description: "Authentication via API key",
              KeyName: "x-api-key",
              Location: "Header",
            },
          ],
        },
      },
      $EntityContainer: "auth.example.Container",
    };

    const messages = [];
    const actual = csdl2openapi(csdl, { messages });

    assert.deepStrictEqual(
      actual.components.securitySchemes,
      {
        api_key: {
          description: "Authentication via API key",
          type: "apiKey",
          name: "x-api-key",
          in: "header",
        },
      },
      "security schemes",
    );
    assert.deepStrictEqual(
      messages,
      ["Unknown Authorization type foo"],
      "messages",
    );
  });

  it("various types and fishy annotations", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [{ $Namespace: "Org.OData.Core.V1", $Alias: "Core" }],
        },
      },
      $EntityContainer: "typeExamples.Container",
      typeExamples: {
        Container: {
          set: { $Type: "typeExamples.single", $Collection: true },
          unknown: { $Kind: "unknown" },
        },
        single: {
          $Kind: "EntityType",
          withMaxLength: {
            $Type: "typeExamples.typeDefinitionNew",
            $MaxLength: 10,
          },
          binary: { $Type: "Edm.Binary", $MaxLength: 42 },
          decfloat34: {
            $Type: "Edm.Decimal",
            $Precision: 34,
            $Scale: "floating",
          },
          enum: { $Type: "typeExamples.enumType" },
          primitive: { $Type: "Edm.PrimitiveType" },
          annotationPath: { $Type: "Edm.AnnotationPath" },
          modelElementPath: { $Type: "Edm.ModelElementPath" },
          navigationPropertyPath: { $Type: "Edm.NavigationPropertyPath" },
          propertyPath: { $Type: "Edm.PropertyPath" },
          sbyte: { $Type: "Edm.SByte" },
          time: { $Type: "Edm.TimeOfDay" },
          timestamp: { $Type: "Edm.DateTimeOffset", $Precision: 7 },
          kaputt: { $Type: "Edm.kaputt" },
          unknown: { $Type: "typeExamples.un-known" },
          "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {}, // non-standard property name, silently accept it
        },
        typeDefinitionNew: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.String",
        },
        enumType: {
          $Kind: "EnumType",
          zero: 0,
          one: 1,
        },
        $Annotations: {
          "typeExamples.single/foo/bar": {
            /* more than two target path segments */
          },
          "typeExamples.single/foo": {
            /* invalid annotation target */
          },
          "typeExamples.not-there": {
            /* invalid annotation target */
          },
          "typeExamples.enumType": {
            "@Core.LongDescription": "description of enumeration type",
          },
          "typeExamples.enumType/zero": {
            "@Core.LongDescription":
              "description of enumeration type member has no effect",
          },
          "typeExamples.enumType/one": {
            "@Core.LongDescription":
              "description of enumeration type member has no effect",
          },
        },
      },
    };

    const messages = [];
    const openapi = csdl2openapi(csdl, { messages });

    assert.deepStrictEqual(
      openapi.components.schemas["typeExamples.single"].properties,
      {
        withMaxLength: {
          maxLength: 10,
          allOf: [
            { $ref: "#/components/schemas/typeExamples.typeDefinitionNew" },
          ],
        },
        binary: { format: "base64url", type: "string", maxLength: 56 },
        decfloat34: {
          anyOf: [{ type: "number" }, { type: "string" }],
          example: "9.9e6144",
          format: "decimal128",
        },
        enum: {
          $ref: "#/components/schemas/typeExamples.enumType",
        },
        primitive: {
          anyOf: [{ type: "boolean" }, { type: "number" }, { type: "string" }],
        },
        annotationPath: { type: "string" },
        modelElementPath: { type: "string" },
        navigationPropertyPath: { type: "string" },
        propertyPath: { type: "string" },
        sbyte: { type: "integer", format: "int8" },
        time: { type: "string", format: "time", example: "15:51:04" },
        timestamp: {
          type: "string",
          format: "date-time",
          example: "2017-04-13T15:51:04.0000000Z",
        },
        kaputt: {},
        unknown: {
          $ref: "#/components/schemas/typeExamples.un-known",
        },
        "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
          type: "string",
        },
      },
      "MaxLength",
    );
    assert.equal(
      openapi.components.schemas["typeExamples.enumType"].description,
      "description of enumeration type",
    );
    assert.deepStrictEqual(
      messages,
      [
        "More than two annotation target path segments",
        "Invalid annotation target 'typeExamples.single/foo'",
        "Invalid annotation target 'typeExamples.not-there'",
        'Unknown type for element: ["unknown",{"$Type":"typeExamples.un-known"}]',
        "Unrecognized entity container child: unknown",
        "Unknown type: Edm.kaputt",
        "Unknown type: Edm.kaputt",
      ],
      "messages",
    );
  });

  it("IncludeAnnotations is silently ignored", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $IncludeAnnotations: [{ $Namespace: "foo.bar" }],
        },
      },
    };
    const expected = {
      openapi: "3.0.2",
      info: {
        title: "OData CSDL document",
        description: "",
        version: "",
      },
      paths: {},
      components: { schemas: {} },
    };
    const openapi = csdl2openapi(csdl, { diagram: true });
    assert.deepStrictEqual(openapi, expected, "Empty CSDL document");
  });

  it("AllowedValues on various Edm types", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Validation.V1", $Alias: "Validation" },
          ],
        },
      },
      $EntityContainer: "typeExamples.Container",
      typeExamples: {
        Container: {
          sing: { $Type: "typeExamples.single" },
        },
        single: {
          $Kind: "EntityType",
          string: {},
          int32: { $Type: "Edm.Int32" },
          decfloat34: {
            $Type: "Edm.Decimal",
            $Precision: 34,
            $Scale: "floating",
          },
          primitive: { $Type: "Edm.PrimitiveType" },
          time: { $Type: "Edm.TimeOfDay" },
        },
        typeDefinition: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.String",
        },
        $Annotations: {
          "typeExamples.single/string": {
            "@Validation.AllowedValues": [{ Value: "one" }, { Value: "two" }],
          },
          "typeExamples.single/int32": {
            "@Validation.AllowedValues": [{ Value: 1 }, { Value: 2 }],
          },
          "typeExamples.single/decfloat34": {
            "@Validation.AllowedValues": [{ Value: 10 }, { Value: 20 }],
          },
          "typeExamples.single/primitive": {
            "@Validation.AllowedValues": [
              { Value: true },
              { Value: 1 },
              { Value: "yes" },
            ],
          },
          "typeExamples.single/time": {
            "@Validation.AllowedValues": [
              { Value: "10:00:00" },
              { Value: "20:00:00" },
            ],
          },
        },
      },
    };

    const messages = [];
    const openapi = csdl2openapi(csdl, { messages });

    assert.deepStrictEqual(
      openapi.components.schemas["typeExamples.single"].properties,
      {
        string: { type: "string", enum: ["one", "two"] },
        int32: { format: "int32", type: "integer", enum: [1, 2] },
        decfloat34: {
          anyOf: [{ type: "number" }, { type: "string" }],
          example: "9.9e6144",
          format: "decimal128",
          enum: [10, 20],
        },
        primitive: {
          anyOf: [{ type: "boolean" }, { type: "number" }, { type: "string" }],
          enum: [true, 1, "yes"],
        },
        time: {
          type: "string",
          format: "time",
          example: "15:51:04",
          enum: ["10:00:00", "20:00:00"],
        },
      },
      "Properties",
    );

    assert.deepStrictEqual(messages, [], "messages");
  });
});
