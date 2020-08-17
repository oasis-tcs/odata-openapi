/**
 * Converts OData CSDL JSON to OpenAPI 3.0.2
 * 
 * Latest version: https://github.com/oasis-tcs/odata-openapi/blob/master/lib/csdl2openapi.js
*/

//TODO
// - Core.Example for complex types
// - reduce number of loops over schemas
// - inject $Name or $$Name into each model element to make parameter passing easier?
// - allow passing additional files for referenced documents
// - delta: headers Prefer and Preference-Applied
// - custom headers and query options - https://issues.oasis-open.org/browse/ODATA-1099
// - response codes and descriptions - https://issues.oasis-open.org/browse/ODATA-884
// - inline definitions for Edm.* to make OpenAPI documents self-contained
// - $Extends for entity container: include /paths from referenced container
// - both "clickable" and freestyle $expand, $select, $orderby - does not work yet, open issue for Swagger UI
// - system query options for actions/functions/imports depending on $Collection
// - 200 response for PATCH
// - ETag for GET / If-Match for PATCH and DELETE depending on @Core.OptimisticConcurrency
// - CountRestrictions for GET collection-valued (containment) navigation - https://issues.oasis-open.org/browse/ODATA-1300
// - InsertRestrictions/NonInsertableProperties
// - InsertRestrictions/NonInsertableNavigationProperties
// - see //TODO comments below

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
        diagram = false,
        maxLevels = 5
    } = {}
) {
    const serviceRoot = scheme + '://' + host + basePath;
    const queryOptionPrefix = csdl.$Version <= '4.0' ? '$' : '';
    const typesToInline = {}; // filled in schema() and used in inlineTypes()
    const boundOverloads = {};
    const derivedTypes = {};
    const alias = {};
    const namespace = { 'Edm': 'Edm' };
    const namespaceUrl = {};
    const voc = {};
    preProcess(csdl, boundOverloads, derivedTypes, alias, namespace, namespaceUrl, voc);

    const entityContainer = csdl.$EntityContainer ? modelElement(csdl.$EntityContainer) : {};
    const keyAsSegment = entityContainer[voc.Capabilities.KeyAsSegmentSupported];
    const deepUpdate = entityContainer[voc.Capabilities.DeepUpdateSupport] && entityContainer[voc.Capabilities.DeepUpdateSupport].Supported;

    const openapi = {
        openapi: '3.0.2',
        info: info(csdl, entityContainer),
        servers: servers(serviceRoot),
        tags: tags(entityContainer),
        paths: paths(entityContainer),
        components: components(csdl, entityContainer)
    };
    if (!csdl.$EntityContainer) {
        delete openapi.servers;
        delete openapi.tags;
    }

    security(openapi, entityContainer);

    return openapi;


    /**
     * Collect model info for easier lookup
     * @param {object} csdl CSDL document
     * @param {object} boundOverloads Map of action/function names to bound overloads
     * @param {object} derivedTypes Map of type names to derived types
     * @param {object} alias Map of namespace or alias to alias
     * @param {object} namespace Map of namespace or alias to namespace
     * @param {object} namespaceUrl Map of namespace to reference URL
     * @param {object} voc Map of vocabularies and terms
     */
    function preProcess(csdl, boundOverloads, derivedTypes, alias, namespace, namespaceUrl, voc) {
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

        vocabularies(voc, alias);

        Object.keys(csdl).filter(name => isIdentifier(name)).forEach(name => {
            const schema = csdl[name];
            const qualifier = schema.$Alias || name;
            const isDefaultNamespace = schema[voc.Core.DefaultNamespace];

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
                        boundOverloads[type].push({ name: (isDefaultNamespace ? name : qualifiedName), overload: overload });
                    });
                } else if (element.$BaseType) {
                    const base = namespaceQualifiedName(element.$BaseType);
                    if (!derivedTypes[base]) derivedTypes[base] = [];
                    derivedTypes[base].push(qualifiedName);
                }
            });

            Object.keys(schema.$Annotations || {}).forEach(target => {
                const annotations = schema.$Annotations[target];
                const segments = target.split('/');
                const open = segments[0].indexOf('(');
                let element;
                if (open == -1) {
                    element = modelElement(segments[0]);
                } else {
                    element = modelElement(segments[0].substring(0, open));
                    let args = segments[0].substring(open + 1, segments[0].length - 1);
                    element = element.find(overload =>
                        overload.$Kind == 'Action' && overload.$IsBound != true && args == ''
                        || overload.$Kind == 'Action' && args == (overload.$Parameter[0].$Type || '')
                        || (overload.$Parameter || []).map(p => p.$Type || 'Edm.String').join(',') == args);
                }
                if (!element) {
                    // console.warn(`Invalid annotation target '${target}'`)
                } else if (Array.isArray(element)) {
                    //TODO: action or function: 
                    //- loop over all overloads
                    //- if there are more segments, a parameter or the return type is targeted
                } else {
                    switch (segments.length) {
                        case 1:
                            Object.assign(element, annotations);
                            break;
                        case 2:
                            if (['Action', 'Function'].includes(element.$Kind)) {
                                if (segments[1] == '$ReturnType') {
                                    Object.assign(element.$ReturnType, annotations);
                                } else {
                                    const parameter = element.$Parameter.find(p => p.$Name == segments[1]);
                                    Object.assign(parameter, annotations);
                                }
                            } else {
                                if (element[segments[1]]) {
                                    Object.assign(element[segments[1]], annotations);
                                } else {
                                    // console.warn(`Invalid annotation target '${target}'`)
                                }
                            }
                            break;
                        default:
                            console.warn('More than two annotation target path segments');
                    }
                }
            });
        });
    }

    /**
     * Construct map of qualified term names
     * @param {object} voc Map of vocabularies and terms
     * @param {object} alias Map of namespace or alias to alias
     */
    function vocabularies(voc, alias) {
        const terms = {
            Authorization: ['Authorizations', 'SecuritySchemes'],
            Capabilities: ['BatchSupport', 'BatchSupported', 'ChangeTracking', 'CountRestrictions', 'DeleteRestrictions', 'DeepUpdateSupport', 'ExpandRestrictions',
                'FilterRestrictions', 'IndexableByKey', 'InsertRestrictions', 'KeyAsSegmentSupported', 'NavigationRestrictions',
                'SearchRestrictions', 'SelectSupport', 'SkipSupported', 'SortRestrictions',
                'ReadRestrictions', 'TopSupported', 'UpdateRestrictions'],
            Core: ['AcceptableMediaTypes', 'Computed', 'DefaultNamespace', 'Description', 'Example', 'Immutable', 'LongDescription',
                'OptionalParameter', 'Permissions', 'SchemaVersion'],
            JSON: ['Schema'],
            Validation: ['AllowedValues', 'Exclusive', 'Maximum', 'Minimum', 'Pattern']
        };

        Object.keys(terms).forEach(vocab => {
            voc[vocab] = {};
            terms[vocab].forEach(term => {
                voc[vocab][term] = '@' + alias['Org.OData.' + vocab + '.V1'] + '.' + term;
            });
        });
    }

    /**
     * Construct the Info Object
     * @param {object} csdl CSDL document
     * @param {object} entityContainer Entity Container object
     * @return {object} Info Object
     */
    function info(csdl, entityContainer) {
        const namespace = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
        const containerSchema = csdl.$EntityContainer ? csdl[namespace] : {};
        const description = (
            entityContainer[voc.Core.LongDescription]
            || containerSchema[voc.Core.LongDescription]
            || 'This service is located at [' + serviceRoot + '/]('
            + serviceRoot.replace(/\(/g, '%28').replace(/\)/g, '%29') + '/)'
        ) + (diagram ? resourceDiagram(csdl, entityContainer) : '');
        return {
            title: entityContainer[voc.Core.Description]
                || containerSchema[voc.Core.Description]
                || (csdl.$EntityContainer ? 'Service for namespace ' + namespace : 'OData CSDL document'),
            description: csdl.$EntityContainer ? description : '',
            version: containerSchema[voc.Core.SchemaVersion] || ''
        };
    }

    /**
     * Construct resource diagram using web service at https://yuml.me
     * @param {object} csdl CSDL document
     * @param {object} entityContainer Entity Container object
     * @return {string} resource diagram
     */
    function resourceDiagram(csdl) {
        let diagram = '';
        let comma = '';
        //TODO: make colors configurable
        let color = { resource: '{bg:lawngreen}', entityType: '{bg:lightslategray}', complexType: '', external: '{bg:whitesmoke}' }

        Object.keys(csdl).filter(name => isIdentifier(name)).forEach(namespace => {
            const schema = csdl[namespace];
            Object.keys(schema).filter(name => isIdentifier(name) && ['EntityType', 'ComplexType'].includes(schema[name].$Kind))
                .forEach(typeName => {
                    const type = schema[typeName];
                    diagram += comma
                        + (type.$BaseType ? '[' + nameParts(type.$BaseType).name + ']^' : '')
                        + '[' + typeName + (type.$Kind == 'EntityType' ? color.entityType : color.complexType) + ']';
                    Object.keys(type).filter(name => isIdentifier(name)).forEach(propertyName => {
                        const property = type[propertyName];
                        const targetNP = nameParts(property.$Type || 'Edm.String');
                        if (property.$Kind == 'NavigationProperty' || targetNP.qualifier != 'Edm') {
                            const target = modelElement(property.$Type);
                            const bidirectional = property.$Partner && target && target[property.$Partner] && target[property.$Partner].$Partner == propertyName;
                            // Note: if the partner has the same name then it will also be depicted
                            if (!bidirectional || propertyName <= property.$Partner) {
                                diagram += ',[' + typeName + ']'
                                    + ((property.$Kind != 'NavigationProperty' || property.$ContainsTarget) ? '++' : (bidirectional ? cardinality(target[property.$Partner]) : ''))
                                    + '-'
                                    + cardinality(property)
                                    + ((property.$Kind != 'NavigationProperty' || bidirectional) ? '' : '>')
                                    + '['
                                    + (target ? targetNP.name : property.$Type + color.external)
                                    + ']';
                            }
                        }
                    });
                    comma = ',';
                });
        });

        Object.keys(entityContainer).filter(name => isIdentifier(name)).reverse().forEach(name => {
            const resource = entityContainer[name];
            if (resource.$Type) {
                diagram += comma
                    + '[' + name + '%20' + color.resource + ']' // additional space in case entity set and type have same name
                    + '++-'
                    + cardinality(resource, true)
                    + '>[' + nameParts(resource.$Type).name + ']';
            } else {
                if (resource.$Action) {
                    diagram += comma
                        + '[' + name + color.resource + ']';
                    const overload = modelElement(resource.$Action).find(overload => !overload.$IsBound);
                    if (overload.$ReturnType) {
                        const type = modelElement(overload.$ReturnType.$Type || 'Edm.String');
                        if (type) {
                            diagram += '-'
                                + cardinality(overload.$ReturnType, true)
                                + '>[' + nameParts(overload.$ReturnType.$Type).name + ']';
                        }
                    }
                } else if (resource.$Function) {
                    diagram += comma
                        + '[' + name + color.resource + ']';
                    const overloads = modelElement(resource.$Function);
                    if (overloads) {
                        const unbound = overloads.filter(overload => !overload.$IsBound);
                        // TODO: loop over all overloads, add new source box after first arrow
                        const overload = unbound[0];
                        const type = modelElement(overload.$ReturnType.$Type || 'Edm.String');
                        if (type) {
                            diagram += '-'
                                + cardinality(overload.$ReturnType, true)
                                + '>[' + nameParts(overload.$ReturnType.$Type).name + ']';
                        }
                    }
                }
            }
        });

        if (diagram != '') {
            diagram = '\n\n## Entity Data Model\n![ER Diagram](https://yuml.me/diagram/class/'
                + diagram
                + ')\n\n### Legend\n![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type' + color.external
                + '],[ComplexType' + color.complexType + '],[EntityType' + color.entityType
                + '],[EntitySet/Singleton/Operation' + color.resource + '])';
        }

        return diagram;

        /**
         * Diagram representation of property cardinality
         * @param {object} typedElement Typed model element, e.g. property
         * @param {boolean} one Explicitly represent to-1
         * @return {string} cardinality
         */
        function cardinality(typedElement, one = false) {
            return typedElement.$Collection ? '*' : (typedElement.$Nullable ? '0..1' : '');
        }
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
            const tag = { name: child };
            const type = modelElement(container[child].$Type);
            const description = container[child][voc.Core.Description]
                || type && type[voc.Core.Description];
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
        const resources = Object.keys(container).filter(name => isIdentifier(name));
        resources.forEach(name => {
            let child = container[name];
            if (child.$Type) {
                // entity sets and singletons are almost containment navigation properties
                child.$ContainsTarget = true;
                pathItems(paths, '/' + name, [], child, child, name, name, child, 0, '');
            } else if (child.$Action) {
                pathItemActionImport(paths, name, child);
            } else if (child.$Function) {
                pathItemFunctionImport(paths, name, child);
            } else {
                console.warn('Unrecognized entity container child: ' + name);
            }
        })
        if (resources.length > 0) pathItemBatch(paths, container);
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
        const restrictions = navigationPropertyRestrictions(root, navigationPath);
        const nonExpandable = nonExpandableProperties(root, navigationPath);

        paths[prefix] = pathItem;
        if (prefixParameters.length > 0) paths[prefix].parameters = prefixParameters;

        operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, false, nonExpandable);
        if (element.$Collection && (element.$ContainsTarget || level < 2 && target)) {
            operationCreate(pathItem, element, name, sourceName, targetName, target, level, restrictions);
        }
        pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);

        if (element.$ContainsTarget) {
            if (element.$Collection) {
                if (level < maxLevels)
                    pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, nonExpandable);
            } else {
                operationUpdate(pathItem, element, name, sourceName, target, level, restrictions);
                if (element.$Nullable) {
                    operationDelete(pathItem, element, name, sourceName, target, level, restrictions);
                }
                pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);
                pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceName, level, navigationPath);
            }
        }
    }

    /**
     * Find navigation restrictions for a navigation path
     * @param {object} root Root model element
     * @param {string} navigationPath Path for finding navigation restrictions
     * @return Navigation property restrictions of navigation segment
     */
    function navigationPropertyRestrictions(root, navigationPath) {
        const navigationRestrictions = root[voc.Capabilities.NavigationRestrictions] || {};
        return (navigationRestrictions.RestrictedProperties || []).find(item => item.NavigationProperty == navigationPath)
            || {};
    }

    /**
     * Find non-expandable properties for a navigation path
     * @param {object} root Root model element
     * @param {string} navigationPath Path for finding navigation restrictions
     * @return Navigation property restrictions of navigation segment
     */
    function nonExpandableProperties(root, navigationPath) {
        const expandRestrictions = root[voc.Capabilities.ExpandRestrictions] || {};
        const prefix = navigationPath.length === 0 ? '' : navigationPath + '/'
        const from = prefix.length
        const nonExpandable = []
        for (const path of (expandRestrictions.NonExpandableProperties || [])) {
            if (path.startsWith(prefix)) {
                nonExpandable.push(path.substring(from))
            }
        }
        return nonExpandable;
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
     * @param {array} nonExpandable Non-expandable navigation properties
     */
    function pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, nonExpandable) {
        const targetIndexable = target == null || target[voc.Capabilities.IndexableByKey] != false;
        if (restrictions.IndexableByKey == true || restrictions.IndexableByKey != false && targetIndexable) {
            const name = prefix.substring(prefix.lastIndexOf('/') + 1);
            const type = modelElement(element.$Type);
            const key = entityKey(type, level);
            if (key.parameters.length > 0) {
                const path = prefix + key.segment;
                const parameters = prefixParameters.concat(key.parameters);
                const pathItem = { parameters: parameters };
                paths[path] = pathItem;

                operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, true, nonExpandable);
                operationUpdate(pathItem, element, name, sourceName, target, level, restrictions);
                operationDelete(pathItem, element, name, sourceName, target, level, restrictions);

                pathItemsForBoundOperations(paths, path, parameters, element, sourceName, true);
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
        const insertRestrictions = restrictions.InsertRestrictions || target && target[voc.Capabilities.InsertRestrictions] || {};

        if (insertRestrictions.Insertable !== false) {
            const type = modelElement(element.$Type);
            pathItem.post = {
                summary: insertRestrictions.Description || 'Add new entity to ' + (level > 0 ? 'related ' : '') + name,
                tags: [sourceName],
                requestBody: {
                    description: type && type[voc.Core.Description] || 'New entity',
                    required: true,
                    content: {
                        'application/json': {
                            schema: ref(element.$Type, '-create')
                        }
                    }
                },
                responses: response(201, 'Created entity', { $Type: element.$Type })
            };
            if (insertRestrictions.LongDescription) pathItem.post.description = insertRestrictions.LongDescription;
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
     * @param {boolean} byKey Read by key
     * @param {array} nonExpandable Non-expandable navigation properties
     */
    function operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, byKey, nonExpandable) {
        const targetRestrictions = target && target[voc.Capabilities.ReadRestrictions];
        const readRestrictions = restrictions.ReadRestrictions || targetRestrictions || {};
        const readByKeyRestrictions = readRestrictions.ReadByKeyRestrictions;
        let readable = true;
        if (byKey && readByKeyRestrictions && readByKeyRestrictions.Readable !== undefined)
            readable = readByKeyRestrictions.Readable;
        else if (readRestrictions.Readable !== undefined)
            readable = readRestrictions.Readable;

        if (readable) {
            let descriptions = (level == 0 ? targetRestrictions : restrictions.ReadRestrictions) || {};
            if (byKey) descriptions = descriptions.ReadByKeyRestrictions || {};

            const collection = !byKey && element.$Collection;
            const operation = {
                summary: descriptions.Description
                    || 'Get '
                    + (byKey ? 'entity from ' : (element.$Collection ? 'entities from ' : ''))
                    + (level > 0 ? 'related ' : '')
                    + name
                    + (byKey ? ' by key' : ''),
                tags: [sourceName],
                parameters: [],
                responses: response(200, 'Retrieved entit' + (collection ? 'ies' : 'y'), { $Type: element.$Type, $Collection: collection })
            };
            const deltaSupported = element[voc.Capabilities.ChangeTracking] && element[voc.Capabilities.ChangeTracking].Supported;
            if (!byKey && deltaSupported) {
                operation.responses[200].content['application/json'].schema.properties['@odata.deltaLink'] = {
                    type: 'string',
                    example: basePath + '/' + name + '?$deltatoken=opaque server-generated token for fetching the delta'
                }
            }
            if (descriptions.LongDescription) operation.description = descriptions.LongDescription;
            if (target && sourceName != targetName) operation.tags.push(targetName);

            if (collection) {
                optionTop(operation.parameters, target, restrictions);
                optionSkip(operation.parameters, target, restrictions);
                if (csdl.$Version >= '4.0') optionSearch(operation.parameters, target, restrictions);
                optionFilter(operation.parameters, target, restrictions);
                optionCount(operation.parameters, target);
                optionOrderBy(operation.parameters, element, target, restrictions);
            }

            optionSelect(operation.parameters, element, target, restrictions);
            optionExpand(operation.parameters, element, target, nonExpandable);

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
     * @param {array} nonExpandable Non-expandable navigation properties
     */
    function optionExpand(parameters, element, target, nonExpandable) {
        const targetRestrictions = target && target[voc.Capabilities.ExpandRestrictions];
        const supported = targetRestrictions == null || targetRestrictions.Expandable != false;
        if (supported) {
            const expandItems = ['*'].concat(navigationPaths(element).filter(path => !nonExpandable.includes(path)));
            if (expandItems.length > 1) {
                parameters.push({
                    name: queryOptionPrefix + 'expand',
                    description: (targetRestrictions && targetRestrictions[voc.Core.Description])
                        || 'Expand related entities, see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
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
     * Collect navigation paths of a navigation segment and its potentially structured components
     * @param {object} element Model element of navigation segment
     * @param {string} prefix Navigation prefix
     * @param {integer} level Number of navigation segments so far
     * @return {Array} Array of navigation property paths
     */
    function navigationPaths(element, prefix = '', level = 0) {
        const paths = [];
        const type = modelElement(element.$Type);
        const properties = propertiesOfStructuredType(type);
        Object.keys(properties).forEach(key => {
            if (properties[key].$Kind == 'NavigationProperty') {
                paths.push(prefix + key)
            } else if (properties[key].$Type && level < maxLevels) {
                paths.push(...navigationPaths(properties[key], prefix + key + '/', level + 1));
            }
        })
        return paths;
    }

    /**
     * Add parameter for query option $filter
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionFilter(parameters, target, restrictions) {
        const filterRestrictions = restrictions.FilterRestrictions || target && target[voc.Capabilities.FilterRestrictions] || {};

        if (filterRestrictions.Filterable !== false) {
            const filter = {
                name: queryOptionPrefix + 'filter',
                description: filterRestrictions[voc.Core.Description]
                    || 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)',
                in: 'query',
                schema: {
                    type: 'string'
                }
            };
            if (filterRestrictions.RequiresFilter)
                filter.required = true;
            if (filterRestrictions.RequiredProperties) {
                filter.description += '\n\nRequired filter properties:';
                filterRestrictions.RequiredProperties.forEach(
                    item => filter.description += '\n- ' + item
                );
            }
            parameters.push(filter);
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
        const sortRestrictions = restrictions.SortRestrictions || target && target[voc.Capabilities.SortRestrictions] || {};

        if (sortRestrictions.Sortable !== false) {
            const nonSortable = {};
            (sortRestrictions.NonSortableProperties || []).forEach(name => {
                nonSortable[name] = true;
            });
            const orderbyItems = [];
            primitivePaths(element).filter(property => !nonSortable[property]).forEach(property => {
                orderbyItems.push(property);
                orderbyItems.push(property + ' desc');
            });
            if (orderbyItems.length > 0) {
                parameters.push({
                    name: queryOptionPrefix + 'orderby',
                    description: sortRestrictions[voc.Core.Description]
                        || 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
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
     * Collect primitive paths of a navigation segment and its potentially structured components
     * @param {object} element Model element of navigation segment
     * @param {string} prefix Navigation prefix
     * @return {Array} Array of primitive property paths
     */
    function primitivePaths(element, prefix = '') {
        const paths = [];
        const elementType = modelElement(element.$Type);

        if (!elementType) {
            console.warn(`Unknown type for element: ${JSON.stringify(element)}`);
            return paths;
        }

        const propsOfType = propertiesOfStructuredType(elementType);
        const ignore = Object.entries(propsOfType)
            .filter(entry => entry[1].$Kind !== 'NavigationProperty')
            .filter(entry => entry[1].$Type)
            .filter(entry => nameParts(entry[1].$Type).qualifier !== 'Edm')
            .filter(entry => !modelElement(entry[1].$Type));

        // Keep old logging
        ignore.forEach(entry => console.warn(`Unknown type for element: ${JSON.stringify(entry)}`));

        const properties = Object.entries(propsOfType)
            .filter(entry => entry[1].$Kind !== 'NavigationProperty')
            .filter(entry => !ignore.includes(entry))
            .map(entryToProperty({ path: prefix, typeRefChain: [] }));

        for (let i = 0; i < properties.length; i++) {
            const property = properties[i];
            if (!property.isComplex) {
                paths.push(property.path);
                continue;
            }

            const typeRefChainTail = property.typeRefChain[property.typeRefChain.length - 1];

            // Allow full cycle to be shown (0) times
            if (property.typeRefChain.filter(_type => _type === typeRefChainTail).length > 1) {
                console.warn(`Cycle detected ${property.typeRefChain.join('->')}`);
                continue;
            }

            const expanded = Object.entries(property.properties)
                .filter(property => property[1].$Kind !== 'NavigationProperty')
                .map(entryToProperty(property))
            properties.splice(i + 1, 0, ...expanded);
        }

        return paths;
    }

    function entryToProperty(parent) {

        return function (entry) {
            const key = entry[0];
            const property = entry[1];
            const propertyType = property.$Type && modelElement(property.$Type);

            if (propertyType && propertyType.$Kind && propertyType.$Kind === 'ComplexType') {
                return {
                    properties: propertiesOfStructuredType(propertyType),
                    path: `${parent.path}${key}/`,
                    typeRefChain: parent.typeRefChain.concat(property.$Type),
                    isComplex: true
                }
            }

            return {
                properties: {},
                path: `${parent.path}${key}`,
                typeRefChain: [],
                isComplex: false,
            }
        };
    }

    /**
     * Add parameter for query option $search
     * @param {Array} parameters Array of parameters to augment
     * @param {string} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionSearch(parameters, target, restrictions) {
        const searchRestrictions = restrictions.SearchRestrictions || target && target[voc.Capabilities.SearchRestrictions] || {};

        if (searchRestrictions.Searchable !== false) {
            if (searchRestrictions[voc.Core.Description]) {
                parameters.push({
                    name: queryOptionPrefix + 'search',
                    description: searchRestrictions[voc.Core.Description],
                    in: 'query',
                    schema: { type: 'string' }
                });
            } else {
                parameters.push({ $ref: '#/components/parameters/search' });
            }
        }
    }

    /**
     * Add parameter for query option $select
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {string} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionSelect(parameters, element, target, restrictions) {
        const selectSupport = restrictions.SelectSupport || target && target[voc.Capabilities.SelectSupport] || {};

        if (selectSupport.Supported !== false) {
            const type = modelElement(element.$Type) || {};
            const properties = propertiesOfStructuredType(type);
            const selectItems = [];
            Object.keys(properties).filter(key => properties[key].$Kind != 'NavigationProperty').forEach(
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
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionSkip(parameters, target, restrictions) {
        const supported = restrictions.SkipSupported !== undefined
            ? restrictions.SkipSupported
            : target == null || target[voc.Capabilities.SkipSupported] !== false;;

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
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionTop(parameters, target, restrictions) {
        const supported = restrictions.TopSupported !== undefined
            ? restrictions.TopSupported
            : target == null || target[voc.Capabilities.TopSupported] !== false;;

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
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function operationUpdate(pathItem, element, name, sourceName, target, level, restrictions) {
        const updateRestrictions = restrictions.UpdateRestrictions || target && target[voc.Capabilities.UpdateRestrictions] || {};

        if (updateRestrictions.Updatable !== false) {
            const type = modelElement(element.$Type);
            pathItem.patch = {
                summary: updateRestrictions.Description
                    || 'Update ' + (element.$Collection ? 'entity in ' : '') + (level > 0 ? 'related ' : '') + name,
                tags: [sourceName],
                requestBody: {
                    description: type && type[voc.Core.Description] || 'New property values',
                    required: true,
                    content: {
                        'application/json': {
                            schema: ref(element.$Type, '-update')
                        }
                    }
                },
                responses: response(204, 'Success')
            };
            if (updateRestrictions.LongDescription) pathItem.patch.description = updateRestrictions.LongDescription;
        }
    }

    /**
     * Construct Operation Object for delete
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} target Target container child of path
     * @param {integer} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function operationDelete(pathItem, element, name, sourceName, target, level, restrictions) {
        const deleteRestrictions = restrictions.DeleteRestrictions || target && target[voc.Capabilities.DeleteRestrictions] || {};

        if (deleteRestrictions.Deletable !== false) {
            pathItem.delete = {
                summary: deleteRestrictions.Description
                    || 'Delete ' + (element.$Collection ? 'entity from ' : '') + (level > 0 ? 'related ' : '') + name,
                tags: [sourceName],
                responses: response(204, 'Success')
            };
            if (deleteRestrictions.LongDescription) pathItem.delete.description = deleteRestrictions.LongDescription;
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
        const navigationRestrictions = root[voc.Capabilities.NavigationRestrictions] || {};
        const rootNavigable = level == 0 && navigationRestrictions.Navigability != 'None'
            || level == 1 && navigationRestrictions.Navigability != 'Single'
            || level > 1;

        if (type && level < maxLevels) {
            const properties = navigationPathMap(type);
            Object.keys(properties).forEach(name => {
                const parentRestrictions = navigationPropertyRestrictions(root, navigationPrefix);
                if (parentRestrictions.Navigability == 'Single') return;

                const navigationPath = navigationPrefix + (navigationPrefix.length > 0 ? '/' : '') + name;
                const restrictions = navigationPropertyRestrictions(root, navigationPath);
                if (['Recursive', 'Single'].includes(restrictions.Navigability) || restrictions.Navigability == null && rootNavigable) {
                    const targetSetName = root.$NavigationPropertyBinding && root.$NavigationPropertyBinding[navigationPath];
                    const target = entityContainer[targetSetName];
                    pathItems(paths, prefix + '/' + name, prefixParameters, properties[name], root, sourceName, targetSetName, target, level + 1, navigationPath);
                }
            });
        }
    }

    /**
     * Collect navigation paths of a navigation segment and its potentially structured components
     * @param {object} type Structured type
     * @param {object} map Map of navigation property paths and their types
     * @param {string} prefix Navigation prefix
     * @param {integer} level Number of navigation segments so far
     * @return {object} Map of navigation property paths and their types
     */
    function navigationPathMap(type, map = {}, prefix = '', level = 0) {
        const properties = propertiesOfStructuredType(type);
        Object.keys(properties).forEach(key => {
            if (properties[key].$Kind == 'NavigationProperty') {
                map[prefix + key] = properties[key];
            } else if (properties[key].$Type && !properties[key].$Collection && level < maxLevels) {
                navigationPathMap(modelElement(properties[key].$Type), map, prefix + key + '/', level + 1);
            }
        })
        return map;
    }

    /**
     * Construct map of key names for an entity type
     * @param {object} type Entity type object
     * @return {object} Map of key names
     */
    function keyMap(type) {
        const map = {};
        if (type.$Kind == 'EntityType') {
            const keys = key(type) || [];
            keys.forEach(key => {
                if (typeof key == 'string')
                    map[key] = true;
            });
        }
        return map;
    }

    /**
     * Key for path item
     * @param {object} entityType Entity Type object
     * @return {array} Key of entity type or null
     */
    function key(entityType) {
        let type = entityType;
        let keys = null;
        while (type) {
            keys = type.$Key;
            if (keys || !type.$BaseType) break;
            type = modelElement(type.$BaseType);
        }
        return keys;
    }

    /**
     * Key for path item
     * @param {object} entityType Entity Type object
     * @param {integer} level Number of navigation segments so far
     * @return {object} key: Key segment, parameters: key parameters
     */
    function entityKey(entityType, level) {
        let segment = '';
        const params = [];
        const keys = key(entityType) || [];
        const properties = propertiesOfStructuredType(entityType);

        keys.forEach((key, index) => {
            const suffix = level > 0 ? '_' + level : '';
            if (keyAsSegment)
                segment += '/';
            else {
                if (index > 0) segment += ',';
                if (keys.length != 1) segment += key + '=';
            }
            let parameter;
            let property = {};
            if (typeof key == 'string') {
                parameter = key;
                property = properties[key];
            } else {
                parameter = Object.keys(key)[0];
                const segments = key[parameter].split('/');
                property = properties[segments[0]];
                for (let i = 1; i < segments.length; i++) {
                    const complexType = modelElement(property.$Type);
                    const properties = propertiesOfStructuredType(complexType);
                    property = properties[segments[i]];
                }
            }
            const propertyType = property.$Type;
            segment += pathValuePrefix(propertyType) + '{' + parameter + suffix + '}' + pathValueSuffix(propertyType);
            const param = {
                description: [property[voc.Core.Description], property[voc.Core.LongDescription]].filter(t => t).join('  \n')
                    || 'key: ' + parameter,
                in: 'path',
                name: parameter + suffix,
                required: true,
                schema: schema(property, '', true)
            };
            params.push(param);
        })
        return { segment: (keyAsSegment ? '' : '(') + segment + (keyAsSegment ? '' : ')'), parameters: params };
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
        if (keyAsSegment) return '';
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
        if (keyAsSegment) return '';
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
        const overload = modelElement(child.$Action).find(overload => !overload.$IsBound);
        pathItemAction(paths, '/' + name, [], child.$Action, overload, child.$EntitySet, child);
    }

    /**
     * Add path and Path Item Object for action overload
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {string} actionName Qualified name of function
     * @param {object} overload Function overload
     * @param {string} sourceName Name of path source
     * @param {string} actionImport Action import
     */
    function pathItemAction(paths, prefix, prefixParameters, actionName, overload, sourceName, actionImport = {}) {
        const name = actionName.indexOf('.') === -1 ? actionName : nameParts(actionName).name;
        const pathItem = {
            post: {
                summary: actionImport[voc.Core.Description] || overload[voc.Core.Description] || 'Invoke action ' + name,
                tags: [sourceName || 'Service Operations'],
                responses: overload.$ReturnType
                    ? response(200, 'Success', overload.$ReturnType)
                    : response(204, 'Success')
            }
        };
        const description = actionImport[voc.Core.LongDescription] || overload[voc.Core.LongDescription];
        if (description) pathItem.post.description = description;
        if (prefixParameters.length > 0) pathItem.post.parameters = prefixParameters;
        let parameters = overload.$Parameter || [];
        if (overload.$IsBound) parameters = parameters.slice(1);
        if (parameters.length > 0) {
            const requestProperties = {};
            parameters.forEach(p => { requestProperties[p.$Name] = schema(p) });
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
        console.assert(overloads, 'Unknown function "' + child.$Function + '" in function import "' + name + '"');
        overloads && overloads.filter(overload => !overload.$IsBound).forEach(overload => pathItemFunction(paths, '/' + name, [], child.$Function, overload, child.$EntitySet, child));
    }

    /**
     * Add path and Path Item Object for function overload
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {string} functionName Qualified name of function
     * @param {object} overload Function overload
     * @param {string} sourceName Name of path source
     * @param {object} functionImport Function Import
     */
    function pathItemFunction(paths, prefix, prefixParameters, functionName, overload, sourceName, functionImport = {}) {
        const name = functionName.indexOf('.') === -1 ? functionName : nameParts(functionName).name;
        let parameters = overload.$Parameter || [];
        if (overload.$IsBound) parameters = parameters.slice(1);

        const pathSegments = [];
        const params = [];

        const implicitAliases = csdl.$Version > '4.0' || parameters.some(p => p[voc.Core.OptionalParameter]);

        parameters.forEach(p => {
            const param = {
                required: implicitAliases ? !p[voc.Core.OptionalParameter] : true
            };
            const description = [p[voc.Core.Description], p[voc.Core.LongDescription]].filter(t => t).join('  \n');
            if (description) param.description = description;
            const type = modelElement(p.$Type || 'Edm.String');
            // TODO: check whether parameter or type definition of Edm.Stream is annotated with JSON.Schema
            if (p.$Collection || p.$Type == 'Edm.Stream'
                || type && ['ComplexType', 'EntityType'].includes(type.$Kind)
                || type && type.$UnderlyingType == 'Edm.Stream') {
                param.in = 'query';
                if (implicitAliases) {
                    param.name = p.$Name;
                } else {
                    pathSegments.push(p.$Name + '=@' + p.$Name);
                    param.name = '@' + p.$Name;
                }
                param.schema = { type: 'string' };
                if (description) param.description += '  \n'; else param.description = '';
                param.description += 'This is '
                    + (p.$Collection ? 'a ' : '')
                    + 'URL-encoded JSON '
                    + (p.$Collection ? 'array with items ' : '')
                    + 'of type '
                    + namespaceQualifiedName(p.$Type || 'Edm.String')
                    + ', see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)';
                param.example = p.$Collection ? '[]' : '{}';
            } else {
                if (implicitAliases) {
                    param.in = 'query';
                } else {
                    pathSegments.push(p.$Name + '=' + pathValuePrefix(p.$Type) + '{' + p.$Name + '}' + pathValueSuffix(p.$Type));
                    param.in = 'path';
                }
                param.name = p.$Name;
                param.schema = schema(p, '', true);
            }
            params.push(param);
        });

        const pathParameters = implicitAliases ? '' : '(' + pathSegments.join(',') + ')';
        const pathItem = {
            get: {
                summary: functionImport[voc.Core.Description] || overload[voc.Core.Description] || 'Invoke function ' + name,
                tags: [sourceName || 'Service Operations'],
                parameters: prefixParameters.concat(params),
                responses: response(200, 'Success', overload.$ReturnType)
            }
        };
        const description = functionImport[voc.Core.LongDescription] || overload[voc.Core.LongDescription];
        if (description) pathItem.get.description = description;
        paths[prefix + pathParameters] = pathItem;
    }

    /**
     * Add path and Path Item Object for batch requests
     * @param {object} paths Paths Object to augment
     * @param {object} container Entity container
     */
    function pathItemBatch(paths, container) {
        const batchSupport = container[voc.Capabilities.BatchSupport] || {};
        const supported = container[voc.Capabilities.BatchSupported] !== false && batchSupport.Supported !== false;
        if (supported) {
            const firstEntitySet = Object.keys(container).filter(child => isIdentifier(child) && container[child].$Collection)[0];
            paths['/$batch'] = {
                post: {
                    summary: batchSupport[voc.Core.Description] || 'Send a group of requests',
                    description: (batchSupport[voc.Core.LongDescription] || 'Group multiple requests into a single request payload, see '
                        + '[Batch Requests](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_BatchRequests).')
                        + '\n\n*Please note that "Try it out" is not supported for this request.*',
                    tags: ['Batch Requests'],
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
                        '4XX': {
                            $ref: '#/components/responses/error'
                        }
                    }
                }
            };
            paths['/$batch'].post.responses[csdl.$Version < '4.0' ? 202 : 200] = {
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
            };
        }
    }

    /**
     * Construct Responses Object
     * @param {string} code HTTP response code
     * @param {string} description Description
     * @param {object} type Response type object
     */
    function response(code, description, type = {}) {
        const r = {};
        r[code] = {
            description: description
        };
        if (code != 204) {
            const s = schema(type);
            r[code].content = {
                'application/json': {
                    schema: type.$Collection
                        ? {
                            type: 'object',
                            title: 'Collection of ' + nameParts(type.$Type || 'Edm.String').name,
                            properties: {
                                [csdl.$Version > '4.0' ? '@count' : '@odata.count']: ref('count'),
                                value: s
                            }
                        }
                        : s
                }
            };
        }
        r['4XX'] = {
            $ref: '#/components/responses/error'
        }
        return r;
    }

    /**
     * Construct the Components Object from the types of the CSDL document
     * @param {object} csdl CSDL document
     * @param {object} entityContainer Entity Container object
     * @return {object} Components Object
     */
    function components(csdl, entityContainer) {
        const c = {
            schemas: schemas(csdl)
        };

        if (csdl.$EntityContainer) {
            c.parameters = parameters();
            c.responses = {
                error: {
                    description: 'Error',
                    content: {
                        'application/json': {
                            schema: ref('error')
                        }
                    }
                }
            };
        }

        securitySchemes(c, entityContainer)

        return c;
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

        if (csdl.$EntityContainer) {
            s.count = count();
            s.error = error();
        }

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
                if (property.$Collection) {
                    allProperties[`${name}@${csdl.$Version === '4.0' ? 'odata.' : ''}count`] = ref('count');
                }
                creProperties[name] = schema(property, '-create');
                if (deepUpdate)
                    updProperties[name] = schema(property, '-create');
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

        const title = type[voc.Core.Description] || name;

        schemas[allName] = {
            title: title,
            type: 'object'
        };
        if (Object.keys(allProperties).length > 0) schemas[allName].properties = allProperties;

        schemas[creName] = {
            title: title + ' (for create)',
            type: 'object',
        };
        if (Object.keys(creProperties).length > 0) schemas[creName].properties = creProperties;
        if (required.length > 0) schemas[creName].required = required;

        schemas[updName] = {
            title: title + ' (for update)',
            type: 'object'
        };
        if (Object.keys(updProperties).length > 0) schemas[updName].properties = updProperties;

        const description = type[voc.Core.LongDescription];
        if (description) {
            schemas[allName].description = description;
            schemas[creName].description = description;
            schemas[updName].description = description;
        }

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
        const properties = (type && type.$BaseType) ? propertiesOfStructuredType(modelElement(type.$BaseType)) : {};
        if (type) {
            Object.keys(type).filter(name => isIdentifier(name)).forEach(name => {
                properties[name] = type[name];
            });
        }
        return properties;
    }

    /**
     * Construct Parameter Objects for type-independent OData system query options
     * @return {object} Map of Parameter Objects
     */
    function parameters() {
        const param = {
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
            }
        };

        if (csdl.$Version >= '4.0') param.search = {
            name: queryOptionPrefix + 'search',
            in: 'query',
            description: 'Search items by search phrases, see [Searching](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionsearch)',
            schema: {
                type: 'string'
            }
        };

        return param;
    }

    /**
     * Construct OData error response
     * @return {object} Error response schema
     */
    function error() {
        const err = {
            type: 'object',
            required: ['error'],
            properties: {
                error: {
                    type: 'object',
                    required: ['code', 'message'],
                    properties: {
                        code: { type: 'string' },
                        message: { type: 'string' },
                        target: { type: 'string' },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['code', 'message'],
                                properties: {
                                    code: { type: 'string' },
                                    message: { type: 'string' },
                                    target: { type: 'string' }
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

        if (csdl.$Version < '4.0') {
            err.properties.error.properties.message = {
                type: 'object',
                properties: {
                    lang: { type: 'string' },
                    value: { type: 'string' }
                },
                required: ['lang', 'value']
            };
            delete err.properties.error.properties.details;
            delete err.properties.error.properties.target;
        }

        return err;
    }

    /**
     * Construct OData count response
     * @return {object} Count response schema
     */
    function count() {
        return {
            anyOf: [
                { type: 'number' },
                { type: 'string' }
            ],
            description: 'The number of entities in the collection. Available when using the [$count](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptioncount) query option.',
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
            case 'Edm.AnnotationPath':
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
            case 'Edm.DateTime':
            case 'Edm.DateTimeOffset':
                s = {
                    type: 'string',
                    format: 'date-time',
                    example: '2017-04-13T15:51:04' + (isNaN(element.$Precision) || element.$Precision === 0 ? '' : '.' + '0'.repeat(element.$Precision)) + 'Z'
                };
                break;
            case 'Edm.Decimal':
                s = {
                    anyOf: [{ type: 'number' }, { type: 'string' }],
                    format: 'decimal',
                    example: 0
                };
                let scale = !isNaN(element.$Scale) ? element.$Scale : null;
                if (scale !== null) {
                    // Node.js 12.13.0 has problems with negative exponents, 10 ** -5 --> 0.000009999999999999999
                    if (scale <= 0)
                        s.multipleOf = 10 ** -scale;
                    else
                        s.multipleOf = 1 / 10 ** scale;
                }
                if (element.$Precision < 16) {
                    let limit = 10 ** (element.$Precision - scale);
                    let delta = 10 ** -scale;
                    s.maximum = limit - delta;
                    s.minimum = -s.maximum;
                }
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
                let jsonSchema = element[voc.JSON.Schema];
                if (jsonSchema) {
                    if (typeof jsonSchema == 'string')
                        s = JSON.parse(jsonSchema);
                    else
                        s = jsonSchema;
                } else {
                    s = {
                        type: 'string',
                        format: 'base64url'
                    };
                }
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
                    console.warn('Unknown type: ' + element.$Type);
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

        if (!forParameter && element[voc.Core.LongDescription]) {
            if (s.$ref) s = { anyOf: [s] };
            s.description = element[voc.Core.LongDescription];
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
     * Augment Components Object with map of Security Scheme Objects
     * @param {object} components Components Object to augment 
     * @param {object} entityContainer Entity Container object
     */
    function securitySchemes(components, entityContainer) {
        const authorizations = entityContainer[voc.Authorization.Authorizations] || [];
        const schemes = {};
        const location = { Header: 'header', QueryOption: 'query', Cookie: 'cookie' };
        authorizations.forEach(auth => {
            const scheme = {};
            const flow = {};
            if (auth.Description) scheme.description = auth.Description;
            const qualifiedType = auth['@type'] || auth['@odata.type']
            const type = qualifiedType.substr(qualifiedType.lastIndexOf('.') + 1);
            let unknown = false
            switch (type) {
                case 'ApiKey':
                    scheme.type = 'apiKey';
                    scheme.name = auth.KeyName;
                    scheme.in = location[auth.Location];
                    break;
                case 'Http':
                    scheme.type = 'http';
                    scheme.scheme = auth.Scheme;
                    scheme.bearerFormat = auth.BearerFormat;
                    break;
                case 'OAuth2AuthCode':
                    scheme.type = 'oauth2';
                    scheme.flows = { authorizationCode: flow };
                    flow.authorizationUrl = auth.AuthorizationUrl;
                    flow.tokenUrl = auth.TokenUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = scopes(auth);
                    break;
                case 'OAuth2ClientCredentials':
                    scheme.type = 'oauth2';
                    scheme.flows = { clientCredentials: flow };
                    flow.tokenUrl = auth.TokenUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = scopes(auth);
                    break;
                case 'OAuth2Implicit':
                    scheme.type = 'oauth2';
                    scheme.flows = { implicit: flow };
                    flow.authorizationUrl = auth.AuthorizationUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = scopes(auth);
                    break;
                case 'OAuth2Password':
                    scheme.type = 'oauth2';
                    scheme.flows = {};
                    scheme.flows = { password: flow };
                    flow.tokenUrl = auth.TokenUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = scopes(auth);
                    break;
                case 'OpenIDConnect':
                    scheme.type = 'openIdConnect';
                    scheme.openIdConnectUrl = auth.IssuerUrl;
                    break;
                default:
                    unknown = true
                    console.warn('Unknown Authorization type ' + qualifiedType);
            }
            if (!unknown) schemes[auth.Name] = scheme;
        });
        if (Object.keys(schemes).length > 0) components.securitySchemes = schemes
    }

    function scopes(authorization) {
        const scopes = {};
        authorization.Scopes.forEach(scope => { scopes[scope.Scope] = scope.Description });
        return scopes;
    }

    /**
     * Augment OpenAPI document with Security Requirements Object
     * @param {object} openapi OpenAPI document to augment 
     * @param {object} entityContainer Entity Container object
     */
    function security(openapi, entityContainer) {
        const securitySchemes = entityContainer[voc.Authorization.SecuritySchemes] || [];
        if (securitySchemes.length > 0) openapi.security = [];
        securitySchemes.forEach(scheme => {
            const s = {};
            s[scheme.Authorization] = scheme.RequiredScopes || [];
            openapi.security.push(s);
        });
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

}


/**
 * Delete referenced Schema and Parameter Objects from an OpenAPI description
 * @param {object} openapi OpenAPI description
 */
module.exports.deleteUnreferencedSchemas = function (openapi) {
    var referenced;
    var deleted;

    while (true) {
        referenced = {};
        getReferencedSchemas(openapi, referenced);
        deleted = deleteUnreferenced(openapi.components.schemas, referenced, '#/components/schemas/');
        if (!deleted) break;
    }

    deleteUnreferenced(openapi.components.parameters, referenced, '#/components/parameters/');
    if (Object.keys(openapi.components.parameters || {}).length == 0) {
        delete openapi.components.parameters;
    }

    return;


    /**
     * Get unreferenced Schema and Parameter Objects recursively
     * @param {object} openapi OpenAPI description
     * @param {object} referenced Map of referenced objects
     */
    function getReferencedSchemas(document, referenced) {
        Object.keys(document).forEach(key => {
            let value = document[key];
            if (key == '$ref') {
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

    /**
     * Delete unreferenced Schema and Parameter Objects recursively
     * @param {object} schemas Map of Schema and Parameter Objects
     * @param {object} referenced Map of referenced objects
     * @param {string} prefix Prefix used within referenced
     */
    function deleteUnreferenced(schemas, referenced, prefix) {
        var deleted = false;

        Object.keys(schemas || {}).forEach(key => {
            if (!referenced[prefix + key]) {
                delete schemas[key];
                deleted = true;
            }
        });

        return deleted;
    }
}
