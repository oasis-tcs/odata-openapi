#!/usr/bin/env node
'use strict';

const csdl = require('odata-csdl');
const lib = require('./csdl2openapi');
const fs = require('fs');

//TODO: cleanup
// - finish this script
// - remove transform, .cmd, .txt
// - remove Swagger output, keep only *.openapi3.json
// - remove V2 input, move over to /openapi
// - clean up mocha tests, no more tweaking with description etc.
// - cleanup /README.md, /tools/README.md, /lib/README.md
// - /examples/odata-definitions.json: still needed?

const exampleFolder = './examples/';

const basePath = {
    example: '/V4/OData/(S(nsga2k1tyctb0cn0ofcgcn4o))/OData.svc',
    Northwind: '/V4/Northwind/Northwind.svc',
    TripPin: '/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW',
    'odata-rw-v3': '/V3/(S(1urrjxgkuh4r30yqim0hqrtj))/OData/OData.svc',
    'Northwind-V3': '/V3/Northwind/Northwind.svc'
};

fs.readdirSync(exampleFolder).filter(fn => fn.endsWith('.xml')).forEach(xmlfile => {
    const example = xmlfile.substring(0, xmlfile.lastIndexOf('.'));
    console.log(xmlfile);

    const xml = fs.readFileSync(exampleFolder + xmlfile, 'utf8');
    const json = csdl.xml2json(xml, false);

    //TODO: references:true?
    const openapi = lib.csdl2openapi(
        json,
        {
            scheme: 'https',
            host: basePath[example] ? 'services.odata.org' : 'localhost',
            basePath: basePath[example] || '/service-root',
            diagram: true
        }
    );

    // fs.writeFileSync(exampleFolder + example + '.json', JSON.stringify(openapi, null, 4));
});