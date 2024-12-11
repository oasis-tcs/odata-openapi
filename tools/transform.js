#!/usr/bin/env node

/* TODO:
- glob for source file patterns
- arguments for
     - info-title/description/version?
     - externalDocs-url/description?
*/

"use strict";

const { parseArgs } = require("node:util");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { deleteUnusedSchemas } = require("./lib/utilities");

const toolsPath = path.dirname(require.main.filename) + path.sep;
const classPath = `${toolsPath}xalan/xalan.jar${path.delimiter}${toolsPath}xalan/serializer.jar`;

let unknown = false;
let argv;

try {
  argv = parseArgs({
    options: {
      basePath: { type: "string", default: "/service-root" },
      diagram: { type: "boolean", short: "d" },
      help: { type: "boolean", short: "h" },
      host: { type: "string", default: "localhost" },
      "openapi-version": { type: "string", short: "o", default: "3.0.0" },
      pretty: { type: "boolean", short: "p" },
      references: { type: "boolean", short: "r" },
      scheme: { type: "string", default: "https" },
      skipBatchPath: { type: "boolean" },
      target: { type: "string", short: "t" },
      "used-schemas-only": { type: "boolean", short: "u" },
      verbose: { type: "boolean" },
    },
    allowPositionals: true,
  });
} catch (e) {
  console.error(e.message);
  unknown = true;
}

if (argv.values["openapi-version"] == "2")
  argv.values["openapi-version"] = "2.0";
if (argv.values["openapi-version"] == "3")
  argv.values["openapi-version"] = "3.0.0";

if (unknown || argv.positionals.length == 0 || argv.values.help) {
  console.log(`Usage: odata-openapi <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -o, --openapi-version   3.0.0 or 2.0 (default: 3.0.0)
 -p, --pretty            pretty-print JSON result
 -r, --references        include references to other files
 --scheme                scheme (default: http)
 -t, --target            target file (only useful with a single source file)
 -u, --used-schemas-only produce only schemas that are actually used in operation objects
 --verbose               output additional progress information`);
  process.exit(1);
} else {
  for (let i = 0; i < argv.positionals.length; i++) {
    transform(argv.positionals[i]);
  }
}

function transform(source) {
  if (!fs.existsSync(source)) {
    console.error(`Source file not found: ${source}`);
    process.exit(1);
  }

  if (argv.values.verbose)
    console.log(`Checking OData version used in source file: ${source}`);

  const result = xalan("OData-Version.xsl", "-IN", source);

  if (result.status === null) {
    console.error("Java did not start: is it installed and in the PATH?");
    process.exit(1);
  }

  if (result.stderr.length) {
    console.error(`Source file not XML: ${source}`);
    if (argv.values.verbose) console.log(result.stderr.toString());
    process.exit(1);
  }

  const version = result.stdout.toString();
  if (version == "") {
    console.error("Source file not OData: " + source);
    process.exit(1);
  }

  if (version == "2.0" || version == "3.0") {
    if (argv.values.verbose)
      console.log(`Source file is OData version: ${version}`);
    transformV2V3(source, version);
  } else {
    if (argv.values.verbose)
      console.log(`Source file is OData version: ${version}`);
    transformV4(source, version, false);
  }
}

function xalan(xslt, ...args) {
  return spawnSync("java", [
    "-cp",
    classPath,
    "org.apache.xalan.xslt.Process",
    "-XSL",
    toolsPath + xslt,
    ...args,
  ]);
}

function transformV2V3(source, version) {
  const target = source.substring(0, source.lastIndexOf(".") + 1) + "tmp";

  if (argv.values.verbose)
    console.log(`Transforming ${source} to OData V4, target file: ${target}`);

  const result = xalan("V2-to-V4-CSDL.xsl", "-IN", source, "-OUT", target);

  if (result.stderr.length) console.log(result.stderr.toString());
  if (result.status !== 0) process.exit(1);

  transformV4(target, version, true);
}

function transformV4(source, version, deleteSource) {
  const target =
    argv.values.target ||
    source.substring(0, source.lastIndexOf(".") + 1) + "openapi.json";

  if (argv.values.verbose)
    console.log(
      `Transforming ${source} to OpenAPI ${argv.values["openapi-version"]}, target file: ${target}`,
    );

  const params = ["-IN", source];
  if (!argv.values["used-schemas-only"] && !argv.values.pretty)
    params.push("-OUT", target);
  if (argv.values.basePath)
    params.push("-PARAM", "basePath", argv.values.basePath);
  if (argv.values.diagram)
    params.push("-PARAM", "diagram", argv.values.diagram);
  if (argv.values.host) params.push("-PARAM", "host", argv.values.host);
  params.push("-PARAM", "odata-version", version);
  params.push("-PARAM", "openapi-version", argv.values["openapi-version"]);
  if (argv.values.references)
    params.push("-PARAM", "references", argv.values.references);
  if (argv.values.scheme) params.push("-PARAM", "scheme", argv.values.scheme);

  const result = xalan("V4-CSDL-to-OpenAPI.xsl", ...params);

  if (result.stderr.length) console.log(result.stderr.toString());
  if (result.status !== 0) process.exit(1);

  if (argv.values.pretty || argv.values["used-schemas-only"]) {
    try {
      let openapi = JSON.parse(result.stdout);

      if (argv.values["used-schemas-only"]) {
        if (argv.values.verbose) console.log("Deleting unused schemas");
        deleteUnusedSchemas(openapi);
      }
      if (argv.values.verbose) console.log(`Writing target file: ${target}`);
      fs.writeFileSync(
        target,
        JSON.stringify(openapi, null, argv.values.pretty ? 4 : 0),
      );
    } catch (e) {
      if (argv.values.verbose) console.log("Ooops, something went wrong: ");
      console.log(e);
      fs.writeFileSync(target, result.stdout);
    }
  }

  if (deleteSource) {
    if (argv.values.verbose)
      console.log(`Removing intermediate file: ${source}`);
    fs.unlinkSync(source);
  }

  if (argv.values.verbose) console.log("Done.");
}
