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
        const openapi = lib.csdl2openapi(example3, { diagram: true });
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
        const openapi = lib.csdl2openapi(example8, { diagram: true });
        check(openapi, result8);
    })

    it('odata-rw-v3', function () {
        const openapi = lib.csdl2openapi(example9, {
            host: 'services.odata.org',
            basePath: '/V3/(S(1urrjxgkuh4r30yqim0hqrtj))/OData/OData.svc',
            diagram: true
        });
        check(openapi, result9);
    })
})

describe('Edge cases', function () {

    it('empty input', function () {
        const csdl = {};
        const expected = {
            openapi: '3.0.2',
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
            $Reference: { dummy: { '$Include': [{ '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' }] } },
            ReuseTypes: {
                entityType: {
                    '@Core.Description': 'Core.Description',
                    $Kind: 'EntityType',
                    $Key: ['key'],
                    key: {}
                },
                typeDefinition: { $Kind: 'TypeDefinition', $UnderlyingType: 'Edm.DateTimeOffset' },
                typeDefinition3: { $Kind: 'TypeDefinition', $UnderlyingType: 'Edm.DateTimeOffset', $Precision: 3 }
            }
        };
        const expected = {
            openapi: '3.0.2',
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

    it('circular reference on collect primitive paths', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                source: {
                    $Kind: 'EntityType',
                    $Key: ['s_id'],
                    s_id: {},
                    complex1: { $Type: 'this.complex1' },
                    complex2: { $Type: 'this.complex2' },
                },
                complex1: {
                    $Kind: 'ComplexType',
                    beforeComplex2: {},
                    complex2: { $Type: 'this.complex2' },
                    afterComplex2: {}
                },
                complex2: {
                    $Kind: 'ComplexType',
                    beforeComplex1: {},
                    complex1: { $Type: 'this.complex1' },
                    afterComplex1: {}
                },                
                Container: {
                    sources: { $Type: 'this.source', $Collection: true },
                }
            }
        };

        expected_sources_get_param = {
            description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
            explode: false,
            in: 'query',
            name: 'orderby',
            schema: {
                items: {
                    enum: [
                        's_id',
                        's_id desc',
                        'complex1/beforeComplex2',
                        'complex1/beforeComplex2 desc',
                        'complex1/complex2/beforeComplex1',
                        'complex1/complex2/beforeComplex1 desc',
                        'complex1/complex2/afterComplex1',
                        'complex1/complex2/afterComplex1 desc',
                        'complex1/afterComplex2',
                        'complex1/afterComplex2 desc',
                        'complex2/beforeComplex1',
                        'complex2/beforeComplex1 desc',
                        'complex2/complex1/beforeComplex2',
                        'complex2/complex1/beforeComplex2 desc',
                        'complex2/complex1/afterComplex2',
                        'complex2/complex1/afterComplex2 desc',
                        'complex2/afterComplex1',
                        'complex2/afterComplex1 desc'
                    ],
                    type: 'string'
                },
                type: 'array',
                uniqueItems: true
            }
        }

        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi.paths['/sources'].get.parameters[4], expected_sources_get_param);
    })

    it('type definition with @JSON.Schema', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' },
                        { '$Namespace': 'Org.OData.JSON.V1', '$Alias': 'JSON' }
                    ]
                }
            },
            jsonExamples: {
                typeDefinitionOld: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@JSON.Schema": "{\"type\":\"object\",\"additionalProperties\":false,\"patternProperties\":{\"^[\\\\w\\\\.\\\\-\\\\/]+$\":{\"type\":\"string\"}}}"
                },
                typeDefinitionNew: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@JSON.Schema": {
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: { "^[\\w\\.\\-\\/]+$": { type: 'string' } }
                    }
                }
            }
        };
        const expected = {
            openapi: '3.0.2',
            info: {
                title: 'OData CSDL document',
                description: '',
                version: ''
            },
            paths: {},
            components: {
                schemas: {
                    'jsonExamples.typeDefinitionOld': {
                        title: 'typeDefinitionOld',
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: {
                            "^[\\w\\.\\-\\/]+$": { type: 'string' }
                        }
                    },
                    'jsonExamples.typeDefinitionNew': {
                        title: 'typeDefinitionNew',
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: {
                            "^[\\w\\.\\-\\/]+$": { type: 'string' }
                        }
                    }
                }
            }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi, expected, 'Empty CSDL document');
    })

    it('type definition with @Org.OData.JSON.V1.Schema', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1'},
                        { '$Namespace': 'Org.OData.JSON.V1'}
                    ]
                }
            },
            jsonExamples: {
                typeDefinitionOld: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@Org.OData.JSON.V1.Schema": "{\"type\":\"object\",\"additionalProperties\":false,\"patternProperties\":{\"^[\\\\w\\\\.\\\\-\\\\/]+$\":{\"type\":\"string\"}}}"
                },
                typeDefinitionNew: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@Org.OData.JSON.V1.Schema": {
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: { "^[\\w\\.\\-\\/]+$": { type: 'string' } }
                    }
                }
            }
        };
        const expected = {
            openapi: '3.0.2',
            info: {
                title: 'OData CSDL document',
                description: '',
                version: ''
            },
            paths: {},
            components: {
                schemas: {
                    'jsonExamples.typeDefinitionOld': {
                        title: 'typeDefinitionOld',
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: {
                            "^[\\w\\.\\-\\/]+$": { type: 'string' }
                        }
                    },
                    'jsonExamples.typeDefinitionNew': {
                        title: 'typeDefinitionNew',
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: {
                            "^[\\w\\.\\-\\/]+$": { type: 'string' }
                        }
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

    it('inherited key, BatchSupport/Supported:false', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            $Reference: { dummy: { $Include: [{ $Namespace: 'Org.OData.Capabilities.V1', $Alias: 'Capabilities' }] } },
            this: {
                Base: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: {
                    '@Capabilities.BatchSupport': { Supported: false },
                    Set: { $Collection: true, $Type: 'this.Derived' }
                }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                "/Set('{key}')": { get: {}, patch: {}, delete: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('key-as-segment', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' },
                        { '$Namespace': 'Org.OData.Capabilities.V1', '$Alias': 'Capabilities' }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                Type: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Type2: { $Kind: 'EntityType', $Key: ['key1', 'key2'], key1: {}, key2: {} },
                Container: {
                    '@Capabilities.BatchSupport': {
                        '@Core.Description': 'BatchSupport - Description',
                        '@Core.LongDescription': 'BatchSupport - LongDescription'
                    },
                    '@Capabilities.KeyAsSegmentSupported': true,
                    Set: { $Collection: true, $Type: 'this.Type' },
                    Set2: { $Collection: true, $Type: 'this.Type2' }
                }
            }
        }
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/Set/{key}': { get: {}, patch: {}, delete: {} },
                '/Set2': { get: {}, post: {} },
                '/Set2/{key1}/{key2}': { get: {}, patch: {}, delete: {} },
                '/$batch': { post: {} }
            }
        }
        const actual = lib.csdl2openapi(csdl);
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.equal(actual.paths['/$batch'].post.summary, 'BatchSupport - Description', 'Batch summary');
        assert.equal(actual.paths['/$batch'].post.description, 'BatchSupport - LongDescription\n\n*Please note that "Try it out" is not supported for this request.*', 'Batch description');
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
            $Reference: { dummy: { '$Include': [{ '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' }] } },
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
                '/fun()': {
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
                                                '@odata.count': {
                                                    $ref: '#/components/schemas/count'
                                                },
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
                '/$batch': { post: {} }
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
            '@odata.count': {
                $ref: '#/components/schemas/count'
            },
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
                                                '@odata.count': {
                                                    $ref: '#/components/schemas/count'
                                                },
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

    it('inheritance', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                base: {
                    $Kind: 'EntityType', $Abstract: true, baseProp: {},
                    baseNav: { $Kind: 'NavigationProperty', $Type: 'this.other', $ContainsTarget: true }
                },
                derived: {
                    $Kind: 'EntityType', $BaseType: 'this.base', $Key: ['key'], key: {}, derivedProp: {},
                    derivedNav: { $Kind: 'NavigationProperty', $Type: 'this.other' }
                },
                Container: {
                    set: { $Type: 'this.derived', $Collection: true }
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
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: 'orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'baseProp',
                                            'baseProp desc',
                                            'key',
                                            'key desc',
                                            'derivedProp',
                                            'derivedProp desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'baseProp',
                                            'key',
                                            'derivedProp'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'expand',
                                description: 'Expand related entities, see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'baseNav',
                                            'derivedNav'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved entities',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of derived',
                                            properties: {
                                                '@odata.count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.derived'
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
                                        $ref: '#/components/schemas/this.derived'
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
                                            $ref: '#/components/schemas/undefined.type_does_not_exist'
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
                "/set('{key}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/set('{key}')/baseNav": {
                    get: {},
                    patch: {}
                },
                "/set('{key}')/derivedNav": {
                    get: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/set'].get, expected.paths['/set'].get, 'GET set');
    })

    it('navigation property in complex type', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                source: {
                    $Kind: 'EntityType', $Key: ['s_id'], s_id: {}, complexProp: { $Type: 'this.complex', $Collection: true },
                },
                complex: {
                    $Kind: 'ComplexType',
                    primProp: {},
                    navProp: { $Kind: 'NavigationProperty', $Type: 'this.target', $Collection: true }
                },
                target: {
                    $Kind: 'EntityType', $BaseType: 'this.base', $Key: ['t_id'], t_id: {}
                },
                Container: {
                    sources: { $Type: 'this.source', $Collection: true },
                    targets: { $Type: 'this.target', $Collection: true }
                }
            }
        };
        const expected = {
            paths: {
                "/sources": {
                    get: {
                        summary: 'Get entities from sources',
                        tags: ['sources'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            {
                                in: 'query',
                                name: 'filter',
                                schema: { type: 'string' },
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: 'orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            's_id',
                                            's_id desc',
                                            'complexProp/primProp',
                                            'complexProp/primProp desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            's_id',
                                            'complexProp'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'expand',
                                description: 'Expand related entities, see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'complexProp/navProp'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved entities',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of source',
                                            properties: {
                                                '@odata.count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.source'
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
                                        $ref: '#/components/schemas/this.derived'
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
                                            $ref: '#/components/schemas/undefined.type_does_not_exist'
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
                "/sources('{s_id}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/targets": {
                    get: {},
                    post: {}
                },
                "/targets('{t_id}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/sources'].get, expected.paths['/sources'].get, 'GET sources');
    })

    it('key aliases', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Category: {
                    $Kind: 'EntityType', $Key: [{ EntityInfoID: 'Info/ID' }],
                    Info: { $Type: 'this.EntityInfo' },
                    Name: { $Nullable: true }
                },
                EntityInfo: {
                    $Kind: 'ComplexType',
                    ID: { $Type: 'Edm.Int32' },
                    Created: { $Type: 'Edm.DateTimeOffset' }
                },
                Container: {
                    $Kind: 'EntityContainer',
                    Categories: { $Type: 'this.Category', $Collection: true }
                }
            }
        };
        const expected = {
            paths: {
                "/Categories": {
                    get: {
                        summary: 'Get entities from Categories',
                        tags: ['Categories'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            {
                                in: 'query',
                                name: 'filter',
                                schema: { type: 'string' },
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: 'orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'Info/ID',
                                            'Info/ID desc',
                                            'Info/Created',
                                            'Info/Created desc',
                                            'Name',
                                            'Name desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'Info',
                                            'Name'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved entities',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of Category',
                                            properties: {
                                                '@odata.count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.Category'
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
                                        $ref: '#/components/schemas/this.derived'
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
                                            $ref: '#/components/schemas/undefined.type_does_not_exist'
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
                "/Categories({EntityInfoID})": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/Categories'].get, expected.paths['/Categories'].get, 'GET Categories');
    })

    it('FilterRestrictions, NavigationRestrictions, SearchRestrictions, and SortRestrictions', function () {
        const csdl = {
            $Version: '4.01',
            $Reference: {
                dummy: {
                    "$Include": [
                        { "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" },
                        { "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                thing: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.thing', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                Container: {
                    things: {
                        $Type: 'this.thing', $Collection: true,
                        "@Capabilities.FilterRestrictions": {
                            "@Core.Description": "Filtering has some restrictions here.",
                            "RequiredProperties": ["two"]
                        },
                        "@Capabilities.NavigationRestrictions": {
                            "RestrictedProperties": [
                                {
                                    "NavigationProperty": "nav",
                                    "Navigability": "Single"
                                }
                            ]
                        },
                        "@Capabilities.SearchRestrictions": {
                            "@Core.Description": "Searching has some restrictions here.",
                            "Searchable": true
                        },
                        "@Capabilities.SortRestrictions": {
                            "@Core.Description": "Sorting has some restrictions here.",
                            "NonSortableProperties": ["one"]
                        }
                    }
                }
            }
        };
        const expected = {
            paths: {
                "/things": {
                    get: {
                        summary: 'Get entities from things',
                        tags: ['things'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            {
                                in: 'query',
                                name: 'search',
                                schema: { type: 'string' },
                                description: 'Searching has some restrictions here.'
                            },
                            {
                                in: 'query',
                                name: 'filter',
                                schema: { type: 'string' },
                                description: 'Filtering has some restrictions here.\n\nRequired filter properties:\n- two'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: 'orderby',
                                description: 'Sorting has some restrictions here.',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'key',
                                            'key desc',
                                            'two',
                                            'two desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'key',
                                            'one',
                                            'two'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: 'expand',
                                description: 'Expand related entities, see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'nav'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved entities',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of thing',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.thing'
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
                    post: {}
                },
                "/things('{key}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/things('{key}')/nav": {
                    get: {},
                    patch: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/things'].get, expected.paths['/things'].get, 'GET things');
    })

    it('ExpandRestrictions', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    "$Include": [
                        { "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" },
                        { "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                root: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.child', $Kind: 'NavigationProperty', $ContainsTarget: true },
                    no_expand: { $Type: 'this.child', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                child: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.grandchild', $Kind: 'NavigationProperty', $ContainsTarget: true },
                    no_expand: { $Type: 'this.grandchild', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                grandchild: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {}
                },
                Container: {
                    roots: {
                        $Type: 'this.root', $Collection: true,
                        "@Capabilities.ExpandRestrictions": {
                            "@Core.Description": "Expanding has some restrictions here.",
                            "NonExpandableProperties": ["no_expand", "nav/no_expand", "no_expand/no_expand"]
                        }
                    }
                }
            }
        };
        const expectedExpands = {
            "/roots": [
                '*',
                'nav'
            ],
            "/roots('{key}')": [
                '*',
                'nav'
            ],
            "/roots('{key}')/nav": [
                '*',
                'nav'
            ],
            "/roots('{key}')/no_expand": [
                '*',
                'nav'
            ]
        }

        const actual = lib.csdl2openapi(csdl, {});

        const actualExpands = {}
        for (const [path, item] of Object.entries(actual.paths)) {
            const expand = item.get && item.get.parameters && item.get.parameters.find(param => param.name === 'expand')
            if (expand) {
                actualExpands[path] = expand.schema.items.enum
            }
        }
        assert.deepStrictEqual(actualExpands, expectedExpands, 'expands');
        assert.equal(actual.paths['/roots'].get.parameters.find(item => item.name == 'expand').description, 'Expanding has some restrictions here.', 'expand description')
    })

    it('Default Namespace', function () {

        const csdl = {
            $Version: '4.01',
            $Reference: {
                dummy: {
                    "$Include": [
                        { "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" },
                        { "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                '@Core.DefaultNamespace': true,
                root: {
                    $Kind: 'EntityType', $Key: ['key'], key: {}
                },
                act: [
                    {
                        $Kind: 'Action',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root' }]
                    },
                    {
                        $Kind: 'Action',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root', $Collection: true }]
                    }
                ],
                func: [
                    {
                        $Kind: 'Function',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root' }],
                        $ReturnType: {}
                    },
                    {
                        $Kind: 'Function',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root', $Collection: true }],
                        $ReturnType: {}
                    }
                ],
                Container: {
                    '@Capabilities.KeyAsSegmentSupported': true,
                    roots: {
                        $Type: 'this.root', $Collection: true
                    }
                }
            }
        };

        const expected = {
            paths: {
                "/$batch": { post: {} },
                "/roots": { get: {}, post: {} },
                "/roots/act": {
                    post: {
                        summary: 'Invoke action act',
                        tags: ['roots'],
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
                "/roots/func": { get: {} },
                "/roots/{key}": { get: {}, patch: {}, delete: {} },
                "/roots/{key}/act": { post: {} },
                "/roots/{key}/func": { get: {} }
            }
        }

        const actual = lib.csdl2openapi(csdl, {});

        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/roots/act'].post, expected.paths['/roots/act'].post, 'POST /roots/act');
    })

    it('Deep update on container level', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }] } },
            $EntityContainer: 'this.Container',
            this: {
                root: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    children: { $Type: 'this.child', $Kind: 'NavigationProperty', $ContainsTarget: true, $Collection: true },
                },
                child: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.grandchild', $Kind: 'NavigationProperty', $ContainsTarget: true },
                },
                grandchild: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {}
                },
                Container: {
                    '@Capabilities.KeyAsSegmentSupported': true,
                    '@Capabilities.DeepUpdateSupport': { Supported: true },
                    roots: {
                        $Type: 'this.root', $Collection: true
                    }
                }
            }
        };

        const expected = {
            paths: {
                "/$batch": { post: {} },
                "/roots": { get: {}, post: {} },
                "/roots/{key}": { get: {}, patch: {}, delete: {} },
                "/roots/{key}/children": { get: {}, post: {} },
                "/roots/{key}/children/{key_1}": { get: {}, patch: {}, delete: {} },
                "/roots/{key}/children/{key_1}/nav": { get: {}, patch: {} },
            },
            components: {
                schemas: {
                    'this.root-update': {
                        type: 'object',
                        title: 'root (for update)',
                        properties: {
                            one: { type: 'string' }, two: { type: 'string' },
                            children: { type: 'array', items: { $ref: '#/components/schemas/this.child-create' } }
                        }
                    },
                    'this.child-update': {
                        type: 'object',
                        title: 'child (for update)',
                        properties: {
                            one: { type: 'string' }, two: { type: 'string' },
                            nav: { $ref: '#/components/schemas/this.grandchild-create' }
                        }
                    }
                }
            }
        }

        const actual = lib.csdl2openapi(csdl, {});

        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');

        //TODO: check components
        assert.deepStrictEqual(actual.components.schemas['this.root-update'], expected.components.schemas['this.root-update'], 'root update structure')
        assert.deepStrictEqual(actual.components.schemas['this.child-update'], expected.components.schemas['this.child-update'], 'child update structure')
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