/**
 * Parse command-line options
 *
 * Latest version: https://github.com/oasis-tcs/odata-openapi/blob/main/lib/cliOptions.js
 */

const util = require("node:util");

module.exports = { parseArguments };

function parseArguments(argv) {
  const usage = `Usage: odata-openapi3 <options> <source file>
  Options:
   --basePath              base path (default: /service-root)
   --description           default description if none is annotated
   -d, --diagram           include YUML diagram
   -h, --help              show this info
   --host                  host (default: localhost)
   -k, --keep              root resource to keep (can be specified multiple times with one name each)
   --levels                maximum number of path segments
   -o, --openapi-version   3.0.0 to 3.0.3 or 3.1.0 (default: 3.0.2)
   -p, --pretty            pretty-print JSON result
   --scheme                scheme (default: http)
   --skipBatchPath         skips the generation of the $batch path, (default: false)
   -t, --target            target file (default: source file basename + .openapi3.json)
   --title                 default title if none is annotated`;

  let parsed;
  try {
    parsed = util.parseArgs({
      args: argv,
      options: {
        basePath: { type: "string" },
        description: { type: "string" },
        diagram: { type: "boolean", short: "d" },
        help: { type: "boolean", short: "h" },
        host: { type: "string" },
        keep: { type: "string", short: "k", multiple: true },
        levels: { type: "string" },
        "openapi-version": { type: "string", short: "o" },
        pretty: { type: "boolean", short: "p" },
        scheme: { type: "string" },
        skipBatchPath: { type: "boolean" },
        target: { type: "string", short: "t" },
        title: { type: "string" },
      },
      allowPositionals: true,
    });
  } catch (e) {
    return { unknown: e.message, usage };
  }

  if (parsed.values.help || parsed.positionals.length !== 1) return { usage };

  const source = parsed.positionals[0];
  const target =
    parsed.values.target ||
    (source.lastIndexOf(".") > 0
      ? source.substring(0, source.lastIndexOf("."))
      : source) + ".openapi3.json";

  const options = {};

  for (const [name, value] of Object.entries(parsed.values)) {
    switch (name) {
      case "description":
        options.defaultDescription = value;
        break;
      case "keep":
        options.rootResourcesToKeep = value;
        break;
      case "levels": {
        const l = Number(value);
        if (!isNaN(l)) options.maxLevels = l;
        break;
      }
      case "openapi-version":
        options.openapiVersion = value;
        break;
      case "target":
        break;
      case "title":
        options.defaultTitle = value;
        break;
      default:
        options[name] = value;
        break;
    }
  }

  return {
    source,
    target,
    options,
  };
}
