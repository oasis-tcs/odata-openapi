/**
 * Parse command-line options
 *
 * Latest version: https://github.com/oasis-tcs/odata-openapi/blob/main/lib/cliOptions.js
 */

const minimist = require("minimist");

module.exports = { parseArgs };

function parseArgs(argv) {
  let unknown = false;
  const args = minimist(argv.slice(2), {
    string: [
      "basePath",
      "description",
      "host",
      "keep",
      "levels",
      "openapi-version",
      "scheme",
      "target",
      "title",
    ],
    boolean: [
      "diagram",
      "help",
      "pretty",
      "skipBatchPath",
      "used-schemas-only",
    ],
    alias: {
      d: "diagram",
      h: "help",
      k: "keep",
      o: "openapi-version",
      p: "pretty",
      t: "target",
      u: "used-schemas-only",
    },
    default: {
      pretty: false,
    },
    unknown: (arg) => {
      if (arg.substring(0, 1) == "-") {
        console.error("Unknown option: " + arg);
        unknown = true;
        return false;
      }
    },
  });

  const options = {};

  //TODO: options
  // scheme: args.scheme,
  // host: args.host,
  // basePath: args.basePath,
  // diagram: args.diagram,
  // maxLevels: Number(args.levels),
  // openapiVersion: args.o,
  // messages: [],
  // skipBatchPath: args.skipBatchPath,
  // defaultTitle: args.title,
  // defaultDescription: args.description,
  // rootResourcesToKeep: Array.isArray(args.keep)
  //   ? args.keep
  //   : args.keep
  //   ? [args.keep]
  //   : undefined,

  //TODO: no source provided
  const source = args._[0];

  return {
    source,
    target:
      args.target || source === undefined
        ? undefined
        : (source.lastIndexOf(".") > 0
            ? source.substring(0, source.lastIndexOf("."))
            : source) + ".openapi3.json",
    options,
  };
}
