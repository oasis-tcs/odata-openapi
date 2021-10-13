# Changelog

## [0.9.0] - 2021-10-13

### Changed

- Schema Objects for `-create` and `-update` only advertise "deep" insert/update for _containment_ navigation properties. Non-containment navigation properties are no longer mentioned.

  Note: all Schema Objects for structured types implicitly allow additional properties, so arbitrary "deep" requests are still allowed.
