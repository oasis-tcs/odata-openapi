/**
 * Converts OData CSDL JSON or XML 4.0x to OpenAPI 3.0.0
*/

//TODO: see //TODO comments below

/**
 * Construct an OpenAPI description from a CSDL document
 * @param {object} csdl The CSDL document
 * @param {object} options Optional parameters
 * @return {object} The OpenAPI description
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

    const container = entityContainer(csdl);

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
     * @param {object} csdl The CSDL document
     * @return {object} The Info Object
     */
    function info(csdl) {
        //TODO        
        return {
            title: '',
            description: '',
            version: ''
        };
    }

    /**
     * Extract the entity container object
     * @param {object} csdl The CSDL document
     * @return {Object} The entity container
     */
    function entityContainer(csdl) {
        const c = nameParts(csdl.$EntityContainer);
        const container = csdl[c.qualifier][c.name];
        console.assert(container.$Kind == 'EntityContainer', 'Could not find entity container ' + csdl.$EntityContainer);
        return container;
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
     * @param {object} container The CSDL document
     * @return {Object} The Paths Object
     */
    function paths(container) {
        const paths = {};
        Object.keys(container).filter(name => isIdentifier(name)).forEach(child => {
            //TODO
        })
        return paths;
    }

    /**
     * Construct the Components Object from the types of the CSDL document
     * @param {object} csdl The CSDL document
     * @return {Object} The Components Object
     */
    function components(csdl) {
        //TODO        
        return {};
    }

    /**
     * a qualified name consists of a namespace or alias, a dot, and a simple name
     * @param {string} qualifiedName 
     * @return {Object} with components qualifier and name
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
     * @param {string} name The path
     * @return {string} The normalized path
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
     * @param {string} name The target
     * @return {string} The normalized target
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