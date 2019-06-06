#!/usr/bin/env node
'use strict';

//TODO: everything
//TODO: glob for source file patterns

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
    boolean: ["d", "diagram", "h", "help", "p", "pretty"],
    alias: {
        d: "diagram",
        h: "help",
        p: "pretty",
        t: "target"
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
    console.log(`Usage: odata-csdl-xml2json <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -p, --pretty            pretty-print JSON result
 --scheme                scheme (default: http)
 -t, --target            target file (only useful with a single source file)`);
} else {
    for (var i = 0; i < argv._.length; i++) {
        convert(argv._[i]);
    }
}

function convert(source) {
    if (!fs.existsSync(source)) {
        console.error('Source file not found: ' + source);
        return;
    }

    const target = argv.t || source.substring(0, source.lastIndexOf('.')) + '.openapi.json';
    console.log(target);

    const text = fs.readFileSync(source, 'utf8');

    const openapi = lib.csdl2openapi(
        text.startsWith('<') ? csdl.xml2json(text) : text,
        {
            scheme: argv.scheme,
            host: argv.host,
            basePath: argv.basePath,
            diagram: argv.diagram
        });

    fs.writeFileSync(target, JSON.stringify(openapi, null, argv.pretty ? 4 : 0));
}