const assert = require("assert");

//TODO:
// title/description on action/function (import), with fallback from import to action/function
// title/description on action/function return type
// title/description on path parameters for keys
// title/description on entity types for POST and PATCH request bodies
// tags: Core.Description on entity type as fallback for description on entity set/singleton
// Nullable on action/function return type
// reference undefined type: silent for included schema, warning for local schema
// key-aliases: one and more segments
// navigation properties inherited from base type A.n1 -> B.n2 -> C.n3
// collection-navigation to entity type without key or unknown entity type: suppress path item with key segment
// remaining Edm types, especially Geo* - see odata-definitions.json
// (external) annotations on actions, functions, parameters, return types
// control mapping of reference URLs

const { csdl2openapi } = require("odata-openapi");

describe("Edge cases", function () {
  it("empty input", function () {
    const csdl = {};
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

  it("don't modify input", function () {
    const csdl = {
      $Version: "4.0",
      $EntityContainer: "Model.Service",
      Model: {
        Foo: {
          $Kind: "EntityType",
          $OpenType: true,
          $Key: ["is"],
          is: {},
        },
        Service: {
          $Kind: "EntityContainer",
          foos: {
            $Collection: true,
            $Type: "Model.Foo",
          },
          foo: {
            $Type: "Model.Foo",
          },
        },
        //TODO: do not modify CSDL input
        // $Annotations: {
        //   "Model.Service/foos": {
        //     "@Org.OData.Vocabularies.V1.Core.Description": "my foos",
        //   },
        // },
      },
    };
    csdl2openapi(csdl, {});
    assert.deepStrictEqual(
      csdl.Model.Service,
      {
        $Kind: "EntityContainer",
        foo: { $Type: "Model.Foo" },
        foos: { $Type: "Model.Foo", $Collection: true },
      },
      "Entity container of CSDL input"
    );
  });

  it("omit unused types", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [{ $Namespace: "Org.OData.Core.V1", $Alias: "Core" }],
        },
      },
      ReuseTypes: {
        entityType: {
          "@Core.Description": "Core.Description",
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          val: { $Type: "ReuseTypes.typeDefinition" },
        },
        typeDefinition: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.DateTimeOffset",
        },
        typeDefinition3: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.DateTimeOffset",
          $Precision: 3,
        },
      },
    };
    const expected = {
      openapi: "3.0.0",
      info: {
        title: "OData CSDL document",
        description: "",
        version: "",
      },
      paths: {},
      components: {
        schemas: {},
      },
    };
    const openapi = csdl2openapi(csdl, { openapiVersion: "3.0.0" });
    assert.deepStrictEqual(openapi, expected, "Empty CSDL document");
  });

  it("omit unused types with cyclic references", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [{ $Namespace: "Org.OData.Core.V1", $Alias: "Core" }],
        },
      },
      ReuseTypes: {
        entityType: {
          "@Core.Description": "Core.Description",
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: { $Kind: "NavigationProperty", $Type: "ReuseTypes.otherType" },
        },
        otherType: {
          "@Core.Description": "Core.Description",
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: { $Kind: "NavigationProperty", $Type: "ReuseTypes.entityType" },
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
      components: {
        schemas: {},
      },
    };
    const openapi = csdl2openapi(csdl, {});
    assert.deepStrictEqual(openapi, expected, "Empty CSDL document");
  });

  it("external reference", function () {
    const csdl = {
      $Reference: {
        "dummy.xml": {
          $Include: [{ $Namespace: "external" }],
        },
      },
      $EntityContainer: "this.container",
      this: {
        container: {
          sing: { $Type: "this.entityType" },
        },
        entityType: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: { $Kind: "NavigationProperty", $Type: "external.otherType" },
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
      paths: { "/$batch": {}, "/sing": {}, "/sing/nav": {} },
      components: {
        schemas: {
          "this.entityType": {
            title: "entityType",
            type: "object",
            properties: {
              key: { type: "string" },
              nav: {
                $ref: "dummy.openapi3.json#/components/schemas/external.otherType",
              },
            },
          },
        },
      },
    };
    const actual = csdl2openapi(csdl, { diagram: true });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      actual.components.schemas["this.entityType"],
      expected.components.schemas["this.entityType"],
      "entityType schema"
    );
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
      "Operations"
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
  });

  it("circular reference on collect primitive paths", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $IncludeAnnotations: [{ $Namespace: "foo.bar" }],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        source: {
          $Kind: "EntityType",
          $Key: ["s_id"],
          s_id: {},
          complex1: { $Type: "this.complex1" },
          complex2: { $Type: "this.complex2" },
        },
        complex1: {
          $Kind: "ComplexType",
          beforeComplex2: {},
          complex2: { $Type: "this.complex2" },
          afterComplex2: {},
        },
        complex2: {
          $Kind: "ComplexType",
          beforeComplex1: {},
          complex1: { $Type: "this.complex1" },
          afterComplex1: {},
        },
        Container: {
          sources: { $Type: "this.source", $Collection: true },
        },
      },
    };

    const expected_sources_get_param = {
      description:
        "Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)",
      explode: false,
      in: "query",
      name: "orderby",
      schema: {
        items: {
          enum: [
            "s_id",
            "s_id desc",
            "complex1/beforeComplex2",
            "complex1/beforeComplex2 desc",
            "complex1/complex2/beforeComplex1",
            "complex1/complex2/beforeComplex1 desc",
            "complex1/complex2/afterComplex1",
            "complex1/complex2/afterComplex1 desc",
            "complex1/afterComplex2",
            "complex1/afterComplex2 desc",
            "complex2/beforeComplex1",
            "complex2/beforeComplex1 desc",
            "complex2/complex1/beforeComplex2",
            "complex2/complex1/beforeComplex2 desc",
            "complex2/complex1/afterComplex2",
            "complex2/complex1/afterComplex2 desc",
            "complex2/afterComplex1",
            "complex2/afterComplex1 desc",
          ],
          type: "string",
        },
        type: "array",
        uniqueItems: true,
      },
    };
    const messages = [];

    const openapi = csdl2openapi(csdl, { messages });

    assert.deepStrictEqual(
      openapi.paths["/sources"].get.parameters[4],
      expected_sources_get_param
    );
    assert.deepStrictEqual(
      messages,
      [
        "Cycle detected this.complex1->this.complex2->this.complex1",
        "Cycle detected this.complex2->this.complex1->this.complex2",
      ],
      "messages"
    );
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
      "JSON property old-style"
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
      "JSON property new-style"
    );
    assert.deepStrictEqual(
      openapi.components.schemas["jsonExamples.single"].properties.stream2,
      {
        maxLength: 10,
        allOf: [
          { $ref: "#/components/schemas/jsonExamples.typeDefinitionNew" },
        ],
      },
      "MaxLength"
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
      "stream parameters of function"
    );
    assert.deepStrictEqual(
      openapi.paths["/f(first=@first,second=@second)"].get.responses[200]
        .content["application/json"],
      { schema: { type: "array" } },
      "stream return type of function"
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
      "JSON property old-style"
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
      "JSON property new-style"
    );
  });

  it("no key", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        NoKey: { $Kind: "EntityType" },
        Container: { Set: { $Collection: true, $Type: "this.NoKey" } },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
  });

  it("base type not found", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        Derived: { $Kind: "EntityType", $BaseType: "this.Base" },
        Container: { Set: { $Collection: true, $Type: "this.Derived" } },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
  });

  it("no inherited key", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        Base: { $Kind: "EntityType" },
        Derived: { $Kind: "EntityType", $BaseType: "this.Base" },
        Container: { Set: { $Collection: true, $Type: "this.Derived" } },
      },
    };
    const expected = {
      paths: {
        "/Set": { get: {}, post: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
  });

  it("inherited key, BatchSupport/Supported:false", function () {
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
        Base: { $Kind: "EntityType", $Key: ["key"], key: {} },
        Derived: { $Kind: "EntityType", $BaseType: "this.Base" },
        Container: {
          "@Capabilities.BatchSupport": { Supported: false },
          Set: { $Collection: true, $Type: "this.Derived" },
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
      "Operations"
    );
  });

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
      "Operations"
    );
    assert.strictEqual(
      actual.paths["/$batch"].post.summary,
      "BatchSupport - Description",
      "Batch summary"
    );
    assert.strictEqual(
      actual.paths["/$batch"].post.description,
      'BatchSupport - LongDescription\n\n*Please note that "Try it out" is not supported for this request.*',
      "Batch description"
    );
  });

  it("function without parameters", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        $Annotations: {
          "this.NoParameters()": {
            "@Org.OData.Core.V1.Description": "no parameters",
          },
        },
        NoParameters: [
          {
            $Kind: "Function",
            $ReturnType: {},
          },
        ],
        Container: { fun: { $Function: "this.NoParameters" } },
      },
    };
    const expected = {
      paths: {
        "/fun()": { get: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.equal(
      actual.paths["/fun()"].get.summary,
      "no parameters",
      "function summary"
    );
  });

  it("function with nullable and not nullable parameters", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Validation.V1", $Alias: "Validation" },
          ],
        },
      },
      $EntityContainer: "this.Container",
      this: {
        typedef: { $Kind: "TypeDefinition", $UnderlyingType: "Edm.String" },
        func: [
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "string",
                "@Validation.Pattern": "^red|green$",
              },
              {
                $Name: "stringNull",
                $Nullable: true,
                "@Core.LongDescription": "Nullable string",
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "typedef",
                $Type: "this.typedef",
                "@Validation.Pattern": "^red|green$",
              },
              {
                $Name: "typedefNull",
                $Type: "this.typedef",
                $Nullable: true,
                "@Core.LongDescription": "Nullable string",
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "guid",
                $Type: "Edm.Guid",
              },
              {
                $Name: "guidNull",
                $Type: "Edm.Guid",
                $Nullable: true,
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "int32",
                $Type: "Edm.Int32",
              },
              {
                $Name: "int32Null",
                $Type: "Edm.Int32",
                $Nullable: true,
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "binary",
                $Type: "Edm.Binary",
              },
              {
                $Name: "binaryNull",
                $Type: "Edm.Binary",
                $Nullable: true,
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "boolean",
                $Type: "Edm.Boolean",
              },
              {
                $Name: "booleanNull",
                $Type: "Edm.Boolean",
                $Nullable: true,
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "decimal",
                $Type: "Edm.Decimal",
              },
              {
                $Name: "decimalNull",
                $Type: "Edm.Decimal",
                $Nullable: true,
              },
            ],
            $ReturnType: {},
          },
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "duration",
                $Type: "Edm.Duration",
              },
              {
                $Name: "durationNull",
                $Type: "Edm.Duration",
                $Nullable: true,
              },
            ],
            $ReturnType: {},
          },
        ],
        Container: { fun: { $Function: "this.func" } },
      },
    };
    const expected = {
      paths: {
        "/fun(string={string},stringNull={stringNull})": { get: {} },
        "/fun(typedef={typedef},typedefNull={typedefNull})": { get: {} },
        "/fun(guid={guid},guidNull={guidNull})": { get: {} },
        "/fun(int32={int32},int32Null={int32Null})": { get: {} },
        "/fun(binary={binary},binaryNull={binaryNull})": { get: {} },
        "/fun(boolean={boolean},booleanNull={booleanNull})": { get: {} },
        "/fun(decimal={decimal},decimalNull={decimalNull})": { get: {} },
        "/fun(duration={duration},durationNull={durationNull})": { get: {} },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(string={string},stringNull={stringNull})"].get
        .parameters,
      [
        {
          in: "path",
          name: "string",
          description: "String value needs to be enclosed in single quotes",
          required: true,
          schema: { type: "string", pattern: "^'(red|green)'$" },
        },
        {
          in: "path",
          name: "stringNull",
          required: true,
          description:
            "Nullable string  \nString value needs to be enclosed in single quotes",
          schema: {
            type: "string",
            nullable: true,
            default: "null",
            pattern: "^(null|'([^']|'')*')$",
          },
        },
      ],
      "String function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(typedef={typedef},typedefNull={typedefNull})"].get
        .parameters,
      [
        {
          in: "path",
          name: "typedef",
          description: "String value needs to be enclosed in single quotes",
          required: true,
          schema: {
            $ref: "#/components/schemas/this.typedef",
          },
        },
        {
          in: "path",
          name: "typedefNull",
          required: true,
          description:
            "Nullable string  \nString value needs to be enclosed in single quotes",
          schema: {
            allOf: [{ $ref: "#/components/schemas/this.typedef" }],
            nullable: true,
            default: "null",
          },
        },
      ],
      "TypeDefinition function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(guid={guid},guidNull={guidNull})"].get.parameters,
      [
        {
          in: "path",
          name: "guid",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
            example: "01234567-89ab-cdef-0123-456789abcdef",
          },
        },
        {
          in: "path",
          name: "guidNull",
          required: true,
          schema: {
            type: "string",
            format: "uuid,null",
            nullable: true,
            default: "null",
            example: "01234567-89ab-cdef-0123-456789abcdef",
          },
        },
      ],
      "Guid function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(int32={int32},int32Null={int32Null})"].get.parameters,
      [
        {
          in: "path",
          name: "int32",
          required: true,
          schema: {
            type: "integer",
            format: "int32",
          },
        },
        {
          in: "path",
          name: "int32Null",
          required: true,
          schema: {
            type: "string",
            format: "int32,null",
            nullable: true,
            default: "null",
          },
        },
      ],
      "Int32 function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(binary={binary},binaryNull={binaryNull})"].get
        .parameters,
      [
        {
          in: "path",
          name: "binary",
          required: true,
          schema: {
            type: "string",
            format: "base64url",
          },
        },
        {
          in: "path",
          name: "binaryNull",
          required: true,
          schema: {
            type: "string",
            format: "base64url,null",
            nullable: true,
            default: "null",
          },
        },
      ],
      "Binary function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(boolean={boolean},booleanNull={booleanNull})"].get
        .parameters,
      [
        {
          in: "path",
          name: "boolean",
          required: true,
          schema: {
            type: "boolean",
          },
        },
        {
          in: "path",
          name: "booleanNull",
          required: true,
          schema: {
            type: "string",
            nullable: true,
            default: "null",
          },
        },
      ],
      "Binary function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(decimal={decimal},decimalNull={decimalNull})"].get
        .parameters,
      [
        {
          in: "path",
          name: "decimal",
          required: true,
          schema: {
            anyOf: [{ type: "number" }, { type: "string" }],
            format: "decimal",
            example: 0,
          },
        },
        {
          in: "path",
          name: "decimalNull",
          required: true,
          schema: {
            anyOf: [{ type: "number" }, { type: "string" }],
            format: "decimal,null",
            nullable: true,
            default: "null",
            example: 0,
          },
        },
      ],
      "Decimal function parameters"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(duration={duration},durationNull={durationNull})"].get
        .parameters,
      [
        {
          in: "path",
          name: "duration",
          required: true,
          schema: {
            type: "string",
            format: "duration",
            example: "'P4DT15H51M04S'",
          },
        },
        {
          in: "path",
          name: "durationNull",
          required: true,
          schema: {
            type: "string",
            format: "duration,null",
            nullable: true,
            default: "null",
            example: "'P4DT15H51M04S'",
          },
        },
      ],
      "Duration function parameters"
    );
  });

  it("function with complex and optional collection parameter", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [{ $Namespace: "Org.OData.Core.V1", $Alias: "Core" }],
        },
      },
      $EntityContainer: "model.Container",
      model: {
        $Alias: "this",
        $Annotations: {
          "this.ComplexParameters(this.Complex,Collection(Edm.String))": {
            "@Core.Description": "foo",
          },
        },
        Complex: { $Kind: "ComplexType", $OpenType: true },
        ComplexParameters: [
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "complex",
                $Type: "this.Complex",
                "@Core.Description": "param description",
              },
              {
                $Name: "collection",
                $Collection: true,
              },
            ],
            $ReturnType: {},
          },
        ],
        OptionalParameter: [
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "complex",
                $Type: "this.Complex",
                "@Core.OptionalParameter": {},
              },
            ],
            $ReturnType: {},
          },
        ],
        Container: {
          funC: { $Function: "this.ComplexParameters" },
          funO: { $Function: "this.OptionalParameter" },
        },
      },
    };
    const expected = {
      paths: {
        "/funO": {
          get: {
            parameters: [
              {
                name: "complex",
                in: "query",
                required: false,
                schema: { type: "string" },
                example: "{}",
                description:
                  "This is URL-encoded JSON of type model.Complex, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
              },
            ],
          },
        },
        "/$batch": { post: {} },
      },
    };
    const path = "/funC(complex=@complex,collection=@collection)";
    expected.paths[path] = {
      get: {
        parameters: [
          {
            name: "@complex",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "{}",
            description:
              "param description  \nThis is URL-encoded JSON of type model.Complex, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
          },
          {
            name: "@collection",
            in: "query",
            required: true,
            schema: { type: "string" },
            example: "[]",
            description:
              "This is a URL-encoded JSON array with items of type Edm.String, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
          },
        ],
      },
    };
    const actual = csdl2openapi(csdl, { diagram: true });
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths[path].get.parameters,
      expected.paths[path].get.parameters,
      "complex function parameters"
    );
    assert.equal(
      actual.paths[path].get.summary,
      "foo",
      "complex function summary"
    );
    assert.deepStrictEqual(
      actual.paths["/funO"].get.parameters,
      expected.paths["/funO"].get.parameters,
      "optional function parameters"
    );
    assert.deepStrictEqual(
      actual.info.description.split("\n"),
      [
        "This service is located at [https://localhost/service-root/](https://localhost/service-root/)",
        "",
        "## Entity Data Model",
        "![ER Diagram](https://yuml.me/diagram/class/[Complex],[funO{bg:lawngreen}],[funO{bg:lawngreen}]in->[Complex],[funC{bg:lawngreen}],[funC{bg:lawngreen}]in->[Complex])",
        "",
        "### Legend",
        "![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type{bg:whitesmoke}],[ComplexType],[EntityType{bg:lightslategray}],[EntitySet/Singleton/Operation{bg:lawngreen}])",
      ],
      "diagram"
    );
  });

  it("return type with facets", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        fun: [
          { $Kind: "Function", $ReturnType: { $MaxLength: 20 } },
          {
            $Kind: "Function",
            $Parameter: [{ $Name: "in" }],
            $ReturnType: { $Collection: true, $MaxLength: 20 },
          },
        ],
        Container: { fun: { $Function: "this.fun" } },
      },
    };
    const expected = {
      paths: {
        "/fun()": {
          get: {
            responses: {
              200: {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      type: "string",
                      maxLength: 20,
                    },
                  },
                },
              },
            },
          },
        },
        "/fun(in={in})": {
          get: {
            responses: {
              200: {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      title: "Collection of String",
                      properties: {
                        "@odata.count": {
                          $ref: "#/components/schemas/count",
                        },
                        value: {
                          type: "array",
                          items: {
                            type: "string",
                            maxLength: 20,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/fun()"].get.responses[200],
      expected.paths["/fun()"].get.responses[200],
      "fun"
    );
    assert.deepStrictEqual(
      actual.paths["/fun(in={in})"].get.responses[200],
      expected.paths["/fun(in={in})"].get.responses[200],
      "fun(in)"
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
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/Set"].get.responses[200].content["application/json"].schema
        .properties,
      expectedGetResponseProperties,
      "get list with delta"
    );
  });

  it("entity set and singleton with non-existing type", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        Container: {
          stuff: { $Type: "self.type_does_not_exist", $Collection: true },
          single: { $Type: "self.type_does_not_exist" },
        },
      },
    };
    const expected = {
      paths: {
        "/stuff": {
          get: {
            summary: "Get entities from stuff",
            tags: ["stuff"],
            parameters: [
              { $ref: "#/components/parameters/top" },
              { $ref: "#/components/parameters/skip" },
              {
                in: "query",
                name: "filter",
                schema: { type: "string" },
                description:
                  "Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)",
              },
              { $ref: "#/components/parameters/count" },
            ],
            responses: {
              200: {
                description: "Retrieved entities",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      title: "Collection of type_does_not_exist",
                      properties: {
                        "@odata.count": {
                          $ref: "#/components/schemas/count",
                        },
                        value: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/undefined.type_does_not_exist",
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
          post: {
            summary: "Add new entity to stuff",
            tags: ["stuff"],
            requestBody: {
              description: "New entity",
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/undefined.type_does_not_exist-create",
                  },
                },
              },
            },
            responses: {
              201: {
                description: "Created entity",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/undefined.type_does_not_exist",
                    },
                  },
                },
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
        },
        "/single": {
          get: {
            summary: "Get single",
            tags: ["single"],
            parameters: [],
            responses: {
              200: {
                description: "Retrieved entity",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/undefined.type_does_not_exist",
                    },
                  },
                },
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
          patch: {
            summary: "Update single",
            tags: ["single"],
            requestBody: {
              description: "New property values",
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/undefined.type_does_not_exist-update",
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
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/stuff"].get,
      expected.paths["/stuff"].get,
      "GET set"
    );
    assert.deepStrictEqual(
      actual.paths["/stuff"].post,
      expected.paths["/stuff"].post,
      "POST set"
    );
    assert.deepStrictEqual(
      actual.paths["/single"].get,
      expected.paths["/single"].get,
      "GET single"
    );
    assert.deepStrictEqual(
      actual.paths["/single"].patch,
      expected.paths["/single"].patch,
      "PATCH single"
    );
  });

  it("inheritance", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        base: {
          $Kind: "EntityType",
          $Abstract: true,
          baseProp: {},
          baseNav: {
            $Kind: "NavigationProperty",
            $Type: "this.other",
            $ContainsTarget: true,
          },
        },
        derived: {
          $Kind: "EntityType",
          $BaseType: "this.base",
          $Key: ["key"],
          key: { $Type: "Edm.Int32" },
          derivedProp: {},
          derivedNav: { $Kind: "NavigationProperty", $Type: "this.other" },
        },
        Container: {
          set: { $Type: "this.derived", $Collection: true },
        },
      },
    };
    const expected = {
      paths: {
        "/set": {
          get: {
            summary: "Get entities from set",
            tags: ["set"],
            parameters: [
              { $ref: "#/components/parameters/top" },
              { $ref: "#/components/parameters/skip" },
              {
                in: "query",
                name: "filter",
                schema: { type: "string" },
                description:
                  "Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)",
              },
              { $ref: "#/components/parameters/count" },
              {
                in: "query",
                name: "orderby",
                description:
                  "Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)",
                explode: false,
                schema: {
                  type: "array",
                  uniqueItems: true,
                  items: {
                    type: "string",
                    enum: [
                      "baseProp",
                      "baseProp desc",
                      "key",
                      "key desc",
                      "derivedProp",
                      "derivedProp desc",
                    ],
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
                    enum: ["baseProp", "key", "derivedProp"],
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
                    enum: ["*", "baseNav", "derivedNav"],
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
                      title: "Collection of derived",
                      properties: {
                        "@odata.count": {
                          $ref: "#/components/schemas/count",
                        },
                        value: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/this.derived",
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
          post: {
            summary: "Add new entity to set",
            tags: ["set"],
            requestBody: {
              description: "New entity",
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/this.derived",
                  },
                },
              },
            },
            responses: {
              201: {
                description: "Created entity",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/undefined.type_does_not_exist",
                    },
                  },
                },
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
        },
        "/set({key})": {
          get: {},
          patch: {},
          delete: {},
        },
        "/set({key})/baseNav": {
          get: {},
          patch: {},
        },
        "/set({key})/derivedNav": {
          get: {},
        },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/set"].get,
      expected.paths["/set"].get,
      "GET set"
    );
  });

  it("navigation property in complex type", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        source: {
          $Kind: "EntityType",
          $Key: ["s_id"],
          s_id: {},
          complexProp: { $Type: "this.complex", $Collection: true },
        },
        complex: {
          $Kind: "ComplexType",
          primProp: {},
          navProp: {
            $Kind: "NavigationProperty",
            $Type: "this.target",
            $Collection: true,
          },
        },
        target: {
          $Kind: "EntityType",
          $BaseType: "this.base",
          $Key: ["t_id"],
          t_id: {},
        },
        Container: {
          sources: { $Type: "this.source", $Collection: true },
          targets: { $Type: "this.target", $Collection: true },
        },
      },
    };
    const expected = {
      paths: {
        "/sources": {
          get: {
            summary: "Get entities from sources",
            tags: ["sources"],
            parameters: [
              { $ref: "#/components/parameters/top" },
              { $ref: "#/components/parameters/skip" },
              {
                in: "query",
                name: "filter",
                schema: { type: "string" },
                description:
                  "Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)",
              },
              { $ref: "#/components/parameters/count" },
              {
                in: "query",
                name: "orderby",
                description:
                  "Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)",
                explode: false,
                schema: {
                  type: "array",
                  uniqueItems: true,
                  items: {
                    type: "string",
                    enum: [
                      "s_id",
                      "s_id desc",
                      "complexProp/primProp",
                      "complexProp/primProp desc",
                    ],
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
                    enum: ["s_id", "complexProp"],
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
                    enum: ["*", "complexProp/navProp"],
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
                      title: "Collection of source",
                      properties: {
                        "@odata.count": {
                          $ref: "#/components/schemas/count",
                        },
                        value: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/this.source",
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
          post: {
            summary: "Add new entity to set",
            tags: ["set"],
            requestBody: {
              description: "New entity",
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/this.derived",
                  },
                },
              },
            },
            responses: {
              201: {
                description: "Created entity",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/undefined.type_does_not_exist",
                    },
                  },
                },
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
        },
        "/sources('{s_id}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/targets": {
          get: {},
          post: {},
        },
        "/targets('{t_id}')": {
          get: {},
          patch: {},
          delete: {},
        },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/sources"].get,
      expected.paths["/sources"].get,
      "GET sources"
    );
  });

  it("key aliases", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        Category: {
          $Kind: "EntityType",
          $Key: [{ EntityInfoID: "Info/ID" }],
          Info: { $Type: "this.EntityInfo" },
          Name: { $Nullable: true },
        },
        EntityInfo: {
          $Kind: "ComplexType",
          ID: { $Type: "Edm.Int32" },
          Created: { $Type: "Edm.DateTimeOffset" },
        },
        Container: {
          $Kind: "EntityContainer",
          Categories: { $Type: "this.Category", $Collection: true },
        },
      },
    };
    const expected = {
      paths: {
        "/Categories": {
          get: {
            summary: "Get entities from Categories",
            tags: ["Categories"],
            parameters: [
              { $ref: "#/components/parameters/top" },
              { $ref: "#/components/parameters/skip" },
              {
                in: "query",
                name: "filter",
                schema: { type: "string" },
                description:
                  "Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)",
              },
              { $ref: "#/components/parameters/count" },
              {
                in: "query",
                name: "orderby",
                description:
                  "Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)",
                explode: false,
                schema: {
                  type: "array",
                  uniqueItems: true,
                  items: {
                    type: "string",
                    enum: [
                      "Info/ID",
                      "Info/ID desc",
                      "Info/Created",
                      "Info/Created desc",
                      "Name",
                      "Name desc",
                    ],
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
                    enum: ["Info", "Name"],
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
                      title: "Collection of Category",
                      properties: {
                        "@odata.count": {
                          $ref: "#/components/schemas/count",
                        },
                        value: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/this.Category",
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
          post: {
            summary: "Add new entity to set",
            tags: ["set"],
            requestBody: {
              description: "New entity",
              required: true,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/this.derived",
                  },
                },
              },
            },
            responses: {
              201: {
                description: "Created entity",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/undefined.type_does_not_exist",
                    },
                  },
                },
              },
              "4XX": {
                $ref: "#/components/responses/error",
              },
            },
          },
        },
        "/Categories({EntityInfoID})": {
          get: {},
          patch: {},
          delete: {},
        },
        "/$batch": { post: {} },
      },
    };
    const actual = csdl2openapi(csdl, {});
    assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
    assert.deepStrictEqual(
      operations(actual),
      operations(expected),
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/Categories"].get,
      expected.paths["/Categories"].get,
      "GET Categories"
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
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/things"].get,
      expected.paths["/things"].get,
      "GET things"
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.thing"].properties.one,
      { type: "string", default: "def" },
      "Property with default value"
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
        (item) => item.name == "expand"
      ).description,
      "Expanding has some restrictions here.",
      "expand description"
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
      "Operations"
    );
    assert.deepStrictEqual(
      actual.paths["/roots/act"].post,
      expected.paths["/roots/act"].post,
      "POST /roots/act"
    );
    assert.deepStrictEqual(
      actual.info.description.split("\n"),
      [
        "This service is located at [https://localhost/service-root/](https://localhost/service-root/)",
        "",
        "## Entity Data Model",
        "![ER Diagram](https://yuml.me/diagram/class/[root{bg:lightslategray}],[act{bg:lawngreen}]->[root],[act{bg:lawngreen}]in->[root],[roots%20{bg:lawngreen}]++-*>[root])",
        "",
        "### Legend",
        "![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type{bg:whitesmoke}],[ComplexType],[EntityType{bg:lightslategray}],[EntitySet/Singleton/Operation{bg:lawngreen}])",
      ],
      "diagram"
    );
    assert.deepStrictEqual(
      messages,
      ["Ignoring annotations targeting all overloads of 'this.act'"],
      "messages"
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
      "Operations"
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.root-update"],
      expected.components.schemas["this.root-update"],
      "root update structure"
    );
    assert.deepStrictEqual(
      actual.components.schemas["this.child-update"],
      expected.components.schemas["this.child-update"],
      "child update structure"
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
      "security schemes"
    );
    assert.deepStrictEqual(
      messages,
      ["Unknown Authorization type foo"],
      "messages"
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
          "@Core.LongDescription": "an enumeration type",
          $Kind: "EnumType",
          foo: {},
          bar: {},
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
      "MaxLength"
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
      "messages"
    );
  });

  it("OpenAPI 3.1.0", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Validation.V1", $Alias: "Validation" },
          ],
        },
      },
      $EntityContainer: "oas31.Container",
      oas31: {
        Container: {
          sing: { $Type: "oas31.single" },
        },
        single: {
          $Kind: "EntityType",
          binary: { $Type: "Edm.Binary" },
          stream: { $Type: "Edm.Stream" },
          date: { $Type: "Edm.Date" },
          nullableString: { $Nullable: true },
          primitive: { $Type: "Edm.PrimitiveType" },
          ref: { $Type: "oas31.typeDef" },
          refDef: { $Type: "oas31.typeDef", $DefaultValue: 42 },
          refD: { $Type: "oas31.typeDef", "@Core.Description": "D" },
          refEx: { $Type: "oas31.typeDef", "@Core.Example": { Value: 11 } },
          refLD: { $Type: "oas31.typeDef", "@Core.LongDescription": "LD" },
          refMax: { $Type: "oas31.typeDef", "@Validation.Maximum": -5 },
          refMin: { $Type: "oas31.typeDef", "@Validation.Minimum": -5 },
          nullableRef: {
            $Type: "oas31.typeDef",
            $Nullable: true,
          },
          min: {
            $Type: "Edm.Int32",
            "@Validation.Minimum": 1,
          },
          exclusiveMin: {
            $Type: "Edm.Int64",
            "@Validation.Minimum@Validation.Exclusive": true,
            "@Validation.Minimum": 0,
          },
          max: {
            $Type: "Edm.Decimal",
            $Nullable: true,
            "@Validation.Maximum": 42,
          },
          exclusiveMax: {
            $Type: "Edm.Double",
            "@Validation.Maximum@Validation.Exclusive": true,
            "@Validation.Maximum": 42,
          },
        },
        typeDef: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.Int32",
          "@Core.LongDescription": "an integer",
        },
      },
    };

    const properties = {
      binary: { type: "string", contentEncoding: "base64url" },
      stream: { type: "string", contentEncoding: "base64url" },
      date: { type: "string", format: "date", example: "2017-04-13" }, // example is deprecated but still allowed
      nullableString: { type: ["string", "null"] },
      primitive: { type: ["boolean", "number", "string"] },
      ref: { $ref: "#/components/schemas/oas31.typeDef" },
      refDef: {
        allOf: [{ $ref: "#/components/schemas/oas31.typeDef" }],
        default: 42,
      },
      refD: {
        allOf: [{ $ref: "#/components/schemas/oas31.typeDef" }],
        title: "D",
      },
      refLD: {
        allOf: [{ $ref: "#/components/schemas/oas31.typeDef" }],
        description: "LD",
      },
      refEx: {
        allOf: [{ $ref: "#/components/schemas/oas31.typeDef" }],
        example: 11,
      },
      refMax: {
        allOf: [{ $ref: "#/components/schemas/oas31.typeDef" }],
        maximum: -5,
      },
      refMin: {
        allOf: [{ $ref: "#/components/schemas/oas31.typeDef" }],
        minimum: -5,
      },
      nullableRef: {
        anyOf: [
          { $ref: "#/components/schemas/oas31.typeDef" },
          { type: "null" },
        ],
      },
      min: { type: "integer", format: "int32", minimum: 1 },
      exclusiveMin: {
        type: ["integer", "string"],
        format: "int64",
        example: "42",
        exclusiveMinimum: 0,
      },
      max: {
        type: ["number", "string", "null"],
        format: "decimal",
        example: 0,
        maximum: 42,
      },
      exclusiveMax: {
        type: "number",
        format: "double",
        example: 3.14,
        exclusiveMaximum: 42,
      },
    };

    const openapi = csdl2openapi(csdl, { openapiVersion: "3.1.0" });

    assert.equal(openapi.openapi, "3.1.0", "OpenAPI version");
    assert.deepStrictEqual(
      openapi.components.schemas["oas31.single"].properties,
      properties,
      "Schemas"
    );
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
      "Operations"
    );
    assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
  });
});

function paths(openapi) {
  return Object.keys(openapi.paths).sort();
}

function operations(openapi) {
  const p = {};
  Object.keys(openapi.paths).forEach((template) => {
    p[template] = Object.keys(openapi.paths[template]).filter(
      (op) => op != "parameters"
    );
  });
  return p;
}

function schemas(openapi) {
  return Object.keys(openapi.components.schemas)
    .sort()
    .filter((s) => s.includes("."));
}
