# Convert OData CSDL JSON or XML to OpenAPI 3.0.0

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

Assuming you installed the script globally and your XML metadata file is `MyMetadata.xml`, then
```sh
odata-openapi MyMetadata.xml
```
will create `MyMetadata.openapi.json` next to it. 


Just type
```sh
odata-openapi -h
```
to get usage hints
```
Usage: odata-csdl-xml2json <options> <source files>
Options:
 -h, --help              show this info
...
```

If you installed the script locally, start it via
```sh
node lib/cli.js ...
```
