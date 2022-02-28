# Changelog

## [0.12.0] - 2022-02-xx

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
