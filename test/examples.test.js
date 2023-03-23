const assert = require("assert");
const fs = require("fs");

const { paths, operations } = require("./utilities");

const { xml2json } = require("odata-csdl");
const { csdl2openapi } = require("odata-openapi");

const example1 = xml2json(fs.readFileSync("examples/csdl-16.1.xml"));
const result1 = require("../examples/csdl-16.1.openapi3.json");

const example2 = xml2json(fs.readFileSync("examples/TripPin.xml"));
const result2 = require("../examples/TripPin.openapi3.json");

const example3 = xml2json(fs.readFileSync("examples/custom-parameters.xml"));
const result3 = require("../examples/custom-parameters.openapi3.json");

const example4 = xml2json(fs.readFileSync("examples/aggregation.xml"));
const result4 = require("../examples/aggregation.openapi3.json");

const example5 = xml2json(fs.readFileSync("examples/annotations.xml"));
const result5 = require("../examples/annotations.openapi3.json");

const example6 = xml2json(fs.readFileSync("examples/containment.xml"));
const result6 = require("../examples/containment.openapi3.json");

const example7 = xml2json(fs.readFileSync("examples/authorization.xml"));
const result7 = require("../examples/authorization.openapi3.json");

const example8 = xml2json(fs.readFileSync("examples/descriptions.xml"));
const result8 = require("../examples/descriptions.openapi3.json");

const example9 = xml2json(fs.readFileSync("examples/odata-rw-v3.xml"));
const result9 = require("../examples/odata-rw-v3.openapi3.json");

const example10 = xml2json(fs.readFileSync("examples/odata-rw-v2.xml"));
const result10 = require("../examples/odata-rw-v2.openapi3.json");

const example11 = xml2json(fs.readFileSync("examples/PingTest_V1.xml"));
const result11 = require("../examples/PingTest_V1.openapi3.json");
const result11NoBatch = require("../examples/PingTest_V1.no-batch.openapi3.json");

const result12Title = require("../examples/TitleAndDescription.openapi3.json");

describe("Examples", function () {
  it("csdl-16.1", function () {
    const openapi = csdl2openapi(example1, { diagram: true });
    check(openapi, result1);
  });

  it("TripPin", function () {
    const openapi = csdl2openapi(example2, {
      host: "services.odata.org",
      basePath: "/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW",
      diagram: true,
    });
    check(openapi, result2);
  });

  it("custom-parameters", function () {
    const openapi = csdl2openapi(example3, { diagram: true });
    check(openapi, result3);
  });

  it("aggregation", function () {
    const openapi = csdl2openapi(example4, { diagram: true });
    check(openapi, result4);
  });

  it("annotations", function () {
    const openapi = csdl2openapi(example5, { diagram: true });
    check(openapi, result5);
  });

  it("containment", function () {
    const openapi = csdl2openapi(example6, { diagram: true });
    check(openapi, result6);
  });

  it("authorization", function () {
    const openapi = csdl2openapi(example7, { diagram: true });
    check(openapi, result7);
  });

  it("descriptions", function () {
    const openapi = csdl2openapi(example8, { diagram: true });
    check(openapi, result8);
  });

  it("odata-rw-v3", function () {
    const openapi = csdl2openapi(example9, {
      host: "services.odata.org",
      basePath: "/V3/(S(1urrjxgkuh4r30yqim0hqrtj))/OData/OData.svc",
      diagram: true,
    });
    check(openapi, result9);
  });

  it("odata-rw-v2", function () {
    const openapi = csdl2openapi(example10, { diagram: true });
    check(openapi, result10);
  });

  it("SAP PingTest with $batch path (default)", function () {
    const openapi = csdl2openapi(example11, { diagram: true });
    check(openapi, result11);
  });

  it("SAP PingTest without $batch path", function () {
    const openapi = csdl2openapi(example11, {
      skipBatchPath: true,
      diagram: false,
    });
    check(openapi, result11NoBatch);
  });

  it("Support of default title and description", function () {
    const openapi = csdl2openapi(example11, {
      diagram: true,
      defaultTitle: "My Custom Title",
      defaultDescription: "Some description",
    });
    check(openapi, result12Title);
  });
});

function check(actual, expected) {
  assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
  assert.deepStrictEqual(
    operations(actual),
    operations(expected),
    "Operations"
  );
  assert.deepStrictEqual(actual, expected, "OpenAPI document");
}
