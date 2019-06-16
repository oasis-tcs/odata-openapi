const assert = require('assert');
const fs = require('fs');

//TODO: document without entity container, similar to csdl-16.2.xml, but with types

const csdl = require('odata-csdl');
const lib = require('../lib/csdl2openapi');

const example1 = csdl.xml2json(fs.readFileSync('examples/csdl-16.1.xml'));
const result1 = require('../examples/csdl-16.1.openapi3.json');

const example2 = csdl.xml2json(fs.readFileSync('examples/TripPin.xml'));
const result2 = require('../examples/TripPin.openapi3.json');

const example3 = csdl.xml2json(fs.readFileSync('examples/miscellaneous.xml'));
const result3 = require('../examples/miscellaneous.openapi3.json');

const example4 = csdl.xml2json(fs.readFileSync('examples/example.xml'));
const result4 = require('../examples/example.openapi3.json');

const example5 = csdl.xml2json(fs.readFileSync('examples/Northwind.xml'));
const result6 = require('../examples/Northwind.openapi3.json');

//TODO: People, Products

describe('Examples', function () {

    it('csdl-16.1', function () {
        let openapi = lib.csdl2openapi(example1, { diagram: true });
        assert.deepStrictEqual(openapi, result1, 'CSDL specification example');
    })

    it('TripPin', function () {
        let openapi = lib.csdl2openapi(example2, {
            host: 'services.odata.org',
            basePath: '/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW',
            diagram: true
        });
        assert.deepStrictEqual(openapi, result2, 'TripPin reference service');
    })

    it('miscellaneous', function () {
        let openapi = lib.csdl2openapi(example3, { scheme: 'http', diagram: true });
        assert.deepStrictEqual(openapi, result3, 'miscellaneus');
    })

    it('example', function () {
        let openapi = lib.csdl2openapi(example4, {
            host: 'services.odata.org',
            basePath: '/V4/OData/(S(nsga2k1tyctb0cn0ofcgcn4o))/OData.svc',
            diagram: true
        });
        assert.deepStrictEqual(openapi, result4, 'example');
    })

})