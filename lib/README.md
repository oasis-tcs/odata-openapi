# Convert OData 4.0x CSDL JSON or XML to OpenAPI 3.0.x or 3.1.0

This script converts an OData Version 2.0, 3.0, 4.0, or 4.01 [CSDL XML](http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/odata-csdl-xml-v4.01.html) or [CSDL JSON](http://docs.oasis-open.org/odata/odata-csdl-json/v4.01/odata-csdl-json-v4.01.html) (`$metadata`) document into an [OpenAPI 3.0.x](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.3.md) or [OpenAPI 3.1.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.1.0.md) JSON document.

It's a pure JavaScript implementation, depending only on [`odata-csdl`](https://github.com/oasis-tcs/odata-csdl-schemas/tree/master/lib), which in turn depends on [`sax js`](https://www.npmjs.com/package/sax).

## Installation

```sh
npm install odata-openapi
```

To install globally type

```sh
npm install -g odata-openapi
```

## Direct local usage of the CLI

Switch into the checkout project directory

```sh
npm install
npm run build
npm link
```

You can verify the installation using `npm list -g`, which should show the installed:

```sh
npm list -g
├── npm@9.6.1
└── odata-openapi@0.21.4 -> .\..\..\your\path\odata-openapi
```

## Usage

Assuming you installed the script globally, and your XML metadata file is `MyMetadata.xml`, then

```sh
odata-openapi3 MyMetadata.xml
```

will create `MyMetadata.openapi.json` next to it.

Just type

```sh
odata-openapi3 -h
```

to get usage hints

```
Usage: odata-openapi3 <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -o, --openapi-version   3.0.0 to 3.0.3 or 3.1.0 (default: 3.0.2)
 -p, --pretty            pretty-print JSON result
 --scheme                scheme (default: http)
 -t, --target            target file (default: source file basename + .openapi3.json)
 --skipBatchPath         skips the generation of the $batch path, (default: false)
 --title                 default title if none is annotated
 --description           default description if none is annotated
```

If you installed the script locally, start it via

```sh
node lib/cli.js ...
```

## Supported Annotations

The mapping can be fine-tuned via [annotations](../doc/Annotations.md) in the CSDL (`$metadata`) XML documents.
