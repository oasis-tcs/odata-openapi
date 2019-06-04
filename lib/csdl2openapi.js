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
        basePath = '/service-root'
    } = {}
) {
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
        servers: servers({ scheme: scheme, host: host, basePath: basePath }),
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
        //TODO: yUML
        return {
            title: 'Service for namespace ' + nameParts(csdl.$EntityContainer).qualifier,
            description: '',
            version: ''
        };
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
    function servers(options) {
        return [{ url: options.scheme + '://' + options.host + options.basePath }];
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
                pathItems(paths, '/' + name, [], child);
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
     */
    function pathItems(paths, prefix, prefixParameters, element) {
        const type = modelElement(element.$Type);
        const pathItem = {};
        paths[prefix] = pathItem;
        if (prefixParameters.length > 0) paths[prefix].parameters = prefixParameters;

        //TODO: collection or single get
        pathItem.get = {};

        if (element.$Collection) {
            //TODO: collection post
            pathItem.post = {};

            pathItemsForBoundOperations(paths, prefix, prefixParameters, element);
        }

        if (element.$ContainsTarget) {
            if (element.$Collection) {
                pathItemsWithKey(paths, prefix, prefixParameters, element)
            } else {
                //TODO: contained single - patch, delete(if nullable) 
                pathItem.patch = {};
                if (element.$Nullable) pathItem.delete = {};

                pathItemsForBoundOperations(paths, prefix, prefixParameters, element);
                pathItemsWithNavigation(paths, prefix, prefixParameters, type);
            }
        }
    }

    /**
     * Add path and Path Item Object for a navigation segment with key
     * @param {object} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element of navigation segment
     */
    function pathItemsWithKey(paths, prefix, prefixParameters, element) {
        const type = modelElement(element.$Type);
        const key = entityKey(type);
        const path = prefix + key.segment;
        const parameters = prefixParameters.concat(key.parameters);
        const pathItem = {};
        paths[path] = pathItem;
        if (parameters.length > 0) pathItem.parameters = parameters;

        //TODO
        pathItem.get = {};
        pathItem.patch = {};
        pathItem.delete = {};

        pathItemsForBoundOperations(paths, path, parameters, element);
        pathItemsWithNavigation(paths, path, parameters, type);
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
     */
    function pathItemsWithNavigation(paths, prefix, prefixParameters, type) {
        //TODO: collect navigation properties along $BaseType
        Object.keys(type).filter(name => isIdentifier(name) && type[name].$Kind == 'NavigationProperty').forEach(name => {
            pathItems(paths, prefix + '/' + name, prefixParameters, type[name]);
        });
    }

    /**
     * Key for path item
     * @param {object} entityType Entity type object
     * @return {object} key: Key segment, parameters: key parameters
     */
    function entityKey(entityType) {
        var segment = '';
        const params = [];
        //TODO: recurse along baseType to find $Key
        const keys = entityType.$Key;
        keys.forEach((key, index) => {
            //TODO: key-as-segment
            if (index > 0) segment += ','
            //TODO: key aliases
            //TODO: containment recursion
            if (keys.length != 1) segment += key + '=';
            //TODO: key prefix/suffix depending on type of key
            let propertyType = entityType[key].$Type;
            segment += pathValuePrefix(propertyType) + '{' + key + '}' + pathValueSuffix(propertyType);
            let param = {
                description: 'key: ' + key,
                in: 'path',
                name: key,
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
        return "'";
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
        return "'";
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
        //TODO: find all unbound overloads, generate one path item per overload with path parameters
        //TODO: need to build an "index" for overloads across all schemas
    }

    /**
     * Add path and Path Item Object for batch requests
     * @param {object} paths Paths Object to augment
     */
    function pathItemBatch(paths) {
        //TODO
        paths['/$batch'] = { post: {} };
    }

    /**
     * Construct the Components Object from the types of the CSDL document
     * @param {object} csdl CSDL document
     * @return {object} Components Object
     */
    function components(csdl) {
        //TODO        
        return {};
    }

    /**
     * Construct Schema Object for model object referencing a type
     * @param {object} modelElement referencing a type 
     * @return {object} Schema Object
     */
    function schema(element) {
        const s = {};
        //TODO: switch(qualifiedName)
        switch (element.$Type) {
            case 'Edm.Int32':
                s.type = 'integer';
                s.format = 'int32';
                break;
            default:
                s.type = 'string';
                if (element.$MaxLength) s.maxLength = element.$MaxLength;
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
