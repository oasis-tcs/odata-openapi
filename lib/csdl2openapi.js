/**
 * Converts OData CSDL JSON to OpenAPI 3.0.0
*/

//TODO: see //TODO comments below
//TODO: reduce number of loops over schemas
//TODO: inject $Name into each model element to make parameter passing easier

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
    const typesToInline = {}; // filled in schema() and used in inlineTypes()
    const boundOverloads = {};
    const derivedTypes = {};
    const alias = {};
    const namespace = {};
    const namespaceUrl = {};
    preProcess(csdl, boundOverloads, derivedTypes, alias, namespace, namespaceUrl);
    const voc = vocabularies(alias);

    const entityContainer = modelElement(csdl.$EntityContainer);
    console.assert(entityContainer.$Kind == 'EntityContainer', 'Could not find entity container ' + csdl.$EntityContainer);

    return {
        openapi: '3.0.0',
        info: info(csdl),
        servers: servers(serviceRoot),
        tags: tags(entityContainer),
        paths: paths(entityContainer),
        components: components(csdl)
    };


    /**
     * Collect model info for easier lookup
     * @param {object} csdl CSDL document
     * @param {object} boundOverloads Map of action/function names to bound overloads
     * @param {object} derivedTypes Map of type names to derived types
     * @param {object} alias Map of namespace or alias to alias
     * @param {object} namespace Map of namespace or alias to namespace
     * @param {object} namespaceUrl Map of namespace to reference URL
     */
    function preProcess(csdl, boundOverloads, derivedTypes, alias, namespace, namespaceUrl) {
        Object.keys(csdl.$Reference || {}).forEach(url => {
            const reference = csdl.$Reference[url];
            (reference.$Include || []).forEach(include => {
                const qualifier = include.$Alias || include.$Namespace;
                alias[include.$Namespace] = qualifier;
                namespace[qualifier] = include.$Namespace;
                namespace[include.$Namespace] = include.$Namespace;
                namespaceUrl[include.$Namespace] = url;
            });
        });

        Object.keys(csdl).filter(name => isIdentifier(name)).forEach(name => {
            const schema = csdl[name];
            const qualifier = schema.$Alias || name;

            alias[name] = qualifier;
            namespace[qualifier] = name;
            namespace[name] = name;

            Object.keys(schema).filter(name => isIdentifier(name)).forEach(name => {
                const qualifiedName = qualifier + '.' + name;
                const element = schema[name];
                if (Array.isArray(element)) {
                    element.filter(overload => overload.$IsBound).forEach(overload => {
                        const type = overload.$Parameter[0].$Type + (overload.$Parameter[0].$Collection ? '-c' : '');
                        if (!boundOverloads[type]) boundOverloads[type] = [];
                        boundOverloads[type].push({ name: qualifiedName, overload: overload });
                    });
                } else if (element.$BaseType) {
                    let structuredType = element;
                    while (structuredType.$BaseType) {
                        let base = namespaceQualifiedName(structuredType.$BaseType);
                        if (!derivedTypes[base]) derivedTypes[base] = [];
                        derivedTypes[base].push(qualifiedName);
                        structuredType = modelElement(base);
                    }
                }
            });

            //TODO: copy external annotations into target elements
            Object.keys(schema.$Annotations || {}).forEach(target => {
                const annotations = schema.$Annotations[target];
                const segments = target.split('/');
                let element = modelElement(segments[0]);
                if (!element) {
                    // console.assert(false, 'Invalid annotation target ' + target);
                } else if (Array.isArray(element)) {
                    //TODO: action or function: 
                    //- if second segment contains (, it references a single overload
                    //- otherwise copy to all overloads
                    //- if there are more segments, a parameter or the return type is targeted
                } else {
                    switch (segments.length) {
                        case 1:
                            Object.assign(element, annotations);
                            break;
                        case 2:
                            Object.assign(element[segments[1]], annotations);
                            break;
                        default:
                            console.assert(false, 'More than two annotation target path segments');
                    }
                }
            });
        });
    }

    /**
     * Construct map of qualified term names
     * @param {object} alias Map of namespace or alias to alias
     * @return {object}Vocabulary term name map
     */
    function vocabularies(alias) {
        const terms = {
            Capabilities: ['BatchSupported', 'CountRestrictions', 'DeleteRestrictions', 'ExpandRestrictions',
                'FilterRestrictions', 'IndexableByKey', 'InsertRestrictions', 'NavigationRestrictions',
                'SearchRestrictions', 'SelectSupport', 'SkipSupported', 'SortRestrictions',
                'ReadRestrictions', 'TopSupported', 'UpdateRestrictions'],
            Core: ['Computed', 'Description', 'Example', 'Immutable', 'LongDescription', 'Permissions', 'SchemaVersion'],
            Validation: ['AllowedValues', 'Exclusive', 'Maximum', 'Minimum', 'Pattern']
        };
        const v = {};

        Object.keys(terms).forEach(vocab => {
            v[vocab] = {};
            terms[vocab].forEach(term => {
                v[vocab][term] = '@' + alias['Org.OData.' + vocab + '.V1'] + '.' + term;
            });
        });

        return v;
    }

    /**
     * Construct the Info Object
     * @param {object} csdl CSDL document
     * @return {object} Info Object
     */
    function info(csdl) {
        const containerSchema = csdl[nameParts(csdl.$EntityContainer).qualifier];
        //TODO: Core.LongDescription on entity container or its schema
        //TODO: Core.SchemaVersion on schema of entity container
        const description = 'This service is located at [' + serviceRoot + '/]('
            + serviceRoot.replace(/\(/g, '%28').replace(/\)/g, '%29')
            + '/)' + (diagram ? resourceDiagram(csdl) : '');
        return {
            title: entityContainer[voc.Core.Description]
                || containerSchema[voc.Core.Description]
                || 'Service for namespace ' + nameParts(csdl.$EntityContainer).qualifier,
            description: description,
            version: containerSchema[voc.Core.SchemaVersion] || ''
        };
    }

    function resourceDiagram(csdl) {
        let diagram = '\n\n## Entity Data Model\n![ER Diagram](https://yuml.me/diagram/class/';
        let comma = '';

        Object.keys(csdl).filter(name => isIdentifier(name)).forEach(namespace => {
            const schema = csdl[namespace];
            Object.keys(schema).filter(name => isIdentifier(name) && ['EntityType', 'ComplexType'].includes(schema[name].$Kind))
                .forEach(typeName => {
                    const type = schema[typeName];
                    diagram += comma
                        + (type.$BaseType ? '[' + nameParts(type.$BaseType).name + ']^' : '')
                        + '[' + typeName + (type.$Kind == 'EntityType' ? '{bg:orange}' : '') + ']';
                    Object.keys(type).filter(name => isIdentifier(name)).forEach(propertyName => {
                        let property = type[propertyName];
                        let targetNP = nameParts(property.$Type || 'Edm.String');
                        if (property.$Kind == 'NavigationProperty' || targetNP.qualifier != 'Edm') {
                            let target = modelElement(property.$Type);
                            diagram += ',[' + typeName + ']'
                                + (property.$ContainsTarget ? '++' : '')
                                + '-'
                                + (property.$Collection ? '*' : (property.$Nullable ? '0..1' : ''))
                                + '>['
                                + (target ? targetNP.name : property.$Type + '{bg:whitesmoke}')
                                + ']';
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
        const schema = csdl[q.qualifier] || csdl[namespace[q.qualifier]];
        return schema ? schema[q.name] : null;
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
                pathItems(paths, '/' + name, [], child, child, name, name, child, 0, '');
            } else if (child.$Action) {
                pathItemActionImport(paths, name, child);
            } else if (child.$Function) {
                pathItemFunctionImport(paths, name, child);
            }
        })
        pathItemBatch(paths, container);
        return paths;
    }

    /**
     * Add path and Path Item Object for a navigation segment
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element of navigation segment
     * @param {object} root Root model element
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     * @param {string} navigationPath Path for finding navigation restrictions
     */
    function pathItems(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath) {
        const name = prefix.substring(prefix.lastIndexOf('/') + 1);
        const type = modelElement(element.$Type);
        const pathItem = {};
        const navigationRestrictions = root[voc.Capabilities.NavigationRestrictions] || {};
        const restrictions = (navigationRestrictions.RestrictedProperties || []).find(item => item.NavigationProperty == navigationPath)
            || {};

        paths[prefix] = pathItem;
        if (prefixParameters.length > 0) paths[prefix].parameters = prefixParameters;

        operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, false);
        if (element.$Collection && (element.$ContainsTarget || (level < 2 && target))) {
            operationCreate(pathItem, element, name, sourceName, targetName, target, level, restrictions);
        }
        pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);

        if (element.$ContainsTarget) {
            //TODO: Navigability
            // <xsl:variable name="navigable"
            // select="$propertyNavigability='Recursive' or $propertyNavigability='Single' 
            //         or (string-length($propertyNavigability)=0 and not($rootNavigability='None'))" />
            // the above is not complete
            const navigable = (level == 0 && navigationRestrictions.Navigability != 'None')
                || level > 0; //TODO: finish

            if (element.$Collection) {
                pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, navigable);
            } else {
                operationUpdate(pathItem, element, name, sourceName, targetName, target, level);
                if (element.$Nullable) {
                    operationDelete(pathItem, name, sourceName, target, level);
                }
                pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);
                if (navigable) {
                    pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceName, level, navigationPath);
                }
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
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     * @param {string} navigationPath Path for finding navigation restrictions
     * @param {object} restrictions Navigation property restrictions of navigation segment
     * @param {boolean} navigable
     */
    function pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, navigable) {
        const indexable = target == null || target[voc.Capabilities.IndexableByKey] != false;
        if (indexable) {
            const name = prefix.substring(prefix.lastIndexOf('/') + 1);
            const type = modelElement(element.$Type);
            const key = entityKey(type, level);
            const path = prefix + key.segment;
            const parameters = prefixParameters.concat(key.parameters);
            const pathItem = {};
            paths[path] = pathItem;
            if (parameters.length > 0) pathItem.parameters = parameters;

            operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, true);;
            operationUpdate(pathItem, element, name, sourceName, targetName, target, level);
            operationDelete(pathItem, name, sourceName, target, level);

            pathItemsForBoundOperations(paths, path, parameters, element, sourceName, true);
            if (navigable) {
                pathItemsWithNavigation(paths, path, parameters, type, root, sourceName, level, navigationPath);
            }
        }
    }

    /**
     * Construct Operation Object for create
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function operationCreate(pathItem, element, name, sourceName, targetName, target, level, restrictions) {
        const targetRestrictions = (target && target[voc.Capabilities.InsertRestrictions]) || {};
        const targetInsertable = targetRestrictions.Insertable !== false;
        const navInsertable = restrictions.InsertRestrictions && restrictions.InsertRestrictions.Insertable;

        if (navInsertable || (navInsertable === undefined & targetInsertable)) {
            const summary = target && targetRestrictions.Description;
            //TODO: description from LongDescription
            pathItem.post = {
                summary: summary || 'Add new entity to ' + (level > 0 ? 'related ' : '') + name,
                tags: [sourceName],
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
            if (targetName && sourceName != targetName) pathItem.post.tags.push(targetName);
        }
    }

    /**
     * Construct Operation Object for read
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     * @param {boolean} byKey read by key
     */
    function operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, byKey) {
        const targetRestrictions = (target && target[voc.Capabilities.ReadRestrictions]) || {};
        const targetReadable = targetRestrictions.Readable !== false
            || (byKey == true && targetRestrictions.ReadByKeyRestrictions && targetRestrictions.ReadByKeyRestrictions.Readable !== false);
        const navReadable = restrictions.ReadRestrictions && restrictions.ReadRestrictions.Readable;

        if (navReadable || (navReadable === undefined && targetReadable)) {
            //TODO: summary and description on navigation segments from restrictions (if level>0)
            let summary = null;
            let description = null;
            if (level == 0) {
                if (byKey) {
                    summary = targetRestrictions.ReadByKeyRestrictions && targetRestrictions.ReadByKeyRestrictions.Description;
                    description = targetRestrictions.ReadByKeyRestrictions && targetRestrictions.ReadByKeyRestrictions.LongDescription;
                } else {
                    summary = targetRestrictions.Description;
                    description = targetRestrictions.LongDescription;
                }
            }

            const collection = !byKey && element.$Collection;
            const operation = {
                summary: summary || 'Get '
                    + (byKey ? 'entity from ' : (element.$Collection ? 'entities from ' : ''))
                    + (level > 0 ? 'related ' : '')
                    + name
                    + (byKey ? ' by key' : ''),
                tags: [sourceName],
                parameters: [],
                responses: response(200, 'Retrieved entit' + (collection ? 'ies' : 'y'), element.$Type, collection)
            };
            if (description) operation.description = description;
            if (target && sourceName != targetName) operation.tags.push(targetName);

            if (collection) {
                optionTop(operation.parameters, target);
                optionSkip(operation.parameters, target);
                optionSearch(operation.parameters, target);
                optionFilter(operation.parameters, target);
                optionCount(operation.parameters, target);
                optionOrderBy(operation.parameters, element, target, restrictions);
            }

            optionSelect(operation.parameters, element, target);
            optionExpand(operation.parameters, element, target);

            pathItem.get = operation;
        }
    }

    /**
     * Add parameter for query option $count
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     */
    function optionCount(parameters, target) {
        const targetRestrictions = target && target[voc.Capabilities.CountRestrictions];
        const targetCountable = target == null
            || targetRestrictions == null
            || targetRestrictions.Countable !== false;

        if (targetCountable) {
            parameters.push({

                $ref: '#/components/parameters/count'
            });
        }
    }

    /**
     * Add parameter for query option $expand
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {string} target Target container child of path
     */
    function optionExpand(parameters, element, target) {
        const targetRestrictions = target && target[voc.Capabilities.ExpandRestrictions];
        const supported = targetRestrictions == null || targetRestrictions.Expandable != false;
        if (supported) {
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
    }

    /**
     * Add parameter for query option $filter
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     */
    function optionFilter(parameters, target) {
        const targetRestrictions = target && target[voc.Capabilities.FilterRestrictions];
        const targetFilterable = target == null
            || targetRestrictions == null
            || targetRestrictions.Filterable !== false;

        if (targetFilterable) {
            parameters.push({
                name: queryOptionPrefix + 'filter',
                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)',
                in: 'query',
                schema: {
                    type: 'string'
                }
            });
        }
    }

    /**
     * Add parameter for query option $orderby
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {string} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionOrderBy(parameters, element, target, restrictions) {
        const targetRestrictions = (target && target[voc.Capabilities.SortRestrictions]) || {};
        const targetSortable = targetRestrictions.Sortable !== false;
        const navRestrictions = restrictions.SortRestrictions || {};

        if (targetSortable) {
            const nonSortable = {};
            ((navRestrictions.NonSortableProperties || targetRestrictions.NonSortableProperties) || []).forEach(name => {
                nonSortable[name] = true;
            });
            const type = modelElement(element.$Type);
            const orderbyItems = [];
            Object.keys(type).filter(key => isIdentifier(key) && type[key].$Kind != 'NavigationProperty').forEach(
                key => {
                    if (!nonSortable[key]) {
                        orderbyItems.push(key);
                        orderbyItems.push(key + ' desc');
                    }
                });
            if (orderbyItems.length > 0) {
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
        }
    }

    /**
     * Add parameter for query option $search
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     */
    function optionSearch(parameters, target) {
        const targetRestrictions = target && target[voc.Capabilities.SearchRestrictions];
        const targetSearchable = target == null
            || targetRestrictions == null
            || targetRestrictions.Searchable !== false;

        if (targetSearchable) {
            parameters.push({
                $ref: '#/components/parameters/search'
            });
        }
    }

    /**
     * Add parameter for query option $select
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {string} target Target container child of path
     */
    function optionSelect(parameters, element, target) {
        const selectSupport = target && target[voc.Capabilities.SelectSupport];
        const supported = selectSupport == null || selectSupport.Supported;
        if (supported) {
            const type = modelElement(element.$Type);
            const selectItems = [];
            Object.keys(type).filter(key => isIdentifier(key) && type[key].$Kind != 'NavigationProperty').forEach(
                key => selectItems.push(key)
            )
            if (selectItems.length > 0) {
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
        }
    }

    /**
     * Add parameter for query option $skip
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     */
    function optionSkip(parameters, target) {
        const supported = target == null || target[voc.Capabilities.SkipSupported] !== false;
        if (supported) {
            parameters.push({
                $ref: '#/components/parameters/skip'
            });
        }
    }

    /**
     * Add parameter for query option $top
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     */
    function optionTop(parameters, target) {
        const supported = target == null || target[voc.Capabilities.TopSupported] !== false;
        if (supported) {
            parameters.push({
                $ref: '#/components/parameters/top'
            });
        }
    }

    /**
     * Construct Operation Object for update
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     */
    function operationUpdate(pathItem, element, name, sourceName, targetName, target, level) {
        const targetRestrictions = target && target[voc.Capabilities.UpdateRestrictions];
        const targetUpdatable = target == null
            || targetRestrictions == null
            || targetRestrictions.Updatable !== false;

        if (targetUpdatable) {
            const summary = targetRestrictions && targetRestrictions.Description;
            //TODO: description from LongDescription
            const operation = {
                summary: summary || 'Update ' + (element.$Collection ? 'entity in ' : '') + (level > 0 ? 'related ' : '') + name,
                tags: [sourceName],
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
            pathItem.patch = operation;
        }
    }

    /**
     * Construct Operation Object for delete
     * @param {object} pathItem Path Item Object to augment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     */
    function operationDelete(pathItem, name, sourceName, target, level) {
        const targetRestrictions = (target && target[voc.Capabilities.DeleteRestrictions]) || {};
        const targetDeletable = targetRestrictions.Deletable !== false;

        if (targetDeletable) {
            const summary = targetRestrictions && targetRestrictions.Description;
            //TODO: description from LongDescription
            pathItem.delete = {
                summary: summary || 'Delete entity from ' + (level > 0 ? 'related ' : '') + name,
                tags: [sourceName],
                responses: response(204, 'Success')
            };
        }
    }

    /**
     * Add paths and Path Item Objects for navigation segments
     * @param {object} paths The Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} type Entity type object of navigation segment
     * @param {string} sourceName Name of path source
     * @param {integer} level Number of navigation segments so far
     * @param {string} navigationPrefix Path for finding navigation restrictions
     */
    function pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceName, level, navigationPrefix) {
        //TODO: make 5 an option
        if (level < 5) {
            //TODO: collect navigation properties along $BaseType
            Object.keys(type).filter(name => isIdentifier(name) && type[name].$Kind == 'NavigationProperty').forEach(name => {
                const navigationPath = navigationPrefix + (navigationPrefix.length > 0 ? '/' : '') + name;
                const targetSetName = root.$NavigationPropertyBinding && root.$NavigationPropertyBinding[navigationPath];
                const target = entityContainer[targetSetName];
                pathItems(paths, prefix + '/' + name, prefixParameters, type[name], root, sourceName, targetSetName, target, level + 1, navigationPath);
            });
        }
    }

    /**
     * Construct map of key names for an entity type
     * @param {object} type Entity type object
     * @return {object} Map of key names
     */
    function keyMap(type) {
        const map = {};
        if (type.$Kind == 'EntityType') {
            let _type = type;
            let keys;
            while (_type) {
                keys = _type.$Key;
                if (keys || !_type.$BaseType) break;
                _type = modelElement(_type.$BaseType);
            }
            (keys || []).forEach(key => {
                if (typeof key == 'string')
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
        let segment = '';
        const params = [];
        //TODO: recurse along baseType to find $Key
        const keys = entityType.$Key;
        keys.forEach((key, index) => {
            suffix = level > 0 ? '-' + level : '';
            //TODO: key-as-segment
            if (index > 0) segment += ','
            //TODO: key aliases
            if (keys.length != 1) segment += key + '=';
            let propertyType = entityType[key].$Type;
            segment += pathValuePrefix(propertyType) + '{' + key + suffix + '}' + pathValueSuffix(propertyType);
            let param = {
                description: 'key: ' + key,
                in: 'path',
                name: key + suffix,
                required: true,
                schema: schema(entityType[key], '', true)
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
     * Add path and Path Item Object for actions and functions bound to the element
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element the operations are bound to
     * @param {string} sourceName Name of path source
     * @param {boolean} byKey read by key
     */
    function pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName, byKey = false) {
        const overloads = boundOverloads[element.$Type + (!byKey && element.$Collection ? '-c' : '')] || [];
        overloads.forEach(item => {
            if (item.overload.$Kind == 'Action')
                pathItemAction(paths, prefix + '/' + item.name, prefixParameters, item.name, item.overload, sourceName);
            else
                pathItemFunction(paths, prefix + '/' + item.name, prefixParameters, item.name, item.overload, sourceName);
        });
    }

    /**
    * Add path and Path Item Object for an action import
    * @param {object} paths Paths Object to augment
    * @param {string} name Name of action import
    * @param {object} child Action import object
    */
    function pathItemActionImport(paths, name, child) {
        const overload = modelElement(child.$Action).filter(overload => !overload.$IsBound)[0];
        pathItemAction(paths, '/' + name, [], child.$Action, overload, child.$EntitySet);
    }

    /**
     * Add path and Path Item Object for action overload
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {string} actionName Qualified name of function
     * @param {object} overload Function overload
     * @param {string} sourceName Name of path source
     */
    function pathItemAction(paths, prefix, prefixParameters, actionName, overload, sourceName) {
        const pathItem = {
            post: {
                summary: overload[voc.Core.Description] || 'Invoke action ' + nameParts(actionName).name,
                tags: [sourceName || 'Service Operations'],
                responses: overload.$ReturnType
                    ? response(200, 'Success', overload.$ReturnType.$Type, overload.$ReturnType.$Collection)
                    : response(204, 'Success')
            }
        };
        if (prefixParameters.length > 0) pathItem.post.parameters = prefixParameters;
        let parameters = overload.$Parameter || [];
        if (overload.$IsBound) parameters = parameters.slice(1);
        if (parameters.length > 0) {
            const requestProperties = {};
            parameters.map(p => { requestProperties[p.$Name] = schema(p) });
            pathItem.post.requestBody = {
                description: 'Action parameters',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: requestProperties
                        }
                    }
                }
            }
        }
        paths[prefix] = pathItem;
    }

    /**
     * Add path and Path Item Object for an action import
     * @param {object} paths Paths Object to augment
     * @param {string} name Name of function import
     * @param {object} child Function import object
     */
    function pathItemFunctionImport(paths, name, child) {
        const overloads = modelElement(child.$Function);
        overloads.filter(overload => !overload.$IsBound).forEach(overload => pathItemFunction(paths, '/' + name, [], child.$Function, overload, child.$EntitySet));
    }

    /**
     * Add path and Path Item Object for function overload
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {string} functionName Qualified name of function
     * @param {object} overload Function overload
     * @param {string} sourceName Name of path source
     */
    function pathItemFunction(paths, prefix, prefixParameters, functionName, overload, sourceName) {
        let parameters = overload.$Parameter;
        if (overload.$IsBound) parameters = parameters.slice(1);
        const pathParameters = '('
            + parameters.map(p => p.$Name + '=' + pathValuePrefix(p.$Type) + '{' + p.$Name + '}' + pathValuePrefix(p.$Type)).join(',')
            + ')';
        const pathItem = {
            get: {
                summary: overload[voc.Core.Description] || 'Invoke function ' + nameParts(functionName).name,
                tags: [sourceName || 'Service Operations'],
                parameters: prefixParameters.concat(parameters.map(p => {
                    let param = {
                        name: p.$Name,
                        in: 'path',
                        required: true,
                        schema: schema(p, '', true)
                    };
                    let description = p[voc.Core.Description];
                    if (description) param.description = description;
                    return param;
                })),
                responses: response(200, 'Success', overload.$ReturnType.$Type, overload.$ReturnType.$Collection)
            }
        };
        let description = overload[voc.Core.LongDescription];
        if (description) pathItem.get.description = description;
        paths[prefix + pathParameters] = pathItem;
    }

    /**
     * Add path and Path Item Object for batch requests
     * @param {object} paths Paths Object to augment
     * @param {object} container Entity container
     */
    function pathItemBatch(paths, container) {
        const supported = container[voc.Capabilities.BatchSupported] != false;
        if (supported) {
            const firstEntitySet = Object.keys(container).filter(child => isIdentifier(child) && container[child].$Collection)[0];
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
                                    + 'GET ' + firstEntitySet + ' HTTP/1.1\n'
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
        if (typename) {
            let s = schema({ $Type: typename, $Collection: collection });
            r[code].content = {
                'application/json': {
                    schema: collection
                        ? {
                            type: 'object',
                            title: 'Collection of ' + nameParts(typename).name,
                            properties: {
                                value: s
                            }
                        }
                        : s
                }
            };
        }
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
     * @return {object} Map of Schema Objects
     */
    function schemas(csdl) {
        const s = {};

        Object.keys(csdl).filter(key => isIdentifier(key)).forEach(namespace => {
            Object.keys(csdl[namespace]).filter(key => isIdentifier(key)).forEach(name => {
                const type = csdl[namespace][name];
                switch (type.$Kind) {
                    case 'ComplexType':
                    case 'EntityType':
                        schemasForStructuredType(s, namespace, name, type);
                        break;
                    case 'EnumType':
                        schemaForEnumerationType(s, namespace, name, type);
                        break;
                    case 'TypeDefinition':
                        schemaForTypeDefinition(s, namespace, name, type);
                        break;
                }
            });
        });

        inlineTypes(s);

        s.error = error();
        return s;
    }

    /**
     * Construct Schema Objects from the types of the CSDL document
     * @param {object} schemas Map of Schema Objects to augment
     */
    function inlineTypes(schemas) {
        if (typesToInline.geoPoint) {
            schemas.geoPoint = {
                type: 'object',
                properties: {
                    coordinates: ref('geoPosition'),
                    type: {
                        type: 'string',
                        enum: ['Point'],
                        default: 'Point'
                    }
                },
                required: ['type', 'coordinates']
            };
            schemas.geoPosition = {
                type: 'array',
                minItems: 2,
                items: {
                    type: 'number'
                }
            }
        }
    }

    /**
     * Construct Schema Objects for an enumeration type
     * @param {object} schemas Map of Schema Objects to augment
     * @param {string} qualifier Qualifier for structured type
     * @param {string} name Simple name of structured type
     * @param {object} type Structured type
     * @return {object} Map of Schemas Objects
     */
    function schemaForEnumerationType(schemas, qualifier, name, type) {
        const members = [];
        Object.keys(type).filter(name => isIdentifier(name)).forEach(name => {
            members.push(name);
        });

        const s = {
            type: 'string',
            title: type[voc.Core.Description] || name,
            enum: members
        };
        const description = type[voc.Core.LongDescription];
        if (description) s.description = description;
        schemas[qualifier + '.' + name] = s;
    }

    /**
     * Construct Schema Objects for a type definition
     * @param {object} schemas Map of Schema Objects to augment
     * @param {string} qualifier Qualifier for structured type
     * @param {string} name Simple name of structured type
     * @param {object} type Structured type
     * @return {object} Map of Schemas Objects
     */
    function schemaForTypeDefinition(schemas, qualifier, name, type) {
        const s = schema(Object.assign({ $Type: type.$UnderlyingType }, type));
        s.title = type[voc.Core.Description] || name;
        const description = type[voc.Core.LongDescription];
        if (description) s.description = description;
        schemas[qualifier + '.' + name] = s;
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
        const allName = qualifier + '.' + name;
        const creName = allName + '-create';
        const updName = allName + '-update';
        const isKey = keyMap(type);
        const required = Object.keys(isKey);
        const allProperties = {};
        const creProperties = {};
        const updProperties = {};

        const properties = propertiesOfStructuredType(type);
        Object.keys(properties).forEach(name => {
            const property = properties[name];
            allProperties[name] = schema(property);
            if (property.$Kind == 'NavigationProperty') {
                creProperties[name] = schema(property, '-create');
            } else {
                if (property[voc.Core.Permissions] == 'Read' || property[voc.Core.Computed]) {
                    let index = required.indexOf(name);
                    if (index != -1) required.splice(index, 1);
                } else {
                    creProperties[name] = schema(property, '-create');
                    if (!isKey[name] && !property[voc.Core.Immutable])
                        updProperties[name] = schema(property, '-update');
                }
            }
        });

        schemas[allName] = {
            title: name,
            type: 'object'
        };
        if (Object.keys(allProperties).length > 0) schemas[allName].properties = allProperties;

        schemas[creName] = {
            title: name + ' (for create)',
            type: 'object',
        };
        if (Object.keys(creProperties).length > 0) schemas[creName].properties = creProperties;
        if (required.length > 0) schemas[creName].required = required;

        schemas[updName] = {
            title: name + ' (for update)',
            type: 'object'
        };
        if (Object.keys(updProperties).length > 0) schemas[updName].properties = updProperties;

        if (derivedTypes[allName]) {
            schemas[allName].anyOf = [];
            schemas[creName].anyOf = [];
            schemas[updName].anyOf = [];
            derivedTypes[allName].forEach(derivedType => {
                schemas[allName].anyOf.push(ref(derivedType));
                schemas[creName].anyOf.push(ref(derivedType, '-create'));
                schemas[updName].anyOf.push(ref(derivedType, '-update'));
            });
            if (!type.$Abstract) {
                schemas[allName].anyOf.push({});
                schemas[creName].anyOf.push({});
                schemas[updName].anyOf.push({});
            }
        }
    }

    /**
     * Collect all properties of a structured type along the inheritance hierarchy
     * @param {object} type Structured type
     * @return {object} Map of properties
     */
    function propertiesOfStructuredType(type) {
        const properties = type.$BaseType ? propertiesOfStructuredType(modelElement(type.$BaseType)) : {};
        Object.keys(type).filter(name => isIdentifier(name)).forEach(name => {
            properties[name] = type[name];
        });
        return properties;
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
     * Construct Schema Object for model object referencing a type
     * @param {object} modelElement referencing a type 
     * @return {object} Schema Object
     */
    function schema(element, suffix = '', forParameter = false) {
        let s = {};
        switch (element.$Type) {
            case 'Edm.AnnnotationPath':
            case 'Edm.ModelElementPath':
            case 'Edm.NavigationPropertyPath':
            case 'Edm.PropertyPath':
                s.type = 'string';
                break;
            case 'Edm.Binary':
                s = {
                    type: 'string',
                    format: 'base64url'
                };
                if (element.$MaxLength) s.maxLength = Math.ceil(4 * element.$MaxLength / 3);
                break;
            case 'Edm.Boolean':
                s.type = 'boolean';
                break;
            case 'Edm.Byte':
                s = {
                    type: 'integer',
                    format: 'uint8'
                };
                break;
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
                let scale = !isNaN(element.$Scale) ? element.$Scale : null;
                if (scale !== null) s.multipleOf = 10 ** -scale;
                if (element.$Precision < 16) {
                    //TODO: consider $Scale
                    let limit = 10 ** (element.$Precision - scale);
                    let delta = 10 ** -scale;
                    s.maximum = limit - delta;
                    s.minimum = -s.maximum;
                }
                minimumMaximum(s, element);
                break;
            case 'Edm.Double':
                s = {
                    anyOf: [{ type: 'number' }, { type: 'string' }],
                    format: 'double',
                    example: 3.14
                };
                break;
            case 'Edm.Duration':
                s = {
                    type: 'string',
                    format: 'duration',
                    example: 'P4DT15H51M04S'
                };
                break;
            case 'Edm.GeographyPoint':
            case 'Edm.GeometryPoint':
                s = ref('geoPoint');
                typesToInline.geoPoint = true;
                break;
            case 'Edm.Guid':
                s = {
                    type: 'string',
                    format: 'uuid',
                    example: '01234567-89ab-cdef-0123-456789abcdef'
                };
                break;
            case 'Edm.Int16':
                s = {
                    type: 'integer',
                    format: 'int16'
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
                break;
            case 'Edm.PrimitiveType':
                s = {
                    anyOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }]
                };
                break;
            case 'Edm.SByte':
                s = {
                    type: 'integer',
                    format: 'int8'
                };
                break;
            case 'Edm.Single':
                s = {
                    anyOf: [{ type: 'number' }, { type: 'string' }],
                    format: 'float',
                    example: 3.14
                };
                break;
            case 'Edm.Stream':
                s = {
                    type: 'string',
                    format: 'base64url'
                };
                break;
            case 'Edm.String':
            case undefined:
                s.type = 'string';
                if (element.$MaxLength) s.maxLength = element.$MaxLength;
                allowedValues(s, element);
                pattern(s, element);
                break;
            case 'Edm.TimeOfDay':
                s = {
                    type: 'string',
                    format: 'time',
                    example: '15:51:04'
                };
                break;
            default:
                if (element.$Type.startsWith('Edm.')) {
                    console.assert(false, 'Unknown type: ' + element.$Type);
                } else {
                    let type = modelElement(element.$Type);
                    let isStructured = type && ['ComplexType', 'EntityType'].includes(type.$Kind);
                    s = ref(element.$Type, (isStructured ? suffix : ''));
                    if (element.$MaxLength) {
                        s = {
                            anyOf: [s],
                            maxLength: element.$MaxLength
                        };
                    }
                }
        }

        if (element.$Nullable) {
            if (s.$ref) s = { anyOf: [s] };
            s.nullable = true;
        }

        if (element.$DefaultValue !== undefined) {
            if (s.$ref) s = { anyOf: [s] };
            s.default = element.$DefaultValue;
        }

        if (element[voc.Core.Example]) {
            if (s.$ref) s = { anyOf: [s] };
            s.example = element[voc.Core.Example].Value;
        }

        if (element[voc.Validation.Maximum] != undefined) {
            if (s.$ref) s = { anyOf: [s] };
            s.maximum = element[voc.Validation.Maximum];
            if (element[voc.Validation.Maximum + voc.Validation.Exclusive]) s.exclusiveMaximum = true;
        }

        if (element[voc.Validation.Minimum] != undefined) {
            if (s.$ref) s = { anyOf: [s] };
            s.minimum = element[voc.Validation.Minimum];
            if (element[voc.Validation.Minimum + voc.Validation.Exclusive]) s.exclusiveMinimum = true;
        }

        if (element.$Collection) {
            s = {
                type: 'array',
                items: s
            };
        }

        if (!forParameter && element[voc.Core.Description]) {
            if (s.$ref) s = { anyOf: [s] };
            s.title = element[voc.Core.Description];
        }

        return s;
    }

    /**
     * Add allowed values enum to Schema Object for string-like model element
     * @param {object} schema Schema Object to augment 
     * @param {object} element Model element 
     */
    function allowedValues(schema, element) {
        const values = element[voc.Validation.AllowedValues];
        if (values) schema.enum = values.map(record => record.Value);
    }

    /**
     * Add pattern to Schema Object for string-like model element
     * @param {object} schema Schema Object to augment 
     * @param {object} element Model element 
     */
    function pattern(schema, element) {
        const pattern = element[voc.Validation.Pattern];
        if (pattern) schema.pattern = pattern;
    }

    /**
     * Add minimum and maximum to Schema Object for numeric model element
     * @param {object} schema Schema Object to augment 
     * @param {object} element Model element 
     */
    function minimumMaximum(schema, element) {
        const min = element[voc.Validation.Minimum];
        const max = element[voc.Validation.Maximum];
        if (min) {
            schema.minimum = Number.parseFloat(min);
            if (element[voc.Validation.Minimum + voc.Validation.Exclusive]) schema.exclusiveMinimum = true;
        }
        if (max) {
            schema.maximum = Number.parseFloat(max);
            if (element[voc.Validation.Maximum + voc.Validation.Exclusive]) schema.exclusiveMaximum = true;
        }
    }

    /**
     * Construct Reference Object for a type
     * @param {string} typename Qualified name of referenced type 
     * @param {string} suffix Optional suffix for referenced schema 
     * @return {object} Reference Object
     */
    function ref(typename, suffix = '') {
        let name = typename;
        let nsp = '';
        let url = '';
        if (typename.indexOf('.') != -1) {
            let parts = nameParts(typename);
            nsp = namespace[parts.qualifier];
            name = nsp + '.' + parts.name;
            url = namespaceUrl[nsp] || '';
            //TODO: introduce better way than guessing
            if (url.endsWith('.xml')) url = url.substr(0, url.length - 3) + 'openapi3.json';
        }
        return {
            $ref: url + '#/components/schemas/' + name + suffix
        };
    }

    /**
     * a qualified name consists of a namespace or alias, a dot, and a simple name
     * @param {string} qualifiedName 
     * @return {string} namespace-qualified name
     */
    function namespaceQualifiedName(qualifiedName) {
        let np = nameParts(qualifiedName);
        return namespace[np.qualifier] + '.' + np.name;
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
        let path = paren === -1 ? target : target.substring(0, paren);
        let args = paren === -1 ? '' : target.substring(paren);

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
