#!/usr/bin/env node
"use strict";

//console.dir(argv);

//TODO: what to require?
const csdl = require("odata-csdl");
const lib = require("./csdl2openapi");
const minimist = require("minimist");
const fs = require("fs");
const { stringifyStream } = require("@discoveryjs/json-ext");

var unknown = false;

var argv = minimist(process.argv.slice(2), {
  string: [
    "basePath",
    "description",
    "host",
    "keep",
    "levels",
    "openapi-version",
    "scheme",
    "target",
    "title",
  ],
  boolean: ["diagram", "help", "pretty", "skipBatchPath", "used-schemas-only"],
  alias: {
    d: "diagram",
    h: "help",
    k: "keep",
    o: "openapi-version",
    p: "pretty",
    t: "target",
    u: "used-schemas-only",
  },
  default: {
    levels: 4,
    pretty: false,
    skipBatchPath: false,
  },
  unknown: (arg) => {
    if (arg.substring(0, 1) == "-") {
      console.error("Unknown option: " + arg);
      unknown = true;
      return false;
    }
  },
});

if (unknown || argv._.length == 0 || argv.h) {
  console.log(`Usage: odata-openapi3 <options> <source file>
Options:
 --basePath              base path (default: /service-root)
 --description           default description if none is annotated
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -k, --keep              root resource to keep (can be specified multiple times with one name each)
 --levels                maximum number of path segments
 -o, --openapi-version   3.0.0 to 3.0.3 or 3.1.0 (default: 3.0.2)
 -p, --pretty            pretty-print JSON result
 --scheme                scheme (default: http)
 --skipBatchPath         skips the generation of the $batch path, (default: false)
 -t, --target            target file (default: source file basename + .openapi3.json)
 --title                 default title if none is annotated`);
} else {
  //TODO: further input parameters reserved for e.g. referenced CSDL documents
  // for (var i = 0; i < argv._.length; i++) {
  //     convert(argv._[i]);
  // }
  convert(argv._[0]);
}

function convert(source) {
  if (!fs.existsSync(source)) {
    console.error("Source file not found: " + source);
    return;
  }

  const text = fs.readFileSync(source, "utf8");
  const json = text.startsWith("<") ? csdl.xml2json(text) : JSON.parse(text);

  const target =
    argv.target ||
    (source.lastIndexOf(".") <= 0
      ? source
      : source.substring(0, source.lastIndexOf("."))) + ".openapi3.json";
  console.log(target);

  const messages = [];

  const openapi = lib.csdl2openapi(json, {
    scheme: argv.scheme,
    host: argv.host,
    basePath: argv.basePath,
    diagram: argv.diagram,
    maxLevels: Number(argv.levels),
    openapiVersion: argv.o,
    messages,
    skipBatchPath: argv.skipBatchPath,
    defaultTitle: argv.title,
    defaultDescription: argv.description,
    rootResourcesToKeep: Array.isArray(argv.keep) ? argv.keep : argv.keep? [argv.keep]: undefined,
  });

  stringifyStream(openapi, null, argv.pretty ? 4 : 0).pipe(
    fs.createWriteStream(target),
  );

  if (messages.length > 0) console.dir(messages);
}
