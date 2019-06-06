/**
 * Converts OData CSDL JSON or XML 4.0x to OpenAPI 3.0.0
*/

//TODO: see //TODO comments below


/**
 * Construct an OpenAPI description from a CSDL document
 * @param {object} csdl CSDL document
 * @param {object} options Optional parameters
 * @return {object} OpenAPI description
 */
module.exports.csdl2openapi = function (
    csdl,
    {
        scheme = 'https',
        host = 'localhost',
        basePath = '/service-root',
        diagram = false
    } = {}
) {
    const serviceRoot = scheme + '://' + host + basePath;
    const queryOptionPrefix = csdl.$Version <= '4.0' ? '$' : '';

    //TODO: construct using aliases from csdl
    const voc = {
        Core: {
            Description: '@Core.Description'
        }
    };

    //TODO: overloads by binding type name

    const container = modelElement(csdl.$EntityContainer);
    console.assert(container.$Kind == 'EntityContainer', 'Could not find entity container ' + csdl.$EntityContainer);

    return {
        openapi: '3.0.0',
        info: info(csdl),
        servers: servers(serviceRoot),
        tags: tags(container),
        paths: paths(container),
        components: components(csdl)
    };


    /**
     * Construct the Info Object
     * @param {object} csdl CSDL document
     * @return {object} Info Object
     */
    function info(csdl) {
        //TODO: Core.Description, Core.LongDescription, Core.SchemaVersion
        var description = 'This service is located at [' + serviceRoot + '/](' + serviceRoot + '/)' + (diagram ? resourceDiagram(csdl) : '');
        //TODO: yUML
        return {
            title: 'Service for namespace ' + nameParts(csdl.$EntityContainer).qualifier,
            description: description,
            version: ''
        };
    }

    function resourceDiagram(csdl) {
        var diagram = '\n\n## Entity Data Model\n![ER Diagram](https://yuml.me/diagram/class/';
        var comma = '';

        Object.keys(csdl).filter(name => isIdentifier(name)).forEach(namespace => {
            const schema = csdl[namespace];
            Object.keys(schema).filter(name => isIdentifier(name) && ['EntityType', 'ComplexType'].includes(schema[name].$Kind))
                .forEach(typeName => {
                    const type = schema[typeName];
                    diagram += comma + '[' + typeName + (type.$Kind == 'EntityType' ? '{bg:orange}' : '') + ']';
                    Object.keys(type).filter(name => isIdentifier(name)).forEach(propertyName => {
                        property = type[propertyName];
                        target = nameParts(property.$Type || 'Edm.String');
                        if (property.$Kind == 'NavigationProperty' || target.qualifier != 'Edm') {
                            diagram += ',[' + typeName + ']-'
                                + (property.$Collection ? '*' : (property.$Nullable ? '0..1' : ''))
                                + '>[' + target.name + ']';
                        }
                    });
                    comma = ',';
                });
        });

        return diagram + ')';
    }

    /**
     * Find model element by qualified name
     * @param {string} qname Qualified name of model element
     * @return {object} Model element
     */
    function modelElement(qname) {
        const q = nameParts(qname);
        return csdl[q.qualifier][q.name];
    }

    /**
     * Construct an array of Server Objects
     * @param {object} csdl The CSDL document
     * @param {object} options Optional parameters
     * @return {Array} The list of servers
     */
    function servers(serviceRoot) {
        return [{ url: serviceRoot }];
    }

    /**
     * Construct an array of Tag Objects from the entity container
     * @param {object} container The entity container
     * @return {Array} The list of tags
     */
    function tags(container) {
        const tags = [];
        // all entity sets and singletons
        Object.keys(container).filter(name => isIdentifier(name) && container[name].$Type).forEach(child => {
            let tag = { name: child };
            let description = container[child][voc.Core.Description];
            if (description) tag.description = description;
            tags.push(tag);
        })
        return tags;
    }

    /**
     * Construct the Paths Object from the entity container
     * @param {object} container Entity container
     * @return {object} Paths Object
     */
    function paths(container) {
        const paths = {};
        Object.keys(container).filter(name => isIdentifier(name)).forEach(name => {
            let child = container[name];
            if (child.$Type) {
                // entity sets and singletons are almost containment navigation properties
                child.$ContainsTarget = true;
                pathItems(paths, '/' + name, [], child, child, name, name, 0);
            } else if (child.$Action) {
                pathItemActionImport(paths, name, child);
            } else if (child.$Function) {
                pathItemFunctionImport(paths, name, child);
            }
        })
        pathItemBatch(paths);
        return paths;
    }

    /**
     * Add path and Path Item Object for a navigation segment
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element of navigation segment
     * @param {object} root Root model element
     * @param {string} sourceTag Tag of path source
     * @param {string} targetTag Tag of path target
     * @param {integer} level Number of navigation segments so far
     */
    function pathItems(paths, prefix, prefixParameters, element, root, sourceTag, targetTag, level) {
        const name = prefix.substring(prefix.lastIndexOf('/') + 1);
        const type = modelElement(element.$Type);
        const pathItem = {};
        paths[prefix] = pathItem;
        if (prefixParameters.length > 0) paths[prefix].parameters = prefixParameters;

        pathItem.get = operationRead(element, name, sourceTag, targetTag, level);;

        if (element.$Collection && (level < 2 || element.$ContainsTarget)) {
            pathItem.post = operationCreate(element, name, sourceTag, targetTag, level);
            pathItemsForBoundOperations(paths, prefix, prefixParameters, element);
        }

        if (element.$ContainsTarget) {
            if (element.$Collection) {
                pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceTag, targetTag, level)
            } else {
                pathItem.patch = operationUpdate(element, name, sourceTag, targetTag, level);
                if (element.$Nullable)
                    pathItem.delete = operationDelete(name, sourceTag, targetTag, level);
                pathItemsForBoundOperations(paths, prefix, prefixParameters, element);
                pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceTag, level);
            }
        }
    }

    /**
     * Add path and Path Item Object for a navigation segment with key
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element of navigation segment
     * @param {object} root Root model element
     * @param {string} sourceTag Tag of path source
     * @param {string} targetTag Tag of path target
     * @param {integer} level Number of navigation segments so far
     */
    function pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceTag, targetTag, level) {
        const name = prefix.substring(prefix.lastIndexOf('/') + 1);
        const type = modelElement(element.$Type);
        const key = entityKey(type, level);
        const path = prefix + key.segment;
        const parameters = prefixParameters.concat(key.parameters);
        const pathItem = {};
        paths[path] = pathItem;
        if (parameters.length > 0) pathItem.parameters = parameters;

        pathItem.get = operationRead(element, name, sourceTag, targetTag, level, true);;
        pathItem.patch = operationUpdate(element, name, sourceTag, targetTag, level);
        pathItem.delete = operationDelete(name, sourceTag, targetTag, level);

        pathItemsForBoundOperations(paths, path, parameters, element);
        pathItemsWithNavigation(paths, path, parameters, type, root, sourceTag, level);
    }

    /**
     * Construct Operation Object for create
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceTag Tag of path source
     * @param {string} targetTag Tag of path target
     * @param {integer} level Number of navigation segments so far
     */
    function operationCreate(element, name, sourceTag, targetTag, level) {
        const operation = {
            summary: 'Add new entity to ' + (level > 0 ? 'related ' : '') + name,
            tags: [sourceTag],
            requestBody: {
                description: 'New entity',
                required: true,
                content: {
                    'application/json': {
                        schema: ref(element.$Type, '-create')
                    }
                }
            },
            responses: response(201, 'Created entity', element.$Type)
        };
        if (targetTag && sourceTag != targetTag) operation.tags.push(targetTag);
        return operation;
    }

    /**
     * Construct Operation Object for read
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceTag Tag of path source
     * @param {string} targetTag Tag of path target
     * @param {integer} level Number of navigation segments so far
     */
    function operationRead(element, name, sourceTag, targetTag, level, byKey = false) {
        const collection = !byKey && element.$Collection;
        const operation = {
            summary: 'Get '
                + (byKey ? 'entity from ' : (element.$Collection ? 'entities from ' : ''))
                + (level > 0 ? 'related ' : '')
                + name
                + (byKey ? ' by key' : ''),
            tags: [sourceTag],
            parameters: [],
            responses: response(200, 'Retrieved entit' + (collection ? 'ies' : 'y'), element.$Type, collection)
        };
        if (targetTag && sourceTag != targetTag) operation.tags.push(targetTag);

        if (collection) {
            //TODO: other options
            optionTop(operation.parameters);
            optionSkip(operation.parameters);
            optionSearch(operation.parameters);
            optionFilter(operation.parameters);
            optionCount(operation.parameters);
            optionOrderBy(operation.parameters, element);
        }

        optionSelect(operation.parameters, element);
        optionExpand(operation.parameters, element);

        return operation;
    }

    /**
     * Add parameter for query option $count
     * @param {Array} parameters Array of parameters to augment
     */
    function optionCount(parameters) {
        parameters.push({
            $ref: '#/components/parameters/count'
        });
    }

    /**
     * Add parameter for query option $expand
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     */
    function optionExpand(parameters, element) {
        const type = modelElement(element.$Type);
        const expandItems = ['*'];
        Object.keys(type).filter(key => isIdentifier(key) && type[key].$Kind == 'NavigationProperty').forEach(
            key => expandItems.push(key)
        )
        if (expandItems.length > 1) {
            parameters.push({
                name: queryOptionPrefix + 'expand',
                description: 'Expand related entities, see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                in: 'query',
                explode: false,
                schema: {
                    type: 'array',
                    uniqueItems: true,
                    items: {
                        type: 'string',
                        enum: expandItems
                    }
                }
            });
        }
    }

    /**
     * Add parameter for query option $filter
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     */
    function optionFilter(parameters, element) {
        parameters.push({
            name: queryOptionPrefix + 'filter',
            description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)',
            in: 'query',
            schema: {
                type: 'string'
            }
        });
    }

    /**
     * Add parameter for query option $orderby
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     */
    function optionOrderBy(parameters, element) {
        const type = modelElement(element.$Type);
        const orderbyItems = [];
        Object.keys(type).filter(key => isIdentifier(key) && type[key].$Kind != 'NavigationProperty').forEach(
            key => {
                orderbyItems.push(key);
                orderbyItems.push(key + ' desc');
            }
        )
        parameters.push({
            name: queryOptionPrefix + 'orderby',
            description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
            in: 'query',
            explode: false,
            schema: {
                type: 'array',
                uniqueItems: true,
                items: {
                    type: 'string',
                    enum: orderbyItems
                }
            }
        });
    }

    /**
     * Add parameter for query option $search
     * @param {Array} parameters Array of parameters to augment
     */
    function optionSearch(parameters) {
        parameters.push({
            $ref: '#/components/parameters/search'
        });
    }

    /**
     * Add parameter for query option $select
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     */
    function optionSelect(parameters, element) {
        const type = modelElement(element.$Type);
        const selectItems = [];
        Object.keys(type).filter(key => isIdentifier(key) && type[key].$Kind != 'NavigationProperty').forEach(
            key => selectItems.push(key)
        )
        parameters.push({
            name: queryOptionPrefix + 'select',
            description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
            in: 'query',
            explode: false,
            schema: {
                type: 'array',
                uniqueItems: true,
                items: {
                    type: 'string',
                    enum: selectItems
                }
            }
        });
    }

    /**
     * Add parameter for query option $skip
     * @param {Array} parameters Array of parameters to augment
     */
    function optionSkip(parameters) {
        parameters.push({
            $ref: '#/components/parameters/skip'
        });
    }

    /**
     * Add parameter for query option $top
     * @param {Array} parameters Array of parameters to augment
     */
    function optionTop(parameters) {
        parameters.push({
            $ref: '#/components/parameters/top'
        });
    }

    /**
     * Construct Operation Object for update
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceTag Tag of path source
     * @param {string} targetTag Tag of path target
     * @param {integer} level Number of navigation segments so far
     */
    function operationUpdate(element, name, sourceTag, targetTag, level) {
        return {
            summary: 'Update ' + (element.$Collection ? 'entity in ' : '') + (level > 0 ? 'related ' : '') + name,
            tags: [sourceTag],
            requestBody: {
                description: 'New property values',
                required: true,
                content: {
                    'application/json': {
                        schema: ref(element.$Type, '-update')
                    }
                }
            },
            responses: response(204, 'Success')
        };
    }

    /**
     * Construct Operation Object for delete
     * @param {string} name Name of navigation segment
     * @param {string} sourceTag Tag of path source
     * @param {string} targetTag Tag of path target
     * @param {integer} level Number of navigation segments so far
     */
    function operationDelete(name, sourceTag, targetTag, level) {
        return {
            summary: 'Delete entity from ' + (level > 0 ? 'related ' : '') + name,
            tags: [sourceTag],
            responses: response(204, 'Success')
        };
    }

    /**
     * Add path and Path Item Object for actions and functions bound to the element
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element the operations are bound to
     */
    function pathItemsForBoundOperations(paths, prefix, prefixParameters, element) {
        //TODO: find actions and functions 
    }

    /**
     * Add paths and Path Item Objects for navigation segments
     * @param {object} paths The Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} type Entity type object of navigation segment
     * @param {string} sourceTag Tag of path source
     * @param {integer} level Number of navigation segments so far
     */
    function pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceTag, level) {
        //TODO: make this an option
        if (level < 5) {
            //TODO: collect navigation properties along $BaseType
            Object.keys(type).filter(name => isIdentifier(name) && type[name].$Kind == 'NavigationProperty').forEach(name => {
                const targetTag = root.$NavigationPropertyBinding[name];
                pathItems(paths, prefix + '/' + name, prefixParameters, type[name], root, sourceTag, targetTag, level + 1);
            });
        }
    }

    /**
     * Key for path item
     * @param {object} type Entity type object
     * @return {object} key: Key segment, parameters: key parameters
     */
    function keyMap(type) {
        const map = {};
        if (type.$Kind == 'EntityType') {
            var _type = type;
            var keys;
            while (_type) {
                keys = _type.$Key;
                if (keys) break;
                _type = modelElement(_type.$BaseType);
            }
            //TODO: complain if no key is found
            keys.forEach(key => {
                //TODO: if object...
                map[key] = true;
            });
        }
        return map;
    }

    /**
     * Key for path item
     * @param {object} entityType Entity type object
     * @param {integer} level Number of navigation segments so far
     * @return {object} key: Key segment, parameters: key parameters
     */
    function entityKey(entityType, level) {
        var segment = '';
        const params = [];
        //TODO: recurse along baseType to find $Key
        const keys = entityType.$Key;
        keys.forEach((key, index) => {
            suffix = level > 0 ? '-' + level : '';
            //TODO: key-as-segment
            if (index > 0) segment += ','
            //TODO: key aliases
            //TODO: containment recursion
            if (keys.length != 1) segment += key + '=';
            //TODO: key prefix/suffix depending on type of key
            let propertyType = entityType[key].$Type;
            segment += pathValuePrefix(propertyType) + '{' + key + suffix + '}' + pathValueSuffix(propertyType);
            let param = {
                description: 'key: ' + key,
                in: 'path',
                name: key + suffix,
                required: true,
                schema: schema(entityType[key])
            };
            params.push(param);
        })
        //TODO: key-as-segment
        return { segment: '(' + segment + ')', parameters: params };
    }

    /**
      * Prefix for key value in key segment
      * @param {typename} Qualified name of key property type
      * @return {string} value prefix
      */
    function pathValuePrefix(typename) {
        //TODO: handle other Edm types, enumeration types, and type definitions
        if (['Edm.Int64', 'Edm.Int32', 'Edm.Int16', 'Edm.SByte', 'Edm.Byte',
            'Edm.Double', 'Edm.Single', 'Edm.Date', 'Edm.DateTimeOffset', 'Edm.Guid'].includes(typename)) return '';
        //TODO: if (keyAsSegment) return '';
        return `'`;
    }

    /**
     * Suffix for key value in key segment
     * @param {typename} Qualified name of key property type
     * @return {string} value prefix
     */
    function pathValueSuffix(typename) {
        //TODO: handle other Edm types, enumeration types, and type definitions
        if (['Edm.Int64', 'Edm.Int32', 'Edm.Int16', 'Edm.SByte', 'Edm.Byte',
            'Edm.Double', 'Edm.Single', 'Edm.Date', 'Edm.DateTimeOffset', 'Edm.Guid'].includes(typename)) return '';
        //TODO: if (keyAsSegment) return '';
        return `'`;
    }

    /**
    * Add path and Path Item Object for an action import
    * @param {object} paths Paths Object to augment
    */
    function pathItemActionImport(paths, name, child) {
        //TODO: find unbound overload
        paths['/' + name] = {};
    }

    /**
     * Add path and Path Item Object for an action import
     * @param {object} paths Paths Object to augment
     */
    function pathItemFunctionImport(paths, name, child) {
        const overloads = modelElement(child.$Function);
        overloads.filter(overload => !overload.$IsBound).forEach(overload => {
            //TODO: generate one path item per overload with path parameters
            const pathParameters = '('
                + overload.$Parameter.map(p => p.$Name + '={' + p.$Name + '}').join(',')
                + ')';
            paths['/' + name + pathParameters] = {
                get: {
                    summary: 'Invoke function ' + nameParts(child.$Function).name,
                    tags: [child.$EntitySet || 'Service Operations'],
                    parameters: overload.$Parameter.map(p => ({
                        name: p.$Name,
                        in: 'path',
                        required: true,
                        schema: schema(p)
                    })),
                    responses: response(200, 'Success', overload.$ReturnType.$Type, overload.$ReturnType.$Collection)
                }
            };

        });
    }

    /**
     * Add path and Path Item Object for batch requests
     * @param {object} paths Paths Object to augment
     */
    function pathItemBatch(paths) {
        paths['/$batch'] = {
            post: {
                summary: 'Send a group of requests',
                description: 'Group multiple requests into a single request payload, see '
                    + '[Batch Requests](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_BatchRequests).'
                    + '\n\n*Please note that "Try it out" is not supported for this request.*',
                tags: [
                    'Batch Requests'
                ],
                requestBody: {
                    required: true,
                    description: 'Batch request',
                    content: {
                        'multipart/mixed;boundary=request-separator': {
                            schema: {
                                type: 'string'
                            },
                            example: '--request-separator\n'
                                + 'Content-Type: application/http\n'
                                + 'Content-Transfer-Encoding: binary\n\n'
                                + 'GET Products HTTP/1.1\n'
                                + 'Accept: application/json\n\n'
                                + '\n--request-separator--'
                        }
                    }
                },
                responses: {
                    202: {
                        description: 'Batch response',
                        content: {
                            'multipart/mixed': {
                                schema: {
                                    type: 'string'
                                },
                                example: '--response-separator\n'
                                    + 'Content-Type: application/http\n\n'
                                    + 'HTTP/1.1 200 OK\n'
                                    + 'Content-Type: application/json\n\n'
                                    + '{...}'
                                    + '\n--response-separator--'
                            }
                        }
                    },
                    default: {
                        $ref: '#/components/responses/error'
                    }
                }
            }
        };
    }

    /**
     * Construct Responses Object
     * @param {string} code HTTP response code
     * @param {string} description Description
     * @param {string} typename Qualified name of response type
     * @param {boolean} collection response is a collection
     */
    function response(code, description, typename = null, collection = false) {
        const r = {};
        r[code] = {
            description: description
        };
        if (typename)
            r[code].content = {
                'application/json': {
                    schema: collection
                        ? {
                            type: 'object',
                            title: 'Collection of ' + nameParts(typename).name,
                            properties: {
                                value: {
                                    type: 'array',
                                    items: ref(typename)
                                }
                            }
                        }
                        : ref(typename)
                }
            };
        r.default = {
            $ref: '#/components/responses/error'
        }
        return r;
    }

    /**
     * Construct the Components Object from the types of the CSDL document
     * @param {object} csdl CSDL document
     * @return {object} Components Object
     */
    function components(csdl) {
        return {
            schemas: schemas(csdl),
            parameters: parameters(),
            responses: {
                error: {
                    description: 'Error',
                    content: {
                        'application/json': {
                            schema: ref('error')
                        }
                    }
                }
            }
        };
    }

    /**
     * Construct Schema Objects from the types of the CSDL document
     * @param {object} csdl CSDL document
     * @return {object} Map of Schemas Objects
     */
    function schemas(csdl) {
        const s = {};

        Object.keys(csdl).filter(key => isIdentifier(key)).forEach(namespace => {
            const qualifier = csdl[namespace].$Alias || namespace;
            Object.keys(csdl[namespace]).filter(key => isIdentifier(key)).forEach(name => {
                const type = csdl[namespace][name];
                switch (type.$Kind) {
                    case 'ComplexType':
                    case 'EntityType':
                        schemasForStructuredType(s, qualifier, name, type);
                        break;
                    case 'EnumerationType':
                        //TODO: add schema
                        break;
                    case 'TypeDefinition':
                        //TODO: add schema
                        break;
                }
            });
        });

        s.error = error();
        return s;
    }

    /**
     * Construct Schema Objects for a structured type
     * @param {object} schemas Map of Schema Objects to augment
     * @param {string} qualifier Qualifier for structured type
     * @param {string} name Simple name of structured type
     * @param {object} type Structured type
     * @return {object} Map of Schemas Objects
     */
    function schemasForStructuredType(schemas, qualifier, name, type) {
        const qualifiedName = qualifier + '.' + name;
        const isKey = keyMap(type);
        const keys = Object.keys(isKey);
        const allProperties = {};
        const creProperties = {};
        const updProperties = {};

        //TODO: follow $BaseType
        //TODO: immutable, computed, ...
        Object.keys(type).filter(name => isIdentifier(name)).forEach(name => {
            const property = type[name];
            allProperties[name] = schema(property);
            if (property.$Kind == 'NavigationProperty') {
                creProperties[name] = schema(property, '-create');
            } else {
                creProperties[name] = schema(property, '-create');
                if (!isKey[name])
                    updProperties[name] = schema(property, '-update');
            }
        });

        schemas[qualifiedName] = {
            title: name,
            type: 'object',
            properties: allProperties
        };

        schemas[qualifiedName + '-create'] = {
            title: name + ' (for create)',
            type: 'object',
            properties: creProperties
        };
        if (keys.length > 0) schemas[qualifiedName + '-create'].required = keys;

        schemas[qualifiedName + '-update'] = {
            title: name + ' (for update)',
            type: 'object',
            properties: updProperties
        };
    }

    /**
     * Construct Parameter Objects for type-independent OData system query options
     * @return {object} Map of Parameter Objects
     */
    function parameters() {
        return {
            top: {
                name: queryOptionPrefix + 'top',
                in: 'query',
                description: 'Show only the first n items, see [Paging - Top](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptiontop)',
                schema: {
                    type: 'integer',
                    minimum: 0
                },
                example: 50
            },
            skip: {
                name: queryOptionPrefix + 'skip',
                in: 'query',
                description: 'Skip the first n items, see [Paging - Skip](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionskip)',
                schema: {
                    type: 'integer',
                    minimum: 0
                }
            },
            count: {
                name: queryOptionPrefix + 'count',
                in: 'query',
                description: 'Include count of items, see [Count](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptioncount)',
                schema: {
                    type: 'boolean'
                }
            },
            search: {
                name: queryOptionPrefix + 'search',
                in: 'query',
                description: 'Search items by search phrases, see [Searching](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionsearch)',
                schema: {
                    type: 'string'
                }
            }
        }
    }

    /**
     * Construct OData error response
     * @return {object} Error response schema
     */
    function error() {
        return {
            type: 'object',
            required: [
                'error'
            ],
            properties: {
                error: {
                    type: 'object',
                    required: [
                        'code',
                        'message'
                    ],
                    properties: {
                        code: {
                            type: 'string'
                        },
                        message: {
                            type: 'string'
                        },
                        target: {
                            type: 'string'
                        },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: [
                                    'code',
                                    'message'
                                ],
                                properties: {
                                    code: {
                                        type: 'string'
                                    },
                                    message: {
                                        type: 'string'
                                    },
                                    target: {
                                        type: 'string'
                                    }
                                }
                            }
                        },
                        innererror: {
                            type: 'object',
                            description: 'The structure of this object is service-specific'
                        }
                    }
                }
            }
        };
    }

    /**
     * Construct Reference Object for a type
     * @param {string} typename Qualified name of referenced type 
     * @param {string} suffix Optional suffix for referenced schema 
     * @return {object} Reference Object
     */
    function ref(typename, suffix = '') {
        return {
            $ref: '#/components/schemas/' + typename + suffix
        };
    }

    /**
     * Construct Schema Object for model object referencing a type
     * @param {object} modelElement referencing a type 
     * @return {object} Schema Object
     */
    function schema(element, suffix = '') {
        var s = {};
        //TODO: switch(qualifiedName)
        switch (element.$Type) {
            case 'Edm.Date':
                s = {
                    type: 'string',
                    format: 'date',
                    example: '2017-04-13'
                };
                break;
            case 'Edm.DateTimeOffset':
                s = {
                    type: 'string',
                    format: 'date-time',
                    example: '2017-04-13T15:51:04Z'
                };
                break;
            case 'Edm.Decimal':
                s = {
                    anyOf: [{ type: 'number' }, { type: 'string' }],
                    format: 'decimal',
                    example: 0
                };
                if (!isNaN(element.$Scale)) s.multipleOf = 10 ** element.$Scale;
                break;
            case 'Edm.Duration':
                s = {
                    type: 'string',
                    format: 'duration',
                    example: 'P4DT15H51M04S'
                };
                break;
            case 'Edm.Guid':
                s = {
                    type: 'string',
                    format: 'uuid',
                    example: '01234567-89ab-cdef-0123-456789abcdef'
                };
                break;
            case 'Edm.Int32':
                s = {
                    type: 'integer',
                    format: 'int32'
                };
                break;
            case 'Edm.Int64':
                s = {
                    anyOf: [{ type: 'integer' }, { type: 'string' }],
                    format: 'int64',
                    example: "42"
                };
                if (!isNaN(element.$Scale)) s.multipleOf = 10 ** element.$Scale;
                break;
            case 'Edm.String':
            case undefined:
                s.type = 'string';
                if (element.$MaxLength) s.maxLength = element.$MaxLength;
                break;
            default:
                if (element.$Type.startsWith('Edm.')) {
                    console.log('Unknown type: ' + element.$Type);
                } else {
                    s = ref(element.$Type, suffix)
                }
        }

        if (element.$Nullable) {
            if (s.$ref) s = { anyOf: [s] };
            s.nullable = true;
        }

        if (element.$Collection) {
            s = {
                type: 'array',
                items: s
            };
        }

        return s;
    }

    /**
     * a qualified name consists of a namespace or alias, a dot, and a simple name
     * @param {string} qualifiedName 
     * @return {object} with components qualifier and name
     */
    function nameParts(qualifiedName) {
        const pos = qualifiedName.lastIndexOf('.');
        console.assert(pos > 0, 'Invalid qualified name ' + qualifiedName);
        return {
            qualifier: qualifiedName.substring(0, pos),
            name: qualifiedName.substring(pos + 1)
        };
    }

    /**
     * an identifier does not start with $ and does not contain @
     * @param {string} name 
     * @return {boolean} name is an identifier
     */
    function isIdentifier(name) {
        return !name.startsWith('$') && !name.includes('@');
    }

    /**
     * alias-normalize path expression
     * @param {string} name path
     * @return {string} normalized path
     */
    function normalizePath(path) {
        return path.split('/').map(part => {
            const at = part.indexOf('@') + 1;
            const prefix = part.substring(0, at);
            const suffix = part.substring(at);
            const dot = suffix.lastIndexOf('.');
            return prefix + (dot === -1 ? suffix : (alias[suffix.substring(0, dot)] || suffix.substring(0, dot)) + suffix.substring(dot));
        }).join('/');
    }

    /**
     * alias-normalize target path
     * @param {string} name target
     * @return {string} normalized target
     */
    function normalizeTarget(target) {
        const paren = target.indexOf('(');
        var path = paren === -1 ? target : target.substring(0, paren);
        var args = paren === -1 ? '' : target.substring(paren);

        path = path.split('/').map(part => {
            const dot = part.lastIndexOf('.');
            return dot === -1 ? part : (alias[part.substring(0, dot)] || part.substring(0, dot)) + part.substring(dot);
        }).join('/');

        if (args !== '') {
            let params = args.substring(1, args.length - 1)
            args = '('
                + params.split(',').map(part => {
                    const dot = part.lastIndexOf('.');
                    return alias[part.substring(0, dot)] + part.substring(dot);
                }).join(',')
                + ')';
        }

        return path + args;
    }

}
