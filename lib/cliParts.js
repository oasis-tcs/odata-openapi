/**
 * Parse command-line options
 *
 * Latest version: https://github.com/oasis-tcs/odata-openapi/blob/main/lib/cliOptions.js
 */

const minimist = require("minimist");

module.exports = { parseArgs };

function parseArgs(argv) {
  const usage = `Usage: odata-openapi3 <options> <source file>
  Options:
   --basePath              base path (default: /service-root)
   --description           default description if none is annotated
   -d, --diagram           include YUML diagram
   -h, --help              show this info
   --host                  host (default: localhost)
   --levels                maximum number of path segments
   -o, --openapi-version   3.0.0 to 3.0.3 or 3.1.0 (default: 3.0.2)
   -p, --pretty            pretty-print JSON result
   --scheme                scheme (default: http)
   --skipBatchPath         skips the generation of the $batch path, (default: false)
   -t, --target            target file (default: source file basename + .openapi3.json)
   --title                 default title if none is annotated`;
  const unknown = [];

  const args = minimist(argv, {
    string: [
      "basePath",
      "description",
      "host",
      "levels",
      "openapi-version",
      "scheme",
      "target",
      "title",
    ],
    boolean: ["diagram", "help", "pretty", "skipBatchPath"],
    alias: {
      d: "diagram",
      h: "help",
      o: "openapi-version",
      p: "pretty",
      t: "target",
    },
    default: {
      pretty: false,
    },
    unknown: (arg) => {
      if (arg.substring(0, 1) == "-") {
        unknown.push(arg);
        return false;
      }
    },
  });

  if (unknown.length > 0 || args.help || args._.length !== 1)
    return {
      unknown,
      usage,
    };

  const source = args._[0];
  const target =
    args.target ||
    (source.lastIndexOf(".") > 0
      ? source.substring(0, source.lastIndexOf("."))
      : source) + ".openapi3.json";

  const options = {};

  for (const [name, value] of Object.entries(args)) {
    if (name.length === 1) continue;
    if (value === false) continue;
    switch (name) {
      case "description":
        options.defaultDescription = value;
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
