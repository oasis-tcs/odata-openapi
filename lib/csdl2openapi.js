/**
 * Converts OData CSDL JSON or XML 4.0x to OpenAPI 3.0.0
*/

//TODO: everything

module.exports.csdl2openapi = function (csdl) {
    const openapi = {};

    //TODO: everything

    return openapi;


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