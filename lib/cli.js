#!/usr/bin/env node
'use strict';

//console.dir(argv);

//TODO: what to require?
const csdl = require('odata-csdl');
const lib = require('./csdl2openapi');
const minimist = require('minimist');
const path = require('path');
const fs = require('fs');

var unknown = false;

var argv = minimist(process.argv.slice(2), {
    string: ["t", "target", "scheme", "host", "basePath"],
    boolean: ["d", "diagram", "h", "help", "p", "pretty", "u", "used-schemas-only"],
    alias: {
        d: "diagram",
        h: "help",
        p: "pretty",
        t: "target",
        u: "used-schemas-only"
    },
    default: {
        pretty: false
    },
    unknown: (arg) => {
        if (arg.substring(0, 1) == '-') {
            console.error('Unknown option: ' + arg);
            unknown = true;
            return false;
        }
    }
});

if (unknown || argv._.length == 0 || argv.h) {
    console.log(`Usage: odata-openapi3 <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -p, --pretty            pretty-print JSON result
 --scheme                scheme (default: http)
 -t, --target            target file (default: source file basename + .openapi3.json)
 -u, --used-schemas-only produce only schemas that are actually used in operation objects`);
} else {
    convert(argv._);
}

function convert(sources) {
    var main = null;
    var ext = [];

    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];

        if (!fs.existsSync(source)) {
            console.error('Source file not found: ' + source);
            return;
        }

        const text = fs.readFileSync(source, 'utf8');
        const json = text.startsWith('<') ? csdl.xml2json(text) : JSON.parse(text);
        if (json.$Version < '3.0') {
            console.error('Only OData Version 3.0 or greater is supported: ' + source);
            return;
        }

        if (i == 0)
            main = json;
        else
            ext.push(json);
    }

    const source = sources[0];
    const target = argv.target || (source.lastIndexOf('.') <= 0 ? source : source.substring(0, source.lastIndexOf('.'))) + '.openapi3.json';
    console.log(target);

    const openapi = lib.csdl2openapi(
        main,
        {
            scheme: argv.scheme,
            host: argv.host,
            basePath: argv.basePath,
            diagram: argv.diagram
        },
        ext
    );

    if (argv.u) lib.deleteUnreferencedSchemas(openapi);

    fs.writeFileSync(target, JSON.stringify(openapi, null, argv.pretty ? 4 : 0));
}