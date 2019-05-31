#!/usr/bin/env node

/* TODO:
- glob for source file patterns   
- arguments for
     - info-title/description/version?
     - externalDocs-url/description?
*/
//console.dir(argv);

'use strict';

var xslt4node = require('xslt4node');
var minimist = require('minimist');
var path = require('path');
var fs = require('fs');

var xsltpath = path.dirname(require.main.filename) + path.sep;
xslt4node.addLibrary(xsltpath + 'xalan/xalan.jar');

var unknown = false;

var argv = minimist(process.argv.slice(2), {
    string: ["o", "openapi-version", "t", "target", "scheme", "host", "basePath"],
    boolean: ["d", "diagram", "h", "help", "p", "pretty", "r", "references", "u", "used-schemas-only", "verbose"],
    alias: {
        d: "diagram",
        h: "help",
        o: "openapi-version",
        p: "pretty",
        r: "references",
        t: "target",
        u: "used-schemas-only",
        v: "odata-version"
    },
    default: {
        basePath: "/service-root",
        diagram: false,
        host: "localhost",
        "odata-version": "4.0",
        "openapi-version": "3.0.0",
        pretty: false,
        references: false,
        scheme: "http",
        verbose: false
    },
    unknown: (arg) => {
        if (arg.substring(0, 1) == '-') {
            console.error('Unknown option: ' + arg);
            unknown = true;
            return false;
        }
    }
});
if (argv.o == '2') argv.o = "2.0";
if (argv.o == '3') argv.o = "3.0.0";

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
} else {
    for (var i = 0; i < argv._.length; i++) {
        transform(argv._[i]);
    }
}

function transform(source) {
    if (!fs.existsSync(source)) {
        console.error('Source file not found: ' + source);
        return;
    }

    if (argv.verbose) console.log('Checking OData version used in source file: ' + source);

    xslt4node.transform(
        {
            xsltPath: xsltpath + 'OData-Version.xsl',
            sourcePath: source,
            result: String
        },
        (err, result) => {
            if (err) {
                console.error('Source file not XML: ' + source);
            } else if (result == "") {
                console.error('Source file not OData: ' + source);
            } else if (result == "2.0" || result == "3.0") {
                transformV2V3(source, result);
            } else {
                transformV4(source, "4.0", false);
            }
        }
    );
}

function transformV2V3(source, version) {
    var target = source.substring(0, source.lastIndexOf('.') + 1) + 'tmp';

    if (argv.verbose) console.log('Transforming ' + source + ' to OData V4, target file: ' + target);

    xslt4node.transform(
        {
            xsltPath: xsltpath + 'V2-to-V4-CSDL.xsl',
            sourcePath: source,
            result: target
        },
        (err, result) => {
            if (err) {
                console.error(err);
            } else {
                transformV4(target, version, true);
            }
        }
    );
}

function transformV4(source, version, deleteSource) {
    var target = argv.t || source.substring(0, source.lastIndexOf('.') + 1) + 'openapi.json';

    if (argv.verbose) console.log('Transforming ' + source + ' to OpenAPI ' + argv.o + ', target file: ' + target);

    xslt4node.transform(
        {
            xsltPath: xsltpath + 'V4-CSDL-to-OpenAPI.xsl',
            sourcePath: source,
            result: (argv.pretty || argv.u ? Buffer : target),
            params: {
                basePath: argv.basePath,
                diagram: argv.diagram,
                host: argv.host,
                "odata-version": version,
                "openapi-version": argv.o,
                references: argv.references,
                scheme: argv.scheme
            }
        },
        (err, result) => {
            if (err) {
                console.error(err);
            } else {
                if (argv.pretty || argv.u) {
                    try {
                        let openapi = JSON.parse(result);
                        if (argv.u)
                            deleteUnusedSchemas(openapi);
                        fs.writeFileSync(target, JSON.stringify(openapi, null, (argv.pretty ? 4 : 0)));
                    } catch (e) {
                        console.log(e);
                        fs.writeFileSync(target, result);
                    }
                }
                if (deleteSource) {
                    if (argv.verbose) console.log('Removing intermediate file: ' + source);
                    fs.unlink(source, (err) => { if (err) console.error(err); });
                }
            }
        }
    );
}

function deleteUnusedSchemas(openapi) {
    var referenced;
    var deleted;

    while (true) {
        referenced = {};
        getReferencedSchemas(openapi, referenced);

        if (openapi.hasOwnProperty('components'))
            deleted = deleteUnreferenced(openapi.components.schemas, referenced, '#/components/schemas/');
        else
            deleted = deleteUnreferenced(openapi.definitions, referenced, '#/definitions/');

        if (!deleted) break;
    }

    if (openapi.hasOwnProperty('components')) {
        deleteUnreferenced(openapi.components.parameters, referenced, '#/components/parameters/');
        if (Object.keys(openapi.components.parameters).length == 0)
            delete openapi.components.parameters;
    } else {
        deleteUnreferenced(openapi.parameters, referenced, '#/parameters/');
        if (Object.keys(openapi.parameters).length == 0)
            delete openapi.parameters;
    }
}

function getReferencedSchemas(document, referenced) {
    Object.keys(document).forEach(key => {
        let value = document[key];
        if (key == '$ref') {
            if (value.startsWith('#'))
                referenced[value] = true;
        } else {
            if (Array.isArray(value)) {
                value.forEach(item => getReferencedSchemas(item, referenced))
            } else if (typeof value == 'object' && value != null) {
                getReferencedSchemas(value, referenced);
            }
        }
    });
}

function deleteUnreferenced(schemas, referenced, prefix) {
    var deleted = false;

    Object.keys(schemas).forEach(key => {
        if (!referenced[prefix + key]) {
            delete schemas[key];
            deleted = true;
        }
    });

    return deleted;
}