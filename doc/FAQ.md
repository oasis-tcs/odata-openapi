# Frequently Asked Questions

Examples for typical questions on how to fine-tune the generated OpenAPI descriptions.

The examples here do not cover the full list of [supported annotions](Annotations.md).

<!-- TOC depthfrom:2 -->

- [How to suppress GET list and by-key on an entity set?](#how-to-suppress-get-list-and-by-key-on-an-entity-set)
- [How to suppress GET list on an entity set?](#how-to-suppress-get-list-on-an-entity-set)
- [How to suppress GET by-key on an entity set?](#how-to-suppress-get-by-key-on-an-entity-set)
- [How to suppress GET and POST along all navigation properties?](#how-to-suppress-get-and-post-along-all-navigation-properties)
- [How to suppress GET and POST along a specific navigation property?](#how-to-suppress-get-and-post-along-a-specific-navigation-property)
- [How to suppress GET along a specific navigation property?](#how-to-suppress-get-along-a-specific-navigation-property)
- [How to suppress POST along a specific navigation property?](#how-to-suppress-post-along-a-specific-navigation-property)
- [Can I have multiple NavigationRestrictions annotations for the same entity set?](#can-i-have-multiple-navigationrestrictions-annotations-for-the-same-entity-set)

<!-- /TOC -->

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

## How to suppress GET along a specific navigation property?

```xml
<Annotation Term="Capabilities.NavigationRestrictions">
  <Record>
    <PropertyValue Property="RestrictedProperties">
      <Collection>
        <Record>
          <PropertyValue Property="NavigationProperty" NavigationPropertyPath="Foo" />
          <PropertyValue Property="ReadRestrictions">
            <Record>
              <PropertyValue Property="Readable" Bool="false" />
            </Record>
          </PropertyValue>
        </Record>
      </Collection>
    </PropertyValue>
  </Record>
</Annotation>
```

## How to suppress POST along a specific navigation property?

```xml
<Annotation Term="Capabilities.NavigationRestrictions">
  <Record>
    <PropertyValue Property="RestrictedProperties">
      <Collection>
        <Record>
          <PropertyValue Property="NavigationProperty" NavigationPropertyPath="Foo" />
          <PropertyValue Property="InsertRestrictions">
            <Record>
              <PropertyValue Property="Insertable" Bool="false" />
            </Record>
          </PropertyValue>
        </Record>
      </Collection>
    </PropertyValue>
  </Record>
</Annotation>
```

## Can I have multiple `NavigationRestrictions` annotations for the same entity set?

No, you have to combine all restrictions for an entity set into a single annotation with term `Capabilities.NavigationRestrictions`.


## Can I have multiple records for the same navigation property in the `RestrictedProperties` collection?

No, you have to combine all restrictions for a navigation proeprty into a single record.
