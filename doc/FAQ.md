# Frequently Asked Questions

Examples for typical questions on how to fine-tune the generated OpenAPI descriptions.

The examples here do not cover the full list of [supported annotions](Annotations.md).

## How to suppress GET (list and by-key) on an entity set?

To suppress both types of GET requests to an entity set, annotate it with

```xml
<Annotation Term="Capabilities.ReadRestrictions">
  <Record>
    <PropertyValue Property="Readable" Bool="false" />
  </Record>
</Annotation>
```

## How to suppress GET (list) on an entity set?

To suppress only GET list requests to an entity set and still allow GET by-key, annotate it with

```xml
<Annotation Term="Capabilities.ReadRestrictions">
  <Record>
    <PropertyValue Property="Readable" Bool="false" />
    <PropertyValue Property="ReadByKeyRestrictions">
      <Record>
        <PropertyValue Property="Readable" Bool="true" />
      </Record>
    </PropertyValue>
  </Record>
</Annotation>
```

## How to suppress GET (by-key) on an entity set?

To suppress only GET by-key requests to an entity set and still allow GET list, annotate it with

```xml
<Annotation Term="Capabilities.ReadRestrictions">
  <Record>
    <PropertyValue Property="ReadByKeyRestrictions">
      <Record>
        <PropertyValue Property="Readable" Bool="false" />
      </Record>
    </PropertyValue>
  </Record>
</Annotation>
```

## How to suppress GET and POST along all navigation properties?

```xml
<Annotation Term="Capabilities.NavigationRestrictions">
  <Record>
    <PropertyValue Property="Navigability" EnumMember="Capabilities.NavigationType/None" />
  </Record>
</Annotation>
```

## How to suppress GET and POST along a specific navigation property?

```xml
<Annotation Term="Capabilities.NavigationRestrictions">
  <Record>
    <PropertyValue Property="RestrictedProperties">
      <Collection>
        <Record>
          <PropertyValue Property="NavigationProperty" NavigationPropertyPath="Foo" />
          <PropertyValue Property="Navigability" EnumMember="Capabilities.NavigationType/None" />
        </Record>
      </Collection>
    </PropertyValue>
  </Record>
</Annotation>
```
