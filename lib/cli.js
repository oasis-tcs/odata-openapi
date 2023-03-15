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
  string: ["o", "openapi-version", "t", "target", "scheme", "host", "basePath", "title", "description"],
  boolean: [
    "d",
    "diagram",
    "h",
    "help",
    "p",
    "pretty",
    "u",
    "used-schemas-only",
    "skipBatchPath",
  ],
  alias: {
    d: "diagram",
    h: "help",
    o: "openapi-version",
    p: "pretty",
    t: "target",
    u: "used-schemas-only",
  },
  default: {
    pretty: false,
    skipBatchPath: false
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
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -o, --openapi-version   3.0.0 to 3.0.3 or 3.1.0 (default: 3.0.2)
 -p, --pretty            pretty-print JSON result
 --scheme                scheme (default: http)
 -t, --target            target file (default: source file basename + .openapi3.json)
 --skipBatchPath         skips the generation of the $batch path, (default: false)
 --title                 default title if none is annotated
 --description           default description if none is annotated`);
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
    openapiVersion: argv.o,
    messages,
    skipBatchPath: argv.skipBatchPath,
    defaultTitle: argv.title,
    defaultDescription: argv.description
  });

  stringifyStream(openapi, null, argv.pretty ? 4 : 0).pipe(
    fs.createWriteStream(target)
  );

  if (messages.length > 0) console.dir(messages);
}
