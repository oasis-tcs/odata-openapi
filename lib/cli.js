#!/usr/bin/env node
"use strict";

const { csdl2openapi } = require("./csdl2openapi");
const { xml2json } = require("odata-csdl");
const { createWriteStream, existsSync, readFileSync } = require("node:fs");
const { Readable } = require("node:stream");
const { parseArguments } = require("./cliParts");
const { stringifyChunked } = require("@discoveryjs/json-ext");

const args = parseArguments(process.argv.slice(2));
if (args.unknown) console.error(args.unknown);
if (args.usage) console.log(args.usage);
else convert(args);

function convert(args) {
  if (!existsSync(args.source)) {
    console.error("Source file not found: " + args.source);
    return;
  }

  const text = readFileSync(args.source, "utf8");
  const json = text.startsWith("<") ? xml2json(text) : JSON.parse(text);

  console.log(args.target);

  const messages = [];

  const openapi = csdl2openapi(json, { messages, ...args.options });

  Readable.from(
    stringifyChunked(openapi, null, args.options.pretty ? 4 : 0),
  ).pipe(createWriteStream(args.target));

  if (messages.length > 0) console.dir(messages);
}
