# XSLT-Based Tools

Tools for transforming [OData](http://www.odata.org) CSDL (`$metadata`) XML documents into [OpenAPI](https://github.com/OAI/OpenAPI-Specification) documents.

The core ingredient is the [`V4-CSDL-to-OpenAPI.xsl`](V4-CSDL-to-OpenAPI.xsl) transformation. It transforms OData CSDL XML Version 4.0 documents into either OpenAPI 3.0.0 or Swagger 2.0 documents.

OData CSDL XML documents conforming to one of the predecessor OData versions 2.0 or 3.0 can be transformed into OData 4.0 with the [`V2-to-V4-CSDL.xsl`](V2-to-V4-CSDL.xsl) transformation.

The two files [`transform.js`](transform.js) and [`transform.cmd`](transform.cmd) are wrapper scripts for Node.js and Windows Command.

The mapping can be fine-tuned via [annotations](../doc/Annotations.md) in the CSDL (`$metadata`) XML documents.

## `transform.js` for Node.js

_Note: if you want to transform OData V3, V4, or V4.01 into OpenAPI 3.0.x or 3.1.0, you better use the [pure Node.js-based tool](../lib)._

This script transforms one or more OData CSDL (`$metadata`) XML documents into OpenAPI JSON documents.

### Installation

Install a [Java SE JDK](http://jdk.java.net) and make sure it is in the `PATH`

```sh
java -version
```

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

The prerequisites are listed within [`transform.cmd`](transform.cmd):

- [Java SE](http://www.oracle.com/technetwork/java/javase/downloads/index.html) is installed and in the `PATH`
- [git](https://git-for-windows.github.io/) is installed and in the `PATH`
- [Python](https://www.python.org/downloads/) is installed

### Usage

In the `tools` folder execute

```sh
npm install
```

Then

```sh
transform path/to/XML-file
```

### Write your own script

Depending on your use case you may want to write your own wrapper script and do some pre- or post-processing. In that case you just need Java installed, and can call the XSL transformations directly.

Make sure to add `xalan/xalan.jar` and `xalan/serializer.jar` to your `CLASSPATH` or add a `-cp ...` command-line argument to the examples below. Note that the separator character for the class path depends on the operating system, `;` for Windows, `:` for Linux, ...

If you don't know up-front which of your input files is OData V2, and which is OData V4, use the detection script and capture its output:

```sh
java org.apache.xalan.xslt.Process -XSL path-to-tools/OData-Version.xsl -IN your-file
```

An OData V2 or V3 file needs to be converted to a temporary file in V4 format first:

```sh
java org.apache.xalan.xslt.Process -L -XSL path-to-tools/V2-to-V4-CSDL.xsl -IN your-file -OUT your-temp-V4-file
```

An OData V4 file can then be converted to OpenAPI 3.0.0 (change the values of parameters `scheme`, `host`, `basePath`, and `odata-version` to the correct values for your API):

```sh
java org.apache.xalan.xslt.Process -L -XSL path-to-tools/V4-CSDL-to-OpenAPI.xsl -PARAM scheme http -PARAM host your-host.com -PARAM basePath /url-path/of/your/service -PARAM odata-version 4.01 -PARAM openapi-version 3.0.0 -IN your-V4-file -OUT your-openapi-file.json
```

Check the `<xsl:param name="..." />` elements in `V4-CSDL-to-OpenAPI.xsl` for further parameters that you might want to supply via `-PARAM x y`.

## Supported Annotations

The mapping can be fine-tuned via [annotations](../doc/Annotations.md) in the CSDL (`$metadata`) XML documents.

This tool generates OpenAPI documents for OData V2 or V4 services that allow deep insert/upsert for _all_ navigation properties. Such OpenAPI documents are published for ABAP-based services on the [SAP Business Accelerator Hub](https://api.sap.com/).