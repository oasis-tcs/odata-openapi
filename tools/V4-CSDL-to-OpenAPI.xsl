<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
  xmlns:edm="http://docs.oasis-open.org/odata/ns/edm" xmlns:json="http://json.org/"
>
  <!--
    This style sheet transforms OData 4.0 XML CSDL documents into OpenAPI 2.0 JSON

    Latest version: https://tools.oasis-open.org/version-control/browse/wsvn/odata/trunk/spec/examples/V4-CSDL-to-OpenAPI.xsl

    TODO:
    - Validation annotations -> pattern, minimum, maximum, exclusiveM??imum, see https://issues.oasis-open.org/browse/ODATA-856,
    inline and explace style
    - annotations within edm:UrlRef, with string value and expression value of edm:UrlRef
    - complex or collection-valued function parameters need special treatment in /paths - use parameter aliases with alias
    option of type string
    - @Extends for entity container: include /paths from referenced container
    - annotations without explicit value: default from term definition (if inline)
    - links to referenced files relative to current Swagger UI?
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
  <xsl:param name="odata-schema" select="'https://raw.githubusercontent.com/ralfhandl/odata/master/edm.json'" />
  <xsl:param name="odata-version" select="'4.0'" />
  <xsl:param name="vocabulary-home" select="'http://localhost/examples'" />
  <xsl:param name="swagger-ui" select="'http://localhost/swagger-ui'" />
  <xsl:param name="diagram" select="null" />
  <xsl:param name="extensions" select="null" />
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

  <xsl:key name="methods" match="edmx:Edmx/edmx:DataServices/edm:Schema/edm:Action|edmx:Edmx/edmx:DataServices/edm:Schema/edm:Function"
    use="concat(../@Namespace,'.',@Name)" />
  <xsl:key name="targets" match="edmx:Edmx/edmx:DataServices/edm:Schema/edm:Annotations" use="concat(../@Namespace,'/',@Target)" />
  <xsl:key name="includeannotations" match="edmx:Edmx/edmx:Reference/edmx:IncludeAnnotations" use="concat(../@Uri,'|',@TermNamespace)" />


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
    <xsl:if test="$extensions">
      <xsl:text>"x-odata-version":"</xsl:text>
      <xsl:value-of select="$odata-version" />
      <xsl:text>",</xsl:text>
    </xsl:if>
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
    <xsl:apply-templates select="//edm:Term" mode="description" />
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

    <xsl:if test="$extensions">
      <xsl:apply-templates select="//edm:Schema|edmx:Reference/edmx:Include" mode="hash">
        <xsl:with-param name="key" select="'Namespace'" />
        <xsl:with-param name="name" select="'x-schemas'" />
      </xsl:apply-templates>

      <xsl:apply-templates select="//edm:Action[generate-id() = generate-id(key('methods', concat(../@Namespace,'.',@Name))[1])]"
        mode="hash"
      >
        <xsl:with-param name="name" select="'x-actions'" />
      </xsl:apply-templates>

      <xsl:apply-templates select="//edm:Function[generate-id() = generate-id(key('methods', concat(../@Namespace,'.',@Name))[1])]"
        mode="hash"
      >
        <xsl:with-param name="name" select="'x-functions'" />
      </xsl:apply-templates>

      <xsl:apply-templates select="//edm:Term" mode="hash">
        <xsl:with-param name="name" select="'x-terms'" />
      </xsl:apply-templates>

      <xsl:apply-templates select="//edm:EntityContainer" />

      <xsl:apply-templates select="edmx:Reference[edmx:IncludeAnnotations|edm:Annotation]" mode="hash">
        <xsl:with-param name="name" select="'x-references'" />
        <xsl:with-param name="key" select="'Uri'" />
      </xsl:apply-templates>
    </xsl:if>

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
    <xsl:text>)</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Term" mode="description">
    <xsl:if test="position() = 1">
      <xsl:text>\n\n## Term Definitions\nTerm|Description\n----|----</xsl:text>
    </xsl:if>
    <xsl:text>\n</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:text>|</xsl:text>
    <xsl:if test="$description!=''">
      <xsl:call-template name="replace-all">
        <xsl:with-param name="string" select="$description" />
        <xsl:with-param name="old" select="'|'" />
        <!-- Should actually be '\|' but Swagger tools don't recognize this GFM escape sequence.
          '&amp;#x7c;' works in Swagger Editor but not in Swagger UI -->
        <xsl:with-param name="new" select="'&amp;#x2758;'" />
      </xsl:call-template>
    </xsl:if>
  </xsl:template>


  <xsl:template match="edmx:Reference" mode="hashvalue">
    <xsl:apply-templates select="@*[local-name()!='Uri']" />
    <xsl:apply-templates
      select="edmx:IncludeAnnotations[generate-id() = generate-id(key('includeannotations', concat(../@Uri,'|',@TermNamespace))[1])]"
      mode="hash"
    >
      <xsl:with-param name="after" />
      <xsl:with-param name="key" select="'TermNamespace'" />
    </xsl:apply-templates>
    <xsl:apply-templates select="edm:Annotation" mode="list">
      <xsl:with-param name="after" select="edmx:IncludeAnnotations" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="edmx:IncludeAnnotations" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@TermNamespace" />
    <xsl:text>":[</xsl:text>
    <xsl:for-each select="key('includeannotations', concat(../@Uri,'|',@TermNamespace))">
      <xsl:if test="position()>1">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{</xsl:text>
      <xsl:apply-templates select="@*[name()!='TermNamespace']" mode="list" />
      <xsl:text>}</xsl:text>
    </xsl:for-each>
    <xsl:text>]</xsl:text>
  </xsl:template>

  <xsl:template match="edmx:Include" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Namespace" />
    <xsl:text>":{"uri":"</xsl:text>
    <xsl:call-template name="json-url">
      <xsl:with-param name="url" select="../@Uri" />
    </xsl:call-template>
    <xsl:text>"</xsl:text>
    <xsl:apply-templates select="edm:Annotation" mode="list2" />
    <xsl:text>}</xsl:text>
    <xsl:if test="@Alias">
      <xsl:text>,"</xsl:text>
      <xsl:value-of select="@Alias" />
      <xsl:text>":{"aliasFor":"</xsl:text>
      <xsl:value-of select="@Namespace" />
      <xsl:text>"}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Schema" mode="hashpair">
    <xsl:if test="@Alias">
      <xsl:text>"</xsl:text>
      <xsl:value-of select="@Alias" />
      <xsl:text>":{"aliasFor":"</xsl:text>
      <xsl:value-of select="@Namespace" />
      <xsl:text>"},</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Namespace" />
    <xsl:text>":{</xsl:text>
    <xsl:apply-templates select="edm:Annotation" mode="list" />
    <xsl:apply-templates select="edm:Annotations[generate-id() = generate-id(key('targets', concat(../@Namespace,'/',@Target))[1])]"
      mode="hash"
    >
      <xsl:with-param name="key" select="'Target'" />
      <xsl:with-param name="after" select="edm:Annotation" />
    </xsl:apply-templates>
    <xsl:text>}</xsl:text>
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
    <xsl:if test="@IsFlags='true' and $extensions">
      <xsl:text>,"x-isFlags":true</xsl:text>
    </xsl:if>
    <xsl:call-template name="x-annotations">
      <xsl:with-param name="annotations" select="edm:Annotation" />
      <xsl:with-param name="fallback-title" select="@Name" />
      <xsl:with-param name="members" select="edm:Member/@Value|edm:Member/edm:Annotation" />
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

  <xsl:template match="edm:Member/@Value" mode="member">
    <xsl:param name="after" />
    <xsl:choose>
      <xsl:when test="position() > 1">
        <xsl:text>,</xsl:text>
      </xsl:when>
      <xsl:when test="$after">
        <xsl:text>,</xsl:text>
      </xsl:when>
    </xsl:choose>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="../@Name" />
    <xsl:text>@value":</xsl:text>
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="edm:Member/edm:Annotation" mode="member">
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
      <xsl:with-param name="target" select="../@Name" />
    </xsl:apply-templates>
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
    <xsl:call-template name="x-annotations">
      <xsl:with-param name="annotations" select="edm:Annotation" />
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
      <xsl:if test="$extensions">
        <xsl:text>"x-baseType":"</xsl:text>
        <xsl:call-template name="namespaceQualifiedName">
          <xsl:with-param name="qualifiedName" select="@BaseType" />
        </xsl:call-template>
        <xsl:text>",</xsl:text>
      </xsl:if>
      <xsl:text>"allOf":[{</xsl:text>
      <xsl:call-template name="schema-ref">
        <xsl:with-param name="qualifiedName" select="@BaseType" />
      </xsl:call-template>
      <xsl:text>},{</xsl:text>
    </xsl:if>

    <xsl:text>"type":"object"</xsl:text>

    <xsl:if test="@Abstract='true' and $extensions">
      <xsl:text>,"x-abstract":true</xsl:text>
      <xsl:if test="local-name()='EntityType' and not(edm:Key)">
        <xsl:text>,"x-keys":[]</xsl:text>
      </xsl:if>
    </xsl:if>

    <xsl:if test="@HasStream='true' and $extensions">
      <xsl:text>,"x-mediaEntity":true</xsl:text>
    </xsl:if>

    <xsl:if test="$extensions">
      <xsl:apply-templates select="@OpenType|edm:Key" mode="list2" />
    </xsl:if>

    <xsl:apply-templates select="edm:Property|edm:NavigationProperty" mode="hash">
      <xsl:with-param name="name" select="'properties'" />
    </xsl:apply-templates>

    <xsl:call-template name="x-annotations">
      <xsl:with-param name="annotations" select="edm:Annotation" />
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
        <xsl:if test="$extensions">
          <xsl:apply-templates select="@Unicode" mode="list2" />
        </xsl:if>
        <xsl:apply-templates select="*[local-name()!='Annotation']" mode="list2" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:if test="$extensions">
          <xsl:text>,"x-relationship":{</xsl:text>
          <xsl:apply-templates
            select="@*[local-name()!='Name' and local-name()!='Type' and local-name()!='Nullable']|node()[local-name()!='ReferentialConstraint' and local-name()!='Annotation']"
            mode="list" />
          <xsl:apply-templates select="edm:ReferentialConstraint" mode="hash">
            <xsl:with-param name="after"
              select="@*[local-name()!='Name' and local-name()!='Type' and local-name()!='Nullable']|node()[local-name()!='ReferentialConstraint' and local-name()!='Annotation']" />
            <xsl:with-param name="key" select="'Property'" />
          </xsl:apply-templates>
          <xsl:text>}</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:call-template name="x-annotations">
      <xsl:with-param name="annotations" select="edm:Annotation" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edm:Term" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="../@Namespace" />
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{</xsl:text>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
    </xsl:call-template>
    <xsl:apply-templates select="@AppliesTo|@BaseTerm|edm:Annotation" mode="list2" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="@AppliesTo">
    <!-- TODO: lower-case values? -->
    <xsl:text>"appliesTo":</xsl:text>
    <xsl:variable name="appliesTo" select="normalize-space()" />
    <xsl:choose>
      <xsl:when test="contains($appliesTo,' ')">
        <xsl:text>["</xsl:text>
        <xsl:call-template name="replace-all">
          <xsl:with-param name="string" select="$appliesTo" />
          <xsl:with-param name="old" select="' '" />
          <xsl:with-param name="new" select="'&quot;,&quot;'" />
        </xsl:call-template>
        <xsl:text>"]</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"</xsl:text>
        <xsl:value-of select="." />
        <xsl:text>"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="@BaseTerm">
    <xsl:text>"baseTerm":"</xsl:text>
    <xsl:call-template name="namespaceQualifiedName">
      <xsl:with-param name="qualifiedName" select="." />
    </xsl:call-template>
    <xsl:text>"</xsl:text>
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
        <xsl:apply-templates select="@MaxLength">
          <xsl:with-param name="byteLength" select="'yes'" />
        </xsl:apply-templates>
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
        <xsl:if test="$extensions">
          <xsl:apply-templates select="@Precision|@Scale[.!=0]" mode="list2" />
        </xsl:if>
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
        <xsl:if test="$extensions">
          <xsl:apply-templates select="@Precision" mode="list2" />
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.TimeOfDay'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"time"</xsl:text>
        <xsl:if test="$extensions">
          <xsl:apply-templates select="@Precision" mode="list2" />
        </xsl:if>
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
        <xsl:if test="not($nullable='false') and $extensions">
          <xsl:text>,"x-nullable":true</xsl:text>
        </xsl:if>
        <xsl:if test="$extensions">
          <xsl:apply-templates select="@SRID" mode="list2" />
        </xsl:if>
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
        <xsl:if test="not($nullable='false') and $extensions">
          <xsl:text>,"x-nullable":true</xsl:text>
        </xsl:if>
        <xsl:apply-templates select="@MaxLength" />
        <xsl:if test="$extensions">
          <xsl:apply-templates select="@Precision" mode="list2" />
        </xsl:if>
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
    <xsl:if test="not($nullable='false') and $extensions">
      <xsl:text>,"x-nullable":true</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@MaxLength">
    <xsl:param name="byteLength" />
    <xsl:if test=".!='max'">
      <xsl:text>,"maxLength":</xsl:text>
      <xsl:if test="$byteLength and $extensions">
        <xsl:value-of select="4*ceiling(. div 3)" />
        <xsl:text>,"x-byteLength":</xsl:text>
      </xsl:if>
      <xsl:value-of select="." />
    </xsl:if>
  </xsl:template>

  <xsl:template match="@Precision">
    <xsl:text>"x-precision":</xsl:text>
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="@Scale">
    <xsl:text>"x-scale":</xsl:text>
    <xsl:choose>
      <xsl:when test=".='variable'">
        <xsl:text>"variable"</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="." />
      </xsl:otherwise>
    </xsl:choose>
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

  <!-- name : unquoted boolean value -->
  <xsl:template match="@Nullable|@OpenType|@Unicode">
    <xsl:text>"x-</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":</xsl:text>
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="@ContainsTarget|@IsBound|@IsComposable|@IncludeInServiceDocument">
    <xsl:text>"</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":</xsl:text>
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="edm:Key">
    <xsl:text>"x-keys":[</xsl:text>
    <xsl:apply-templates select="edm:PropertyRef" mode="list" />
    <xsl:text>]</xsl:text>
  </xsl:template>

  <xsl:template match="edm:PropertyRef">
    <xsl:choose>
      <xsl:when test="@Alias">
        <xsl:text>{"</xsl:text>
        <xsl:value-of select="@Alias" />
        <xsl:text>":"</xsl:text>
        <xsl:value-of select="@Name" />
        <xsl:text>"}</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"</xsl:text>
        <xsl:value-of select="@Name" />
        <xsl:text>"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:ReferentialConstraint" mode="item">
    <xsl:text>{</xsl:text>
    <xsl:apply-templates select="@*|node()" mode="list" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Action|edm:Function" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="../@Namespace" />
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":[</xsl:text>
    <xsl:for-each select="key('methods', concat(../@Namespace,'.',@Name))">
      <xsl:if test="position()>1">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{</xsl:text>
      <xsl:text>"parameters":[</xsl:text>
      <xsl:apply-templates select="edm:Parameter" mode="list" />
      <xsl:text>]</xsl:text>
      <xsl:apply-templates select="edm:ReturnType" mode="list2" />
      <xsl:apply-templates select="@*[local-name()!='Name']" mode="list2" />
      <xsl:apply-templates select="edm:Annotation" mode="list2" />
      <xsl:text>}</xsl:text>
    </xsl:for-each>
    <xsl:text>]</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Parameter">
    <xsl:text>{</xsl:text>
    <xsl:apply-templates select="@Name" />
    <xsl:text>,"parameterType":{</xsl:text>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
    </xsl:call-template>
    <xsl:text>}</xsl:text>
    <xsl:apply-templates select="edm:Annotation" mode="list2" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:ReturnType">
    <xsl:text>"returnType":{</xsl:text>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
    </xsl:call-template>
    <xsl:apply-templates select="edm:Annotation" mode="list2" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EntityContainer">
    <xsl:if test="$extensions">
      <xsl:text>,"x-entityContainer":{</xsl:text>
      <xsl:apply-templates select="@*" mode="list" />
      <xsl:apply-templates select="edm:EntitySet|edm:Singleton|edm:ActionImport|edm:FunctionImport" mode="hash">
        <xsl:with-param name="name" select="'resources'" />
      </xsl:apply-templates>
      <xsl:apply-templates select="edm:Annotation" mode="list2" />
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:EntitySet|edm:Singleton" mode="hashvalue">
    <xsl:text>"kind":"</xsl:text>
    <xsl:value-of select="local-name()" />
    <xsl:text>"</xsl:text>
    <xsl:apply-templates select="@*[local-name()!='Name']" mode="list2" />
    <xsl:apply-templates select="edm:NavigationPropertyBinding" mode="hash">
      <xsl:with-param name="key" select="'Path'" />
    </xsl:apply-templates>
    <xsl:apply-templates select="edm:Annotation" mode="list2" />
  </xsl:template>

  <xsl:template match="edm:NavigationPropertyBinding" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Path" />
    <xsl:text>":"</xsl:text>
    <xsl:value-of select="@Target" />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template match="edm:ActionImport|edm:FunctionImport" mode="hashvalue">
    <xsl:text>"kind":"</xsl:text>
    <xsl:value-of select="local-name()" />
    <xsl:text>"</xsl:text>
    <xsl:apply-templates select="@*[local-name()!='Name']|node()" mode="list2" />
  </xsl:template>

  <xsl:template match="edm:EntitySet/@EntityType|edm:Singleton/@Type">
    <xsl:text>"</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":{</xsl:text>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="." />
      <xsl:with-param name="nullableFacet" select="'false'" />
    </xsl:call-template>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:ActionImport/@Action|edm:FunctionImport/@Function">
    <xsl:text>"</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":"</xsl:text>
    <xsl:call-template name="namespaceQualifiedName">
      <xsl:with-param name="qualifiedName" select="." />
    </xsl:call-template>
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template name="namespaceQualifiedName">
    <xsl:param name="qualifiedName" />
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$qualifiedName" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="//edm:Schema[@Alias=$qualifier]">
        <xsl:value-of select="//edm:Schema[@Alias=$qualifier]/@Namespace" />
      </xsl:when>
      <xsl:when test="//edmx:Include[@Alias=$qualifier]">
        <xsl:value-of select="//edmx:Include[@Alias=$qualifier]/@Namespace" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$qualifier" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>.</xsl:text>
    <xsl:call-template name="substring-after-last">
      <xsl:with-param name="input" select="$qualifiedName" />
      <xsl:with-param name="marker" select="'.'" />
    </xsl:call-template>
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

  <xsl:template match="edm:Annotations" mode="hashpair">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Target" />
    <xsl:text>":{</xsl:text>
    <xsl:for-each select="key('targets', concat(../@Namespace,'/',@Target))">
      <xsl:if test="position()>1">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:apply-templates select="*" mode="list">
        <xsl:with-param name="qualifier" select="@Qualifier" />
      </xsl:apply-templates>
    </xsl:for-each>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="x-annotations">
    <xsl:param name="annotations" />
    <xsl:param name="members" select="null" />
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

    <xsl:variable name="remaining"
      select="$annotations[not((@Term=$coreDescription or @Term=$coreDescriptionAliased or @Term=$commonLabel or @Term=$commonLabelAliased) and not(@Qualifier) and (@String or edm:String))]" />
    <xsl:if test="($remaining or $members) and $extensions">
      <xsl:text>,"x-annotations":{</xsl:text>
      <xsl:apply-templates select="$remaining" mode="list" />
      <xsl:if test="$members">
        <xsl:apply-templates select="$members" mode="member">
          <xsl:with-param name="after" select="$remaining" />
        </xsl:apply-templates>
      </xsl:if>
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Annotation">
    <xsl:param name="target" />
    <xsl:param name="qualifier" />
    <xsl:variable name="name">
      <xsl:value-of select="$target" />
      <xsl:text>@</xsl:text>
      <xsl:value-of select="@Term" />
      <xsl:if test="@Qualifier or $qualifier">
        <xsl:text>#</xsl:text>
        <xsl:value-of select="@Qualifier" />
        <xsl:value-of select="$qualifier" />
      </xsl:if>
    </xsl:variable>
    <xsl:choose>
      <!-- TODO: remove choice, just do xsl:otherwise; remove "normalize" parameter from @String|edm:String template -->
      <xsl:when test="(substring($name,2)=$coreDescription or substring($name,2)=$coreDescriptionAliased) and (@String or edm:String)">
        <xsl:text>"description":</xsl:text>
        <xsl:apply-templates select="@String|edm:String">
          <xsl:with-param name="normalize" select="true()" />
        </xsl:apply-templates>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"</xsl:text>
        <xsl:value-of select="$name" />
        <xsl:text>":</xsl:text>
        <xsl:apply-templates select="@*[local-name()!='Term' and local-name()!='Qualifier']|*[local-name()!='Annotation']"
          mode="list"
        >
          <xsl:with-param name="target" select="$name" />
        </xsl:apply-templates>
        <xsl:if test="count(@*[local-name()!='Term' and local-name()!='Qualifier']|*[local-name()!='Annotation'])=0">
          <!-- tagging term -->
          <!-- TODO: try to get default value from term definition, use true if not possible -->
          <xsl:text>true</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:apply-templates select="edm:Annotation" mode="list2">
      <xsl:with-param name="target" select="$name" />
    </xsl:apply-templates>
  </xsl:template>

  <!-- name : unquoted direct value or annotated quoted special value -->
  <xsl:template match="@Float|edm:Float">
    <xsl:choose>
      <xsl:when test=".='INF' or .='-INF' or .='NaN'">
        <xsl:text>"</xsl:text>
        <xsl:value-of select="." />
        <xsl:text>"</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="." />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- unquoted direct value -->
  <xsl:template match="@Bool|edm:Bool|@Decimal|edm:Decimal|@Int|edm:Int">
    <xsl:value-of select="." />
  </xsl:template>

  <!-- direct quoted value -->
  <xsl:template
    match="@Binary|edm:Binary|@Date|edm:Date|@DateTimeOffset|edm:DateTimeOffset|@Duration|edm:Duration|@Guid|edm:Guid|@TimeOfDay|edm:TimeOfDay"
  >
    <xsl:text>"</xsl:text>
    <xsl:value-of select="." />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template match="@EnumMember|edm:EnumMember">
    <xsl:variable name="type" select="substring-before(.,'/')" />
    <xsl:text>"</xsl:text>
    <xsl:call-template name="replace-all">
      <xsl:with-param name="string">
        <xsl:call-template name="replace-all">
          <xsl:with-param name="string" select="." />
          <xsl:with-param name="old" select="concat($type,'/')" />
          <xsl:with-param name="new" select="''" />
        </xsl:call-template>
      </xsl:with-param>
      <xsl:with-param name="old" select="' '" />
      <xsl:with-param name="new" select="','" />
    </xsl:call-template>
    <xsl:text>"</xsl:text>
  </xsl:template>

  <!-- name : object with escaped string value -->
  <xsl:template
    match="@AnnotationPath|edm:AnnotationPath|@NavigationPropertyPath|edm:NavigationPropertyPath|@Path|edm:Path|@PropertyPath|edm:PropertyPath|@UrlRef"
  >
    <xsl:text>{"@</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":"</xsl:text>
    <xsl:call-template name="escape">
      <xsl:with-param name="string" select="normalize-space(.)" />
    </xsl:call-template>
    <xsl:text>"}</xsl:text>
  </xsl:template>

  <!-- escaped string value -->
  <xsl:template match="@String|edm:String">
    <xsl:param name="normalize" select="false()" />
    <xsl:text>"</xsl:text>
    <xsl:choose>
      <xsl:when test="$normalize">
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="normalize-space(.)" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="." />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"</xsl:text>
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

  <xsl:template match="edm:Record">
    <xsl:text>{</xsl:text>
    <xsl:if test="@Type">
      <xsl:text>"@type":"#</xsl:text>
      <xsl:value-of select="@Type" />
      <xsl:text>"</xsl:text>
    </xsl:if>
    <xsl:apply-templates select="*" mode="list">
      <xsl:with-param name="after" select="@Type" />
    </xsl:apply-templates>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:PropertyValue">
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Property" />
    <xsl:text>":</xsl:text>
    <xsl:apply-templates select="@*[local-name()!='Property']|node()[local-name()!='Annotation']" />
    <xsl:apply-templates select="edm:Annotation" mode="list2">
      <xsl:with-param name="target" select="@Property" />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="edm:Collection">
    <xsl:text>[</xsl:text>
    <xsl:apply-templates select="node()" mode="list" />
    <xsl:text>]</xsl:text>
  </xsl:template>

  <xsl:template match="edm:If|edm:Eq|edm:Ne|edm:Ge|edm:Gt|edm:Le|edm:Lt|edm:And|edm:Or">
    <xsl:text>{"@</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":[</xsl:text>
    <xsl:apply-templates select="*[local-name()!='Annotation']" mode="list" />
    <xsl:text>]</xsl:text>
    <xsl:apply-templates select="edm:Annotation" mode="list2" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Apply">
    <xsl:text>{"@apply":"</xsl:text>
    <xsl:value-of select="@Function" />
    <xsl:text>","parameterValues":[</xsl:text>
    <xsl:apply-templates select="*[local-name()!='Annotation']" mode="list" />
    <xsl:text>]</xsl:text>
    <xsl:apply-templates select="edm:Annotation" mode="list2" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Cast|edm:IsOf">
    <xsl:text>{"@</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":"</xsl:text>
    <xsl:value-of select="@Type" />
    <xsl:text>"</xsl:text>
    <xsl:apply-templates select="@MaxLength" />
    <xsl:apply-templates select="@*[local-name()!='Type' and local-name()!='MaxLength']" mode="list2" />
    <xsl:text>,"value":</xsl:text>
    <xsl:apply-templates select="node()" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:LabeledElement">
    <xsl:text>{"@labeledElement":"</xsl:text>
    <xsl:value-of select="ancestor::edm:Schema/@Namespace" />
    <xsl:text>.</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>","value":</xsl:text>
    <xsl:apply-templates select="@*[local-name()!='Name']|node()" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:LabeledElementReference">
    <xsl:text>{"@labeledElementReference":"</xsl:text>
    <xsl:value-of select="." />
    <xsl:text>"}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Null">
    <xsl:choose>
      <xsl:when test="@*|node()">
        <xsl:text>{"@null":{</xsl:text>
        <xsl:apply-templates select="@*|node()" mode="list" />
        <xsl:text>}}</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>null</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:Not|edm:UrlRef">
    <xsl:text>{"@</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":</xsl:text>
    <xsl:apply-templates select="@*|node()" />
    <xsl:text>}</xsl:text>
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
      <xsl:choose>
        <xsl:when test="$name">
          <xsl:value-of select="$name" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="pluralize">
            <xsl:with-param name="name" select="local-name()" />
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
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

  <!-- name : quoted value -->
  <xsl:template match="@*">
    <xsl:text>"</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
    <xsl:text>":"</xsl:text>
    <xsl:value-of select="." />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <!-- name : object -->
  <xsl:template match="*">
    <xsl:text>"</xsl:text>
    <xsl:call-template name="lowerCamelCase">
      <xsl:with-param name="name" select="local-name()" />
    </xsl:call-template>
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
  <xsl:template name="pluralize">
    <xsl:param name="name" />
    <xsl:choose>
      <xsl:when test="$name='Annotations'">
        <xsl:text>annotations</xsl:text>
      </xsl:when>
      <xsl:when test="$name='IncludeAnnotations'">
        <xsl:text>includeAnnotations</xsl:text>
      </xsl:when>
      <xsl:when test="$name='NavigationProperty'">
        <xsl:text>navigationProperties</xsl:text>
      </xsl:when>
      <xsl:when test="$name='Property'">
        <xsl:text>properties</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="translate(substring($name,1,1),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')" />
        <xsl:value-of select="substring($name,2)" />
        <xsl:text>s</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="lowerCamelCase">
    <xsl:param name="name" />
    <xsl:choose>
      <xsl:when test="$name='SRID'">
        <xsl:text>x-srid</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="translate(substring($name,1,1),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')" />
        <xsl:value-of select="substring($name,2)" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

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
              <!-- TODO: no .openapi in final destination -->
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