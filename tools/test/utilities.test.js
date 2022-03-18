const assert = require("assert");

const { deleteUnusedSchemas } = require("../lib/utilities");

describe("utilities", function () {
  it("nothing to delete - OpenAPI 3.x", () => {
    const source = { components: {} };
    const target = { components: {} };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("nothing to delete - Swagger", () => {
    const source = {};
    const target = {};

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("no empty parameters - OpenAPI 3.x", () => {
    const source = { components: { schemas: {}, parameters: {} } };
    const target = { components: { schemas: {} } };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });

  it("no empty parameters - Swagger", () => {
    const source = { parameters: {} };
    const target = {};

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
          response: { description: "should stay" },
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
        schemas: { response: { description: "should stay" } },
        parameters: {
          top: { description: "should stay" },
        },
      },
    };

    deleteUnusedSchemas(source);
    assert.deepStrictEqual(source, target, "OpenAPI");
  });
});
