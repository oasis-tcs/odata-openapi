# Changelog

## [0.19.0] - 2022-10-08

### Added

- Support for OData V2

## [0.18.3] - 2022-09-01

### Added

- Use [stringifyStream](https://www.npmjs.com/package/@discoveryjs/json-ext) for generating JSON

## [0.18.0] - 2022-06-01

### Added

- Dynamic capabilities using `Path=`(XML) or `$Path` (JSON) are now treated as `true`

## [0.17.0] - 2022-05-19

### Added

- Define operation-specific HTTP error response status codes with descriptions via `ErrorResponses` property of certain annotations

## [0.16.0] - 2022-04-11

### Added

- Option `-o` / `--openapi-version` to set the OpenAPI version - version will be used for `openapi` output property without checks.
- Support for OpenAPI version 3.1.0.
- Recognize namespace-qualified annotations without vocabulary reference

## [0.15.0] - 2022-03-28

### Added

- Schema for custom headers and custom query options with annotation `JSON.Schema`.
- Schema for action/function parameters with annotation `JSON.Schema`.

## [0.14.0] - 2022-03-15

### Added

- `Capabilities.UpdateMethod` to use for example `PUT` instead of `PATCH`.

## [0.13.0] - 2022-03-14

### Added

- Custom headers and custom query options, see example [`custom-parameters.xml`](./examples/custom-parameters.xml) and its output [`custom-parameters.openapi3.json`](./examples/custom-parameters.openapi3.json).

## [0.12.0] - 2022-02-28

### Changed

- Path templates for function parameters in parentheses within the path part now exclude the single quotes that are required for e.g. `Edm.String` values. Instead the quotes have to be provided in the parameter value. This "breaking" change is necessary to allow null values and empty string values as function parameters.

## [0.11.2] - 2022-02-25

### Added

- Non-trivial action and function import parameters are now depicted in the diagram.

## [0.11.1] - 2022-02-21

### Changed

- External annotations targeting a function overload with collection-valued parameters are now correctly recognized.

## [0.11.0] - 2021-11-22

### Added

- Schemas for create allow linking to existing entities for single-valued non-nullable non-containment navigation properties.

## [0.10.0] - 2021-10-22

### Changed

- Paths for bound actions and functions only on entity sets, singletons, and containment navigation properties.

## [0.9.0] - 2021-10-13

### Changed

- Schema Objects for `-create` and `-update` only advertise "deep" insert/update for _containment_ navigation properties. Non-containment navigation properties are no longer mentioned.

  Note: all Schema Objects for structured types implicitly allow additional properties, so arbitrary "deep" requests are still allowed.
