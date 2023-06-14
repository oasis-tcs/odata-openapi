#!/usr/bin/env node
"use strict";

const fs = require("fs");

const Ajv = require("ajv-draft-04");
const addFormats = require("ajv-formats");
const { openapiV2, openapiV3 } = require("@apidevtools/openapi-schemas");

const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validateV2 = ajv.compile(openapiV2);
const validateV3 = ajv.compile(openapiV3);

const exampleFolder = "./tests/";

fs.readdirSync(exampleFolder)
  .filter((fn) => fn.endsWith(".json"))
  .forEach((jsonFile) => {
    const openapi = JSON.parse(
      fs.readFileSync(exampleFolder + jsonFile, "utf8")
    );

    if (openapi.openapi) {
      if (!validateV3(openapi)) {
        console.log(jsonFile);
        console.log(validateV3.errors);
      }
    } else {
      if (!validateV2(openapi)) {
        console.log(jsonFile);
        console.log(validateV2.errors);
      }
    }
  });
