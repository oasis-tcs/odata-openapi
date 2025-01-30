# Changelog

## 0.29.0 - 2025-01-27

### Fixed

- Apply default value `true` for `Capabilities.NavigationRestrictions/RestrictedProperties/TopSupported` and `.../SkipSupported`

## 0.28.2 - 2024-10-30

### Fixed

- Term `Validation.AllowedValues` can be applied to all (primitive) types

## 0.28.1 - 2024-08-29

### Fixed

- Nullable function parameters no longer get a funny format and a wrong type

## 0.28.0 - 2024-08-06

### Added

- Support [SAP OData V2 annotations](https://github.com/SAP/odata-vocabularies/blob/main/docs/v2-annotations.md#element-edmproperty) `label` and `quickinfo` on properties, and `label` on entity types and parameters

## 0.27.1 - 2024-08-01

### Fixed

- Action or function returning a primitive type returns a `value` wrapper

## 0.27.0 - 2024-07-17

### Changed

- OpenAPI 3.1.x: use `examples` in Schema Objects instead of the deprecated `example`

## 0.26.1 - 2024-07-09

### Fixed

- OData V2 type `Edm.Binary` is base64-encoded, not base64url

## 0.26.0 - 2024-07-04

### Added

- OData V2 type `Edm.Time` now supported

## 0.25.0 - 2024-01-12

### Added

- Command-line option `--keep` (short `-k`) to specify which root resources (entity sets, singletons, action imports, function imports) to keep.
  - Paths for the root resources are kept, as are paths to contained entities and bound actions and functions.
  - Types referenced by the (return) type of root resources via structural properties or containment navigation properties are also kept.
  - Non-containment navigation properties to entity types not kept are changed to use a generic stub object type without properties.
  - Deep paths to stubbed entity types are omitted.
  - The `/$batch` resource is omitted.

## 0.24.2 - 2024-01-16

### Fixed

- Action/function imports referencing unknown actions/functions are ignored

## 0.24.1 - 2023-12-20

### Fixed

- Complex types were sometimes wrongly colored in diagrams

## 0.24.0 - 2023-11-07

### Added

- Core.ComputedDefaultValue means property is not required on create

## 0.23.4 - 2023-08-16

### Fixed

- OData V2 EntitySet elements may have Documentation child elements

## 0.23.3 - 2023-06-30

### Added

- Add cli support for maximum level of containment navigation properties using `--levels`

### Fixed

- Reduced default maximum level of containment navigation properties from 5 to 4

## 0.23.2 - 2023-06-16

### Fixed

- Inheritance across schemas is now correctly processed

## 0.23.1 - 2023-06-15

### Fixed

- Annotations for model elements on other schemas are now correctly processed

## 0.23.0 - 2023-03-31

### Changed

- Edm.Decimal with floating scale and precision 34 uses the newly registered OpenAPI format [`decimal128`](https://spec.openapis.org/registry/format/decimal128.html)
- Edm.Binary and Edm.Stream in OpenAPI 3.1 use [`contentEncoding`](https://json-schema.org/draft/2020-12/json-schema-validation.html#name-contentencoding) with a value of `base64url`.

## 0.22.0 - 2023-03-21

### Changed

- Refactored code without functional changes, added `exports` in `package.json` to prevent unintended use of package-internal modules

## 0.21.4 - 2023-03-14

### Added

- Add cli support for a default title if none is annotated using `--title`
- Add cli support for a default description if none is annotated using `--description`, works with diagram

## 0.21.3 - 2023-03-10

### Changed

- Path templates for decimal key properties in parentheses now correctly do not have the single quotes

## 0.21.0 - 2023-02-23

### Added

- Support to skip the `$batch` path using the CLI parameter `--skipBatchPath`, it will skip the generation always

## 0.20.0 - 2023-01-12

### Added

- Support for `FilterSegmentSupported` property of [`UpdateRestrictions`](https://github.com/oasis-tcs/odata-vocabularies/blob/main/vocabularies/Org.OData.Capabilities.V1.md#updaterestrictionstype) and [`DeleteRestrictions`](https://github.com/oasis-tcs/odata-vocabularies/blob/main/vocabularies/Org.OData.Capabilities.V1.md#deleterestrictionstype)

## 0.19.0 - 2022-10-08

### Added

- Support for OData V2

## 0.18.3 - 2022-09-01

### Added

- Use [stringifyStream](https://www.npmjs.com/package/@discoveryjs/json-ext) for generating JSON

## 0.18.0 - 2022-06-01

### Added

- Dynamic capabilities using `Path=`(XML) or `$Path` (JSON) are now treated as `true`

## 0.17.0 - 2022-05-19

### Added

- Define operation-specific HTTP error response status codes with descriptions via `ErrorResponses` property of certain annotations

## 0.16.0 - 2022-04-11

### Added

- Option `-o` / `--openapi-version` to set the OpenAPI version - version will be used for `openapi` output property without checks.
- Support for OpenAPI version 3.1.0.
- Recognize namespace-qualified annotations without vocabulary reference

## 0.15.0 - 2022-03-28

### Added

- Schema for custom headers and custom query options with annotation `JSON.Schema`.
- Schema for action/function parameters with annotation `JSON.Schema`.

## 0.14.0 - 2022-03-15

### Added

- `Capabilities.UpdateMethod` to use for example `PUT` instead of `PATCH`.

## 0.13.0 - 2022-03-14

### Added

- Custom headers and custom query options, see example [`custom-parameters.xml`](./examples/custom-parameters.xml) and its output [`custom-parameters.openapi3.json`](./examples/custom-parameters.openapi3.json).

## 0.12.0 - 2022-02-28

### Changed

- Path templates for function parameters in parentheses within the path part now exclude the single quotes that are required for e.g. `Edm.String` values. Instead the quotes have to be provided in the parameter value. This "breaking" change is necessary to allow null values and empty string values as function parameters.

## 0.11.2 - 2022-02-25

### Added

- Non-trivial action and function import parameters are now depicted in the diagram.

## 0.11.1 - 2022-02-21

### Fixed

- External annotations targeting a function overload with collection-valued parameters are now correctly recognized.

## 0.11.0 - 2021-11-22

### Added

- Schemas for create allow linking to existing entities for single-valued non-nullable non-containment navigation properties.

## 0.10.0 - 2021-10-22

### Changed

- Paths for bound actions and functions only on entity sets, singletons, and containment navigation properties.

## 0.9.0 - 2021-10-13

### Changed

- Schema Objects for `-create` and `-update` only advertise "deep" insert/update for _containment_ navigation properties. Non-containment navigation properties are no longer mentioned.

  Note: all Schema Objects for structured types implicitly allow additional properties, so arbitrary "deep" requests are still allowed.
