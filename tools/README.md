# odata-openapi

Tools for transforming [OData](http://www.odata.org) CSDL (`$metadata`) XML documents into [OpenAPI](https://github.com/OAI/OpenAPI-Specification) documents.

The core ingredient is the [`V4-CSDL-to-OpenAPI.xsl`](V4-CSDL-to-OpenAPI.xsl) transformation. It transforms OData CSDL XML Version 4.0 documents into either OpenAPI 3.0.0 or Swagger 2.0 documents.

OData CSDL XML documents conforming to one of the predecessor OData versions 2.0 or 3.0 can be transformed into OData 4.0 with the [`V2-to-V4-CSDL.xsl`](V2-to-V4-CSDL.xsl) transformation.

The three files [`transform`](transform), [`transform.cmd`](transform.cmd), and [`transform.js`](transform.js) are wrapper scripts for Unix Bash, Windows Command, and Node.js.



## `transform.js` for Node.js

This script transforms one or more OData CSDL (`$metadata`) XML documents into OpenAPI JSON documents.

### Installation

The script uses [`xslt4node`](https://www.npmjs.com/package/xslt4node), which itself depends on [`node-gyp`](https://www.npmjs.com/package/node-gyp). Please install `node-gyp` globally first and follow the [platform-specific installation instructions for `node-gyp`](https://github.com/nodejs/node-gyp/blob/master/README.md#installation).


Then go to the `tools` folder and type
```sh
npm install
```
In some cases this leads to an error message
```sh
npm ERR! enoent ENOENT: no such file or directory, rename '/mnt/c/Temp/xslt2/node_modules/lodash' -> '/mnt/c/Temp/xslt2/node_modules/.lodash.DELETE'
```
If that happens, just run
```sh
npm install
```
a second time. This has always worked for me. Hints on avoiding this are welcome!


### Usage

In `tools` folder type
```sh
node transform -h
```
to get usage hints
```
Usage: node transform <options> <source files>
Options:
 --basePath              base path (default: /service-root)
 -d, --diagram           include YUML diagram
 -h, --help              show this info
 --host                  host (default: localhost)
 -o, --openapi-version   3.0.0 or 2.0 (default: 3.0.0)
 -p, --pretty            pretty-print JSON result
 -r, --references        include references to other files
 --scheme                scheme (default: http)
 -u, --swagger-ui        URL of Swagger UI for cross-service references
```

Or type
```sh
node transform -drp MyMetadata.xml
```
to transform `MyMetadata.xml` into `MyMetadata.openapi.json` with a nice [yUML](https://yuml.me/) diagram, references to included services / vocabularies, and pretty-printed JSON. 




## `transform` for Unix Bash

The main purpose of this script is to refresh all example OpenAPI files in folder [`../examples`](../examples), verify that the produced OpenAPI JSON files conform to the respective JSON schemas, and show diffs to the last committed versions of the JSON files. In other words: it's a simple test tool.

The script transforms all files listed in the control file [`transform.txt`](transform.txt) into both OpenAPI 3.0.0 and Swagger 2.0 documents. The former are suffixed `.openapi3.json`, the latter just `.openapi.json`. 

The control file [`transform.txt`](transform.txt) contains one line per file to be transformed. Each line consists of up to five fields, separated by spaces:
* file name (looked for in `../examples`)
* scheme (`http` or `https`)
* host
* service root path without the trailing slash
* OData version (`V2`, `V3`, or `V4`) (yes, this could be determined from the source file, but I'm too lazy :-)

### Installation

The prerequisites are listed within [`transform`](transform). It's quite a lot:
```sh
sudo apt-get install default-jre
sudo apt-get install git
sudo apt-get install libxalan2-java
sudo apt-get install yajl-tools
sudo apt-get install nodejs
sudo npm install -g ajv-cli
```
And finally clone https://github.com/OAI/OpenAPI-Specification next to this project:
```sh
git clone https://github.com/OAI/OpenAPI-Specification.git
```


### Usage

In the `tools` folder execute
```sh
transform
```



## `transform.cmd` for Windows Command

The main purpose of this script is to refresh all example OpenAPI files in folder [`../examples`](../examples), verify that the produced OpenAPI JSON files conform to the respective JSON schemas, and show diffs to the last committed versions of the JSON files. In other words: it's a simple test tool. And yes, it's the "original" to `transform` for Unix Bash.

### Installation

The prerequisites are listed within [`transform.cmd`](transform.cmd). It's quite a lot:
- [Java SE 8](http://www.oracle.com/technetwork/java/javase/downloads/index.html) is installed and in the `PATH`
- [git](https://git-for-windows.github.io/) is installed and in the `PATH`
- [Eclipse](https://www.eclipse.org/) is installed with Xalan (contained in Eclipse Web Tools Platform or the [Eclipse IDE for JavaScript and Web Developers](http://www.eclipse.org/downloads/packages/eclipse-ide-javascript-and-web-developers/oxygen1a) package), and `ECLIPSE_HOME` environment variable is set  
  Alternative: [Xalan](http://xalan.apache.org/xalan-j/downloads.html) is installed and `CLASSPATH` contains `xalan.jar` and `serializer.jar`
- [YAJL](https://github.com/lloyd/yajl)'s `json_reformat` has been compiled and is in the `PATH`
- [Node.js](https://nodejs.org/) is installed
- [ajv-cli](https://www.npmjs.com/package/ajv-cli) is installed
- https://github.com/OAI/OpenAPI-Specification is cloned next to this project

### Usage


In the `tools` folder execute
```sh
transform
```