#!/usr/bin/env node

/* TODO:
- glob for source file patterns   
- arguments for
     - info-title/description/version?
     - externalDocs-url/description?
*/
//console.dir(argv);

"use strict";

const minimist = require("minimist");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { deleteUnusedSchemas } = require("./lib/utilities");

const toolsPath = path.dirname(require.main.filename) + path.sep;
const classPath = `${toolsPath}xalan/xalan.jar${path.delimiter}${toolsPath}xalan/serializer.jar`;

let unknown = false;

let argv = minimist(process.argv.slice(2), {
  string: ["o", "openapi-version", "t", "target", "scheme", "host", "basePath"],
  boolean: [
    "d",
    "diagram",
    "h",
    "help",
    "p",
    "pretty",
    "r",
    "references",
    "u",
    "used-schemas-only",
    "verbose",
  ],
  alias: {
    d: "diagram",
    h: "help",
    o: "openapi-version",
    p: "pretty",
    r: "references",
    t: "target",
    u: "used-schemas-only",
    v: "odata-version",
  },
  default: {
    basePath: "/service-root",
    diagram: false,
    host: "localhost",
    "odata-version": "4.0",
    "openapi-version": "3.0.0",
    pretty: false,
    references: false,
    scheme: "https",
    verbose: false,
  },
  unknown: (arg) => {
    if (arg.substring(0, 1) == "-") {
      console.error(`Unknown option: ${arg}`);
      unknown = true;
      return false;
    }
  },
});
if (argv.o == "2") argv.o = "2.0";
if (argv.o == "3") argv.o = "3.0.0";

if (unknown || argv._.length == 0 || argv.h) {
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
  for (let i = 0; i < argv._.length; i++) {
    transform(argv._[i]);
  }
}

function transform(source) {
  if (!fs.existsSync(source)) {
    console.error(`Source file not found: ${source}`);
    process.exit(1);
  }

  if (argv.verbose)
    console.log(`Checking OData version used in source file: ${source}`);

  const result = xalan("OData-Version.xsl", "-IN", source);

  if (result.status === null) {
    console.error("Java did not start: is it installed and in the PATH?");
    process.exit(1);
  }

  if (result.stderr.length) {
    console.error(`Source file not XML: ${source}`);
    if (argv.verbose) console.log(result.stderr.toString());
    process.exit(1);
  }

  const version = result.stdout.toString();
  if (version == "") {
    console.error("Source file not OData: " + source);
    process.exit(1);
  }

  if (version == "2.0" || version == "3.0") {
    if (argv.verbose) console.log(`Source file is OData version: ${version}`);
    transformV2V3(source, version);
  } else {
    if (argv.verbose) console.log(`Source file is OData version: ${version}`);
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

  if (argv.verbose)
    console.log(`Transforming ${source} to OData V4, target file: ${target}`);

  const result = xalan("V2-to-V4-CSDL.xsl", "-IN", source, "-OUT", target);

  if (result.stderr.length) console.error(result.stderr.toString());
  if (result.status !== 0) process.exit(1);

  transformV4(target, version, true);
}

function transformV4(source, version, deleteSource) {
  const target =
    argv.t || source.substring(0, source.lastIndexOf(".") + 1) + "openapi.json";

  if (argv.verbose)
    console.log(
      `Transforming ${source} to OpenAPI ${argv.o}, target file: ${target}`,
    );

  const params = ["-IN", source];
  if (!argv.u && !argv.pretty) params.push("-OUT", target);
  if (argv.basePath) params.push("-PARAM", "basePath", argv.basePath);
  if (argv.diagram) params.push("-PARAM", "diagram", argv.diagram);
  if (argv.host) params.push("-PARAM", "host", argv.host);
  params.push("-PARAM", "odata-version", version);
  params.push("-PARAM", "openapi-version", argv.o);
  if (argv.references) params.push("-PARAM", "references", argv.references);
  if (argv.scheme) params.push("-PARAM", "scheme", argv.scheme);

  const result = xalan("V4-CSDL-to-OpenAPI.xsl", ...params);

  if (result.stderr.length) console.error(result.stderr.toString());
  if (result.status !== 0) process.exit(1);

  if (argv.pretty || argv.u) {
    try {
      let openapi = JSON.parse(result.stdout);

      if (argv.u) {
        if (argv.verbose) console.log("Deleting unused schemas");
        deleteUnusedSchemas(openapi);
      }
      if (argv.verbose) console.log(`Writing target file: ${target}`);
      fs.writeFileSync(
        target,
        JSON.stringify(openapi, null, argv.pretty ? 4 : 0),
      );
    } catch (e) {
      if (argv.verbose) console.log("Ooops, something went wrong: ");
      console.log(e);
      fs.writeFileSync(target, result.stdout);
    }
  }

  if (deleteSource) {
    if (argv.verbose) console.log(`Removing intermediate file: ${source}`);
    fs.unlinkSync(source);
  }

  if (argv.verbose) console.log("Done.");
}
