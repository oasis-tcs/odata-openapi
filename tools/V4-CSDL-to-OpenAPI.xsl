<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
  xmlns:edm="http://docs.oasis-open.org/odata/ns/edm" xmlns:json="http://json.org/"
>
  <!--
    This style sheet transforms OData 4.0 CSDL XML documents into OpenAPI 2.0 JSON

    Latest version: https://github.com/oasis-tcs/odata-openapi/blob/master/tools/V4-CSDL-to-OpenAPI.xsl

    TODO:
    - Inline definitions for odata.error*, Edm.* to make OpenAPI documents self-contained
    - Validation annotations -> pattern, minimum, maximum, exclusiveM??imum, see https://issues.oasis-open.org/browse/ODATA-856,
    inline and explace style
    - complex or collection-valued function parameters need special treatment in /paths - use parameter aliases with alias
    option of type string
    - @Extends for entity container: include /paths from referenced container
    - both "clickable" and freestyle $expand, $select, $orderby - does not work yet, open issue
    - system query options for actions/functions/imports depending on "Collection("
    - security/authentication
    - 200 response for PATCH
    - ETag / If-Match for PATCH
    - property description for key parameters in single-entity requests - include @Common.Label or @Core.Description
    - operation descriptions via predefined qualifiers: @Core.Description#GET, #POST, #PATCH (and/or #PUT), #DELETE on entity set,
    singleton
    - allow external targeting for @Core.Description similar to @Common.Label
    - remove duplicated code in /paths production
    - Capabilities: SortRestrictions/NonSortableProperties, FilterRestrictions/NonFilterableProperties
  -->

  <xsl:output method="text" indent="yes" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:strip-space elements="*" />


  <xsl:param name="scheme" select="'http'" />
  <xsl:param name="host" select="'localhost'" />
  <xsl:param name="basePath" select="'/service-root'" />
  <xsl:param name="odata-schema" select="'https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/odata-definitions.json'" />
  <xsl:param name="odata-version" select="'4.0'" />
  <xsl:param name="vocabulary-home" select="'http://localhost/examples'" />
  <xsl:param name="swagger-ui" select="'http://localhost/swagger-ui'" />
  <xsl:param name="diagram" select="null" />
  <xsl:param name="openapi-formatoption" select="''" />


  <xsl:variable name="coreNamespace" select="'Org.OData.Core.V1'" />
  <xsl:variable name="coreAlias"
    select="//edmx:Include[@Namespace=$coreNamespace]/@Alias|//edm:Schema[@Namespace=$coreNamespace]/@Alias" />
  <xsl:variable name="coreDescription" select="concat($coreNamespace,'.Description')" />
  <xsl:variable name="coreDescriptionAliased">
    <xsl:choose>
      <xsl:when test="$coreAlias">
        <xsl:value-of select="concat($coreAlias,'.Description')" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="'Core.Description'" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:variable name="capabilitiesNamespace" select="'Org.OData.Capabilities.V1'" />
  <xsl:variable name="capabilitiesAlias"
    select="//edmx:Include[@Namespace=$capabilitiesNamespace]/@Alias|//edm:Schema[@Namespace=$capabilitiesNamespace]/@Alias" />

  <xsl:variable name="commonNamespace" select="'com.sap.vocabularies.Common.v1'" />
  <xsl:variable name="commonAlias"
    select="//edmx:Include[@Namespace=$commonNamespace]/@Alias|//edm:Schema[@Namespace=$commonNamespace]/@Alias" />
  <xsl:variable name="commonLabel" select="concat($commonNamespace,'.Label')" />
  <xsl:variable name="commonLabelAliased" select="concat($commonAlias,'.Label')" />

  <xsl:variable name="defaultResponse">
    <xsl:text>"default":{"$ref":"#/responses/error"}</xsl:text>
  </xsl:variable>

  <xsl:template name="Core.Description">
    <xsl:param name="node" />
    <xsl:variable name="description"
      select="$node/edm:Annotation[(@Term=$coreDescription or @Term=$coreDescriptionAliased) and not(@Qualifier)]/@String|$node/edm:Annotation[(@Term=$coreDescription or @Term=$coreDescriptionAliased) and not(@Qualifier)]/edm:String" />
    <xsl:call-template name="escape">
      <xsl:with-param name="string" select="normalize-space($description)" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="Core-Annotation">
    <xsl:param name="node" />
    <xsl:param name="term" />
    <xsl:call-template name="escape">
      <xsl:with-param name="string"
        select="$node/edm:Annotation[(@Term=concat('Org.OData.Core.V1.',$term) or @Term=concat($coreAlias,'.',$term)) and not(@Qualifier)]/@String|$node/edm:Annotation[(@Term=concat('Org.OData.Core.V1.',$term) or @Term=concat($coreAlias,'.',$term)) and not(@Qualifier)]/edm:String" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="Common.Label">
    <xsl:param name="node" />
    <!-- TODO: consider explace annotations for properties -->
    <xsl:variable name="label"
      select="normalize-space($node/edm:Annotation[(@Term=$commonLabel or @Term=$commonLabelAliased) and not(@Qualifier)]/@String|$node/edm:Annotation[(@Term=$commonLabel or @Term=$commonLabelAliased) and not(@Qualifier)]/edm:String)" />
    <xsl:variable name="explaceLabel">
      <xsl:choose>
        <xsl:when test="local-name($node)='Property'">
          <xsl:variable name="target" select="concat(../../@Alias,'.',../@Name,'/',@Name)" />
          <xsl:value-of
            select="//edm:Annotations[@Target=$target and not(@Qualifier)]/edm:Annotation[@Term=(@Term=$commonLabel or @Term=$commonLabelAliased) and not(@Qualifier)]/@String" />
        </xsl:when>
      </xsl:choose>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$label">
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="$label" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="$explaceLabel" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>


  <xsl:template match="edmx:Edmx">
    <!--
      <xsl:message><xsl:value-of select="$commonAlias"/></xsl:message>
      <xsl:message><xsl:value-of select="$commonNamespace"/></xsl:message>
    -->
    <xsl:text>{</xsl:text>
    <xsl:text>"swagger":"2.0"</xsl:text>

    <xsl:text>,"info":{"title":"</xsl:text>
    <xsl:variable name="title">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="//edm:Schema" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="containerTitle">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="//edm:EntityContainer" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$title!=''">
        <xsl:value-of select="$title" />
      </xsl:when>
      <xsl:when test="$containerTitle!=''">
        <xsl:value-of select="$containerTitle" />
      </xsl:when>
      <xsl:when test="//edm:EntityContainer">
        <xsl:text>OData Service for namespace </xsl:text>
        <xsl:value-of select="//edm:EntityContainer/../@Namespace" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>OData CSDL Document for namespace </xsl:text>
        <xsl:value-of select="//edm:Schema/@Namespace" />
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>","version":"</xsl:text>
    <xsl:variable name="version">
    </xsl:variable>
    <xsl:call-template name="Core-Annotation">
      <xsl:with-param name="node" select="//edm:EntityContainer" />
      <xsl:with-param name="term" select="'SchemaVersion'" />
    </xsl:call-template>

    <xsl:text>","description":"</xsl:text>
    <xsl:variable name="description">
      <xsl:call-template name="Core-Annotation">
        <xsl:with-param name="node" select="//edm:Schema" />
        <xsl:with-param name="term" select="'LongDescription'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="containerDescription">
      <xsl:call-template name="Core-Annotation">
        <xsl:with-param name="node" select="//edm:EntityContainer" />
        <xsl:with-param name="term" select="'LongDescription'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$description!=''">
        <xsl:value-of select="$description" />
      </xsl:when>
      <xsl:when test="$containerDescription!=''">
        <xsl:value-of select="$containerDescription" />
      </xsl:when>
      <xsl:when test="//edm:EntityContainer">
        <xsl:text>This OData service is located at </xsl:text>
        <xsl:value-of select="$scheme" />
        <xsl:text>://</xsl:text>
        <xsl:value-of select="$host" />
        <xsl:value-of select="$basePath" />
        <xsl:text>/</xsl:text>
      </xsl:when>
    </xsl:choose>
    <xsl:if test="$diagram">
      <xsl:apply-templates select="//edm:EntityType" mode="description" />
    </xsl:if>
    <xsl:apply-templates select="//edmx:Include" mode="description" />
    <xsl:text>"}</xsl:text>

    <xsl:if test="//edm:EntityContainer">
      <xsl:text>,"schemes":["</xsl:text>
      <xsl:value-of select="$scheme" />
      <xsl:text>"],"host":"</xsl:text>
      <xsl:value-of select="$host" />
      <xsl:text>","basePath":"</xsl:text>
      <xsl:value-of select="$basePath" />
      <xsl:text>"</xsl:text>

      <!-- TODO: Capabilities.SupportedFormats -->
      <xsl:text>,"consumes":["application/json"]</xsl:text>
      <xsl:text>,"produces":["application/json"]</xsl:text>
    </xsl:if>

    <xsl:apply-templates select="//edm:EntitySet|//edm:Singleton" mode="tags" />

    <xsl:apply-templates select="//edm:EntityType|//edm:ComplexType|//edm:TypeDefinition|//edm:EnumType" mode="hash">
      <xsl:with-param name="name" select="'definitions'" />
    </xsl:apply-templates>

    <!-- paths is required, so we need it also for documents that do not define an entity container -->
    <xsl:text>,"paths":{</xsl:text>
    <xsl:apply-templates select="//edm:EntityContainer" mode="paths" />
    <xsl:text>}</xsl:text>

    <xsl:if test="//edm:EntityContainer">
      <xsl:text>,"parameters":{</xsl:text>
      <xsl:text>"top":{"name":"$top","in":"query","description":"Show only the first n items</xsl:text>
      <xsl:text>, see [OData Paging - Top](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374630)","type":"integer"},</xsl:text>
      <xsl:text>"skip":{"name":"$skip","in":"query","description":"Skip the first n items</xsl:text>
      <xsl:text>, see [OData Paging - Skip](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374631)","type":"integer"},</xsl:text>
      <xsl:text>"count":{"name":"$count","in":"query","description":"Include count of items</xsl:text>
      <xsl:text>, see [OData Count](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374632)","type":"boolean"},</xsl:text>
      <xsl:text>"filter":{"name":"$filter","in":"query","description":"Filter items by property values</xsl:text>
      <xsl:text>, see [OData Filtering](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374625)","type":"string"},</xsl:text>
      <xsl:text>"search":{"name":"$search","in":"query","description":"Search items by search phrases</xsl:text>
      <xsl:text>, see [OData Searching](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374633)","type":"string"}}</xsl:text>

      <xsl:text>,"responses":{"error":{"description":"Error","schema":{"$ref":"</xsl:text>
      <xsl:value-of select="$odata-schema" />
      <xsl:text>#/definitions/odata.error"}}}</xsl:text>
    </xsl:if>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EntityType" mode="description">
    <xsl:if test="position() = 1">
      <xsl:text>\n\n## Entity Data Model\n![ER Diagram](http://yuml.me/diagram/class/</xsl:text>
    </xsl:if>
    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:apply-templates select="@BaseType" mode="description" />
    <xsl:text>[</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>]</xsl:text>
    <xsl:apply-templates select="edm:NavigationProperty" mode="description" />
    <xsl:if test="position() = last()">
      <xsl:text>)</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@BaseType" mode="description">
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="." />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="." />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:text>[</xsl:text>
    <xsl:choose>
      <xsl:when test="$qualifier=../../@Namespace or $qualifier=../../@Alias">
        <xsl:value-of select="$type" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="@Type" />
        <xsl:text>{bg:white}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>]^</xsl:text>
  </xsl:template>

  <xsl:template match="edm:NavigationProperty" mode="description">
    <xsl:variable name="singleType">
      <xsl:choose>
        <xsl:when test="starts-with(@Type,'Collection(')">
          <xsl:value-of select="substring-before(substring-after(@Type,'('),')')" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@Type" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="collection" select="starts-with(@Type,'Collection(')" />
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$singleType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$singleType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="nullable">
      <xsl:call-template name="nullableFacetValue">
        <xsl:with-param name="type" select="@Type" />
        <xsl:with-param name="nullableFacet" select="@Nullable" />
      </xsl:call-template>
    </xsl:variable>
    <!--
      TODO: evaluate Partner to just have one arrow
      [FeaturedProduct]&lt;0..1-0..1&gt;[Advertisement]
    -->
    <xsl:text>,[</xsl:text>
    <xsl:value-of select="../@Name" />
    <xsl:text>]-</xsl:text>
    <xsl:choose>
      <xsl:when test="$collection">
        <xsl:text>*</xsl:text>
      </xsl:when>
      <xsl:when test="$nullable">
        <xsl:text>0..1</xsl:text>
      </xsl:when>
    </xsl:choose>
    <xsl:text>>[</xsl:text>
    <xsl:choose>
      <xsl:when test="$qualifier=../../@Namespace or $qualifier=../../@Alias">
        <xsl:value-of select="$type" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$singleType" />
        <xsl:text>{bg:white}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>]</xsl:text>
  </xsl:template>

  <xsl:template match="edmx:Include" mode="description">
    <xsl:if test="position() = 1">
      <xsl:text>\n\n## References</xsl:text>
    </xsl:if>
    <xsl:text>\n- [</xsl:text>
    <xsl:value-of select="@Namespace" />
    <xsl:text>](</xsl:text>
    <xsl:choose>
      <xsl:when test="substring(@Namespace,1,10)='Org.OData.'">
        <xsl:text>https://github.com/oasis-tcs/odata-vocabularies/blob/master/vocabularies/</xsl:text>
        <xsl:value-of select="@Namespace" />
        <xsl:text>.md</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$swagger-ui" />
        <xsl:text>/?url=</xsl:text>
        <xsl:call-template name="replace-all">
          <xsl:with-param name="string">
            <xsl:call-template name="json-url">
              <xsl:with-param name="url" select="../@Uri" />
            </xsl:call-template>
          </xsl:with-param>
          <xsl:with-param name="old" select="')'" />
          <xsl:with-param name="new" select="'%29'" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>)</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EnumType" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="../@Namespace" />
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{"type":"string",</xsl:text>
    <xsl:text>"enum":[</xsl:text>
    <xsl:apply-templates select="edm:Member" mode="enum" />
    <xsl:text>]</xsl:text>
    <xsl:call-template name="title-description">
      <xsl:with-param name="fallback-title" select="@Name" />
    </xsl:call-template>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Member" mode="enum">
    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template match="edm:TypeDefinition" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="../@Namespace" />
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{</xsl:text>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@UnderlyingType" />
      <xsl:with-param name="nullableFacet" select="'false'" />
    </xsl:call-template>
    <xsl:call-template name="title-description">
      <xsl:with-param name="fallback-title" select="@Name" />
    </xsl:call-template>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EntityType|edm:ComplexType" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="../@Namespace" />
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{</xsl:text>

    <xsl:if test="@BaseType">
      <xsl:text>"allOf":[{</xsl:text>
      <xsl:call-template name="schema-ref">
        <xsl:with-param name="qualifiedName" select="@BaseType" />
      </xsl:call-template>
      <xsl:text>},{</xsl:text>
    </xsl:if>

    <xsl:text>"type":"object"</xsl:text>

    <xsl:apply-templates select="edm:Property|edm:NavigationProperty" mode="hash">
      <xsl:with-param name="name" select="'properties'" />
    </xsl:apply-templates>

    <xsl:call-template name="title-description">
      <xsl:with-param name="fallback-title" select="@Name" />
    </xsl:call-template>

    <xsl:if test="@BaseType">
      <xsl:text>}]</xsl:text>
    </xsl:if>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Property|edm:NavigationProperty" mode="hashvalue">
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
    </xsl:call-template>
    <xsl:choose>
      <xsl:when test="local-name()='Property'">
        <xsl:apply-templates select="*[local-name()!='Annotation']" mode="list2" />
      </xsl:when>
      <xsl:otherwise>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:call-template name="title-description" />
  </xsl:template>

  <xsl:template name="nullableFacetValue">
    <xsl:param name="type" />
    <xsl:param name="nullableFacet" />
    <xsl:choose>
      <xsl:when test="$nullableFacet">
        <xsl:value-of select="$nullableFacet" />
      </xsl:when>
      <xsl:when test="starts-with($type,'Collection(')">
        <xsl:value-of select="'false'" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="'true'" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="type">
    <xsl:param name="type" />
    <xsl:param name="nullableFacet" />
    <xsl:param name="wrap" select="false()" />
    <xsl:param name="noArray" select="false()" />
    <xsl:variable name="nullable">
      <xsl:call-template name="nullableFacetValue">
        <xsl:with-param name="type" select="$type" />
        <xsl:with-param name="nullableFacet" select="$nullableFacet" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="collection" select="starts-with($type,'Collection(')" />
    <xsl:variable name="singleType">
      <xsl:choose>
        <xsl:when test="$collection">
          <xsl:value-of select="substring-before(substring-after($type,'('),')')" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$type" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$singleType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="$collection">
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>"title":"Related </xsl:text>
        <xsl:value-of select="$type" />
        <xsl:text>","type":"object","properties":{"results":{</xsl:text>
      </xsl:if>
      <xsl:text>"type":"array","items":{</xsl:text>
    </xsl:if>
    <xsl:choose>
      <!--
        <xsl:when test="$singleType='Edm.Stream'">
        <xsl:call-template name="nullableType">
        <xsl:with-param name="type" select="'string'" />
        <xsl:with-param name="nullable" select="$nullable" />
        <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"readOnly":true</xsl:text>
        </xsl:when>
      -->
      <xsl:when test="$singleType='Edm.String'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:apply-templates select="@MaxLength" />
      </xsl:when>
      <xsl:when test="$singleType='Edm.Binary'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"base64url"</xsl:text>
        <xsl:apply-templates select="@MaxLength" />
      </xsl:when>
      <xsl:when test="$singleType='Edm.Boolean'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'boolean'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Decimal'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'number,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"decimal"</xsl:text>
        <xsl:choose>
          <xsl:when test="not(@Scale) or @Scale='0'">
            <xsl:text>,"multipleOf":1</xsl:text>
          </xsl:when>
          <xsl:when test="@Scale!='variable'">
            <xsl:text>,"multipleOf":1.0e-</xsl:text>
            <xsl:value-of select="@Scale" />
          </xsl:when>
        </xsl:choose>
        <xsl:if test="@Precision">
          <xsl:variable name="scale">
            <xsl:choose>
              <xsl:when test="not(@Scale)">
                <xsl:value-of select="0" />
              </xsl:when>
              <xsl:when test="@Scale='variable'">
                <xsl:value-of select="0" />
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="@Scale" />
              </xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <xsl:variable name="limit">
            <xsl:call-template name="repeat">
              <xsl:with-param name="string" select="'9'" />
              <xsl:with-param name="count" select="@Precision - $scale" />
            </xsl:call-template>
            <xsl:if test="$scale > 0">
              <xsl:text>.</xsl:text>
              <xsl:call-template name="repeat">
                <xsl:with-param name="string" select="'9'" />
                <xsl:with-param name="count" select="$scale" />
              </xsl:call-template>
            </xsl:if>
          </xsl:variable>
          <xsl:if test="@Precision &lt; 16">
            <xsl:text>,"minimum":-</xsl:text>
            <xsl:value-of select="$limit" />
            <xsl:text>,"maximum":</xsl:text>
            <xsl:value-of select="$limit" />
          </xsl:if>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Byte'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"uint8"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.SByte'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int8"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Int16'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int16"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Int32'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int32"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Int64'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int64"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Date'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"date"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Double'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'number,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"double"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Single'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'number,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"float"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Guid'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"uuid"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.DateTimeOffset'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"date-time"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.TimeOfDay'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"time"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Duration'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"duration"</xsl:text>
      </xsl:when>
      <xsl:when test="$qualifier='Edm'">
        <xsl:text>"$ref":"</xsl:text>
        <xsl:value-of select="$odata-schema" />
        <xsl:text>#/definitions/</xsl:text>
        <xsl:value-of select="$singleType" />
        <xsl:text>"</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="ref">
          <xsl:with-param name="qualifier" select="$qualifier" />
          <xsl:with-param name="name">
            <xsl:call-template name="substring-after-last">
              <xsl:with-param name="input" select="$singleType" />
              <xsl:with-param name="marker" select="'.'" />
            </xsl:call-template>
          </xsl:with-param>
        </xsl:call-template>
        <xsl:apply-templates select="@MaxLength" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:apply-templates select="@DefaultValue">
      <xsl:with-param name="type" select="$singleType" />
    </xsl:apply-templates>
    <xsl:if test="$collection">
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>}}</xsl:text>
      </xsl:if>
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="ref">
    <xsl:param name="qualifier" />
    <xsl:param name="name" />
    <xsl:variable name="internalNamespace" select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
    <xsl:variable name="externalNamespace">
      <xsl:choose>
        <xsl:when test="//edmx:Include[@Alias=$qualifier]/@Namespace">
          <xsl:value-of select="//edmx:Include[@Alias=$qualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="//edmx:Include[@Namespace=$qualifier]/@Namespace" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:text>"$ref":"</xsl:text>
    <xsl:call-template name="json-url">
      <xsl:with-param name="url" select="//edmx:Include[@Namespace=$externalNamespace]/../@Uri" />
    </xsl:call-template>
    <xsl:text>#/definitions/</xsl:text>
    <xsl:choose>
      <xsl:when test="$internalNamespace">
        <xsl:value-of select="$internalNamespace" />
      </xsl:when>
      <xsl:when test="string-length($externalNamespace)>0">
        <xsl:value-of select="$externalNamespace" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$qualifier" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>.</xsl:text>
    <xsl:value-of select="$name" />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template name="schema-ref">
    <xsl:param name="qualifiedName" />
    <xsl:call-template name="ref">
      <xsl:with-param name="qualifier">
        <xsl:call-template name="substring-before-last">
          <xsl:with-param name="input" select="$qualifiedName" />
          <xsl:with-param name="marker" select="'.'" />
        </xsl:call-template>
      </xsl:with-param>
      <xsl:with-param name="name">
        <xsl:call-template name="substring-after-last">
          <xsl:with-param name="input" select="$qualifiedName" />
          <xsl:with-param name="marker" select="'.'" />
        </xsl:call-template>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="repeat">
    <xsl:param name="string" />
    <xsl:param name="count" />
    <xsl:value-of select="$string" />
    <xsl:if test="$count &gt; 1">
      <xsl:call-template name="repeat">
        <xsl:with-param name="string" select="$string" />
        <xsl:with-param name="count" select="$count - 1" />
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <xsl:template name="nullableType">
    <xsl:param name="type" />
    <xsl:param name="nullable" />
    <xsl:param name="noArray" />
    <xsl:text>"type":</xsl:text>
    <xsl:if test="not($noArray) and (not($nullable='false') or contains($type,','))">
      <xsl:text>[</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:choose>
      <xsl:when test="$noArray and contains($type,',')">
        <xsl:value-of select="substring-before($type,',')" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="replace-all">
          <xsl:with-param name="string" select="$type" />
          <xsl:with-param name="old" select="','" />
          <xsl:with-param name="new" select="'&quot;,&quot;'" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"</xsl:text>
    <xsl:if test="not($noArray) and not($nullable='false')">
      <xsl:text>,"null"</xsl:text>
    </xsl:if>
    <xsl:if test="not($noArray) and (not($nullable='false') or contains($type,','))">
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@MaxLength">
    <xsl:if test=".!='max'">
      <xsl:text>,"maxLength":</xsl:text>
      <xsl:value-of select="." />
    </xsl:if>
  </xsl:template>

  <xsl:template match="@DefaultValue">
    <xsl:param name="type" />
    <xsl:text>,"default":</xsl:text>
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="typeName">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="underlyingType">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Namespace=$qualifier]/edm:TypeDefinition[@Name=$typeName]/@UnderlyingType">
          <xsl:value-of select="//edm:Schema[@Namespace=$qualifier]/edm:TypeDefinition[@Name=$typeName]/@UnderlyingType" />
        </xsl:when>
        <xsl:when test="//edm:Schema[@Alias=$qualifier]/edm:TypeDefinition[@Name=$typeName]/@UnderlyingType">
          <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/edm:TypeDefinition[@Name=$typeName]/@UnderlyingType" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$type" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="underlyingQualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$underlyingType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test=".='-INF' or .='INF' or .='NaN'">
        <xsl:text>"</xsl:text>
        <xsl:value-of select="." />
        <xsl:text>"</xsl:text>
      </xsl:when>
      <xsl:when
        test="$underlyingType='Edm.Boolean' or $underlyingType='Edm.Decimal' or $underlyingType='Edm.Double' or $underlyingType='Edm.Single' or $underlyingType='Edm.Byte' or $underlyingType='Edm.SByte' or $underlyingType='Edm.Int16' or $underlyingType='Edm.Int32' or $underlyingType='Edm.Int64'"
      >
        <xsl:value-of select="." />
      </xsl:when>
      <!-- FAKE: couldn't determine underlying primitive type, so guess from value -->
      <xsl:when test="$underlyingQualifier!='Edm' and (.='true' or .='false' or .='null' or number(.))">
        <xsl:value-of select="." />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"</xsl:text>
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="." />
        </xsl:call-template>
        <xsl:text>"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:EntityContainer" mode="paths">
    <xsl:apply-templates select="edm:EntitySet|edm:Singleton|edm:FunctionImport|edm:ActionImport" mode="list" />
  </xsl:template>

  <xsl:template match="edm:EntitySet|edm:Singleton" mode="tags">
    <xsl:if test="position() = 1">
      <xsl:text>,"tags":[</xsl:text>
    </xsl:if>
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"name":"</xsl:text>
    <xsl:value-of select="@Name" />

    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="$description!=''">
      <xsl:text>","description":"</xsl:text>
      <xsl:value-of select="$description" />
    </xsl:if>

    <xsl:text>"}</xsl:text>
    <xsl:if test="position() = last()">
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:EntitySet">
    <xsl:apply-templates select="." mode="entitySet" />
    <xsl:apply-templates select="." mode="entity" />
  </xsl:template>

  <xsl:template match="edm:EntitySet" mode="entitySet">
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="@EntityType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="namespace">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Alias=$qualifier]">
          <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$qualifier" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@EntityType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="qualifiedType">
      <xsl:value-of select="$namespace" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$type" />
    </xsl:variable>

    <xsl:text>"/</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{</xsl:text>

    <!-- GET -->
    <xsl:text>"get":{</xsl:text>
    <xsl:text>"summary":"Get entities from </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","tags":["</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"]</xsl:text>

    <xsl:text>,"parameters":[</xsl:text>

    <xsl:variable name="top-supported">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'TopSupported'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="not($top-supported='false')">
      <xsl:text>{"$ref":"#/parameters/top"},</xsl:text>
    </xsl:if>

    <xsl:variable name="skip-supported">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'SkipSupported'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="not($skip-supported='false')">
      <xsl:text>{"$ref":"#/parameters/skip"},</xsl:text>
    </xsl:if>

    <xsl:text>{"$ref":"#/parameters/search"},{"$ref":"#/parameters/filter"},{"$ref":"#/parameters/count"}</xsl:text>

    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Property"
      mode="orderby" />
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Property"
      mode="select" />
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:NavigationProperty"
      mode="expand" />

    <xsl:text>],"responses":{"200":{"description":"Retrieved entities","schema":{"type":"object"</xsl:text>
    <xsl:if test="$odata-version='2.0'">
      <xsl:text>,"title":"Wrapper","properties":{"d":{"type":"object"</xsl:text>
    </xsl:if>
    <xsl:text>,"title":"Collection of </xsl:text>
    <xsl:value-of select="$type" />
    <xsl:text>"</xsl:text>
    <xsl:text>,"properties":{</xsl:text>
    <xsl:choose>
      <xsl:when test="$odata-version='2.0'">
        <xsl:text>"results"</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"value"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>:{"type":"array","items":{</xsl:text>
    <xsl:call-template name="schema-ref">
      <xsl:with-param name="qualifiedName" select="$qualifiedType" />
    </xsl:call-template>
    <xsl:text>}}}</xsl:text>
    <xsl:if test="$odata-version='2.0'">
      <xsl:text>}}</xsl:text>
    </xsl:if>
    <xsl:text>}},</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}}</xsl:text>

    <!-- POST -->
    <xsl:variable name="insertable">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'InsertRestrictions'" />
        <xsl:with-param name="property" select="'Insertable'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="not($insertable='false')">
      <xsl:text>,"post":{</xsl:text>
      <xsl:text>"summary":"Add new entity to </xsl:text>
      <xsl:value-of select="@Name" />
      <xsl:text>","tags":["</xsl:text>
      <xsl:value-of select="@Name" />
      <xsl:text>"]</xsl:text>
      <xsl:text>,"parameters":[{"name":"</xsl:text>
      <xsl:value-of select="$type" />
      <xsl:text>","in":"body"</xsl:text>
      <xsl:call-template name="entityTypeDescription">
        <xsl:with-param name="namespace" select="$namespace" />
        <xsl:with-param name="type" select="$type" />
        <xsl:with-param name="default" select="'New entity'" />
      </xsl:call-template>
      <xsl:text>,"schema":{</xsl:text>
      <xsl:call-template name="schema-ref">
        <xsl:with-param name="qualifiedName" select="$qualifiedType" />
      </xsl:call-template>
      <xsl:text>}}]</xsl:text>
      <xsl:text>,"responses":{"201":{"description":"Created entity","schema":{</xsl:text>
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>"title":"Created </xsl:text>
        <xsl:value-of select="$type" />
        <xsl:text>","type":"object","properties":{"d":{</xsl:text>
      </xsl:if>
      <xsl:call-template name="schema-ref">
        <xsl:with-param name="qualifiedName" select="$qualifiedType" />
      </xsl:call-template>
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>}}</xsl:text>
      </xsl:if>
      <xsl:text>}},</xsl:text>
      <xsl:value-of select="$defaultResponse" />
      <xsl:text>}}</xsl:text>
    </xsl:if>

    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="capability">
    <xsl:param name="term" />
    <xsl:param name="property" select="false()" />
    <xsl:choose>
      <xsl:when test="$property">
        <xsl:value-of
          select="edm:Annotation[@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term)]/edm:Record/edm:PropertyValue[@Property=$property]/@Bool|edm:Annotation[@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term)]/edm:Record/edm:PropertyValue[@Property=$property]/edm:Bool" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of
          select="edm:Annotation[@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term)]/@Bool|edm:Annotation[@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term)]/edm:Bool" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:Property" mode="orderby">
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{"name":"$orderby","in":"query","description":"Order items by property values</xsl:text>
      <xsl:text>, see [OData Sorting](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374629)"</xsl:text>
      <xsl:text>,"type":"array","uniqueItems":true,"items":{"type":"string"},"enum":[</xsl:text>
    </xsl:if>
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text> desc"</xsl:text>
    <xsl:if test="position()=last()">
      <xsl:text>]}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Property" mode="select">
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{"name":"$select","in":"query","description":"Select properties to be returned</xsl:text>
      <xsl:text>, see [OData Select](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374620)"</xsl:text>
      <xsl:text>,"type":"array","uniqueItems":true,"items":{"type":"string"},"enum":[</xsl:text>
    </xsl:if>
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"</xsl:text>
    <xsl:if test="position()=last()">
      <xsl:text>]}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:NavigationProperty" mode="expand">
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{"name":"$expand","in":"query","description":"Expand related entities</xsl:text>
      <xsl:text>, see [OData Expand](http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part1-protocol.html#_Toc445374621)"</xsl:text>
      <xsl:text>,"type":"array","uniqueItems":true,"items":{"type":"string"},"enum":["*"</xsl:text>
    </xsl:if>
    <xsl:text>,"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"</xsl:text>
    <xsl:if test="position()=last()">
      <xsl:text>]}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:EntitySet" mode="entity">
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="@EntityType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="namespace">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Alias=$qualifier]">
          <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$qualifier" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@EntityType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="qualifiedType">
      <xsl:value-of select="$namespace" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$type" />
    </xsl:variable>
    <xsl:variable name="aliasQualifiedType">
      <xsl:value-of select="//edm:Schema[@Namespace=$namespace]/@Alias" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$type" />
    </xsl:variable>

    <xsl:variable name="qualifiedBasetype" select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/@BaseType" />
    <xsl:variable name="basetypeQualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$qualifiedBasetype" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="basetypeNamespace">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Alias=$basetypeQualifier]">
          <xsl:value-of select="//edm:Schema[@Alias=$basetypeQualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$basetypeQualifier" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="basetype">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$qualifiedBasetype" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>

    <!-- entity path template -->
    <xsl:text>,"/</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>(</xsl:text>
    <xsl:apply-templates
      select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef|//edm:Schema[@Namespace=$basetypeNamespace]/edm:EntityType[@Name=$basetype]/edm:Key/edm:PropertyRef"
      mode="path" />
    <xsl:text>)":{</xsl:text>

    <!-- GET -->
    <xsl:text>"get":{</xsl:text>
    <xsl:text>"summary":"Get entity from </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text> by key","tags":["</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"]</xsl:text>
    <xsl:text>,"parameters":[</xsl:text>
    <xsl:apply-templates
      select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef|//edm:Schema[@Namespace=$basetypeNamespace]/edm:EntityType[@Name=$basetype]/edm:Key/edm:PropertyRef"
      mode="parameter" />
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Property"
      mode="select" />
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:NavigationProperty"
      mode="expand" />
    <xsl:text>],"responses":{"200":{"description":"Retrieved entity","schema":{</xsl:text>
    <xsl:if test="$odata-version='2.0'">
      <xsl:text>"title":"</xsl:text>
      <xsl:value-of select="$type" />
      <xsl:text>","type":"object","properties":{"d":{</xsl:text>
    </xsl:if>
    <xsl:call-template name="schema-ref">
      <xsl:with-param name="qualifiedName" select="$qualifiedType" />
    </xsl:call-template>
    <xsl:if test="$odata-version='2.0'">
      <xsl:text>}}</xsl:text>
    </xsl:if>
    <xsl:text>}},</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}}</xsl:text>

    <!-- PATCH -->
    <xsl:variable name="updatable">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'UpdateRestrictions'" />
        <xsl:with-param name="property" select="'Updatable'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="not($updatable='false')">
      <xsl:text>,"patch":{</xsl:text>
      <xsl:text>"summary":"Update entity in </xsl:text>
      <xsl:value-of select="@Name" />
      <xsl:text>","tags":["</xsl:text>
      <xsl:value-of select="@Name" />
      <xsl:text>"]</xsl:text>
      <xsl:text>,"parameters":[</xsl:text>
      <xsl:apply-templates
        select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef|//edm:Schema[@Namespace=$basetypeNamespace]/edm:EntityType[@Name=$basetype]/edm:Key/edm:PropertyRef"
        mode="parameter" />
      <xsl:text>,{"name":"</xsl:text>
      <xsl:value-of select="$type" />
      <xsl:text>","in":"body"</xsl:text>
      <xsl:call-template name="entityTypeDescription">
        <xsl:with-param name="namespace" select="$namespace" />
        <xsl:with-param name="type" select="$type" />
        <xsl:with-param name="default" select="'New property values'" />
      </xsl:call-template>
      <xsl:text>,"schema":{</xsl:text>
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>"title":"Modified </xsl:text>
        <xsl:value-of select="$type" />
        <xsl:text>","type":"object","properties":{"d":{</xsl:text>
      </xsl:if>
      <xsl:call-template name="schema-ref">
        <xsl:with-param name="qualifiedName" select="$qualifiedType" />
      </xsl:call-template>
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>}}</xsl:text>
      </xsl:if>
      <xsl:text>}}],"responses":{"204":{"description":"Success"},</xsl:text>
      <xsl:value-of select="$defaultResponse" />
      <xsl:text>}}</xsl:text>
    </xsl:if>

    <!-- DELETE -->
    <xsl:variable name="deletable">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'DeleteRestrictions'" />
        <xsl:with-param name="property" select="'Deletable'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="not($deletable='false')">
      <xsl:text>,"delete":{</xsl:text>
      <xsl:text>"summary":"Delete entity from </xsl:text>
      <xsl:value-of select="@Name" />
      <xsl:text>","tags":["</xsl:text>
      <xsl:value-of select="@Name" />
      <xsl:text>"]</xsl:text>
      <xsl:text>,"parameters":[</xsl:text>
      <xsl:apply-templates
        select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef|//edm:Schema[@Namespace=$basetypeNamespace]/edm:EntityType[@Name=$basetype]/edm:Key/edm:PropertyRef"
        mode="parameter" />
      <xsl:text>,{"name":"If-Match","in":"header","description":"ETag","type":"string"}]</xsl:text>
      <xsl:text>,"responses":{"204":{"description":"Success"},</xsl:text>
      <xsl:value-of select="$defaultResponse" />
      <xsl:text>}}</xsl:text>
    </xsl:if>

    <xsl:text>}</xsl:text>

    <xsl:apply-templates
      select="//edm:Function[@IsBound='true' and (edm:Parameter[1]/@Type=$qualifiedType or edm:Parameter[1]/@Type=$aliasQualifiedType)]"
      mode="bound"
    >
      <xsl:with-param name="entitySet" select="@Name" />
      <xsl:with-param name="namespace" select="$namespace" />
      <xsl:with-param name="type" select="$type" />
    </xsl:apply-templates>
    <xsl:apply-templates
      select="//edm:Action[@IsBound='true' and (edm:Parameter[1]/@Type=$qualifiedType or edm:Parameter[1]/@Type=$aliasQualifiedType)]"
      mode="bound"
    >
      <xsl:with-param name="entitySet" select="@Name" />
      <xsl:with-param name="namespace" select="$namespace" />
      <xsl:with-param name="type" select="$type" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="edm:Singleton">
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="@Type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="namespace">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Alias=$qualifier]">
          <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$qualifier" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@Type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="qualifiedType">
      <xsl:value-of select="$namespace" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$type" />
    </xsl:variable>
    <xsl:variable name="aliasQualifiedType">
      <xsl:value-of select="//edm:Schema[@Namespace=$namespace]/@Alias" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$type" />
    </xsl:variable>

    <!-- singleton path template -->
    <xsl:text>"/</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{</xsl:text>

    <!-- GET -->
    <xsl:text>"get":{</xsl:text>
    <xsl:text>"summary":"Get </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","tags":["</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"]</xsl:text>
    <xsl:text>,"parameters":[</xsl:text>

    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Property"
      mode="select"
    >
      <xsl:with-param name="after" select="''" />
    </xsl:apply-templates>
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:NavigationProperty"
      mode="expand" />

    <xsl:text>],"responses":{"200":{"description":"Retrieved entity","schema":{</xsl:text>
    <xsl:call-template name="schema-ref">
      <xsl:with-param name="qualifiedName" select="$qualifiedType" />
    </xsl:call-template>
    <xsl:text>}},</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}}</xsl:text>

    <!-- PATCH -->
    <xsl:text>,"patch":{</xsl:text>
    <xsl:text>"summary":"Update </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","tags":["</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"]</xsl:text>
    <xsl:text>,"parameters":[</xsl:text>
    <xsl:text>{"name":"</xsl:text>
    <xsl:value-of select="$type" />
    <xsl:text>","in":"body"</xsl:text>
    <xsl:call-template name="entityTypeDescription">
      <xsl:with-param name="namespace" select="$namespace" />
      <xsl:with-param name="type" select="$type" />
      <xsl:with-param name="default" select="'New property values'" />
    </xsl:call-template>
    <xsl:text>,"schema":{</xsl:text>
    <xsl:call-template name="schema-ref">
      <xsl:with-param name="qualifiedName" select="$qualifiedType" />
    </xsl:call-template>
    <xsl:text>}}],"responses":{"204":{"description":"Success"},</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}}</xsl:text>

    <xsl:text>}</xsl:text>

    <xsl:apply-templates
      select="//edm:Function[@IsBound='true' and (edm:Parameter[1]/@Type=$qualifiedType or edm:Parameter[1]/@Type=$aliasQualifiedType)]"
      mode="bound"
    >
      <xsl:with-param name="singleton" select="@Name" />
      <xsl:with-param name="namespace" select="$namespace" />
      <xsl:with-param name="type" select="$type" />
    </xsl:apply-templates>
    <xsl:apply-templates
      select="//edm:Action[@IsBound='true' and (edm:Parameter[1]/@Type=$qualifiedType or edm:Parameter[1]/@Type=$aliasQualifiedType)]"
      mode="bound"
    >
      <xsl:with-param name="singleton" select="@Name" />
      <xsl:with-param name="namespace" select="$namespace" />
      <xsl:with-param name="type" select="$type" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template name="entityTypeDescription">
    <xsl:param name="namespace" />
    <xsl:param name="type" />
    <xsl:param name="default" />
    <xsl:text>,"description":"</xsl:text>
    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$description!=''">
        <xsl:value-of select="$description" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$default" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template match="edm:PropertyRef" mode="path">
    <xsl:variable name="name" select="@Name" />
    <xsl:variable name="type" select="../../edm:Property[@Name=$name]/@Type" />
    <!-- TODO: inheritance - find key definition in base type (recursively) -->
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:if test="last()>1">
      <xsl:value-of select="@Name" />
      <xsl:text>=</xsl:text>
    </xsl:if>
    <xsl:call-template name="pathValuePrefix">
      <xsl:with-param name="type" select="$type" />
    </xsl:call-template>
    <xsl:text>{</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>}</xsl:text>
    <xsl:call-template name="pathValueSuffix">
      <xsl:with-param name="type" select="$type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="pathValuePrefix">
    <xsl:param name="type" />
    <xsl:choose>
      <xsl:when
        test="$type='Edm.Int64' or $type='Edm.Int32' or $type='Edm.Int16' or $type='Edm.SByte' or $type='Edm.Byte' or $type='Edm.Double' or $type='Edm.Single' or $type='Edm.Date' or $type='Edm.DateTimeOffset' or $type='Edm.Guid'" />
      <!-- TODO: handle other Edm types, enumeration types, and type definitions -->
      <xsl:otherwise>
        <xsl:text>'</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="pathValueSuffix">
    <xsl:param name="type" />
    <xsl:choose>
      <xsl:when
        test="$type='Edm.Int64' or $type='Edm.Int32' or $type='Edm.Int16' or $type='Edm.SByte' or $type='Edm.Byte' or $type='Edm.Double' or $type='Edm.Single' or $type='Edm.Date' or $type='Edm.DateTimeOffset' or $type='Edm.Guid'" />
      <!-- TODO: handle other Edm types, enumeration types, and type definitions -->
      <xsl:otherwise>
        <xsl:text>'</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:PropertyRef" mode="parameter">
    <xsl:variable name="name" select="@Name" />
    <xsl:variable name="type" select="../../edm:Property[@Name=$name]/@Type" />
    <!-- TODO: inheritance - find key definition in base type (recursively) -->
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"name":"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","in":"path","required":true,"description":"key: </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","type":</xsl:text>
    <xsl:choose>
      <xsl:when test="$type='Edm.Int64'">
        <xsl:text>"integer","format":"int64"</xsl:text>
      </xsl:when>
      <xsl:when test="$type='Edm.Int32'">
        <xsl:text>"integer","format":"int32"</xsl:text>
      </xsl:when>
      <!-- TODO: handle other Edm types, enumeration types, and type definitions -->
      <xsl:otherwise>
        <xsl:text>"string"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:ActionImport">
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="@Action" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="namespace">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Alias=$qualifier]">
          <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$qualifier" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="action">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@Action" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:text>"/</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{"post":{"summary":"</xsl:text>
    <xsl:variable name="summary"
      select="edm:Annotation[@Term=$commonLabel or @Term=$commonLabelAliased]/@String|//edm:Schema/edm:Annotation[@Term=$commonLabel or @Term=$commonLabelAliased]/edm:String" />
    <xsl:choose>
      <xsl:when test="$summary">
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="$summary" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>Invoke action </xsl:text>
        <xsl:value-of select="@Name" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>","tags":["</xsl:text>
    <xsl:variable name="action-for" select="edm:Annotation[@Term='SAP.ActionFor']/@String" />
    <xsl:choose>
      <xsl:when test="@EntitySet">
        <xsl:value-of select="@EntitySet" />
      </xsl:when>
      <xsl:when test="$action-for">
        <xsl:value-of select="//edm:EntitySet[@EntityType=$action-for]/@Name" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>Service Operations</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"],"parameters":[</xsl:text>
    <xsl:variable name="parameters"
      select="//edm:Schema[@Namespace=$namespace]/edm:Action[@Name=$action and not(@IsBound='true')]/edm:Parameter" />
    <xsl:if test="$parameters">
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:apply-templates select="$parameters" mode="parameter" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>{"name":"body","in":"body","description":"Action parameters","schema":{"type":"object"</xsl:text>
          <xsl:apply-templates select="$parameters" mode="hash">
            <xsl:with-param name="name" select="'properties'" />
          </xsl:apply-templates>
          <xsl:text>}}</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
    <xsl:text>]</xsl:text>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="//edm:Schema[@Namespace=$namespace]/edm:Action[@Name=$action]/edm:ReturnType/@Type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edm:FunctionImport">
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="@Function" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="namespace">
      <xsl:choose>
        <xsl:when test="//edm:Schema[@Alias=$qualifier]">
          <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$qualifier" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="function">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@Function" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>

    <!-- need to apply templates for all function overloads that match the function name -->
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:Function[@Name=$function]" mode="import">
      <xsl:with-param name="functionImport" select="@Name" />
      <xsl:with-param name="entitySet" select="@EntitySet" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="edm:Function" mode="import">
    <xsl:param name="functionImport" />
    <xsl:param name="entitySet" />

    <xsl:text>"/</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:if test="$odata-version!='2.0'">
      <xsl:text>(</xsl:text>
      <xsl:apply-templates select="edm:Parameter" mode="path" />
      <xsl:text>)</xsl:text>
    </xsl:if>
    <xsl:text>":{"get":{"summary":"</xsl:text>
    <xsl:variable name="summary"
      select="edm:Annotation[@Term=$commonLabel or @Term=$commonLabelAliased]/@String|//edm:Schema/edm:Annotation[@Term=$commonLabel or @Term=$commonLabelAliased]/edm:String" />
    <xsl:choose>
      <xsl:when test="$summary">
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="$summary" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>Invoke function </xsl:text>
        <xsl:value-of select="@Name" />
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>","tags":["</xsl:text>
    <xsl:variable name="action-for" select="edm:Annotation[@Term='SAP.ActionFor']/@String" />
    <xsl:choose>
      <xsl:when test="$entitySet">
        <xsl:value-of select="$entitySet" />
      </xsl:when>
      <xsl:when test="$action-for">
        <xsl:value-of select="//edm:EntitySet[@EntityType=$action-for]/@Name" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>Service Operations</xsl:text>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>"],"parameters":[</xsl:text>
    <xsl:apply-templates select="edm:Parameter" mode="parameter" />
    <xsl:text>]</xsl:text>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="edm:ReturnType/@Type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="responses">
    <xsl:param name="type" />

    <xsl:variable name="collection" select="starts-with($type,'Collection(')" />

    <xsl:text>,"responses":{</xsl:text>
    <xsl:choose>
      <xsl:when test="not($type)">
        <xsl:text>"204":{"description":"Success"}</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"200":{"description":"Success","schema":{</xsl:text>
        <xsl:if test="$collection or $odata-version='2.0'">
          <xsl:text>"title":"Result","type":"object","properties":{"</xsl:text>
          <xsl:choose>
            <xsl:when test="$odata-version='2.0'">
              <xsl:text>d</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>value</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>":{</xsl:text>
        </xsl:if>
        <xsl:call-template name="type">
          <xsl:with-param name="type" select="$type" />
          <xsl:with-param name="nullableFacet" select="'false'" />
        </xsl:call-template>
        <xsl:if test="$collection or $odata-version='2.0'">
          <xsl:text>}}</xsl:text>
        </xsl:if>
        <xsl:text>}}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>,</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}}}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Action" mode="bound">
    <xsl:param name="entitySet" />
    <xsl:param name="singleton" />
    <xsl:param name="namespace" />
    <xsl:param name="type" />

    <xsl:text>,"/</xsl:text>
    <xsl:choose>
      <xsl:when test="$entitySet">
        <xsl:value-of select="$entitySet" />
        <xsl:text>(</xsl:text>
        <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef"
          mode="path" />
        <xsl:text>)</xsl:text>
      </xsl:when>
      <xsl:when test="$singleton">
        <xsl:value-of select="$singleton" />
      </xsl:when>
    </xsl:choose>
    <xsl:text>/</xsl:text>
    <xsl:choose>
      <xsl:when test="../@Alias">
        <xsl:value-of select="../@Alias" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="../@Namespace" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{"post":{"summary":"Invoke action </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","tags":["</xsl:text>
    <xsl:value-of select="$entitySet" />
    <xsl:value-of select="$singleton" />
    <xsl:text>"],"parameters":[</xsl:text>
    <xsl:if test="$entitySet">
      <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef"
        mode="parameter" />
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"name":"body","in":"body","description":"Action parameters","schema":{"type":"object"</xsl:text>
    <xsl:apply-templates select="edm:Parameter[position()>1]" mode="hash">
      <xsl:with-param name="name" select="'properties'" />
    </xsl:apply-templates>
    <xsl:text>}}]</xsl:text>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="edm:ReturnType/@Type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edm:Function" mode="bound">
    <xsl:param name="entitySet" />
    <xsl:param name="singleton" />
    <xsl:param name="namespace" />
    <xsl:param name="type" />
    <xsl:variable name="singleReturnType">
      <xsl:choose>
        <xsl:when test="starts-with(edm:ReturnType/@Type,'Collection(')">
          <xsl:value-of select="substring-before(substring-after(edm:ReturnType/@Type,'('),')')" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="edm:ReturnType/@Type" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <xsl:text>,"/</xsl:text>
    <xsl:choose>
      <xsl:when test="$entitySet">
        <xsl:value-of select="$entitySet" />
        <xsl:text>(</xsl:text>
        <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef"
          mode="path" />
        <xsl:text>)</xsl:text>
      </xsl:when>
      <xsl:when test="$singleton">
        <xsl:value-of select="$singleton" />
      </xsl:when>
    </xsl:choose>
    <xsl:text>/</xsl:text>
    <xsl:choose>
      <xsl:when test="../@Alias">
        <xsl:value-of select="../@Alias" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="../@Namespace" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>(</xsl:text>
    <xsl:apply-templates select="edm:Parameter[position()>1]" mode="path" />
    <xsl:text>)":{"get":{"summary":"Invoke function </xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","tags":["</xsl:text>
    <xsl:value-of select="$entitySet" />
    <xsl:value-of select="$singleton" />
    <xsl:text>"],"parameters":[</xsl:text>
    <xsl:apply-templates
      select="//edm:Schema[@Namespace=$namespace and $entitySet]/edm:EntityType[@Name=$type]/edm:Key/edm:PropertyRef|edm:Parameter[position()>1]"
      mode="parameter" />
    <xsl:text>]</xsl:text>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="edm:ReturnType/@Type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edm:Action/edm:Parameter" mode="hashvalue">
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edm:Action/edm:Parameter|edm:Function/edm:Parameter" mode="parameter">
    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"name":"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:choose>
      <xsl:when test="$odata-version='2.0'">
        <xsl:text>","in":"query"</xsl:text>
        <xsl:if test="@Nullable='false'">
          <xsl:text>,"required":true</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>","in":"path"</xsl:text>
        <xsl:text>,"required":true</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>,</xsl:text>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
      <xsl:with-param name="noArray" select="true()" />
    </xsl:call-template>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Parameter/@MaxLength">
    <xsl:if test=".!='max'">
      <xsl:text>,"maxLength":</xsl:text>
      <xsl:value-of select="." />
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Function/edm:Parameter" mode="path">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:value-of select="@Name" />
    <xsl:text>=</xsl:text>
    <xsl:call-template name="pathValueSuffix">
      <xsl:with-param name="type" select="@Type" />
    </xsl:call-template>
    <xsl:text>{</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>}</xsl:text>
    <xsl:call-template name="pathValueSuffix">
      <xsl:with-param name="type" select="@Type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="title-description">
    <xsl:param name="fallback-title" select="null" />

    <xsl:variable name="title">
      <xsl:call-template name="Common.Label">
        <xsl:with-param name="node" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$title!=''">
        <xsl:text>,"title":"</xsl:text>
        <xsl:value-of select="$title" />
        <xsl:text>"</xsl:text>
      </xsl:when>
      <xsl:when test="$fallback-title">
        <xsl:text>,"title":"</xsl:text>
        <xsl:value-of select="$fallback-title" />
        <xsl:text>"</xsl:text>
      </xsl:when>
    </xsl:choose>

    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="$description!=''">
      <xsl:text>,"description":"</xsl:text>
      <xsl:value-of select="$description" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="escape">
    <xsl:param name="string" />
    <xsl:choose>
      <xsl:when test="contains($string,'&quot;')">
        <xsl:call-template name="replace">
          <xsl:with-param name="string" select="$string" />
          <xsl:with-param name="old" select="'&quot;'" />
          <xsl:with-param name="new" select="'\&quot;'" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="contains($string,'\')">
        <xsl:call-template name="replace">
          <xsl:with-param name="string" select="$string" />
          <xsl:with-param name="old" select="'\'" />
          <xsl:with-param name="new" select="'\\'" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="contains($string,'&#x0A;')">
        <xsl:call-template name="replace">
          <xsl:with-param name="string" select="$string" />
          <xsl:with-param name="old" select="'&#x0A;'" />
          <xsl:with-param name="new" select="'\n'" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="contains($string,'&#x0D;')">
        <xsl:call-template name="replace">
          <xsl:with-param name="string" select="$string" />
          <xsl:with-param name="old" select="'&#x0D;'" />
          <xsl:with-param name="new" select="'\r'" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="contains($string,'&#x09;')">
        <xsl:call-template name="replace">
          <xsl:with-param name="string" select="$string" />
          <xsl:with-param name="old" select="'&#x09;'" />
          <xsl:with-param name="new" select="'\t'" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$string" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="replace">
    <xsl:param name="string" />
    <xsl:param name="old" />
    <xsl:param name="new" />
    <xsl:call-template name="escape">
      <xsl:with-param name="string" select="substring-before($string,$old)" />
    </xsl:call-template>
    <xsl:value-of select="$new" />
    <xsl:call-template name="escape">
      <xsl:with-param name="string" select="substring-after($string,$old)" />
    </xsl:call-template>
  </xsl:template>

  <!-- name : object -->
  <xsl:template match="@*|*" mode="object">
    <xsl:param name="name" />
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>"</xsl:text>
      <xsl:value-of select="$name" />
      <xsl:text>":{</xsl:text>
    </xsl:if>
    <xsl:apply-templates select="." />
    <xsl:if test="position()!=last()">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:if test="position()=last()">
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <!-- object within array -->
  <xsl:template match="*" mode="item">
    <xsl:text>{</xsl:text>
    <xsl:apply-templates select="@*|node()" mode="list" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <!-- pluralize(name) : hash -->
  <xsl:template match="*" mode="hash">
    <xsl:param name="name" />
    <xsl:param name="key" select="'Name'" />
    <xsl:param name="after" select="'something'" />
    <xsl:param name="constantProperties" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>"</xsl:text>
      <xsl:value-of select="$name" />
      <xsl:text>":{</xsl:text>
    </xsl:if>
    <xsl:apply-templates select="." mode="hashpair">
      <xsl:with-param name="name" select="$name" />
      <xsl:with-param name="key" select="$key" />
    </xsl:apply-templates>
    <xsl:if test="position()!=last()">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:if test="position()=last()">
      <xsl:value-of select="$constantProperties" />
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="*" mode="hashpair">
    <xsl:param name="name" />
    <xsl:param name="key" select="'Name'" />
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@*[local-name()=$key]" />
    <xsl:text>":{</xsl:text>
    <xsl:apply-templates select="." mode="hashvalue">
      <xsl:with-param name="name" select="$name" />
      <xsl:with-param name="key" select="$key" />
    </xsl:apply-templates>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="*" mode="hashvalue">
    <xsl:param name="key" select="'Name'" />
    <xsl:apply-templates select="@*[local-name()!=$key]|node()" mode="list" />
  </xsl:template>

  <!-- comma-separated list -->
  <xsl:template match="@*|*" mode="list">
    <xsl:param name="target" />
    <xsl:param name="qualifier" />
    <xsl:param name="after" />
    <xsl:choose>
      <xsl:when test="position() > 1">
        <xsl:text>,</xsl:text>
      </xsl:when>
      <xsl:when test="$after">
        <xsl:text>,</xsl:text>
      </xsl:when>
    </xsl:choose>
    <xsl:apply-templates select=".">
      <xsl:with-param name="target" select="$target" />
      <xsl:with-param name="qualifier" select="$qualifier" />
    </xsl:apply-templates>
  </xsl:template>

  <!-- continuation of comma-separated list -->
  <xsl:template match="@*|*" mode="list2">
    <xsl:param name="target" />
    <xsl:param name="qualifier" />
    <xsl:text>,</xsl:text>
    <xsl:apply-templates select=".">
      <xsl:with-param name="target" select="$target" />
      <xsl:with-param name="qualifier" select="$qualifier" />
    </xsl:apply-templates>
  </xsl:template>

  <!-- leftover attributes -->
  <xsl:template match="@*">
    <xsl:text>"TODO:@</xsl:text>
    <xsl:value-of select="local-name()" />
    <xsl:text>":"</xsl:text>
    <xsl:value-of select="." />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <!-- leftover elements -->
  <xsl:template match="*">
    <xsl:text>"TODO:</xsl:text>
    <xsl:value-of select="local-name()" />
    <xsl:text>":{</xsl:text>
    <xsl:apply-templates select="@*|node()" mode="list" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <!-- leftover text -->
  <xsl:template match="text()">
    <xsl:text>"TODO:text()":"</xsl:text>
    <xsl:value-of select="." />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <!-- helper functions -->
  <xsl:template name="substring-before-last">
    <xsl:param name="input" />
    <xsl:param name="marker" />
    <xsl:if test="contains($input,$marker)">
      <xsl:value-of select="substring-before($input,$marker)" />
      <xsl:if test="contains(substring-after($input,$marker),$marker)">
        <xsl:value-of select="$marker" />
        <xsl:call-template name="substring-before-last">
          <xsl:with-param name="input" select="substring-after($input,$marker)" />
          <xsl:with-param name="marker" select="$marker" />
        </xsl:call-template>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template name="substring-after-last">
    <xsl:param name="input" />
    <xsl:param name="marker" />
    <xsl:choose>
      <xsl:when test="contains($input,$marker)">
        <xsl:call-template name="substring-after-last">
          <xsl:with-param name="input" select="substring-after($input,$marker)" />
          <xsl:with-param name="marker" select="$marker" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$input" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="replace-all">
    <xsl:param name="string" />
    <xsl:param name="old" />
    <xsl:param name="new" />
    <xsl:choose>
      <xsl:when test="contains($string,$old)">
        <xsl:value-of select="substring-before($string,$old)" />
        <xsl:value-of select="$new" />
        <xsl:call-template name="replace-all">
          <xsl:with-param name="string" select="substring-after($string,$old)" />
          <xsl:with-param name="old" select="$old" />
          <xsl:with-param name="new" select="$new" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$string" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="json-url">
    <xsl:param name="url" />
    <xsl:variable name="jsonUrl">
      <xsl:choose>
        <xsl:when test="substring($url,string-length($url)-3) = '.xml'">
          <xsl:choose>
            <xsl:when test="substring($url,1,33) = 'http://docs.oasis-open.org/odata/'">
              <xsl:value-of select="$vocabulary-home" />
              <xsl:text>/</xsl:text>
              <xsl:variable name="filename">
                <xsl:call-template name="substring-after-last">
                  <xsl:with-param name="input" select="$url" />
                  <xsl:with-param name="marker" select="'/'" />
                </xsl:call-template>
              </xsl:variable>
              <xsl:value-of select="substring($filename,1,string-length($filename)-4)" />
              <xsl:value-of select="'.openapi.json'" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="substring($url,1,string-length($url)-4)" />
              <xsl:value-of select="'.openapi.json'" />
            </xsl:otherwise>
          </xsl:choose>
        </xsl:when>
        <xsl:when test="string-length($url) = 0">
          <xsl:value-of select="$url" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$url" />
          <xsl:value-of select="$openapi-formatoption" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="substring($jsonUrl,1,1) = '/'">
        <xsl:value-of select="$scheme" />
        <xsl:text>://</xsl:text>
        <xsl:value-of select="$host" />
        <xsl:value-of select="$jsonUrl" />
      </xsl:when>
      <xsl:when test="substring($jsonUrl,1,3) = '../'">
        <xsl:value-of select="$scheme" />
        <xsl:text>://</xsl:text>
        <xsl:value-of select="$host" />
        <xsl:value-of select="$basePath" />
        <xsl:text>/</xsl:text>
        <xsl:value-of select="$jsonUrl" />
      </xsl:when>
      <!-- TODO: more rules for recognizing relative URLs and doing the needful -->
      <xsl:otherwise>
        <xsl:value-of select="$jsonUrl" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>