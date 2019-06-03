const assert = require('assert');
const fs = require('fs');

//TODO: generate JSON input once
const csdl = require('odata-csdl');
const lib = require('../lib/csdl2openapi');

const example1 = csdl.xml2json(fs.readFileSync('examples/csdl-16.1.xml'));
const result1 = require('../examples/csdl-16.1.openapi3.json');

describe('Examples', function () {

    it('csdl-16.1', function () {
        assert.deepStrictEqual(lib.csdl2openapi(example1), result1);
    })

})