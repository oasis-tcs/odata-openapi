#!/usr/bin/env node
"use strict";

const csdl = require("odata-csdl");
const lib = require("./csdl2openapi");
const fs = require("fs");

const Ajv = require("ajv-draft-04");
const addFormats = require("ajv-formats");
const { openapiV3 } = require("@apidevtools/openapi-schemas");

const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(openapiV3);

const exampleFolder = "./examples/";

const basePath = {
  example: "/V4/OData/(S(nsga2k1tyctb0cn0ofcgcn4o))/OData.svc",
  Northwind: "/V4/Northwind/Northwind.svc",
  TripPin: "/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW",
  "odata-rw-v3": "/V3/(S(1urrjxgkuh4r30yqim0hqrtj))/OData/OData.svc",
  "Northwind-V3": "/V3/Northwind/Northwind.svc",
};

fs.readdirSync(exampleFolder)
  .filter((fn) => fn.endsWith(".xml"))
  .forEach((xmlfile) => {
    const example = xmlfile.substring(0, xmlfile.lastIndexOf("."));
    console.log(xmlfile);

    const xml = fs.readFileSync(exampleFolder + xmlfile, "utf8");
    const json = csdl.xml2json(xml);

    const messages = [];
    const openapi = lib.csdl2openapi(json, {
      scheme: "https",
      host: basePath[example] ? "services.odata.org" : "localhost",
      basePath: basePath[example] || "/service-root",
      diagram: true,
      messages,
    });

    fs.writeFileSync(
      exampleFolder + example + ".openapi3.json",
      JSON.stringify(openapi, null, 4),
    );

    if (messages.length > 0) console.dir(messages);

    if (!validate(openapi)) console.log(validate.errors);
  });
