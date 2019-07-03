const assert = require('assert');
const fs = require('fs');

//TODO:
// title/description on action/function (import), with fallback from import to action/function
// title/description on action/function return type 
// title/description on path parameters for keys
// title/description on entity types for POST and PATCH request bodies
// tags: Core.Description on entity type as fallback for description on entity set/singleton
// Nullable on action/function return type
// deleteUnreferencedSchemas
// @JSON.Schema
// @Core.Example
// reference undefined type: silent for included schema, warning for local schema
// key-as-segment: single-part and multi-part key
// key-aliases: one and more segments
// navigation properties inherited from base type A.n1 -> B.n2 -> C.n3 
// collection-navigation to entity type without key or unknown entity type: suppress path item with key segment
// remaining Edm types, especially Geo* - see odata-definitions.json
// (external) annotations on actions, functions, parameters, returntype
// control mapping of reference URLs 

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

const example5 = csdl.xml2json(fs.readFileSync('examples/annotations.xml'));
const result5 = require('../examples/annotations.openapi3.json');

const example6 = csdl.xml2json(fs.readFileSync('examples/containment.xml'));
const result6 = require('../examples/containment.openapi3.json');

const example7 = csdl.xml2json(fs.readFileSync('examples/authorization.xml'));
const result7 = require('../examples/authorization.openapi3.json');

const example8 = csdl.xml2json(fs.readFileSync('examples/descriptions.xml'));
const result8 = require('../examples/descriptions.openapi3.json');


describe('Examples', function () {

    it('csdl-16.1', function () {
        const openapi = lib.csdl2openapi(example1, { diagram: true });
        check(openapi, result1);
    })

    it('TripPin', function () {
        const openapi = lib.csdl2openapi(example2, {
            host: 'services.odata.org',
            basePath: '/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW',
            diagram: true
        });
        check(openapi, result2);
    })

    it('miscellaneous', function () {
        const openapi = lib.csdl2openapi(example3, { scheme: 'http' });
        // ER diagram doesn't match due to different sequence of types and container children
        result3.info.description = 'This service is located at [http://localhost/service-root/](http://localhost/service-root/)';
        check(openapi, result3);
    })

    it('example', function () {
        const openapi = lib.csdl2openapi(example4, {
            host: 'services.odata.org',
            basePath: '/V4/OData/(S(nsga2k1tyctb0cn0ofcgcn4o))/OData.svc',
            diagram: true
        });
        check(openapi, result4);
    })

    it('annotations', function () {
        const openapi = lib.csdl2openapi(example5, { diagram: true });
        check(openapi, result5);
    })

    it('containment', function () {
        const openapi = lib.csdl2openapi(example6, { diagram: true });
        check(openapi, result6);
    })

    it('authorization', function () {
        const openapi = lib.csdl2openapi(example7, { diagram: true });
        check(openapi, result7);
    })

    it('descriptions', function () {
        const openapi = lib.csdl2openapi(example8, { scheme: 'http' });
        // ER diagram doesn't match due to different sequence of types and container children
        result8.info.description = 'Container - LongDescription';
        check(openapi, result8);
    })

    it('empty input', function () {
        const csdl = {};
        const expected = {
            openapi: '3.0.0',
            info: {
                title: 'OData CSDL document',
                description: '',
                version: ''
            },
            paths: {},
            components: { schemas: {} }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi, expected, 'Empty CSDL document');
    })

    it('only types', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" }] } },
            ReuseTypes: {
                entityType: {
                    '@Core.Description': 'Core.Description',
                    $Kind: 'EntityType', $Key: ['key'], key: {}
                },
                typeDefinition: { $Kind: 'TypeDefinition' }
            }
        };
        const expected = {
            openapi: '3.0.0',
            info: {
                title: 'OData CSDL document',
                description: '',
                version: ''
            },
            paths: {},
            components: {
                schemas: {
                    'ReuseTypes.entityType': {
                        type: 'object',
                        title: 'Core.Description',
                        properties: { key: { type: 'string' } }
                    },
                    'ReuseTypes.entityType-create': {
                        type: 'object',
                        title: 'Core.Description (for create)',
                        properties: { key: { type: 'string' } },
                        required: ['key']
                    },
                    'ReuseTypes.entityType-update': {
                        type: 'object',
                        title: 'Core.Description (for update)'
                    },
                    'ReuseTypes.typeDefinition': { title: 'typeDefinition', type: 'string' }
                }
            }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi, expected, 'Empty CSDL document');
    })

    it('no key', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                NoKey: { $Kind: 'EntityType' },
                Container: { Set: { $Collection: true, $Type: 'this.NoKey' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('base type not found', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: { Set: { $Collection: true, $Type: 'this.Derived' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('no inherited key', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Base: { $Kind: 'EntityType' },
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: { Set: { $Collection: true, $Type: 'this.Derived' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('inherited key', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Base: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: { Set: { $Collection: true, $Type: 'this.Derived' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                "/Set('{key}')": { get: {}, patch: {}, delete: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('function without parameters', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                NoParameters: [{ $Kind: 'Function', $ReturnType: {} }],
                Container: { fun: { $Function: 'this.NoParameters' } }
            }
        };
        const expected = {
            paths: {
                '/fun()': { get: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('return type with facets', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                fun: [
                    { $Kind: 'Function', $ReturnType: { $MaxLength: 20 } },
                    { $Kind: 'Function', $Parameter: [{ $Name: 'in' }], $ReturnType: { $Collection: true, $MaxLength: 20 } }
                ],
                Container: { fun: { $Function: 'this.fun' } }
            }
        };
        const expected = {
            paths: {
                "/fun()": {
                    get: {
                        responses: {
                            200: {
                                description: 'Success',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'string',
                                            maxLength: 20
                                        }
                                    }
                                }
                            },
                            default: {}
                        }
                    }
                },
                "/fun(in='{in}')": {
                    get: {
                        responses: {
                            200: {
                                description: 'Success',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of String',
                                            properties: {
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'string',
                                                        maxLength: 20
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            default: {}
                        }
                    }
                },
                "/$batch": { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(
            actual.paths['/fun()'].get.responses[200],
            expected.paths['/fun()'].get.responses[200], 'fun');
        assert.deepStrictEqual(
            actual.paths["/fun(in='{in}')"].get.responses[200],
            expected.paths["/fun(in='{in}')"].get.responses[200], 'fun(in)');
    })

    it('delta link, no $batch', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capa" }] } },
            $EntityContainer: 'this.Container',
            this: {
                ET: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Container: {
                    Set: {
                        $Type: 'this.ET', $Collection: true,
                        '@Capa.ChangeTracking': { Supported: true }
                    },
                    '@Capa.BatchSupported': false
                }
            }
        };
        const expected = {
            paths: {
                "/Set": {
                    get: {},
                    post: {}
                },
                "/Set('{key}')": { get: {}, patch: {}, delete: {} }
            }
        };
        const expectedGetResponseProperties = {
            value: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/this.ET'
                    //TODO:delta
                }
            },
            "@odata.deltaLink": {
                example: "/service-root/Set?$deltatoken=opaque server-generated token for fetching the delta",
                type: "string"
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(
            actual.paths['/Set'].get.responses[200].content['application/json'].schema.properties,
            expectedGetResponseProperties, 'get list with delta');
    })

})

function check(actual, expected) {
    assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
    assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    assert.deepStrictEqual(actual, expected, 'OpenAPI document');
}

function paths(openapi) {
    return Object.keys(openapi.paths).sort();
}

function operations(openapi) {
    const p = {};
    Object.keys(openapi.paths).forEach(template => {
        p[template] = Object.keys(openapi.paths[template]).filter(op => op != 'parameters');
    });
    return p;
}