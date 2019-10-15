# Convert OData 4.0x CSDL JSON or XML to OpenAPI 3.0.x

This script converts an OData Version 3.0, 4.0, or 4.01 [CSDL XML](http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/odata-csdl-xml-v4.01.html) or [CSDL JSON](http://docs.oasis-open.org/odata/odata-csdl-json/v4.01/odata-csdl-json-v4.01.html) (`$metadata`) document into an [OpenAPI 3.0.x](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md) JSON document. 

It's a pure JavaScript implementation, depending only on [`odata-csdl`](https://github.com/oasis-tcs/odata-csdl-schemas/tree/master/lib), which in turn depends on [`sax js`](https://www.npmjs.com/package/sax).

_Note: this tool does not support OData 2.0, and it does not produce Swagger 2.0. If you need any of the 2.0 versions, use the [XSLT-based tool](../tools#transformjs-for-nodejs)._


## Installation

Clone or download this repository, go to its root folder and type
```sh
npm install
```

To install globally type
```sh
npm install -g
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
 -p, --pretty            pretty-print JSON result
 --scheme                scheme (default: http)
 -t, --target            target file (default: source file base name + .openapi3.json)
 -u, --used-schemas-only produce only schemas that are actually used in
 ```

If you installed the script locally, start it via
```sh
node lib/cli.js ...
```

## Supported Annotations

The mapping can be fine-tuned via [annotations](../doc/Annotations.md) in the CSDL (`$metadata`) XML documents.
