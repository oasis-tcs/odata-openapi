#!/usr/bin/env node
"use strict";

const csdl = require("odata-csdl");
const lib = require("./csdl2openapi");
const fs = require("fs");
const { parseArgs } = require("./cliParts");
const { stringifyStream } = require("@discoveryjs/json-ext");

const args = parseArgs(process.argv.slice(2));
if (args.unknown)
  args.unknown.map((arg) => console.error(`Unknown option: ${arg}`));
if (args.usage) console.log(args.usage);
else convert(args);

function convert(args) {
  if (!fs.existsSync(args.source)) {
    console.error("Source file not found: " + args.source);
    return;
  }

  const text = fs.readFileSync(args.source, "utf8");
  const json = text.startsWith("<") ? csdl.xml2json(text) : JSON.parse(text);

  console.log(args.target);

  const messages = [];

  const openapi = lib.csdl2openapi(json, args.options);

  stringifyStream(openapi, null, args.options.pretty ? 4 : 0).pipe(
    fs.createWriteStream(args.target),
  );

  if (messages.length > 0) console.dir(messages);
}
