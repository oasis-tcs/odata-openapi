# Convert OData CSDL JSON or XML to OpenAPI 3.0.x or 3.1.0

This script converts an OData Version 2.0, 3.0, 4.0, or 4.01 [CSDL XML](http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/odata-csdl-xml-v4.01.html) or [CSDL JSON](http://docs.oasis-open.org/odata/odata-csdl-json/v4.01/odata-csdl-json-v4.01.html) (`$metadata`) document into an [OpenAPI 3.0.x](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.3.md) or [OpenAPI 3.1.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.1.0.md) JSON document.

It's a pure JavaScript implementation, depending only on [`odata-csdl`](https://github.com/oasis-tcs/odata-csdl-schemas/tree/master/lib), which in turn depends on [`sax js`](https://www.npmjs.com/package/sax).

## Installation

To install globally type

```sh
npm install -g odata-openapi
```

## Usage

Assuming you installed the script globally, and your XML metadata file is `MyMetadata.xml`, then

```sh
odata-openapi3 MyMetadata.xml
```

will create `MyMetadata.openapi3.json` next to it.

Just type

```sh
odata-openapi3 -h
```

to get usage hints

```
Usage: odata-openapi3 <options> <source files>
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
 --title                 default title if none is annotated
```

## Supported Annotations

The mapping can be fine-tuned via [annotations](https://github.com/oasis-tcs/odata-openapi/blob/main/doc/Annotations.md) in the CSDL (`$metadata`) XML documents.

This tool generates OpenAPI documents for OData V4 services that allow deep insert/upsert only for _containment_ navigation properties. Such OpenAPI documents are suitable for CAP-based services, see also the [`@cap-js/openapi` package](https://github.com/cap-js/openapi) that was forked from this repository.