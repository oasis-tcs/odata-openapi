# XSLT-Based Tools

Tools for transforming [OData](http://www.odata.org) CSDL (`$metadata`) XML documents into [OpenAPI](https://github.com/OAI/OpenAPI-Specification) documents.

The core ingredient is the [`V4-CSDL-to-OpenAPI.xsl`](V4-CSDL-to-OpenAPI.xsl) transformation. It transforms OData CSDL XML Version 4.0 documents into either OpenAPI 3.0.0 or Swagger 2.0 documents.

OData CSDL XML documents conforming to one of the predecessor OData versions 2.0 or 3.0 can be transformed into OData 4.0 with the [`V2-to-V4-CSDL.xsl`](V2-to-V4-CSDL.xsl) transformation.

The two files [`transform.js`](transform.js) and [`transform.cmd`](transform.cmd) are wrapper scripts for Node.js and Windows Command.

The mapping can be fine-tuned via [annotations](../doc/Annotations.md) in the CSDL (`$metadata`) XML documents.


## `transform.js` for Node.js

_Note: if you want to transform OData V3, V4, or V4.01 into OpenAPI 3.0.x, you better use the [pure Node.js-based tool](../lib)._

This script transforms one or more OData CSDL (`$metadata`) XML documents into OpenAPI JSON documents. 

It uses [`xslt4node`](https://www.npmjs.com/package/xslt4node), which in turn needs [`node-gyp`](https://www.npmjs.com/package/node-gyp) and a [Java SE JDK](http://jdk.java.net).

### Installation

Install a [Java SE JDK](http://jdk.java.net) and make sure it is in the `PATH`

```sh
javac -version
```

 Install `node-gyp` globally, following the [platform-specific installation instructions for `node-gyp`](https://github.com/nodejs/node-gyp/blob/master/README.md#installation).


Clone or download this repository, go to the `tools` folder and type
```sh
npm install
```

To install globally type
```sh
npm install -g
```
### Usage

Assuming you installed the script globally and your metadata file is `MyMetadata.xml`, then
```sh
odata-openapi -dp MyMetadata.xml
```
will transform it into `MyMetadata.openapi.json` with a nice [yUML](https://yuml.me/) diagram and pretty-printed JSON. 


Just type
```sh
odata-openapi -h
```
to get usage hints
```
Usage: odata-openapi <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -o, --openapi-version   3.0.0 or 2.0 (default: 3.0.0)
 -p, --pretty            pretty-print JSON result
 -r, --references        include references to other files
 --scheme                scheme (default: http)
 -t, --target            target file (only useful with a single source file)
 -u, --used-schemas-only produce only schemas that are actually used in operation objects
 ```

If you installed the script locally, start it via
```sh
node path_to_tools/transform.js ...
```
(replace `path_to_tools` with your local installation path).


## `transform.cmd` for Windows Command

This script transforms a single OData CSDL (`$metadata`) XML documents into OpenAPI 3.0.0 JSON documents. 

### Installation

The prerequisites are listed within [`transform.cmd`](transform.cmd). It's quite a lot:
- [Java SE 8](http://www.oracle.com/technetwork/java/javase/downloads/index.html) is installed and in the `PATH`
- [git](https://git-for-windows.github.io/) is installed and in the `PATH`
- [Xalan](http://xalan.apache.org/xalan-j/downloads.html) is installed and `CLASSPATH` contains `xalan.jar` and `serializer.jar`
- [YAJL](https://github.com/lloyd/yajl)'s `json_reformat` has been compiled and is in the `PATH`
- [Node.js](https://nodejs.org/) is installed
- [ajv-cli](https://www.npmjs.com/package/ajv-cli) is installed
- https://github.com/OAI/OpenAPI-Specification is cloned next to this project

### Usage

In the `tools` folder execute
```sh
transform
```


## Supported Annotations

The mapping can be fine-tuned via [annotations](../doc/Annotations.md) in the CSDL (`$metadata`) XML documents.
