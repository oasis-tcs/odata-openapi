# Supported Annotations

The OData to OpenAPI Mapping can be fine-tuned via annotations in the CSDL (`$metadata`) XML documents.

See [Frequently Asked Questions](FAQ.md) for examples on how to use these annotations.


## [Core](https://github.com/oasis-tcs/odata-vocabularies/blob/master/vocabularies/Org.OData.Core.V1.md)

Term | Annotation Target | OpenAPI field
-----|-------------------|--------------
`Computed` | Property | omit from Create and Update structures
`DefaultNamespace` | Schema | path templates for actions and functions without namespace prefix
`Description` | Action, ActionImport, Function, FunctionImport | `summary` of Operation Object
`Description` | EntitySet, Singleton | `description` of Tag Object
`Description` | EntityType | `description` of Request Body Object
`Description` | ComplexType, EntityType, EnumerationType, Parameter, Property, TypeDefinition | `title` of Schema Object
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
