# Changelog

## [0.11.0] - 2021-10-22

### Added

- Schemas for create allow linking to existing entities for single-valued non-nullable non-containment navigation properties

## [0.10.0] - 2021-10-22

### Changed

- Paths for bound actions and functions only on entity sets, singletons, and containment navigation properties.

## [0.9.0] - 2021-10-13

### Changed

- Schema Objects for `-create` and `-update` only advertise "deep" insert/update for _containment_ navigation properties. Non-containment navigation properties are no longer mentioned.

  Note: all Schema Objects for structured types implicitly allow additional properties, so arbitrary "deep" requests are still allowed.
