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

const example9 = csdl.xml2json(fs.readFileSync('examples/odata-rw-v3.xml'));
const result9 = require('../examples/odata-rw-v3.openapi3.json');


describe('Examples', function () {

    it('csdl-16.1', function () {
        const openapi = lib.csdl2openapi(example1);
        // ER diagram doesn't match because XSL version doesn't combine navigation properties with partner
        result1.info.description = 'This service is located at [https://localhost/service-root/](https://localhost/service-root/)';
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
        const host = 'services.odata.org';
        const basePath = '/V4/OData/(S(nsga2k1tyctb0cn0ofcgcn4o))/OData.svc';
        const safePath = '/V4/OData/%28S%28nsga2k1tyctb0cn0ofcgcn4o%29%29/OData.svc';
        const openapi = lib.csdl2openapi(example4, {
            host: host,
            basePath: basePath,
            diagram: false
        });
        // ER diagram doesn't match because XSL version doesn't combine navigation properties with partner
        result4.info.description = 'This service is located at [https://' + host + basePath + '/](https://' + host + safePath + '/)';
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

    it('odata-rw-v3', function () {
        const host = 'services.odata.org';
        const basePath = '/V3/(S(1urrjxgkuh4r30yqim0hqrtj))/OData/OData.svc';
        const safePath = '/V3/%28S%281urrjxgkuh4r30yqim0hqrtj%29%29/OData/OData.svc';
        const openapi = lib.csdl2openapi(example9, { host: host, basePath: basePath, diagram: false });
        // ER diagram doesn't match because XSL version doesn't combine navigation properties with partner
        result9.info.description = 'This service is located at [https://' + host + basePath + '/](https://' + host + safePath + '/)';
        check(openapi, result9);
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
                    $Kind: 'EntityType',
                    $Key: ['key'],
                    key: {}
                },
                typeDefinition: { $Kind: 'TypeDefinition', $Type: 'Edm.DateTimeOffset' },
                typeDefinition3: { $Kind: 'TypeDefinition', $Type: 'Edm.DateTimeOffset', $Scale: 3 }
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
                        properties: {
                            key: { type: 'string' }
                        }
                    },
                    'ReuseTypes.entityType-create': {
                        type: 'object',
                        title: 'Core.Description (for create)',
                        properties: {
                            key: { type: 'string' }
                        },
                        required: ['key']
                    },
                    'ReuseTypes.entityType-update': {
                        type: 'object',
                        title: 'Core.Description (for update)'
                    },
                    'ReuseTypes.typeDefinition': {
                        title: 'typeDefinition', type: 'string', format: 'date-time', example: '2017-04-13T15:51:04Z'
                    },
                    'ReuseTypes.typeDefinition3': {
                        title: 'typeDefinition3', type: 'string', format: 'date-time', example: '2017-04-13T15:51:04.000Z'
                    }
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

    it('function with complex and collection parameter', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" }] } },
            $EntityContainer: 'this.Container',
            this: {
                Complex: { $Kind: 'ComplexType', $OpenType: true },
                ComplexParameters: [{
                    $Kind: 'Function',
                    $Parameter: [
                        { $Name: 'complex', $Type: 'this.Complex', '@Core.Description': 'param description' },
                        { $Name: 'collection', $Collection: true }
                    ],
                    $ReturnType: {}
                }],
                Container: { fun: { $Function: 'this.ComplexParameters' } }
            }
        };
        const expected = { paths: { '/$batch': { post: {} } } };
        const path = '/fun(complex=@complex,collection=@collection)';
        expected.paths[path] = {
            get: {
                parameters: [
                    {
                        name: '@complex', in: 'query', required: true, schema: { type: 'string' },
                        example: '{}',
                        description: 'param description  \nThis is URL-encoded JSON of type this.Complex, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)'
                    },
                    {
                        name: '@collection', in: 'query', required: true, schema: { type: 'string' },
                        example: '[]',
                        description: 'This is a URL-encoded JSON array with items of type Edm.String, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)'
                    }
                ]
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths[path].get.parameters, expected.paths[path].get.parameters, 'function parameters');
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
                            }
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
                            }
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

    it('entity set and singleton with non-existing type', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Container: {
                    set: { $Type: 'self.type_does_not_exist', $Collection: true },
                    single: { $Type: 'self.type_does_not_exist' }
                }
            }
        };
        const expected = {
            paths: {
                "/set": {
                    get: {
                        summary: 'Get entities from set',
                        tags: ['set'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            {
                                in: 'query',
                                name: 'filter',
                                schema: { type: 'string' },
                                description: "Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)"
                            },
                            { $ref: "#/components/parameters/count" }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved entities',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of type_does_not_exist',
                                            properties: {
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: "#/components/schemas/undefined.type_does_not_exist"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {
                        summary: 'Add new entity to set',
                        tags: ['set'],
                        requestBody: {
                            description: 'New entity',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: "#/components/schemas/undefined.type_does_not_exist-create"
                                    }
                                }
                            }
                        },
                        responses: {
                            201: {
                                description: 'Created entity',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: "#/components/schemas/undefined.type_does_not_exist"
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/single": {
                    get: {
                        summary: 'Get single',
                        tags: ['single'],
                        parameters: [],
                        responses: {
                            200: {
                                description: 'Retrieved entity',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: "#/components/schemas/undefined.type_does_not_exist"
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    patch: {
                        summary: 'Update single',
                        tags: ['single'],
                        requestBody: {
                            description: 'New property values',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: "#/components/schemas/undefined.type_does_not_exist-update"
                                    }
                                }
                            }
                        },
                        responses: {
                            204: {
                                description: 'Success'
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/$batch": { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/set'].get, expected.paths['/set'].get, 'GET set');
        assert.deepStrictEqual(actual.paths['/set'].post, expected.paths['/set'].post, 'POST set');
        assert.deepStrictEqual(actual.paths['/single'].get, expected.paths['/single'].get, 'GET single');
        assert.deepStrictEqual(actual.paths['/single'].patch, expected.paths['/single'].patch, 'PATCH single');
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