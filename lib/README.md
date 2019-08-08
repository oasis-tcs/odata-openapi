# Convert OData 4.0x CSDL JSON or XML to OpenAPI 3.0.x

This script converts an OData Version 3.0, 4.0, or 4.01 (`$metadata`) [CSDL XML](http://docs.oasis-open.org/odata/odata-csdl-xml/v4.01/odata-csdl-xml-v4.01.html) or [CSDL JSON](http://docs.oasis-open.org/odata/odata-csdl-json/v4.01/odata-csdl-json-v4.01.html) document into an [OpenAPI 3.0.x](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md) JSON document. 

It's a pure JavaScript implementation, depending only on [`odata-csdl`](https://github.com/oasis-tcs/odata-csdl-schemas/tree/master/lib), which in turn depends on [`sax js`](https://www.npmjs.com/package/sax).

_Note: this tool does not support OData 2.0, and it does not produce Swagger 2.0. If you need any of the 2.0 versions, use the [XSLT-based tools](../tools#transformjs-for-nodejs)._


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

# Supported Annotations

The mapping can be fine-tuned via annotations in the CSDL (`$metadata`) XML documents.


## [Core](https://github.com/oasis-tcs/odata-vocabularies/blob/master/vocabularies/Org.OData.Core.V1.md)

Term | Annotation Target | OpenAPI field
-----|-------------------|--------------
`Computed` | Property | omit from Create and Update structures
`DefaultNamespace` | Schema | path templates for actions and functions without namespace prefix
`Description` | Action, ActionImport, Function, FunctionImport | `description` of Operation Object
`Description` | EntitySet, Singleton | `description` of Tag Object
`Description` | EntityType | `description` of Request Body Object
`Description` | ComplexType, EntityType, EnumerationType, Parameter, Property, TypeDefinition | `description` of Schema Object
`Description` | Schema, EntityContainer | `info.title`
`Example`   | Property | `example` of Schema Object
`Immutable` | Property | omit from Update structure
`LongDescription` | Action, ActionImport, Function, FunctionImport | `description` of Operation Object
`LongDescription` | ComplexType, EntityType, EnumerationType, Parameter, Property, TypeDefinition | `description` of Schema Object
`LongDescription` | Schema, EntityContainer | `info.description`
`Permissions:Read`   | Property | omit read-only properties from Create and Update structures
`SchemaVersion` | Schema | `info.version`


## [Capabilities](https://github.com/oasis-tcs/odata-vocabularies/blob/master/vocabularies/Org.OData.Capabilities.V1.md)

Term | Annotation Target | OpenAPI field
-----|-------------------|--------------
`CountRestrictions`<br>&emsp;`/Countable` | EntitySet | `$count` system query option for `GET` operation
`DeleteRestrictions`<br>&emsp;`/Deletable` | EntitySet, Singleton | `DELETE` operation for deleting an existing entity
&emsp;`/Description` | EntitySet, Singleton | `summary` of Operation Object
&emsp;`/LongDescription` | EntitySet, Singleton | `description` of Operation Object
`ExpandRestrictions`<br>&emsp;`/Expandable` | EntitySet, Singleton | `$expand` system query option for `GET` operations
`FilterRestrictions`<br>&emsp;`/Filterable` | EntitySet | `$filter` system query option for `GET` operation
&emsp;`/RequiredProperties` | EntitySet | required properties in `$filter` system query option for `GET` operation (parameter description only)
&emsp;`/RequiresFilter` | EntitySet | `$filter` system query option for `GET` operation is `required`
`IndexableByKey` | EntitySet | `GET`, `PATCH`, and `DELETE` operations for a single entity within an entity set
`InsertRestrictions`<br>&emsp;`/Insertable` | EntitySet | `POST` operation for inserting a new entity
&emsp;`/Description` | EntitySet | `summary` of Operation Object
&emsp;`/LongDescription` | EntitySet | `description` of Operation Object
`KeyAsSegmentSupported` | EntityContainer | `paths` URL templates use key-as-segment style instead of parenthesis style
`NavigationRestrictions`<br>&emsp;`/RestrictedProperties` | EntitySet, Singleton | operations via a navigation path
&emsp;&emsp;`/DeleteRestrictions/...` | EntitySet, Singleton | `DELETE` operation for deleting a contained entity via a navigation path
&emsp;&emsp;`/FilterRestrictions/...` | EntitySet, Singleton | `$filter` system query option for reading related entities via a navigation path
&emsp;&emsp;`/InsertRestrictions/...` | EntitySet, Singleton | `POST` operation for inserting a new related entity via a navigation path
&emsp;&emsp;`/ReadByKeyRestrictions/...` | EntitySet, Singleton | `GET` operation for reading a contained entity by key via a navigation path
&emsp;&emsp;`/ReadRestrictions/...` | EntitySet, Singleton | `GET` operation for reading related entities via a navigation path
&emsp;&emsp;`/SearchRestrictions/...` | EntitySet, Singleton | `$search` system query option for reading related entities via a navigation path
&emsp;&emsp;`/SelectSupport/...` | EntitySet, Singleton | `$select` system query option for reading related entities via a navigation path
&emsp;&emsp;`/SkipSupported` | EntitySet, Singleton | `$skip` system query option for reading contained entities via a navigation path
&emsp;&emsp;`/SortRestrictions/...` | EntitySet, Singleton | `$orderby` system query option for reading related entities via a navigation path
&emsp;&emsp;`/TopSupported` | EntitySet, Singleton | `$top` system query option for reading contained entities via a navigation path
&emsp;&emsp;`/UpdateRestrictions/...` | EntitySet, Singleton | `PATCH` operation for modifying a contained entity via a navigation path
`ReadByKeyRestrictions`<br>&emsp;`/Readable` | EntitySet | `GET` operation for reading a single entity by key
&emsp;`/Description` | EntitySet | `summary` of Operation Object
&emsp;`/LongDescription` | EntitySet | `description` of Operation Object
`ReadRestrictions`<br>&emsp;`/Readable` | EntitySet, Singleton | `GET` operation for reading an entity set or singleton
&emsp;`/Description` | EntitySet, Singleton | `summary` of Operation Object
&emsp;`/LongDescription` | EntitySet, Singleton | `description` of Operation Object
`SearchRestrictions`<br>&emsp;`/Searchable` | EntitySet | `$search` system query option for `GET` operation
`SelectSupport`<br>&emsp;`/Supported` | EntitySet, Singleton | `$select` system query option for `GET` operation
`SkipSupported` | EntitySet | `$skip` system query option for `GET` operation
`SortRestrictions`<br>&emsp;`/NonSortableProperties` | EntitySet | properties not listed in `$orderby` system query option for `GET` operation
&emsp;`/Sortable` | EntitySet | `$orderby` system query option for `GET` operation
`TopSupported` | EntitySet | `$top` system query option for `GET` operation
`UpdateRestrictions`<br>&emsp;`/Updatable` | EntitySet, Singleton | `PATCH` operation for modifying an existing entity
&emsp;`/Description` | EntitySet, Singleton | `summary` of Operation Object
&emsp;`/LongDescription` | EntitySet, Singleton | `description` of Operation Object


## [Validation](https://github.com/oasis-tcs/odata-vocabularies/blob/master/vocabularies/Org.OData.Validation.V1.md)

Term | Annotation Target | OpenAPI field
-----|-------------------|--------------
`AllowedValues` | Property | `enum` of Schema Object - list of allowed (string) values
`Exclusive` | Property | `exclusiveMinimum`/`exclusiveMaximum` of Schema Object
`Maximum` | Property | `maximum` of Schema Object
`Minimum` | Property | `minimum` of Schema Object
`Pattern` | Property | `pattern` of Schema Object


## [Authorization](https://github.com/oasis-tcs/odata-vocabularies/blob/master/vocabularies/Org.OData.Authorization.V1.md)

Term | Annotation Target | OpenAPI field
-----|-------------------|--------------
`Authorizations` | EntityContainer | `securitySchemes` of Components Object / `securityDefinitions` of Swagger Object 
`SecuritySchemes` | EntityContainer | `security` of OpenAPI / Swagger Object
