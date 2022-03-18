const assert = require("assert");

const { deleteUnusedSchemas } = require("../lib/utilities");

describe("utilities", function () {
  it("nothing to delete", () => {
    const source = {};
    const target = {};

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("no empty path items, components, schemas, parameters, responses - OpenAPI 3.x", () => {
    const source = {
      paths: {
        keep: { get: {} },
        "/remove": {},
        "/remove/too": { parameters: [] },
      },
      components: { schemas: {}, parameters: {}, responses: {} },
    };
    const target = { paths: { keep: { get: {} } } };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("no empty path items, definitions, parameters, responses - Swagger", () => {
    const source = {
      paths: {
        keep: { get: {} },
        "/remove": {},
        "/remove/too": { parameters: [] },
      },
      definitions: {},
      parameters: {},
      responses: {},
    };
    const target = { paths: { keep: { get: {} } } };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("something to delete - OpenAPI 3.x", () => {
    const source = {
      paths: {
        "/foo": {
          get: {
            parameters: [{ $ref: "#/components/parameters/top" }],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/response" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          response: { description: "should stay" },
          unused: {
            description: "should go",
            properties: { noCycle: { $ref: "#/components/schemas/unused2" } },
          },
          unused2: { description: "should go, too" },
        },
        parameters: {
          top: { description: "should stay" },
          unused: { description: "should go" },
        },
      },
    };
    const target = {
      paths: {
        "/foo": {
          get: {
            parameters: [{ $ref: "#/components/parameters/top" }],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/response" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: { response: { description: "should stay" } },
        parameters: {
          top: { description: "should stay" },
        },
      },
    };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("something to delete - Swagger 2.0", () => {
    const source = {
      paths: {
        "/foo": {
          get: {
            parameters: [{ $ref: "#/parameters/top" }],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/definitions/response" },
                  },
                },
              },
            },
          },
        },
      },
      definitions: {
        response: { description: "should stay" },
        unused: { description: "should go" },
      },
      parameters: {
        top: { description: "should stay" },
        unused: { description: "should go" },
      },
    };
    const target = {
      paths: {
        "/foo": {
          get: {
            parameters: [{ $ref: "#/parameters/top" }],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/definitions/response" },
                  },
                },
              },
            },
          },
        },
      },
      definitions: {
        response: { description: "should stay" },
      },
      parameters: {
        top: { description: "should stay" },
      },
    };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target);
  });

  it("cycles to delete", () => {
    const source = {
      paths: {
        "/foo": {
          get: {
            parameters: [{ $ref: "#/components/parameters/top" }],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/response" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          response: {
            description: "should stay",
            properties: { used: { $ref: "#/components/schemas/used" } },
          },
          used: {
            description: "should stay",
            properties: { used: { $ref: "#/components/schemas/used2" } },
          },
          used2: { description: "should stay" },
          unused: {
            description: "should go",
            properties: { cycle: { $ref: "#/components/schemas/unused2" } },
          },
          unused2: {
            description: "should go",
            properties: { cycle: { $ref: "#/components/schemas/unused" } },
          },
        },
        parameters: {
          top: { description: "should stay" },
          unused: { description: "should go" },
        },
      },
    };
    const target = {
      paths: {
        "/foo": {
          get: {
            parameters: [{ $ref: "#/components/parameters/top" }],
            responses: {
              200: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/response" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          response: {
            description: "should stay",
            properties: { used: { $ref: "#/components/schemas/used" } },
          },
          used: {
            description: "should stay",
            properties: { used: { $ref: "#/components/schemas/used2" } },
          },
          used2: { description: "should stay" },
        },
        parameters: {
          top: { description: "should stay" },
        },
      },
    };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });
});
