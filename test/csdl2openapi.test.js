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

const { paths, operations, schemas } = require("./utilities");

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
      "Entity container of CSDL input",
    );
  });

  it("omit unused types", function () {
    const csdl = {
      ReuseTypes: {
        entityType: {
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
      ReuseTypes: {
        entityType: {
          $Kind: "EntityType",
          $Key: ["key"],
          key: {},
          nav: { $Kind: "NavigationProperty", $Type: "ReuseTypes.otherType" },
        },
        otherType: {
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
      "entityType schema",
    );
  });

  it("circular reference on collect primitive paths", function () {
    const csdl = {
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
      expected_sources_get_param,
    );
    assert.deepStrictEqual(
      messages,
      [
        // "Cycle detected this.complex1->this.complex2->this.complex1",
        // "Cycle detected this.complex2->this.complex1->this.complex2",
      ],
      "messages",
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
      "Operations",
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
      "Operations",
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
      "Operations",
    );
  });

  it("inherited key", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        Base: { $Kind: "EntityType", $Key: ["key"], key: {} },
        Derived: { $Kind: "EntityType", $BaseType: "this.Base" },
        Container: {
          Set: { $Collection: true, $Type: "this.Derived" },
        },
      },
    };
    const expected = {
      paths: {
        "/$batch": { post: {} },
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
      "Operations",
    );
    assert.equal(
      actual.paths["/fun()"].get.summary,
      "no parameters",
      "function summary",
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
      "Operations",
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
      "String function parameters",
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
      "TypeDefinition function parameters",
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
            format: "uuid",
            nullable: true,
            default: "null",
            example: "01234567-89ab-cdef-0123-456789abcdef",
          },
        },
      ],
      "Guid function parameters",
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
            type: "integer",
            format: "int32",
            nullable: true,
            default: "null",
          },
        },
      ],
      "Int32 function parameters",
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
            format: "base64url",
            nullable: true,
            default: "null",
          },
        },
      ],
      "Binary function parameters",
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
            type: "boolean",
            nullable: true,
            default: "null",
          },
        },
      ],
      "Binary function parameters",
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
            format: "decimal",
            nullable: true,
            default: "null",
            example: 0,
          },
        },
      ],
      "Decimal function parameters",
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
            format: "duration",
            nullable: true,
            default: "null",
            example: "'P4DT15H51M04S'",
          },
        },
      ],
      "Duration function parameters",
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
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths[path].get.parameters,
      expected.paths[path].get.parameters,
      "complex function parameters",
    );
    assert.equal(
      actual.paths[path].get.summary,
      "foo",
      "complex function summary",
    );
    assert.deepStrictEqual(
      actual.paths["/funO"].get.parameters,
      expected.paths["/funO"].get.parameters,
      "optional function parameters",
    );
    assert.deepStrictEqual(
      actual.info.description.split("\n"),
      [
        "This service is located at [https://localhost/service-root/](https://localhost/service-root/)",
        "",
        "## Entity Data Model",
        "![ER Diagram](https://yuml.me/diagram/class/[Complex],[funO{bg:lawngreen}],[funO]in->[Complex],[funC{bg:lawngreen}],[funC]in->[Complex])",
        "",
        "### Legend",
        "![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type{bg:whitesmoke}],[ComplexType],[EntityType{bg:lightslategray}],[EntitySet/Singleton/Operation{bg:lawngreen}])",
      ],
      "diagram",
    );
  });

  it("function with @ parameter aliases", function () {
    const csdl = {
      $Version: "4.01",
      $Reference: {
        dummy: {
          $Include: [{ $Namespace: "Org.OData.Core.V1", $Alias: "Core" }],
        },
      },
      $EntityContainer: "model.Container",
      model: {
        $Alias: "this",
        FavoritePhotos: [
          {
            $Kind: "Function",
            $Parameter: [
              {
                $Name: "SKIP",
                $Type: "Edm.Date",
                $Collection: true,
                "@Core.Description": "Dates to be skipped",
              },
              {
                $Name: "filter",
                "@Core.Description": "Boolean expression to filter the result",
              },
            ],
            $ReturnType: {},
          },
        ],
        Container: {
          fav: { $Function: "this.FavoritePhotos" },
        },
      },
    };
    const expected = {
      paths: {
        "/fav": {
          get: {
            parameters: [
              {
                name: "@SKIP",
                in: "query",
                required: true,
                description:
                  "Dates to be skipped  \nThis is a URL-encoded JSON array with items of type Edm.Date, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
                schema: { type: "string" },
                example: "[]",
              },
              {
                name: "@filter",
                in: "query",
                required: true,
                schema: { type: "string", pattern: "^'([^']|'')*'$" },
                description:
                  "Boolean expression to filter the result  \nString value needs to be enclosed in single quotes",
              },
            ],
            summary: "Invoke function FavoritePhotos",
            tags: ["Service Operations"],
          },
        },
      },
    };
    const actual = csdl2openapi(csdl, { diagram: true });
    delete actual.paths["/$batch"];
    delete actual.paths["/fav"].get.responses;
    assert.deepStrictEqual(actual.paths, expected.paths);
  });

  it("return type with facets", function () {
    const csdl = {
      $EntityContainer: "this.Container",
      this: {
        fun: [
          {
            $Kind: "Function",
            $Parameter: [{ $Name: "in" }],
            $ReturnType: { $Collection: true, $MaxLength: 20 },
          },
        ],
        fun2: [{ $Kind: "Function", $ReturnType: { $MaxLength: 20 } }],
        fun3: [{ $Kind: "Function", $ReturnType: { $Type: "this.typedef" } }],
        typedef: {
          $Kind: "TypeDefinition",
          $UnderlyingType: "Edm.String",
          $MaxLength: 15,
        },
        Container: {
          fun: { $Function: "this.fun" },
          fun2: { $Function: "this.fun2" },
          fun3: { $Function: "this.fun3" },
        },
      },
    };
    const expected = {
      paths: {
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
        "/fun2()": {
          get: {
            responses: {
              200: {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { value: { type: "string", maxLength: 20 } },
                    },
                  },
                },
              },
            },
          },
        },
        "/fun3()": {
          get: {
            responses: {
              200: {
                description: "Success",
                content: {
                  "application/json": {
                    schema: {
                      // Note: the "value" wrapper is missing because the generator doesn't recognize/resolve the type definition
                      $ref: "#/components/schemas/this.typedef",
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
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/fun(in={in})"].get.responses[200],
      expected.paths["/fun(in={in})"].get.responses[200],
      "fun",
    );
    assert.deepStrictEqual(
      actual.paths["/fun2()"].get.responses[200],
      expected.paths["/fun2()"].get.responses[200],
      "fun2",
    );
    assert.deepStrictEqual(
      actual.paths["/fun3()"].get.responses[200],
      expected.paths["/fun3()"].get.responses[200],
      "fun3",
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
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/stuff"].get,
      expected.paths["/stuff"].get,
      "GET set",
    );
    assert.deepStrictEqual(
      actual.paths["/stuff"].post,
      expected.paths["/stuff"].post,
      "POST set",
    );
    assert.deepStrictEqual(
      actual.paths["/single"].get,
      expected.paths["/single"].get,
      "GET single",
    );
    assert.deepStrictEqual(
      actual.paths["/single"].patch,
      expected.paths["/single"].patch,
      "PATCH single",
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
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/set"].get,
      expected.paths["/set"].get,
      "GET set",
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
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/sources"].get,
      expected.paths["/sources"].get,
      "GET sources",
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
      "Operations",
    );
    assert.deepStrictEqual(
      actual.paths["/Categories"].get,
      expected.paths["/Categories"].get,
      "GET Categories",
    );
  });

  it("OData V2 Edm.Binary, Edm.DateTime, and Edm.Time", function () {
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
          bin: { $Type: "Edm.Binary" },
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
              bin: { type: "string", format: "byte" },
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

  it("OData V2 Edm.Binary in OpenAPI 3.1.0", function () {
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
          bin: { $Type: "Edm.Binary" },
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
              bin: { type: "string", contentEncoding: "base64" },
            },
          },
        },
      },
    };
    const messages = [];

    const actual = csdl2openapi(csdl, { messages, openapiVersion: "3.1.0" });
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

  it("OpenAPI 3.1.0", function () {
    const csdl = {
      $Reference: {
        dummy: {
          $Include: [
            { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
            { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
            { $Namespace: "Org.OData.Validation.V1", $Alias: "Validation" },
          ],
        },
      },
      $EntityContainer: "oas31.Container",
      oas31: {
        Container: {
          set: {
            $Type: "oas31.single",
            $Collection: true,
            "@Capabilities.ChangeTracking": { Supported: true },
          },
          sing: {
            $Type: "oas31.single",
            "@Capabilities.ChangeTracking": { Supported: true }, // has currently no effect
          },
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
      date: { type: "string", format: "date", examples: ["2017-04-13"] },
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
        examples: [11],
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
        examples: ["42"],
        exclusiveMinimum: 0,
      },
      max: {
        type: ["number", "string", "null"],
        format: "decimal",
        examples: [0],
        maximum: 42,
      },
      exclusiveMax: {
        type: "number",
        format: "double",
        examples: [3.14],
        exclusiveMaximum: 42,
      },
    };

    const openapi = csdl2openapi(csdl, { openapiVersion: "3.1.0" });

    assert.equal(openapi.openapi, "3.1.0", "OpenAPI version");
    assert.deepStrictEqual(
      openapi.components.schemas["oas31.single"].properties,
      properties,
      "Schemas",
    );
    assert.deepStrictEqual(
      openapi.paths["/set"].get.responses[200].content["application/json"]
        .schema.properties["@odata.deltaLink"],
      {
        type: "string",
        examples: [
          "/service-root/set?$deltatoken=opaque server-generated token for fetching the delta",
        ],
      },
      "delta link",
    );
  });
});
