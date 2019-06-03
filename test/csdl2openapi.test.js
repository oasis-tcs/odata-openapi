const assert = require('assert');
const fs = require('fs');

//TODO: generate JSON input once
const csdl = require('odata-csdl');
const lib = require('../lib/csdl2openapi');

const example1 = csdl.xml2json(fs.readFileSync('examples/csdl-16.1.xml'));
const result1 = require('../examples/csdl-16.1.openapi3.json');

describe('Examples', function () {

    it('csdl-16.1', function () {
        let openapi = lib.csdl2openapi(example1);
        //TODO: remove result tweaking
        Object.keys(result1.paths).forEach(path => {
            const pathItemObject = result1.paths[path];
            Object.keys(pathItemObject).forEach(key => {
                if (['get', 'post', 'patch', 'delete'].includes(key)) pathItemObject[key] = {};
            });
        });
        result1.info.description = '';
        result1.components = {};

        assert.deepStrictEqual(openapi, result1, 'CSDL specification example');
    })

})