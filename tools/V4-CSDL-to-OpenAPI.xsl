<?xml version="1.0" encoding="utf-8" ?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">
  <!--
    This style sheet transforms OData 4.0 CSDL XML documents into OpenAPI 2.0 or OpenAPI 3.0.0 JSON

    Latest version: https://github.com/oasis-tcs/odata-openapi/blob/master/tools/V4-CSDL-to-OpenAPI.xsl

    TODO:
    - delta: headers Prefer and Preference-Applied
    - custom headers and query options - https://issues.oasis-open.org/browse/ODATA-1099
    - response codes and descriptions - https://issues.oasis-open.org/browse/ODATA-884
    - inline definitions for Edm.* to make OpenAPI documents self-contained
    - complex or collection-valued function parameters need special treatment in /paths,
    use parameter aliases with alias option of type string
    - @Extends for entity container: include /paths from referenced container
    - both "clickable" and freestyle $expand, $select, $orderby - does not work yet, open issue for Swagger UI
    - system query options for actions/functions/imports depending on "Collection("
    - 200 response for PATCH if $odata-version!='2.0'
    - ETag for GET / If-Match for PATCH and DELETE depending on @Core.OptimisticConcurrency
    - external targeting for Capabilities.KeyAsSegmentSupported
    - external targeting for Core.Permission/Read
    - example values via Core.Example: Int
    - count/expand restrictions for GET collection-valued (containment) navigation - https://issues.oasis-open.org/browse/ODATA-1300
  -->

  <xsl:output method="text" indent="yes" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:strip-space elements="*" />


  <xsl:param name="scheme" select="'http'" />
  <xsl:param name="host" select="'localhost'" />
  <xsl:param name="basePath" select="'/service-root'" />

  <xsl:param name="info-title" select="null" />
  <xsl:param name="info-description" select="null" />
  <xsl:param name="info-version" select="null" />

  <xsl:param name="externalDocs-url" select="null" />
  <xsl:param name="externalDocs-description" select="null" />

  <xsl:param name="property-longDescription" select="true()" />
  <xsl:param name="label-as-tag" select="false()" />

  <xsl:param name="x-tensions" select="null" />

  <xsl:param name="odata-version" select="'4.0'" />
  <xsl:param name="odata-schema" select="'https://oasis-tcs.github.io/odata-openapi/examples/odata-definitions.json'" />

  <xsl:param name="diagram" select="null" />
  <xsl:param name="references" select="null" />
  <xsl:param name="top-example" select="50" />
  <xsl:param name="max-levels" select="5" />
  <xsl:param name="update-verb" select="'patch'" />

  <xsl:param name="openapi-formatoption" select="''" />
  <xsl:param name="openapi-version" select="'3.0.0'" />
  <xsl:param name="openapi-root" select="''" />


  <xsl:variable name="csdl-version" select="/edmx:Edmx/@Version" />
  <xsl:variable name="option-prefix">
    <xsl:choose>
      <xsl:when test="/edmx:Edmx/@Version='4.0'">
        <xsl:text>$</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:variable name="reuse-schemas">
    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
        <xsl:text>#/definitions/</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>#/components/schemas/</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:variable name="reuse-parameters">
    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
        <xsl:text>#/parameters/</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>#/components/parameters/</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:variable name="coreNamespace" select="'Org.OData.Core.V1'" />
  <xsl:variable name="coreAlias">
    <xsl:choose>
      <xsl:when test="//edmx:Include[@Namespace=$coreNamespace]/@Alias">
        <xsl:value-of select="//edmx:Include[@Namespace=$coreNamespace]/@Alias" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>Core</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:variable>
  <xsl:variable name="coreDescription" select="concat($coreNamespace,'.Description')" />
  <xsl:variable name="coreDescriptionAliased" select="concat($coreAlias,'.Description')" />
  <xsl:variable name="coreLongDescription" select="concat($coreNamespace,'.LongDescription')" />
  <xsl:variable name="coreLongDescriptionAliased" select="concat($coreAlias,'.LongDescription')" />

  <xsl:variable name="authorizationNamespace" select="'Org.OData.Authorization.V1'" />
  <xsl:variable name="authorizationAlias" select="//edmx:Include[@Namespace=$authorizationNamespace]/@Alias" />

  <xsl:variable name="capabilitiesNamespace" select="'Org.OData.Capabilities.V1'" />
  <xsl:variable name="capabilitiesAlias" select="//edmx:Include[@Namespace=$capabilitiesNamespace]/@Alias" />

  <xsl:variable name="validationNamespace" select="'Org.OData.Validation.V1'" />
  <xsl:variable name="validationAlias" select="//edmx:Include[@Namespace=$validationNamespace]/@Alias" />

  <xsl:variable name="jsonNamespace" select="'Org.OData.JSON.V1'" />
  <xsl:variable name="jsonAlias" select="//edmx:Include[@Namespace=$jsonNamespace]/@Alias" />

  <xsl:variable name="commonNamespace" select="'com.sap.vocabularies.Common.v1'" />
  <xsl:variable name="commonAlias" select="//edmx:Include[@Namespace=$commonNamespace]/@Alias" />
  <xsl:variable name="commonLabel" select="concat($commonNamespace,'.Label')" />
  <xsl:variable name="commonLabelAliased" select="concat($commonAlias,'.Label')" />
  <xsl:variable name="commonQuickInfo" select="concat($commonNamespace,'.QuickInfo')" />
  <xsl:variable name="commonQuickInfoAliased" select="concat($commonAlias,'.QuickInfo')" />

  <xsl:variable name="defaultResponse">
    <xsl:text>"</xsl:text>
    <xsl:choose>
      <xsl:when test="$openapi-version!='2.0'">
        <xsl:text>4XX</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>400</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>":{"$ref":"#/</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>components/</xsl:text>
    </xsl:if>
    <xsl:text>responses/error"}</xsl:text>
  </xsl:variable>

  <xsl:variable name="key-as-segment" select="//edm:EntityContainer/edm:Annotation[(@Term=concat($capabilitiesNamespace,'.KeyAsSegmentSupported') or @Term=concat($capabilitiesAlias,'.KeyAsSegmentSupported')) and not(@Qualifier)]" />


  <xsl:template name="capability">
    <xsl:param name="term" />
    <xsl:param name="property" select="false()" />
    <xsl:param name="target" select="." />

    <xsl:variable name="target-path">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Namespace" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="target-path-aliased">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Alias" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="anno" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term)]
                                                                               |$target/edm:Annotation[@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term)]" />
    <xsl:choose>
      <xsl:when test="$property">
        <xsl:value-of select="$anno/edm:Record/edm:PropertyValue[@Property=$property]/@Bool
                 |$anno/edm:Record/edm:PropertyValue[@Property=$property]/edm:Bool" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$anno/@Bool|$anno/edm:Bool" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="capability-indexablebykey">
    <xsl:param name="target" select="." />
    <xsl:variable name="term" select="'IndexableByKey'" />
    <xsl:variable name="target-path" select="concat($target/../../@Namespace,'.',$target/../@Name,'/',$target/@Name)" />
    <xsl:variable name="target-path-aliased" select="concat($target/../../@Alias,'.',$target/../@Name,'/',$target/@Name)" />
    <xsl:variable name="anno" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[(@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term))] 
                                                                               |$target/edm:Annotation[(@Term=concat($capabilitiesNamespace,'.',$term) or @Term=concat($capabilitiesAlias,'.',$term))]" />
    <xsl:choose>
      <xsl:when test="$anno/@Bool|$anno/edm:Bool">
        <xsl:value-of select="$anno/@Bool|$anno/edm:Bool" />
      </xsl:when>
      <xsl:when test="$anno">
        <xsl:text>true</xsl:text>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="annotation-string">
    <xsl:param name="node" />
    <xsl:param name="term" />
    <xsl:param name="termAliased" />
    <xsl:param name="qualifier" select="null" />
    <xsl:variable name="annotation" select="$node/edm:Annotation[(@Term=$term or @Term=$termAliased) and ((not($qualifier) and not(@Qualifier)) or $qualifier=@Qualifier)]" />
    <xsl:variable name="description" select="$annotation/@String|$annotation/edm:String" />
    <xsl:choose>
      <xsl:when test="$description">
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="$description" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:variable name="target">
          <xsl:call-template name="annotation-target">
            <xsl:with-param name="node" select="$node" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="targetAliased">
          <xsl:call-template name="annotation-target">
            <xsl:with-param name="node" select="$node" />
            <xsl:with-param name="qualifier" select="$node/ancestor::edm:Schema/@Alias" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="annotationExt" select="//edm:Annotations[(@Target=$target or @Target=$targetAliased) and not(@Qualifier)]/edm:Annotation[@Term=(@Term=$term or @Term=$termAliased) and ((not($qualifier) and not(@Qualifier)) or $qualifier=@Qualifier)]" />
        <xsl:call-template name="escape">
          <xsl:with-param name="string" select="$annotationExt/@String|$annotationExt/edm:String" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="annotation-target">
    <xsl:param name="node" />
    <xsl:param name="qualifier" select="$node/ancestor::edm:Schema/@Namespace" />
    <xsl:choose>
      <xsl:when test="local-name($node)='Parameter' and $odata-version='2.0'">
        <xsl:value-of select="concat($qualifier,'.',$node/../../edm:EntityContainer/@Name,'/',$node/../@Name,'/',$node/@Name)" />
      </xsl:when>
      <xsl:when test="local-name($node)='Property' or local-name($node)='NavigationProperty'
              or local-name($node)='EntitySet' or local-name($node)='Singleton' 
              or local-name($node)='ActionImport' or local-name($node)='FunctionImport'">
        <xsl:value-of select="concat($qualifier,'.',$node/../@Name,'/',$node/@Name)" />
      </xsl:when>
      <!-- TODO: extract template for overload signature, call it three times -->
      <xsl:when test="local-name($node)='Parameter'">
        <xsl:value-of select="concat($qualifier,'.',$node/../@Name)" />
        <xsl:text>(</xsl:text>
        <xsl:for-each select="$node/../edm:Parameter[local-name($node/..)='Function' or ($node/../@IsBound='true' and position()=1)]">
          <xsl:if test="position()>1">
            <xsl:text>,</xsl:text>
          </xsl:if>
          <xsl:value-of select="@Type" />
        </xsl:for-each>
        <xsl:text>)</xsl:text>
        <xsl:value-of select="concat('/',$node/@Name)" />
      </xsl:when>
      <xsl:when test="local-name($node)='ReturnType'">
        <xsl:value-of select="concat($qualifier,'.',$node/../@Name)" />
        <xsl:text>(</xsl:text>
        <xsl:for-each select="$node/../edm:Parameter[local-name($node/..)='Function' or ($node/../@IsBound='true' and position()=1)]">
          <xsl:if test="position()>1">
            <xsl:text>,</xsl:text>
          </xsl:if>
          <xsl:value-of select="@Type" />
        </xsl:for-each>
        <xsl:text>)/$ReturnType</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="concat($qualifier,'.',$node/@Name)" />
        <xsl:if test="local-name($node)='Action' or local-name($node)='Function'">
          <xsl:text>(</xsl:text>
          <xsl:for-each select="$node/edm:Parameter[local-name($node)='Function' or ($node/@IsBound='true' and position()=1)]">
            <xsl:if test="position()>1">
              <xsl:text>,</xsl:text>
            </xsl:if>
            <xsl:value-of select="@Type" />
          </xsl:for-each>
          <xsl:text>)</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="Core.Description">
    <xsl:param name="node" />
    <xsl:param name="qualifier" select="null" />
    <xsl:call-template name="annotation-string">
      <xsl:with-param name="node" select="$node" />
      <xsl:with-param name="term" select="$coreDescription" />
      <xsl:with-param name="termAliased" select="$coreDescriptionAliased" />
      <xsl:with-param name="qualifier" select="$qualifier" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="Core.LongDescription">
    <xsl:param name="node" />
    <xsl:param name="qualifier" select="null" />
    <xsl:call-template name="annotation-string">
      <xsl:with-param name="node" select="$node" />
      <xsl:with-param name="term" select="$coreLongDescription" />
      <xsl:with-param name="termAliased" select="$coreLongDescriptionAliased" />
      <xsl:with-param name="qualifier" select="$qualifier" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="Common.Label">
    <xsl:param name="node" />
    <xsl:call-template name="annotation-string">
      <xsl:with-param name="node" select="$node" />
      <xsl:with-param name="term" select="$commonLabel" />
      <xsl:with-param name="termAliased" select="$commonLabelAliased" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="Common.QuickInfo">
    <xsl:param name="node" />
    <xsl:call-template name="annotation-string">
      <xsl:with-param name="node" select="$node" />
      <xsl:with-param name="term" select="$commonQuickInfo" />
      <xsl:with-param name="termAliased" select="$commonQuickInfoAliased" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edmx:Edmx">
    <xsl:text>{</xsl:text>
    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
        <xsl:text>"swagger":"2.0"</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"openapi":"3.0.0"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>,"info":{"title":"</xsl:text>
    <xsl:variable name="schemaDescription">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="//edm:Schema" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="containerDescription">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="//edm:EntityContainer" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$info-title">
        <xsl:value-of select="$info-title" />
      </xsl:when>
      <xsl:when test="$schemaDescription!=''">
        <xsl:value-of select="$schemaDescription" />
      </xsl:when>
      <xsl:when test="$containerDescription!=''">
        <xsl:value-of select="$containerDescription" />
      </xsl:when>
      <xsl:when test="//edm:EntityContainer">
        <xsl:text>Service for namespace </xsl:text>
        <xsl:value-of select="//edm:EntityContainer/../@Namespace" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>OData CSDL Document for namespace </xsl:text>
        <xsl:value-of select="//edm:Schema/@Namespace" />
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>","version":"</xsl:text>
    <xsl:choose>
      <xsl:when test="$info-version">
        <xsl:value-of select="$info-version" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="annotation-string">
          <xsl:with-param name="node" select="//edm:Schema" />
          <xsl:with-param name="term" select="concat($coreNamespace,'.SchemaVersion')" />
          <xsl:with-param name="termAliased" select="concat($coreAlias,'.SchemaVersion')" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>","description":"</xsl:text>
    <xsl:variable name="schemaLongDescription">
      <xsl:call-template name="Core.LongDescription">
        <xsl:with-param name="node" select="//edm:Schema" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="containerLongDescription">
      <xsl:call-template name="Core.LongDescription">
        <xsl:with-param name="node" select="//edm:EntityContainer" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$info-description">
        <xsl:value-of select="$info-description" />
      </xsl:when>
      <xsl:when test="$schemaLongDescription!=''">
        <xsl:value-of select="$schemaLongDescription" />
      </xsl:when>
      <xsl:when test="$containerLongDescription!=''">
        <xsl:value-of select="$containerLongDescription" />
      </xsl:when>
      <xsl:when test="//edm:EntityContainer">
        <xsl:text>This service is located at [</xsl:text>
        <xsl:value-of select="$scheme" />
        <xsl:text>://</xsl:text>
        <xsl:value-of select="$host" />
        <xsl:value-of select="$basePath" />
        <xsl:text>/](</xsl:text>
        <xsl:value-of select="$scheme" />
        <xsl:text>://</xsl:text>
        <xsl:value-of select="$host" />
        <xsl:call-template name="replace-all">
          <xsl:with-param name="string">
            <xsl:call-template name="replace-all">
              <xsl:with-param name="string" select="$basePath" />
              <xsl:with-param name="old" select="'('" />
              <xsl:with-param name="new" select="'%28'" />
            </xsl:call-template>
          </xsl:with-param>
          <xsl:with-param name="old" select="')'" />
          <xsl:with-param name="new" select="'%29'" />
        </xsl:call-template>
        <xsl:text>/)</xsl:text>
      </xsl:when>
    </xsl:choose>
    <xsl:if test="$diagram">
      <xsl:variable name="content" select="//edm:EntitySet|//edm:Singleton|//edm:ActionImport|//edm:FunctionImport|//edm:EntityType|//edm:ComplexType" />
      <xsl:if test="$content">
        <xsl:text>\n\n## Entity Data Model\n![ER Diagram](https://yuml.me/diagram/class/</xsl:text>
        <xsl:apply-templates select="$content" mode="diagram" />
        <xsl:text>)</xsl:text>
        <xsl:text>\n\n### Legend\n![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/</xsl:text>
        <xsl:text>[External.Type{bg:whitesmoke}],[ComplexType],[EntityType{bg:orange}],[EntitySet/Singleton/Operation{bg:dodgerblue}])</xsl:text>
      </xsl:if>
    </xsl:if>
    <xsl:if test="$references">
      <xsl:apply-templates select="//edmx:Include[substring(@Namespace,1,10)!='Org.OData.' and substring(@Namespace,1,21)!='com.sap.vocabularies.']" mode="references" />
    </xsl:if>
    <xsl:text>"}</xsl:text>

    <xsl:if test="$externalDocs-url">
      <xsl:text>,"externalDocs":{</xsl:text>
      <xsl:if test="$externalDocs-description">
        <xsl:text>"description":"</xsl:text>
        <xsl:value-of select="$externalDocs-description" />
        <xsl:text>",</xsl:text>
      </xsl:if>
      <xsl:text>"url":"</xsl:text>
      <xsl:value-of select="$externalDocs-url" />
      <xsl:text>"}</xsl:text>
    </xsl:if>

    <xsl:if test="$x-tensions">
      <xsl:text>,</xsl:text>
      <xsl:value-of select="$x-tensions" />
    </xsl:if>

    <xsl:if test="//edm:EntityContainer">
      <xsl:choose>
        <xsl:when test="$openapi-version='2.0'">
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
        </xsl:when>
        <xsl:when test="not(contains($x-tensions, '&quot;servers&quot;:'))">
          <xsl:text>,"servers":[{"url":"</xsl:text>
          <xsl:value-of select="$scheme" />
          <xsl:text>://</xsl:text>
          <xsl:value-of select="$host" />
          <xsl:value-of select="$basePath" />
          <xsl:text>"}]</xsl:text>
        </xsl:when>
      </xsl:choose>

    </xsl:if>

    <xsl:apply-templates select="//edm:EntitySet[not(edm:Annotation[@Term='sap.parameters'])]|//edm:Singleton" mode="tags" />

    <!-- paths is required, so we need it also for documents that do not define an entity container -->
    <xsl:text>,"paths":{</xsl:text>
    <xsl:apply-templates select="//edm:EntityContainer" mode="paths" />
    <xsl:text>}</xsl:text>

    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>,"components":{</xsl:text>
    </xsl:if>

    <xsl:apply-templates select="//edm:EntityType|//edm:ComplexType|//edm:TypeDefinition|//edm:EnumType|//edm:EntityContainer" mode="hash">
      <xsl:with-param name="name">
        <xsl:choose>
          <xsl:when test="$openapi-version='2.0'">
            <xsl:text>definitions</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>schemas</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:with-param>
      <xsl:with-param name="after" select="$openapi-version='2.0'" />
    </xsl:apply-templates>

    <xsl:if test="//edm:EntityContainer">
      <xsl:text>,"parameters":{</xsl:text>
      <xsl:text>"top":{"name":"</xsl:text>
      <xsl:value-of select="$option-prefix" />
      <xsl:text>top","in":"query","description":"Show only the first n items, see [Paging - Top](</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=66</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptiontop</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>)",</xsl:text>
      <xsl:call-template name="parameter-type">
        <xsl:with-param name="type" select="'integer'" />
        <xsl:with-param name="plus" select="',&quot;minimum&quot;:0'" />
      </xsl:call-template>
      <xsl:if test="number($top-example) and $openapi-version!='2.0'">
        <xsl:text>,"example":</xsl:text>
        <xsl:value-of select="$top-example" />
      </xsl:if>
      <xsl:text>},</xsl:text>
      <xsl:text>"skip":{"name":"</xsl:text>
      <xsl:value-of select="$option-prefix" />
      <xsl:text>skip","in":"query","description":"Skip the first n items, see [Paging - Skip](</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=65</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionskip</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>)",</xsl:text>
      <xsl:call-template name="parameter-type">
        <xsl:with-param name="type" select="'integer'" />
        <xsl:with-param name="plus" select="',&quot;minimum&quot;:0'" />
      </xsl:call-template>
      <xsl:text>},</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>"count":{"name": "$inlinecount","in":"query","description":"Include count of items</xsl:text>
          <xsl:text>, see [Inlinecount](https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=67)",</xsl:text>
          <xsl:call-template name="parameter-type">
            <xsl:with-param name="type" select="'string'" />
            <xsl:with-param name="plus">
              <xsl:text>,"enum":["allpages","none"]</xsl:text>
            </xsl:with-param>
          </xsl:call-template>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>"count":{"name":"</xsl:text>
          <xsl:value-of select="$option-prefix" />
          <xsl:text>count","in":"query","description":"Include count of items</xsl:text>
          <xsl:text>, see [Count](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptioncount)",</xsl:text>
          <xsl:call-template name="parameter-type">
            <xsl:with-param name="type" select="'boolean'" />
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>}</xsl:text>
      <xsl:choose>
        <xsl:when test="substring($odata-version,1,3)='4.0'">
          <xsl:text>,"search":{"name":"</xsl:text>
          <xsl:value-of select="$option-prefix" />
          <xsl:text>search","in":"query","description":"Search items by search phrases</xsl:text>
          <xsl:text>, see [Searching](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionsearch)",</xsl:text>
          <xsl:call-template name="parameter-type">
            <xsl:with-param name="type" select="'string'" />
          </xsl:call-template>
          <xsl:text>}</xsl:text>
        </xsl:when>
        <xsl:when test="//edm:Annotation[@Term=concat($capabilitiesNamespace,'.SearchRestrictions') or @Term=concat($capabilitiesAlias,'.SearchRestrictions')]/edm:Record/edm:PropertyValue[@Property='Searchable' and @Bool='true']">
          <xsl:text>,"search":{"name":"search","in":"query","description":"Search items by search phrases</xsl:text>
          <xsl:text>, see [Searching](https://wiki.scn.sap.com/wiki/display/EmTech/SAP+Annotations+for+OData+Version+2.0#SAPAnnotationsforODataVersion2.0-Query_Option_searchQueryOptionsearch)",</xsl:text>
          <xsl:call-template name="parameter-type">
            <xsl:with-param name="type" select="'string'" />
          </xsl:call-template>
          <xsl:text>}</xsl:text>
        </xsl:when>
      </xsl:choose>
      <xsl:text>}</xsl:text>

      <xsl:text>,"responses":{"error":{"description":"Error",</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>"content":{"application/json":{</xsl:text>
      </xsl:if>
      <xsl:text>"schema":{"$ref":"</xsl:text>
      <xsl:value-of select="$reuse-schemas" />
      <xsl:text>error"}</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>}}</xsl:text>
      </xsl:if>
      <xsl:text>}}</xsl:text>

      <xsl:call-template name="security-schemes" />
    </xsl:if>

    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>

    <xsl:call-template name="security" />

    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="security-schemes">
    <xsl:variable name="target" select="//edm:EntityContainer" />
    <xsl:variable name="term" select="'Authorizations'" />
    <xsl:variable name="target-path" select="concat($target/../@Namespace,'.',$target/@Name)" />
    <xsl:variable name="target-path-aliased" select="concat($target/../@Alias,'.',$target/@Name)" />
    <xsl:variable name="anno" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[@Term=concat($authorizationNamespace,'.',$term) or @Term=concat($authorizationAlias,'.',$term)]
                                                                               |$target/edm:Annotation[@Term=concat($authorizationNamespace,'.',$term) or @Term=concat($authorizationAlias,'.',$term)]" />
    <xsl:if test="$anno">
      <xsl:text>,"</xsl:text>
      <xsl:choose>
        <xsl:when test="$openapi-version!='2.0'">
          <xsl:text>securitySchemes</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>securityDefinitions</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>":{</xsl:text>
      <xsl:apply-templates select="$anno/edm:Collection/edm:Record" mode="Authorizations" />
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Record" mode="Authorizations">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="edm:PropertyValue[@Property='Name']/@String
             |edm:PropertyValue[@Property='Name']/edm:String" />
    <xsl:text>":{</xsl:text>
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@Type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$type='ApiKey'">
        <xsl:text>"type":"apiKey"</xsl:text>
        <xsl:text>,"name":"</xsl:text>
        <xsl:value-of select="edm:PropertyValue[@Property='KeyName']/@String
                 |edm:PropertyValue[@Property='KeyName']/edm:String" />
        <xsl:text>","in":"</xsl:text>
        <xsl:variable name="location" select="substring-after(edm:PropertyValue[@Property='Location']/@EnumMember
                                 |edm:PropertyValue[@Property='Location']/edm:EnumMember,'/')" />
        <xsl:choose>
          <xsl:when test="$location='Header'">
            <xsl:text>header</xsl:text>
          </xsl:when>
          <xsl:when test="$location='QueryOption'">
            <xsl:text>query</xsl:text>
          </xsl:when>
          <xsl:when test="$location='Cookie'">
            <xsl:text>cookie</xsl:text>
          </xsl:when>
        </xsl:choose>
        <xsl:text>"</xsl:text>
        <xsl:call-template name="auth-description" />
      </xsl:when>
      <xsl:when test="$type='Http'">
        <xsl:choose>
          <xsl:when test="$openapi-version!='2.0'">
            <xsl:text>"type":"http"</xsl:text>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'Scheme'" />
              <xsl:with-param name="as" select="'scheme'" />
            </xsl:call-template>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'BearerFormat'" />
              <xsl:with-param name="as" select="'bearerFormat'" />
            </xsl:call-template>
            <xsl:call-template name="auth-description" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>"type":"basic"</xsl:text>
            <xsl:variable name="scheme" select="edm:PropertyValue[@Property='Scheme']/@String
                     |edm:PropertyValue[@Property='Scheme']/edm:String" />
            <xsl:choose>
              <xsl:when test="$scheme='basic'">
                <xsl:call-template name="auth-description" />
              </xsl:when>
              <xsl:otherwise>
                <xsl:text>,"description":"</xsl:text>
                <xsl:value-of select="$scheme" />
                <xsl:text> scheme not supported by Swagger 2.0"</xsl:text>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$type='OAuth2AuthCode' or $type='OAuth2ClientCredentials' or $type='OAuth2Implicit' or $type='OAuth2Password'">
        <xsl:text>"type":"oauth2"</xsl:text>
        <xsl:variable name="flow">
          <xsl:choose>
            <xsl:when test="$type='OAuth2AuthCode'">
              <xsl:choose>
                <xsl:when test="$openapi-version!='2.0'">
                  <xsl:text>authorizationCode</xsl:text>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:text>accessCode</xsl:text>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:when>
            <xsl:when test="$type='OAuth2ClientCredentials'">
              <xsl:choose>
                <xsl:when test="$openapi-version!='2.0'">
                  <xsl:text>clientCredentials</xsl:text>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:text>application</xsl:text>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:when>
            <xsl:when test="$type='OAuth2Implicit'">
              <xsl:text>implicit</xsl:text>
            </xsl:when>
            <xsl:when test="$type='OAuth2Password'">
              <xsl:text>password</xsl:text>
            </xsl:when>
          </xsl:choose>
        </xsl:variable>
        <xsl:choose>
          <xsl:when test="$openapi-version!='2.0'">
            <xsl:text>,"flows":{"</xsl:text>
            <xsl:value-of select="$flow" />
            <xsl:text>":{"scopes":{</xsl:text>
            <xsl:apply-templates select="edm:PropertyValue[@Property='Scopes']/edm:Collection/edm:Record" mode="Scopes" />
            <xsl:text>}</xsl:text>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'RefreshUrl'" />
              <xsl:with-param name="as" select="'refreshUrl'" />
            </xsl:call-template>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'AuthorizationUrl'" />
              <xsl:with-param name="as" select="'authorizationUrl'" />
            </xsl:call-template>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'TokenUrl'" />
              <xsl:with-param name="as" select="'tokenUrl'" />
            </xsl:call-template>
            <xsl:text>}}</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"flow":"</xsl:text>
            <xsl:value-of select="$flow" />
            <xsl:text>","scopes":{</xsl:text>
            <xsl:apply-templates select="edm:PropertyValue[@Property='Scopes']/edm:Collection/edm:Record" mode="Scopes" />
            <xsl:text>}</xsl:text>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'AuthorizationUrl'" />
              <xsl:with-param name="as" select="'authorizationUrl'" />
            </xsl:call-template>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'TokenUrl'" />
              <xsl:with-param name="as" select="'tokenUrl'" />
            </xsl:call-template>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:call-template name="auth-description" />
      </xsl:when>
      <xsl:when test="$type='OpenIDConnect'">
        <xsl:choose>
          <xsl:when test="$openapi-version!='2.0'">
            <xsl:text>"type":"openIdConnect"</xsl:text>
            <xsl:call-template name="auth-property">
              <xsl:with-param name="property" select="'IssuerUrl'" />
              <xsl:with-param name="as" select="'openIdConnectUrl'" />
            </xsl:call-template>
            <xsl:call-template name="auth-description" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>"type":"basic","description":"openIdConnect not supported by Swagger 2.0"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"type":"TODO:</xsl:text>
        <xsl:value-of select="$type" />
        <xsl:text>"</xsl:text>
        <xsl:message>
          <xsl:text>Unknown Authorization type </xsl:text>
          <xsl:value-of select="$type" />
        </xsl:message>
        <xsl:call-template name="auth-description" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="auth-property">
    <xsl:param name="property" />
    <xsl:param name="as" />
    <xsl:variable name="value" select="edm:PropertyValue[@Property=$property]/@String
                     |edm:PropertyValue[@Property=$property]/edm:String" />
    <xsl:if test="$value">
      <xsl:text>,"</xsl:text>
      <xsl:value-of select="$as" />
      <xsl:text>":"</xsl:text>
      <xsl:value-of select="$value" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="auth-description">
    <xsl:variable name="description" select="edm:PropertyValue[@Property='Description']/@String
             |edm:PropertyValue[@Property='Description']/edm:String" />
    <xsl:if test="$description">
      <xsl:text>,"description":"</xsl:text>
      <xsl:value-of select="$description" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Record" mode="Scopes">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="edm:PropertyValue[@Property='Scope']/@String
             |edm:PropertyValue[@Property='Scope']/edm:String" />
    <xsl:text>":"</xsl:text>
    <xsl:value-of select="edm:PropertyValue[@Property='Description']/@String
             |edm:PropertyValue[@Property='Description']/edm:String" />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template name="security">
    <xsl:variable name="target" select="//edm:EntityContainer" />
    <xsl:variable name="term" select="'SecuritySchemes'" />
    <xsl:variable name="target-path" select="concat($target/../@Namespace,'.',$target/@Name)" />
    <xsl:variable name="target-path-aliased" select="concat($target/../@Alias,'.',$target/@Name)" />
    <xsl:variable name="anno" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[@Term=concat($authorizationNamespace,'.',$term) or @Term=concat($authorizationAlias,'.',$term)]
                                                                               |$target/edm:Annotation[@Term=concat($authorizationNamespace,'.',$term) or @Term=concat($authorizationAlias,'.',$term)]" />
    <xsl:if test="$anno">
      <xsl:text>,"security":[</xsl:text>
      <xsl:apply-templates select="$anno/edm:Collection/edm:Record" mode="SecuritySchemes" />
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Record" mode="SecuritySchemes">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"</xsl:text>
    <xsl:value-of select="edm:PropertyValue[@Property='Authorization']/@String
             |edm:PropertyValue[@Property='Authorization']/edm:String" />
    <xsl:text>":[</xsl:text>
    <xsl:apply-templates select="edm:PropertyValue[@Property='RequiredScopes']/edm:Collection/edm:String" mode="RequiredScopes" />
    <xsl:text>]}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:String" mode="RequiredScopes">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="." />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template name="parameter-type">
    <xsl:param name="type" />
    <xsl:param name="plus" select="null" />

    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>"schema":{</xsl:text>
    </xsl:if>
    <xsl:text>"type":"</xsl:text>
    <xsl:value-of select="$type" />
    <xsl:text>"</xsl:text>

    <xsl:if test="$plus">
      <xsl:value-of select="$plus" />
    </xsl:if>

    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <!-- definitions for standard error response - only needed if there's an entity container -->
  <xsl:template match="edm:EntityContainer" mode="hashpair">
    <xsl:text>"count":</xsl:text>
    <xsl:choose>
      <xsl:when test="$odata-version='2.0'">
        <xsl:text>{"type":"string","description":"The number of entities in the collection. Available when using the [$inlinecount](https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=67) query option."}</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>{</xsl:text>
        <xsl:if test="$openapi-version!='2.0'">
          <xsl:text>"anyOf":[{"type":"number"},{</xsl:text>
        </xsl:if>
        <xsl:text>"type":"string"</xsl:text>
        <xsl:if test="$openapi-version!='2.0'">
          <xsl:text>}]</xsl:text>
        </xsl:if>
        <xsl:text>,"description":"The number of entities in the collection. Available when using the [$count](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptioncount) query option."}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>,</xsl:text>
    <xsl:if test="//@Type[.='Edm.GeographyPoint' or .='Edm.GeometryPoint']">
      <xsl:text>"geoPoint":{"type":"object","properties":{"type":{"type":"string","enum":["Point"],"default":"Point"},"coordinates":{"$ref":"</xsl:text>
      <xsl:value-of select="$reuse-schemas" />
      <xsl:text>geoPosition"}},"required":["type","coordinates"]},</xsl:text>
    </xsl:if>
    <xsl:if test="//@Type[starts-with(.,'Edm.Geo')]">
      <xsl:text>"geoPosition":{"type":"array","items":{"type":"number"},"minItems":2},</xsl:text>
    </xsl:if>
    <xsl:text>"error":{"type":"object","required":["error"],"properties":{"error":</xsl:text>
    <xsl:text>{"type":"object","required":["code","message"],"properties":{"code":{"type":"string"},"message":</xsl:text>
    <xsl:choose>
      <xsl:when test="substring($odata-version,1,3)='4.0'">
        <xsl:text>{"type":"string"},"target":{"type":"string"},"details":</xsl:text>
        <xsl:text>{"type":"array","items":{"type":"object","required":["code","message"],"properties":{"code":{"type":"string"},"message":{"type":"string"},"target":{"type":"string"}}}}</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>{"type":"object","required":["lang","value"],"properties":{"lang":{"type":"string"},"value":{"type":"string"}}}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>,"innererror":{"type":"object","description":"The structure of this object is service-specific"}}}}}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EntitySet|edm:Singleton" mode="diagram">
    <xsl:variable name="type">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@EntityType|@Type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>[</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>{bg:dodgerblue}</xsl:text>
    <xsl:text>]++-</xsl:text>
    <xsl:choose>
      <xsl:when test="local-name()='EntitySet'">
        <xsl:text>*</xsl:text>
      </xsl:when>
      <xsl:when test="@Nullable='true'">
        <xsl:text>0..1</xsl:text>
      </xsl:when>
    </xsl:choose>
    <xsl:text>>[</xsl:text>
    <xsl:value-of select="$type" />
    <xsl:text>]</xsl:text>
  </xsl:template>

  <xsl:template match="edm:ActionImport" mode="diagram">
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
    <xsl:variable name="actionName">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@Action" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="action" select="//edm:Schema[@Namespace=$namespace]/edm:Action[@Name=$actionName and not(@IsBound='true')]" />

    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>[</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>{bg:dodgerblue}</xsl:text>
    <xsl:text>]</xsl:text>

    <xsl:apply-templates select="$action/edm:ReturnType" mode="diagram" />
  </xsl:template>

  <xsl:template match="edm:FunctionImport" mode="diagram">
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

    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>[</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>{bg:dodgerblue}</xsl:text>
    <xsl:text>]</xsl:text>

    <!-- TODO: deal with multiple unbound overloads, remove [1] -->
    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:Function[@Name=$function and not(@IsBound='true')][1]/edm:ReturnType" mode="diagram" />
  </xsl:template>

  <xsl:template match="edm:ReturnType" mode="diagram">
    <xsl:variable name="collection" select="starts-with(@Type,'Collection(')" />
    <xsl:variable name="singleType">
      <xsl:choose>
        <xsl:when test="$collection">
          <xsl:value-of select="substring-before(substring-after(@Type,'('),')')" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@Type" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
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

    <!-- TODO: deal with external return type -->
    <xsl:if test="$qualifier!='Edm'">
      <xsl:text>-</xsl:text>
      <xsl:choose>
        <xsl:when test="$collection">
          <xsl:text>*</xsl:text>
        </xsl:when>
        <xsl:when test="$nullable='true'">
          <xsl:text>0..1</xsl:text>
        </xsl:when>
      </xsl:choose>
      <xsl:text>>[</xsl:text>
      <xsl:value-of select="$type" />
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:EntityType|edm:ComplexType" mode="diagram">
    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:apply-templates select="@BaseType" mode="diagram" />
    <xsl:text>[</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:if test="local-name()='EntityType'">
      <xsl:text>{bg:orange}</xsl:text>
    </xsl:if>
    <xsl:text>]</xsl:text>
    <xsl:apply-templates select="edm:NavigationProperty|edm:Property" mode="diagram" />
  </xsl:template>

  <xsl:template match="@BaseType" mode="diagram">
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
      <xsl:when test="$qualifier=//edm:Schema/@Namespace or $qualifier=//edm:Schema/@Alias">
        <xsl:value-of select="$type" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="normalizedQualifiedName">
          <xsl:with-param name="qualifiedName" select="." />
        </xsl:call-template>
        <xsl:text>{bg:whitesmoke}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>]^</xsl:text>
  </xsl:template>

  <xsl:template match="edm:NavigationProperty|edm:Property" mode="diagram">
    <xsl:variable name="collection" select="starts-with(@Type,'Collection(')" />
    <xsl:variable name="singleType">
      <xsl:choose>
        <xsl:when test="$collection">
          <xsl:value-of select="substring-before(substring-after(@Type,'('),')')" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@Type" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
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
      [FeaturedProduct]<0..1-0..1>[Advertisement]
    -->
    <xsl:if test="$qualifier!='Edm' or local-name='NavigationProperty'">
      <xsl:text>,[</xsl:text>
      <xsl:value-of select="../@Name" />
      <xsl:text>]</xsl:text>
      <xsl:if test="local-name()='Property' or @ContainsTarget='true'">
        <xsl:text>++</xsl:text>
      </xsl:if>
      <xsl:text>-</xsl:text>
      <xsl:choose>
        <xsl:when test="$collection">
          <xsl:text>*</xsl:text>
        </xsl:when>
        <xsl:when test="$nullable='true'">
          <xsl:text>0..1</xsl:text>
        </xsl:when>
      </xsl:choose>
      <xsl:if test="local-name()='NavigationProperty'">
        <xsl:text>></xsl:text>
      </xsl:if>
      <xsl:text>[</xsl:text>
      <xsl:choose>
        <xsl:when test="$qualifier=//edm:Schema/@Namespace or $qualifier=//edm:Schema/@Alias">
          <xsl:value-of select="$type" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="normalizedQualifiedName">
            <xsl:with-param name="qualifiedName" select="$singleType" />
          </xsl:call-template>
          <xsl:text>{bg:whitesmoke}</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edmx:Include" mode="references">
    <xsl:if test="position() = 1">
      <xsl:text>\n\n## References</xsl:text>
    </xsl:if>
    <xsl:text>\n- [</xsl:text>
    <xsl:value-of select="@Namespace" />
    <xsl:text>](</xsl:text>
    <xsl:text>?url=</xsl:text>
    <xsl:call-template name="replace-all">
      <xsl:with-param name="string">
        <xsl:call-template name="json-url">
          <xsl:with-param name="url" select="../@Uri" />
          <xsl:with-param name="root" select="$openapi-root" />
        </xsl:call-template>
      </xsl:with-param>
      <xsl:with-param name="old" select="')'" />
      <xsl:with-param name="new" select="'%29'" />
    </xsl:call-template>
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
    <xsl:variable name="qualifiedName" select="concat(../@Namespace,'.',@Name)" />
    <xsl:variable name="aliasQualifiedName" select="concat(../@Alias,'.',@Name)" />

    <xsl:call-template name="structure">
      <xsl:with-param name="qualifiedName" select="$qualifiedName" />
      <xsl:with-param name="aliasQualifiedName" select="$aliasQualifiedName" />
    </xsl:call-template>

    <xsl:text>,</xsl:text>

    <xsl:call-template name="structure">
      <xsl:with-param name="qualifiedName" select="$qualifiedName" />
      <xsl:with-param name="aliasQualifiedName" select="$aliasQualifiedName" />
      <xsl:with-param name="suffix" select="'-create'" />
    </xsl:call-template>

    <xsl:text>,</xsl:text>

    <xsl:call-template name="structure">
      <xsl:with-param name="qualifiedName" select="$qualifiedName" />
      <xsl:with-param name="aliasQualifiedName" select="$aliasQualifiedName" />
      <xsl:with-param name="suffix" select="'-update'" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="structure">
    <xsl:param name="qualifiedName" />
    <xsl:param name="aliasQualifiedName" />
    <xsl:param name="suffix" select="null" />

    <xsl:text>"</xsl:text>
    <xsl:value-of select="$qualifiedName" />
    <xsl:value-of select="$suffix" />
    <xsl:text>":{"type":"object"</xsl:text>

    <xsl:call-template name="properties">
      <xsl:with-param name="structuredType" select="." />
      <xsl:with-param name="suffix" select="$suffix" />
    </xsl:call-template>

    <xsl:call-template name="derivedTypes">
      <xsl:with-param name="qualifiedName" select="$qualifiedName" />
      <xsl:with-param name="aliasQualifiedName" select="$aliasQualifiedName" />
      <xsl:with-param name="suffix" select="$suffix" />
    </xsl:call-template>

    <xsl:call-template name="title-description">
      <xsl:with-param name="fallback-title" select="@Name" />
      <xsl:with-param name="suffix">
        <xsl:text></xsl:text>
        <xsl:if test="$suffix">
          <xsl:value-of select="concat(' (','for ',substring($suffix,2),')')" />
        </xsl:if>
      </xsl:with-param>
    </xsl:call-template>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="derivedTypes">
    <xsl:param name="qualifiedName" />
    <xsl:param name="aliasQualifiedName" />
    <xsl:param name="suffix" select="null" />
    <xsl:variable name="derivedTypes" select="//edm:EntityType[@BaseType=$qualifiedName or @BaseType=$aliasQualifiedName]
             |//edm:ComplexType[@BaseType=$qualifiedName or @BaseType=$aliasQualifiedName]" />

    <xsl:if test="$derivedTypes and $openapi-version!='2.0'">
      <xsl:text>,"anyOf":[</xsl:text>
      <xsl:apply-templates select="$derivedTypes" mode="ref">
        <xsl:with-param name="suffix" select="$suffix" />
      </xsl:apply-templates>
      <xsl:if test="not(@Abstract='true')">
        <xsl:text>,{}</xsl:text>
      </xsl:if>
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:EntityType|edm:ComplexType" mode="ref">
    <xsl:param name="suffix" select="null" />

    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{</xsl:text>
    <xsl:call-template name="ref">
      <xsl:with-param name="qualifier" select="../@Namespace" />
      <xsl:with-param name="name" select="@Name" />
      <xsl:with-param name="suffix" select="$suffix" />
    </xsl:call-template>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="properties">
    <xsl:param name="structuredType" />
    <xsl:param name="suffix" select="null" />
    <xsl:param name="direct" select="true()" />

    <xsl:variable name="qualifiedName" select="concat($structuredType/../@Namespace,'.',$structuredType/@Name)" />
    <xsl:variable name="aliasQualifiedName" select="concat($structuredType/../@Alias,'.',$structuredType/@Name)" />

    <xsl:variable name="computed" select="$structuredType/edm:Property[edm:Annotation[@Term='Org.OData.Core.V1.Computed' or @Term=concat($coreAlias,'.Computed')]]/@Name" />
    <xsl:variable name="computed-ext" select="//edm:Annotations[(substring-before(@Target,'/') = $qualifiedName or substring-before(@Target,'/') = $aliasQualifiedName) and edm:Annotation[@Term='Org.OData.Core.V1.Computed' or @Term=concat($coreAlias,'.Computed')]]/@Target" />

    <xsl:variable name="immutable" select="$structuredType/edm:Property[edm:Annotation[@Term='Org.OData.Core.V1.Immutable' or @Term=concat($coreAlias,'.Immutable')]]/@Name" />
    <xsl:variable name="immutable-ext" select="//edm:Annotations[(substring-before(@Target,'/') = $qualifiedName or substring-before(@Target,'/') = $aliasQualifiedName) and edm:Annotation[@Term='Org.OData.Core.V1.Immutable' or @Term=concat($coreAlias,'.Immutable')]]/@Target" />

    <!-- TODO: also external targeting -->
    <!-- TODO: make expression catch all alias variations in @Target, @Term, and @EnumMember -->
    <xsl:variable name="read-only" select="$structuredType/edm:Property[edm:Annotation[@Term='Org.OData.Core.V1.Permissions' or @Term=concat($coreAlias,'.Permissions')]/edm:EnumMember='Org.OData.Core.V1.Permission/Read']/@Name" />
    <!-- TODO: make expression catch all alias variations in @Target, @Term, and @EnumMember -->
    <xsl:variable name="mandatory" select="//edm:Annotations[edm:Annotation[@Term=concat($commonAlias,'.FieldControl') and @EnumMember=concat($commonAlias,'.FieldControlType/Mandatory')] and $qualifiedName=substring-before(@Target,'/')]/@Target" />

    <xsl:variable name="basetypeinfo">
      <xsl:if test="$structuredType/@BaseType">
        <xsl:variable name="qualifier">
          <xsl:call-template name="substring-before-last">
            <xsl:with-param name="input" select="$structuredType/@BaseType" />
            <xsl:with-param name="marker" select="'.'" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="name">
          <xsl:call-template name="substring-after-last">
            <xsl:with-param name="input" select="$structuredType/@BaseType" />
            <xsl:with-param name="marker" select="'.'" />
          </xsl:call-template>
        </xsl:variable>
        <!-- recurse to base type -->
        <!-- TODO: if base type is not defined in this document, add allOf, tunnel similar to required -->
        <xsl:call-template name="properties">
          <xsl:with-param name="structuredType" select="//edm:Schema[@Namespace=$qualifier or @Alias=$qualifier]/edm:ComplexType[@Name=$name]
                   |//edm:Schema[@Namespace=$qualifier or @Alias=$qualifier]/edm:EntityType[@Name=$name]" />
          <xsl:with-param name="suffix" select="$suffix" />
          <xsl:with-param name="direct" select="false()" />
        </xsl:call-template>
      </xsl:if>
    </xsl:variable>
    <xsl:variable name="baseproperties" select="substring-after($basetypeinfo,'|')" />

    <xsl:variable name="hereproperties">
      <xsl:choose>
        <xsl:when test="$suffix='-update'">
          <!-- only updatable non-key properties -->
          <xsl:apply-templates select="$structuredType/edm:Property[not(@Name=$immutable or concat($qualifiedName,'/',@Name) = $immutable-ext or concat($aliasQualifiedName,'/',@Name) = $immutable-ext
                                                  or @Name=$computed or concat($qualifiedName,'/',@Name) = $computed-ext or concat($aliasQualifiedName,'/',@Name) = $computed-ext
                                                  or @Name=$read-only or @Name=../edm:Key/edm:PropertyRef/@Name)]">
            <xsl:with-param name="name" select="'properties'" />
            <xsl:with-param name="suffix" select="'-update'" />
          </xsl:apply-templates>
        </xsl:when>
        <xsl:when test="$suffix='-create'">
          <!-- everything except computed and read-only properties -->
          <xsl:apply-templates select="$structuredType/edm:Property[not(@Name=$computed or concat($qualifiedName,'/',@Name) = $computed-ext or concat($aliasQualifiedName,'/',@Name) = $computed-ext 
                                                  or @Name=$read-only)]|$structuredType/edm:NavigationProperty">
            <xsl:with-param name="name" select="'properties'" />
            <xsl:with-param name="suffix" select="'-create'" />
          </xsl:apply-templates>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="$structuredType/edm:Property|$structuredType/edm:NavigationProperty">
            <xsl:with-param name="suffix" select="$suffix" />
          </xsl:apply-templates>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="required">
      <xsl:if test="$suffix='-create'">
        <!-- non-computed key properties are required, as are properties marked with Common.FieldControl=Mandatory -->
        <xsl:apply-templates select="$structuredType/edm:Property[(@Name=../edm:Key/edm:PropertyRef/@Name 
                                                  and not(@Name=$computed or concat($qualifiedName,'/',@Name) = $computed-ext or concat($aliasQualifiedName,'/',@Name) = $computed-ext 
                                               or @Name=$read-only)) 
                                               or concat($qualifiedName,'/',@Name)=$mandatory]" mode="required" />
      </xsl:if>
    </xsl:variable>

    <xsl:if test="$direct and ($baseproperties!='' or $hereproperties!='')">
      <xsl:text>,"properties":{</xsl:text>
    </xsl:if>

    <xsl:if test="not($direct)">
      <!-- prefix result with required properties -->
      <xsl:value-of select="$required" />
      <!-- comma separator if there are already required properties -->
      <xsl:if test="$structuredType/@BaseType and $required!='' and starts-with($basetypeinfo,'&quot;')">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <!-- at the top of the chain inject the pipe separator between required and properties -->
      <xsl:if test="not($structuredType/@BaseType)">
        <xsl:text>|</xsl:text>
      </xsl:if>
    </xsl:if>

    <xsl:if test="$direct">
      <xsl:value-of select="$baseproperties" />
    </xsl:if>
    <xsl:if test="not($direct)">
      <xsl:value-of select="$basetypeinfo" />
    </xsl:if>
    <xsl:if test="$baseproperties!='' and $hereproperties!=''">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:value-of select="$hereproperties" />

    <xsl:if test="$direct and ($baseproperties!='' or $hereproperties!='')">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <!-- TODO: required array needs to be collected recursively, appended, and then put here -->
    <xsl:if test="$direct">
      <xsl:variable name="baserequired" select="substring-before($basetypeinfo,'|')" />
      <xsl:if test="$required!='' or $baserequired!=''">
        <xsl:text>,"required":[</xsl:text>
        <xsl:value-of select="$required" />
        <xsl:if test="$required!='' and $baserequired!=''">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:value-of select="$baserequired" />
        <xsl:text>]</xsl:text>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Property" mode="required">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Property|edm:NavigationProperty">
    <xsl:param name="suffix" select="null" />
    <xsl:variable name="type">
      <xsl:call-template name="type">
        <xsl:with-param name="type" select="@Type" />
        <xsl:with-param name="nullableFacet" select="@Nullable" />
        <xsl:with-param name="suffix" select="$suffix" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="title">
      <xsl:call-template name="title-description" />
    </xsl:variable>
    <xsl:if test="position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{</xsl:text>
    <xsl:if test="not($openapi-version='2.0') and starts-with($type,'&quot;$ref&quot;:') and $title!=''">
      <xsl:text>"anyOf":[{</xsl:text>
    </xsl:if>
    <xsl:value-of select="$type" />
    <xsl:if test="not($openapi-version='2.0') and starts-with($type,'&quot;$ref&quot;:') and $title!=''">
      <xsl:text>}]</xsl:text>
    </xsl:if>
    <xsl:if test="not($openapi-version='2.0' and starts-with($type,'&quot;$ref&quot;:'))">
      <xsl:value-of select="$title" />
    </xsl:if>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Property|edm:NavigationProperty" mode="hashvalue">
    <xsl:param name="suffix" select="null" />
    <xsl:variable name="type">
      <xsl:call-template name="type">
        <xsl:with-param name="type" select="@Type" />
        <xsl:with-param name="nullableFacet" select="@Nullable" />
        <xsl:with-param name="suffix" select="$suffix" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="title">
      <xsl:call-template name="title-description" />
    </xsl:variable>
    <xsl:if test="not($openapi-version='2.0') and starts-with($type,'&quot;$ref&quot;:') and $title!=''">
      <xsl:text>"anyOf":[{</xsl:text>
    </xsl:if>
    <xsl:value-of select="$type" />
    <xsl:if test="not($openapi-version='2.0') and starts-with($type,'&quot;$ref&quot;:') and $title!=''">
      <xsl:text>}]</xsl:text>
    </xsl:if>
    <xsl:if test="not($openapi-version='2.0' and starts-with($type,'&quot;$ref&quot;:'))">
      <xsl:value-of select="$title" />
    </xsl:if>
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
    <xsl:param name="target" select="." />
    <xsl:param name="inParameter" select="false()" />
    <xsl:param name="inResponse" select="false()" />
    <xsl:param name="suffix" select="null" />
    <xsl:variable name="noArray" select="$inParameter" />
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
    <xsl:variable name="typename">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$singleType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="$collection">
      <xsl:if test="$odata-version='2.0'">
        <xsl:if test="$inResponse">
          <xsl:text>"title":"Collection of </xsl:text>
          <xsl:value-of select="$typename" />
          <xsl:text>",</xsl:text>
        </xsl:if>
        <xsl:text>"type":"object","properties":{</xsl:text>
        <xsl:if test="$inResponse">
          <xsl:text>"__count":{"$ref":"</xsl:text>
          <xsl:value-of select="$reuse-schemas" />
          <xsl:text>count"},</xsl:text>
        </xsl:if>
        <xsl:text>"results":{</xsl:text>
      </xsl:if>
      <xsl:text>"type":"array","items":{</xsl:text>
    </xsl:if>
    <xsl:choose>
      <xsl:when test="$singleType='Edm.String'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:apply-templates select="$target/@MaxLength" />
        <xsl:call-template name="Validation.AllowedValues">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^'[^']*(''[^']*)*'$"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:call-template name="Validation.Pattern">
              <xsl:with-param name="target" select="$target" />
            </xsl:call-template>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:call-template name="Core.Example">
          <xsl:with-param name="target" select="$target" />
          <xsl:with-param name="default">
            <xsl:if test="not($inParameter) and not($nullable='false') and $openapi-version='2.0'">
              <xsl:text>"string"</xsl:text>
            </xsl:if>
          </xsl:with-param>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Stream'">
        <xsl:variable name="json-property" select="$target/edm:Annotation[(@Term=concat($coreNamespace,'.AcceptableMediaTypes')
                                       or @Term=concat($coreAlias,'.AcceptableMediaTypes')) and not(@Qualifier)]/edm:Collection/edm:String[starts-with(.,'application/json')]" />
        <xsl:choose>
          <xsl:when test="$json-property">
            <xsl:variable name="schema">
              <xsl:call-template name="JSON.Schema">
                <xsl:with-param name="target" select="$target" />
              </xsl:call-template>
            </xsl:variable>
            <xsl:choose>
              <xsl:when test="$schema!=''">
                <xsl:value-of select="$schema" />
              </xsl:when>
              <xsl:when test="not($inParameter and $openapi-version='2.0')">
                <xsl:text>"example":{}</xsl:text>
              </xsl:when>
            </xsl:choose>
          </xsl:when>
          <xsl:otherwise>
            <xsl:call-template name="nullableType">
              <xsl:with-param name="type" select="'string'" />
              <xsl:with-param name="nullable" select="$nullable" />
              <xsl:with-param name="noArray" select="$noArray" />
            </xsl:call-template>
            <xsl:text>,"format":"base64url"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Binary'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^X'([0-9a-fA-F][0-9a-fA-F])*'$"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"base64url"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:apply-templates select="$target/@MaxLength" />
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
          <xsl:with-param name="type">
            <xsl:choose>
              <xsl:when test="$odata-version='2.0'">
                <xsl:value-of select="'string'" />
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="'number,string'" />
              </xsl:otherwise>
            </xsl:choose>
          </xsl:with-param>
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^[-]?[0-9]+(\\.[0-9]+)?[mM]$"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"decimal"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:choose>
          <xsl:when test="not($target/@Scale) or $target/@Scale='0'">
            <xsl:text>,"multipleOf":1</xsl:text>
          </xsl:when>
          <xsl:when test="number($target/@Scale)=$target/@Scale">
            <xsl:text>,"multipleOf":1.0e-</xsl:text>
            <xsl:value-of select="$target/@Scale" />
          </xsl:when>
        </xsl:choose>
        <xsl:variable name="scale">
          <xsl:choose>
            <xsl:when test="number($target/@Scale)=$target/@Scale">
              <xsl:value-of select="$target/@Scale" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="0" />
            </xsl:otherwise>
          </xsl:choose>
        </xsl:variable>
        <xsl:variable name="limit">
          <xsl:choose>
            <xsl:when test="$target/@Precision > $scale">
              <xsl:call-template name="repeat">
                <xsl:with-param name="string" select="'9'" />
                <xsl:with-param name="count" select="$target/@Precision - $scale" />
              </xsl:call-template>
            </xsl:when>
            <xsl:when test="$target/@Precision = $scale">
              <xsl:text>0</xsl:text>
            </xsl:when>
          </xsl:choose>
          <xsl:if test="$scale > 0">
            <xsl:text>.</xsl:text>
            <xsl:call-template name="repeat">
              <xsl:with-param name="string" select="'9'" />
              <xsl:with-param name="count" select="$scale" />
            </xsl:call-template>
          </xsl:if>
        </xsl:variable>
        <xsl:variable name="minimum">
          <xsl:call-template name="Validation.Minimum">
            <xsl:with-param name="target" select="$target" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="maximum">
          <xsl:call-template name="Validation.Maximum">
            <xsl:with-param name="target" select="$target" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:choose>
          <xsl:when test="$minimum!=''">
            <xsl:value-of select="$minimum" />
          </xsl:when>
          <xsl:when test="$target/@Precision &lt; 16">
            <xsl:text>,"minimum":-</xsl:text>
            <xsl:value-of select="$limit" />
          </xsl:when>
        </xsl:choose>
        <xsl:choose>
          <xsl:when test="$maximum!=''">
            <xsl:value-of select="$maximum" />
          </xsl:when>
          <xsl:when test="$target/@Precision &lt; 16">
            <xsl:text>,"maximum":</xsl:text>
            <xsl:value-of select="$limit" />
          </xsl:when>
        </xsl:choose>
        <xsl:if test="not($inParameter and $openapi-version='2.0')">
          <xsl:call-template name="Core.Example">
            <xsl:with-param name="target" select="$target" />
            <xsl:with-param name="default">
              <xsl:if test="$odata-version='2.0'">
                <xsl:text>"</xsl:text>
              </xsl:if>
              <xsl:text>0</xsl:text>
              <xsl:if test="$odata-version='2.0'">
                <xsl:text>"</xsl:text>
              </xsl:if>
            </xsl:with-param>
          </xsl:call-template>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Byte'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"uint8"</xsl:text>
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.SByte'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int8"</xsl:text>
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Int16'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int16"</xsl:text>
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Int32'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'integer'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"int32"</xsl:text>
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Int64'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type">
            <xsl:choose>
              <xsl:when test="$odata-version='2.0'">
                <xsl:value-of select="'string'" />
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="'integer,string'" />
              </xsl:otherwise>
            </xsl:choose>
          </xsl:with-param>
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^[-]?[0-9]+[lL]$"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"int64"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <!-- TODO: make example depend on min-max -->
        <xsl:if test="not($inParameter and $openapi-version='2.0')">
          <xsl:text>,"example":"42"</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Date'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^datetime'[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00'$"</xsl:text>
          </xsl:when>
          <xsl:when test="$odata-version='2.0'">
            <xsl:text>,"example":"/Date(1492041600000)/"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"date"</xsl:text>
            <xsl:if test="not($inParameter and $openapi-version='2.0')">
              <xsl:text>,"example":"2017-04-13"</xsl:text>
            </xsl:if>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Double'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'number,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"double"</xsl:text>
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:if test="not($inParameter and $openapi-version='2.0')">
          <xsl:text>,"example":3.14</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Single'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'number,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"float"</xsl:text>
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:if test="not($inParameter and $openapi-version='2.0')">
          <xsl:text>,"example":3.14</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Guid'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^guid'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'$"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"uuid"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:if test="not($inParameter)">
          <xsl:text>,"example":"01234567-89ab-cdef-0123-456789abcdef"</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.DateTimeOffset'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^datetime'[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\\.[0-9]+)?)?'$"</xsl:text>
          </xsl:when>
          <xsl:when test="$odata-version='2.0'">
            <xsl:text>,"example":"/Date(1492098664000)/"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"date-time"</xsl:text>
            <xsl:if test="not($inParameter)">
              <xsl:text>,"example":"2017-04-13T15:51:04Z"</xsl:text>
            </xsl:if>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$singleType='Edm.TimeOfDay'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:choose>
          <xsl:when test="$inParameter and $odata-version='2.0'">
            <xsl:text>,"pattern":"^time'PT(([01]?[0-9]|2[0-3])H)?([0-5]?[0-9]M)?([0-5]?[0-9](\\.[0-9]+)?S)?'$"</xsl:text>
          </xsl:when>
          <xsl:when test="$odata-version='2.0'">
            <xsl:text>,"example":"PT15H51M04S"</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>,"format":"time"</xsl:text>
            <xsl:if test="not($inParameter)">
              <xsl:text>,"example":"15:51:04"</xsl:text>
            </xsl:if>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Duration'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
        <xsl:text>,"format":"duration"</xsl:text>
        <xsl:if test="not($inParameter)">
          <xsl:text>,"example":"P4DT15H51M04S"</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.PrimitiveType'">
        <xsl:call-template name="nullableType">
          <xsl:with-param name="type" select="'boolean,number,string'" />
          <xsl:with-param name="nullable" select="$nullable" />
          <xsl:with-param name="noArray" select="$noArray" />
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$singleType='Edm.AnnotationPath' or $singleType='Edm.NavigationPropertyPath' or $singleType='Edm.PropertyPath'">
        <xsl:text>"type":"string"</xsl:text>
      </xsl:when>
      <xsl:when test="$singleType='Edm.GeographyPoint' or $singleType='Edm.GeometryPoint'">
        <xsl:if test="not($openapi-version='2.0') and (not($nullable='false') or $target/@DefaultValue)">
          <xsl:if test="not($nullable='false')">
            <xsl:text>"nullable":true,</xsl:text>
          </xsl:if>
          <xsl:text>"anyOf":[{</xsl:text>
        </xsl:if>
        <xsl:text>"$ref":"</xsl:text>
        <xsl:value-of select="$reuse-schemas" />
        <xsl:text>geoPoint"</xsl:text>
        <xsl:if test="not($openapi-version='2.0') and (not($nullable='false') or $target/@DefaultValue)">
          <xsl:text>}]</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$singleType='Edm.Untyped'">
        <xsl:if test="not($inParameter and $openapi-version='2.0')">
          <xsl:text>"example":{}</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="$qualifier='Edm'">
        <xsl:message>
          <xsl:text>TODO: inline </xsl:text>
          <xsl:value-of select="$singleType" />
        </xsl:message>
        <xsl:if test="not($openapi-version='2.0') and (not($nullable='false') or $target/@DefaultValue)">
          <xsl:if test="not($nullable='false')">
            <xsl:text>"nullable":true,</xsl:text>
          </xsl:if>
          <xsl:text>"anyOf":[{</xsl:text>
        </xsl:if>
        <xsl:text>"$ref":"</xsl:text>
        <xsl:value-of select="$odata-schema" />
        <xsl:text>#/definitions/</xsl:text>
        <xsl:value-of select="$singleType" />
        <xsl:text>"</xsl:text>
        <xsl:if test="not($openapi-version='2.0') and (not($nullable='false') or $target/@DefaultValue)">
          <xsl:text>}]</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:otherwise>
        <xsl:if test="not($openapi-version='2.0') and (not($nullable='false') or $target/@DefaultValue or $target/@MaxLength)">
          <xsl:if test="not($nullable='false')">
            <xsl:text>"nullable":true,</xsl:text>
          </xsl:if>
          <xsl:text>"anyOf":[{</xsl:text>
        </xsl:if>
        <xsl:call-template name="ref">
          <xsl:with-param name="qualifier" select="$qualifier" />
          <xsl:with-param name="name" select="$typename" />
          <xsl:with-param name="suffix" select="$suffix" />
        </xsl:call-template>
        <xsl:if test="not($openapi-version='2.0') and (not($nullable='false') or @DefaultValue or $target/@MaxLength)">
          <xsl:text>}]</xsl:text>
        </xsl:if>
        <xsl:apply-templates select="$target/@MaxLength" />
        <xsl:call-template name="Validation.Minimum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:call-template name="Validation.Maximum">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:apply-templates select="$target/@DefaultValue">
      <xsl:with-param name="type" select="$singleType" />
    </xsl:apply-templates>
    <xsl:if test="$collection">
      <xsl:if test="$odata-version='2.0'">
        <xsl:text>}}</xsl:text>
      </xsl:if>
      <xsl:text>}</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="Core.Example">
    <xsl:param name="target" />
    <xsl:param name="default" />
    <xsl:variable name="target-path">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Namespace" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="target-path-aliased">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Alias" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="anno" select="//edm:Annotations[@Target=$target-path or @Target=$target-path-aliased]/edm:Annotation[@Term=concat($coreNamespace,'.Example') or @Term=concat($coreAlias,'.Example')]
                                                                             |$target/edm:Annotation[@Term=concat($coreNamespace,'.Example') or @Term=concat($coreAlias,'.Example')]" />
    <xsl:variable name="value" select="$anno/edm:Record/edm:PropertyValue[@Property='Value']" />
    <xsl:variable name="value-s" select="$value/@String|$value/edm:String" />
    <xsl:variable name="value-d" select="$value/@Decimal|$value/edm:Decimal" />
    <xsl:if test="$value-s or $value-d or string($default)">
      <xsl:text>,"example":</xsl:text>
      <xsl:choose>
        <xsl:when test="$value-s">
          <xsl:text>"</xsl:text>
          <xsl:value-of select="$value-s" />
          <xsl:text>"</xsl:text>
        </xsl:when>
        <xsl:when test="$value-d">
          <xsl:if test="$odata-version='2.0'">
            <xsl:text>"</xsl:text>
          </xsl:if>
          <xsl:value-of select="$value-d" />
          <xsl:if test="$odata-version='2.0'">
            <xsl:text>"</xsl:text>
          </xsl:if>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$default" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>

  <xsl:template name="JSON.Schema">
    <xsl:param name="target" />
    <xsl:variable name="target-path">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="target-path-aliased">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Alias" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="schema" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[(@Term=concat($jsonNamespace,'.Schema') or @Term=concat($jsonAlias,'.Schema')) and not(@Qualifier)]
                                                                               |$target/edm:Annotation[(@Term=concat($jsonNamespace,'.Schema') or @Term=concat($jsonAlias,'.Schema')) and not(@Qualifier)]" />
    <xsl:if test="$schema">
      <xsl:variable name="schema-string" select="$schema/@String|$schema/edm:String" />
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="substring-after($schema-string,'{')" />
        <xsl:with-param name="marker" select="'}'" />
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <xsl:template name="Validation.AllowedValues">
    <xsl:param name="target" />
    <xsl:variable name="target-path">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="target-path-aliased">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Alias" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="allowedValues" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[(@Term=concat($validationNamespace,'.AllowedValues') or @Term=concat($validationAlias,'.AllowedValues')) and not(@Qualifier)]
                                                                               |$target/edm:Annotation[(@Term=concat($validationNamespace,'.AllowedValues') or @Term=concat($validationAlias,'.AllowedValues')) and not(@Qualifier)]" />
    <xsl:if test="$allowedValues">
      <xsl:text>,"enum":[</xsl:text>
      <xsl:apply-templates select="$allowedValues/edm:Collection/edm:Record" mode="Validation.AllowedValues" />
      <xsl:text>]</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="Validation.Minimum">
    <xsl:param name="target" />
    <xsl:variable name="target-path">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="target-path-aliased">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Alias" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="minimum" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[(@Term=concat($validationNamespace,'.Minimum') or @Term=concat($validationAlias,'.Minimum')) and not(@Qualifier)]
                                                                               |$target/edm:Annotation[(@Term=concat($validationNamespace,'.Minimum') or @Term=concat($validationAlias,'.Minimum')) and not(@Qualifier)]" />
    <xsl:if test="$minimum">
      <xsl:text>,"minimum":</xsl:text>
      <xsl:value-of select="$minimum/@Decimal|$minimum/edm:Decimal" />
      <xsl:variable name="exclusive" select="$minimum/edm:Annotation[(@Term=concat($validationNamespace,'.Exclusive') or @Term=concat($validationAlias,'.Exclusive')) and not(@Qualifier)]" />
      <xsl:if test="$exclusive/@Bool = 'true' or $exclusive/edm:Bool='true'">
        <xsl:text>,"exclusiveMinimum":true</xsl:text>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template name="Validation.Maximum">
    <xsl:param name="target" />
    <xsl:variable name="target-path">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="target-path-aliased">
      <xsl:call-template name="annotation-target">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="qualifier" select="$target/ancestor::edm:Schema/@Alias" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="maximum" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation[(@Term=concat($validationNamespace,'.Maximum') or @Term=concat($validationAlias,'.Maximum')) and not(@Qualifier)]
                                                                               |$target/edm:Annotation[(@Term=concat($validationNamespace,'.Maximum') or @Term=concat($validationAlias,'.Maximum')) and not(@Qualifier)]" />
    <xsl:if test="$maximum">
      <xsl:text>,"maximum":</xsl:text>
      <xsl:value-of select="$maximum/@Decimal|$maximum/edm:Decimal" />
    </xsl:if>
    <xsl:variable name="exclusive" select="$maximum/edm:Annotation[(@Term=concat($validationNamespace,'.Exclusive') or @Term=concat($validationAlias,'.Exclusive')) and not(@Qualifier)]" />
    <xsl:if test="$exclusive/@Bool = 'true' or $exclusive/edm:Bool='true'">
      <xsl:text>,"exclusiveMaximum":true</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="Validation.Pattern">
    <xsl:param name="target" />
    <xsl:variable name="pattern">
      <xsl:call-template name="annotation-string">
        <xsl:with-param name="node" select="$target" />
        <xsl:with-param name="term" select="concat($validationNamespace,'.Pattern')" />
        <xsl:with-param name="termAliased" select="concat($validationAlias,'.Pattern')" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="$pattern!=''">
      <xsl:text>,"pattern":"</xsl:text>
      <xsl:value-of select="$pattern" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Record" mode="Validation.AllowedValues">
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="edm:PropertyValue[@Property='Value']/@String|edm:PropertyValue[@Property='Value']/edm:String" />
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template name="ref">
    <xsl:param name="qualifier" />
    <xsl:param name="name" />
    <xsl:param name="suffix" select="null" />
    <xsl:variable name="internalNamespace" select="//edm:Schema[@Alias=$qualifier]/@Namespace|//edm:Schema[@Namespace=$qualifier]/@Namespace" />
    <xsl:choose>
      <xsl:when test="$internalNamespace">
        <xsl:text>"$ref":"</xsl:text>
        <xsl:value-of select="$reuse-schemas" />
        <xsl:value-of select="$internalNamespace" />
        <xsl:if test="not(//edm:Schema[@Namespace=$internalNamespace]/edm:*[@Name=$name])">
          <xsl:message>
            <xsl:text>Unknown type: </xsl:text>
            <xsl:value-of select="$qualifier" />
            <xsl:text>.</xsl:text>
            <xsl:value-of select="$name" />
          </xsl:message>
        </xsl:if>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"$ref":"</xsl:text>
        <xsl:variable name="externalNamespace" select="//edmx:Include[@Alias=$qualifier]/@Namespace|//edmx:Include[@Namespace=$qualifier]/@Namespace" />
        <xsl:call-template name="json-url">
          <xsl:with-param name="url" select="//edmx:Include[@Namespace=$externalNamespace]/../@Uri" />
        </xsl:call-template>
        <xsl:value-of select="$reuse-schemas" />
        <xsl:value-of select="$externalNamespace" />
        <xsl:if test="not($externalNamespace)">
          <xsl:message>
            <xsl:text>Unknown qualifier: </xsl:text>
            <xsl:value-of select="$qualifier" />
            <xsl:text>Node: </xsl:text>
            <xsl:value-of select="local-name()" />
          </xsl:message>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>.</xsl:text>
    <xsl:value-of select="$name" />
    <xsl:if test="//edm:Schema[@Namespace=$qualifier or @Alias=$qualifier]/edm:EntityType[@Name=$name]|//edm:Schema[@Namespace=$qualifier or @Alias=$qualifier]/edm:ComplexType[@Name=$name]">
      <xsl:value-of select="$suffix" />
    </xsl:if>
    <xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template name="schema-ref">
    <xsl:param name="qualifiedName" />
    <xsl:param name="suffix" select="null" />
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
      <xsl:with-param name="suffix" select="$suffix" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="repeat">
    <xsl:param name="string" />
    <xsl:param name="count" />
    <xsl:if test="$count > 0">
      <xsl:value-of select="$string" />
    </xsl:if>
    <xsl:if test="$count > 1">
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
    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
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
      </xsl:when>
      <xsl:otherwise>
        <xsl:choose>
          <xsl:when test="contains($type,',')">
            <xsl:text>"anyOf":[{"type":"</xsl:text>
            <xsl:call-template name="replace-all">
              <xsl:with-param name="string" select="$type" />
              <xsl:with-param name="old" select="','" />
              <xsl:with-param name="new" select="'&quot;},{&quot;type&quot;:&quot;'" />
            </xsl:call-template>
            <xsl:text>"}]</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>"type":"</xsl:text>
            <xsl:value-of select="$type" />
            <xsl:text>"</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:if test="not($nullable='false')">
          <xsl:text>,"nullable":true</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="@MaxLength">
    <xsl:if test=".!='max'">
      <xsl:text>,"maxLength":</xsl:text>
      <xsl:choose>
        <xsl:when test="../@Type='Edm.Binary'">
          <xsl:value-of select="ceiling(4 * . div 3)" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="." />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>

  <xsl:template match="@DefaultValue">
    <xsl:param name="type" />
    <xsl:text>,"default":</xsl:text>
    <xsl:choose>
      <xsl:when test="$type='Edm.Boolean' and (.='true' or .='false' or .='null')">
        <xsl:value-of select="." />
      </xsl:when>
      <xsl:when test="($type='Edm.Decimal' or $type='Edm.Double' or $type='Edm.Single' or 
       $type='Edm.Byte' or $type='Edm.SByte' or $type='Edm.Int16' or $type='Edm.Int32') and .=number(.)">
        <xsl:value-of select="." />
      </xsl:when>
      <xsl:when test="$type='Edm.Int64' and number(.) &lt; 9007199254740992">
        <xsl:value-of select="." />
      </xsl:when>
      <!-- FAKE: couldn't determine underlying primitive type, so guess from value -->
      <xsl:when test="substring($type,4)!='Edm.' and (.='true' or .='false' or .='null' or (.=number(.) and string-length(.) &lt; 16))">
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

    <xsl:variable name="batch-supported">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'BatchSupported'" />
        <xsl:with-param name="target" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="not($batch-supported='false')">
      <xsl:call-template name="batch" />
    </xsl:if>
  </xsl:template>

  <xsl:template name="batch">
    <xsl:if test="edm:EntitySet|edm:Singleton|edm:FunctionImport|edm:ActionImport">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"/$batch":{"post":{"summary": "Send a group of requests","description": "Group multiple requests into a single request payload, see [Batch Requests](</xsl:text>
    <xsl:choose>
      <xsl:when test="$odata-version='2.0'">
        <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=152</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_BatchRequests</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>).</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>\n\n*Please note that \"Try it out\" is not supported for this request.*</xsl:text>
    </xsl:if>
    <xsl:text>","tags":["Batch Requests"],</xsl:text>
    <xsl:if test="$openapi-version='2.0'">
      <xsl:text>"consumes":["multipart/mixed;boundary=request-separator"],"produces":["multipart/mixed"],</xsl:text>
    </xsl:if>

    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
        <xsl:text>"parameters":[{"name":"requestBody","in":"body",</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"requestBody":{"required":true,</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"description":"Batch request",</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>"content":{"multipart/mixed;boundary=request-separator":{</xsl:text>
    </xsl:if>
    <xsl:text>"schema":{"type":"string"</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <xsl:text>,"example":"--request-separator\nContent-Type: application/http\nContent-Transfer-Encoding: binary\n\nGET </xsl:text>
    <xsl:value-of select="//edm:EntitySet[1]/@Name" />
    <xsl:text> HTTP/1.1\nAccept: application/json\n\n\n--request-separator--"}</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
        <xsl:text>}]</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:text>,"responses":{"</xsl:text>
    <xsl:choose>
      <xsl:when test="$odata-version='2.0' or $odata-version='3.0'">
        <xsl:text>202</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>200</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>":{"description":"Batch response",</xsl:text>

    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>"content":{"multipart/mixed":{</xsl:text>
    </xsl:if>
    <xsl:text>"schema":{"type":"string"</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <xsl:text>,"example": "--response-separator\nContent-Type: application/http\n\nHTTP/1.1 200 OK\nContent-Type: application/json\n\n{...}\n--response-separator--"}</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <xsl:text>},</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}}}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EntitySet|edm:Singleton" mode="tags">
    <xsl:if test="position() = 1">
      <xsl:text>,"tags":[</xsl:text>
    </xsl:if>
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>

    <xsl:text>{"name":"</xsl:text>
    <xsl:call-template name="entityset-label">
      <xsl:with-param name="set" select="." />
    </xsl:call-template>

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

  <xsl:template name="operation-tag">
    <xsl:param name="sourceSet" />
    <xsl:param name="targetSet" select="null" />
    <xsl:param name="fallback" select="null" />
    <xsl:text>,"tags":["</xsl:text>
    <xsl:variable name="parameters" select="$sourceSet/edm:Annotation[@Term='sap.parameters']" />
    <xsl:if test="not($parameters)">
      <xsl:choose>
        <xsl:when test="$sourceSet">
          <xsl:call-template name="entityset-label">
            <xsl:with-param name="set" select="$sourceSet" />
          </xsl:call-template>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$fallback" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
    <xsl:if test="$targetSet and $targetSet/@Name!=$sourceSet/@Name">
      <xsl:if test="not($parameters)">
        <xsl:text>","</xsl:text>
      </xsl:if>
      <xsl:call-template name="entityset-label">
        <xsl:with-param name="set" select="$targetSet" />
      </xsl:call-template>
    </xsl:if>
    <xsl:text>"]</xsl:text>
  </xsl:template>

  <xsl:template name="entityset-label">
    <xsl:param name="set" />
    <xsl:choose>
      <xsl:when test="$label-as-tag">
        <xsl:variable name="typename" select="$set/@EntityType|$set/@Type" />
        <xsl:variable name="qualifier">
          <xsl:call-template name="substring-before-last">
            <xsl:with-param name="input" select="$typename" />
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
            <xsl:with-param name="input" select="$typename" />
            <xsl:with-param name="marker" select="'.'" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="entityType" select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$type]" />
        <xsl:variable name="label">
          <xsl:call-template name="Common.Label">
            <xsl:with-param name="node" select="$entityType" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:choose>
          <xsl:when test="$label!=''">
            <xsl:value-of select="$label" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="$set/@Name" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$set/@Name" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:EntitySet">
    <xsl:variable name="target-path" select="concat(../../@Namespace,'.',../@Name,'/',@Name)" />
    <xsl:variable name="target-path-aliased" select="concat(../../@Alias,'.',../@Name,'/',@Name)" />
    <xsl:variable name="annotations" select="edm:Annotation|//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation" />

    <xsl:variable name="readRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.ReadRestrictions') or @Term=concat($capabilitiesAlias,'.ReadRestrictions')]" />
    <xsl:variable name="insertRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.InsertRestrictions') or @Term=concat($capabilitiesAlias,'.InsertRestrictions')]" />

    <xsl:variable name="readable">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'ReadRestrictions'" />
        <xsl:with-param name="property" select="'Readable'" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="insertable">
      <xsl:call-template name="capability">
        <xsl:with-param name="term" select="'InsertRestrictions'" />
        <xsl:with-param name="property" select="'Insertable'" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:call-template name="pathItem-entity-collection">
      <xsl:with-param name="type" select="@EntityType" />
      <xsl:with-param name="return-collection" select="true()" />
      <xsl:with-param name="root" select="." />
      <xsl:with-param name="path-prefix" select="@Name" />
      <xsl:with-param name="prefix-parameters" select="''" />
      <xsl:with-param name="navigationPropertyRestriction" select="null" />
      <xsl:with-param name="navigation-prefix" select="''" />
      <xsl:with-param name="readRestrictions" select="$readRestrictions" />
      <xsl:with-param name="insertRestrictions" select="$insertRestrictions" />
      <xsl:with-param name="targetSet" select="." />
      <xsl:with-param name="with-get" select="not($readable='false')" />
      <xsl:with-param name="with-post" select="not($insertable='false')" />
    </xsl:call-template>

    <xsl:variable name="indexable">
      <xsl:call-template name="capability-indexablebykey" />
    </xsl:variable>

    <xsl:if test="not($indexable='false')">
      <xsl:call-template name="pathItem-single-entity">
        <xsl:with-param name="type" select="@EntityType" />
        <xsl:with-param name="with-key" select="true()" />
        <xsl:with-param name="root" select="." />
        <xsl:with-param name="path-prefix" select="@Name" />
        <xsl:with-param name="prefix-parameters" select="''" />
        <xsl:with-param name="level" select="0" />
        <xsl:with-param name="navigationRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.NavigationRestrictions') or @Term=concat($capabilitiesAlias,'.NavigationRestrictions')]" />
        <xsl:with-param name="navigation-prefix" select="''" />
        <xsl:with-param name="readRestrictions" select="$readRestrictions" />
        <xsl:with-param name="selectSupport" select="$annotations[@Term=concat($capabilitiesNamespace,'.SelectSupport') or @Term=concat($capabilitiesAlias,'.SelectSupport')]" />
        <xsl:with-param name="expandRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.ExpandRestrictions') or @Term=concat($capabilitiesAlias,'.ExpandRestrictions')]" />
        <xsl:with-param name="updateRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.UpdateRestrictions') or @Term=concat($capabilitiesAlias,'.UpdateRestrictions')]" />
        <xsl:with-param name="deleteRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.DeleteRestrictions') or @Term=concat($capabilitiesAlias,'.DeleteRestrictions')]" />
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Singleton">
    <xsl:variable name="target-path" select="concat(../../@Namespace,'.',../@Name,'/',@Name)" />
    <xsl:variable name="target-path-aliased" select="concat(../../@Alias,'.',../@Name,'/',@Name)" />
    <xsl:variable name="annotations" select="edm:Annotation|//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation" />

    <xsl:call-template name="pathItem-single-entity">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="with-key" select="false()" />
      <xsl:with-param name="root" select="." />
      <xsl:with-param name="path-prefix" select="@Name" />
      <xsl:with-param name="prefix-parameters" select="''" />
      <xsl:with-param name="level" select="0" />
      <xsl:with-param name="navigationRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.NavigationRestrictions') or @Term=concat($capabilitiesAlias,'.NavigationRestrictions')]" />
      <xsl:with-param name="navigation-prefix" select="''" />
      <xsl:with-param name="readRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.ReadRestrictions') or @Term=concat($capabilitiesAlias,'.ReadRestrictions')]" />
      <xsl:with-param name="selectSupport" select="$annotations[@Term=concat($capabilitiesNamespace,'.SelectSupport') or @Term=concat($capabilitiesAlias,'.SelectSupport')]" />
      <xsl:with-param name="expandRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.ExpandRestrictions') or @Term=concat($capabilitiesAlias,'.ExpandRestrictions')]" />
      <xsl:with-param name="updateRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.UpdateRestrictions') or @Term=concat($capabilitiesAlias,'.UpdateRestrictions')]" />
      <xsl:with-param name="deleteRestrictions" select="$annotations[@Term=concat($capabilitiesNamespace,'.DeleteRestrictions') or @Term=concat($capabilitiesAlias,'.DeleteRestrictions')]" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="edm:NavigationProperty" mode="pathItem">
    <xsl:param name="root" />
    <xsl:param name="path-prefix" />
    <xsl:param name="prefix-parameters" />
    <xsl:param name="level" />
    <xsl:param name="navigationRestrictions" />
    <xsl:param name="navigation-prefix" />

    <xsl:variable name="navPropPath" select="concat($navigation-prefix,@Name)" />
    <xsl:variable name="bindingTarget" select="$root/edm:NavigationPropertyBinding[@Path=$navPropPath]/@Target" />
    <xsl:variable name="targetEntitySetName">
      <xsl:choose>
        <xsl:when test="contains($bindingTarget,'/') and substring-before($bindingTarget,'/') = concat($root/../../@Namespace,'.',$root/../@Name)">
          <xsl:value-of select="substring-after($bindingTarget,'/')" />
        </xsl:when>
        <xsl:when test="contains($bindingTarget,'/') and substring-before($bindingTarget,'/') = concat($root/../../@Alias,'.',$root/../@Name)">
          <xsl:value-of select="substring-after($bindingTarget,'/')" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$bindingTarget" />
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="targetSet" select="//edm:EntitySet[@Name=$targetEntitySetName]" />

    <!-- NavigationRestrictions on root for this navigation property -->
    <xsl:variable name="restrictedProperties" select="$navigationRestrictions/edm:Record/edm:PropertyValue[@Property='RestrictedProperties']/edm:Collection" />
    <xsl:variable name="navigationPropertyRestriction" select="$restrictedProperties/edm:Record[edm:PropertyValue[@Property='NavigationProperty']/@NavigationPropertyPath=$navPropPath]" />
    <!-- navigability -->
    <xsl:variable name="rootNavigability-p" select="$navigationRestrictions/edm:Record/edm:PropertyValue[@Property='Navigability']" />
    <xsl:variable name="rootNavigability" select="substring-after($rootNavigability-p/edm:EnumMember|$rootNavigability-p/@EnumMember,'/')" />
    <xsl:variable name="propertyNavigability-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='Navigability']" />
    <xsl:variable name="propertyNavigability" select="substring-after($propertyNavigability-p/edm:EnumMember|$propertyNavigability-p/@EnumMember,'/')" />
    <xsl:variable name="navigable" select="$propertyNavigability='Recursive' or $propertyNavigability='Single' 
              or (string-length($propertyNavigability)=0 and not($rootNavigability='None'))" />

    <xsl:if test="$navigable">
      <xsl:variable name="collection" select="starts-with(@Type,'Collection(')" />
      <xsl:variable name="singleType">
        <xsl:choose>
          <xsl:when test="$collection">
            <xsl:value-of select="substring-before(substring-after(@Type,'('),')')" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@Type" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:variable>

      <xsl:variable name="path-template">
        <xsl:value-of select="$path-prefix" />
        <xsl:text>/</xsl:text>
        <xsl:value-of select="@Name" />
      </xsl:variable>

      <xsl:if test="$collection or not(@ContainsTarget='true')">
        <xsl:variable name="readable">
          <xsl:call-template name="capability">
            <xsl:with-param name="term" select="'ReadRestrictions'" />
            <xsl:with-param name="property" select="'Readable'" />
            <xsl:with-param name="target" select="$targetSet" />
          </xsl:call-template>
        </xsl:variable>

        <!-- ReadRestrictions on source for this navigation property -->
        <xsl:variable name="readRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='ReadRestrictions']/edm:Record/edm:PropertyValue[@Property='Readable']" />
        <xsl:variable name="navigation-readable" select="$readRestrictions/@Bool|$readRestrictions/edm:Bool" />

        <xsl:variable name="insertable">
          <xsl:call-template name="capability">
            <xsl:with-param name="term" select="'InsertRestrictions'" />
            <xsl:with-param name="property" select="'Insertable'" />
            <xsl:with-param name="target" select="$targetSet" />
          </xsl:call-template>
        </xsl:variable>

        <!-- InsertRestrictions on source for this navigation property -->
        <xsl:variable name="insertRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='InsertRestrictions']/edm:Record/edm:PropertyValue[@Property='Insertable']" />
        <xsl:variable name="navigation-insertable" select="$insertRestrictions/@Bool|$insertRestrictions/edm:Bool" />

        <xsl:text>,</xsl:text>
        <xsl:call-template name="pathItem-entity-collection">
          <xsl:with-param name="type" select="$singleType" />
          <xsl:with-param name="return-collection" select="$collection" />
          <xsl:with-param name="root" select="$root" />
          <xsl:with-param name="path-prefix" select="$path-template" />
          <xsl:with-param name="prefix-parameters" select="$prefix-parameters" />
          <xsl:with-param name="navigationPropertyRestriction" select="$navigationPropertyRestriction" />
          <xsl:with-param name="navigation-prefix" select="$navigation-prefix" />
          <xsl:with-param name="readRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='ReadRestrictions']" />
          <xsl:with-param name="insertRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='InsertRestrictions']" />
          <xsl:with-param name="targetSet" select="$targetSet" />
          <xsl:with-param name="with-get" select="$navigation-readable='true' or (not($navigation-readable) and not($readable='false'))" />
          <!-- TODO: need to look at both navigation restrictions and annotations on target set, same as with readable and insertable above.
            combine them either here or in template
            <xsl:with-param name="selectSupport"
            select="$navigationPropertyRestriction/edm:PropertyValue[@Property='SelectSupport']" />
          -->
          <xsl:with-param name="with-post" select="$collection and ($targetSet or @ContainsTarget='true') and ($navigation-insertable='true' or (not($navigation-insertable) and not($insertable='false')))" />
        </xsl:call-template>
      </xsl:if>

      <xsl:if test="@ContainsTarget='true' and $level&lt;$max-levels">
        <xsl:variable name="indexable-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='IndexableByKey']" />
        <xsl:variable name="indexable" select="$indexable-p/@Bool|$indexable-p/edm:Bool" />
        <xsl:if test="not($indexable='false')">
          <xsl:call-template name="pathItem-single-entity">
            <xsl:with-param name="type" select="$singleType" />
            <xsl:with-param name="with-key" select="$collection" />
            <xsl:with-param name="root" select="$root" />
            <xsl:with-param name="path-prefix" select="$path-template" />
            <xsl:with-param name="prefix-parameters" select="$prefix-parameters" />
            <xsl:with-param name="level" select="$level" />
            <xsl:with-param name="navigationRestrictions" select="$navigationRestrictions" />
            <xsl:with-param name="navigation-prefix" select="concat($navPropPath,'/')" />
            <xsl:with-param name="readRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='ReadRestrictions']" />
            <xsl:with-param name="selectSupport" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='SelectSupport']" />
            <!-- TODO: this is not correct, ExpandRestrictions are on container-child-level only -->
            <xsl:with-param name="expandRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='ExpandRestrictions']" />
            <xsl:with-param name="updateRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='UpdateRestrictions']" />
            <xsl:with-param name="deleteRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='DeleteRestrictions']" />
          </xsl:call-template>
        </xsl:if>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template name="filter-RequiredProperties">
    <xsl:param name="target" select="." />
    <xsl:variable name="target-path" select="concat($target/../../@Namespace,'.',$target/../@Name,'/',$target/@Name)" />
    <xsl:variable name="target-path-aliased" select="concat($target/../../@Alias,'.',$target/../@Name,'/',$target/@Name)" />
    <xsl:variable name="target-node" select="//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]|$target" />
    <xsl:variable name="filter-restrictions" select="$target-node/edm:Annotation[@Term=concat($capabilitiesNamespace,'.FilterRestrictions') or @Term=concat($capabilitiesAlias,'.FilterRestrictions')]" />
    <xsl:variable name="required-properties" select="$filter-restrictions/edm:Record/edm:PropertyValue[@Property='RequiredProperties']/edm:Collection/edm:PropertyPath" />
    <xsl:apply-templates select="$required-properties" mode="filter-RequiredProperties" />
  </xsl:template>

  <xsl:template match="edm:PropertyPath" mode="filter-RequiredProperties">
    <xsl:if test="position()=1">
      <xsl:text>\n\nRequired filter properties:</xsl:text>
    </xsl:if>
    <xsl:text>\n- </xsl:text>
    <xsl:value-of select="." />
  </xsl:template>

  <xsl:template match="edm:Property" mode="orderby">
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{"name":"</xsl:text>
      <xsl:value-of select="$option-prefix" />
      <xsl:text>orderby","in":"query","description":"Order items by property values, see [Sorting](</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=65</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>)",</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>"explode":false,"schema":{</xsl:text>
      </xsl:if>
      <xsl:text>"type":"array","uniqueItems":true,"items":{"type":"string","enum":[</xsl:text>
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
      <xsl:text>]}}</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>}</xsl:text>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Property|edm:NavigationProperty" mode="select">
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{"name":"</xsl:text>
      <xsl:value-of select="$option-prefix" />
      <xsl:text>select","in":"query","description":"Select properties to be returned, see [Select](</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=68</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>)",</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>"explode":false,"schema":{</xsl:text>
      </xsl:if>
      <xsl:text>"type":"array","uniqueItems":true,"items":{"type":"string","enum":[</xsl:text>
    </xsl:if>
    <xsl:if test="position()>1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"</xsl:text>
    <xsl:if test="position()=last()">
      <xsl:text>]}}</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>}</xsl:text>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template match="edm:Property|edm:NavigationProperty" mode="expand">
    <xsl:param name="after" select="'something'" />
    <xsl:if test="position()=1">
      <xsl:if test="$after">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>{"name":"</xsl:text>
      <xsl:value-of select="$option-prefix" />
      <xsl:text>expand","in":"query","description":"Expand related entities, see [Expand](</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=63</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>)",</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>"explode":false,"schema":{</xsl:text>
      </xsl:if>
      <xsl:text>"type":"array","uniqueItems":true,"items":{"type":"string","enum":[</xsl:text>
      <xsl:if test="$odata-version!='2.0'">
        <xsl:text>"*",</xsl:text>
      </xsl:if>
    </xsl:if>
    <xsl:if test="position()!=1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>"</xsl:text>
    <xsl:if test="position()=last()">
      <xsl:text>]}}</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>}</xsl:text>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template name="pathItem-entity-collection">
    <!-- TODO: split off non-collection part, call it separately from navigation property template -->
    <xsl:param name="type" />
    <xsl:param name="return-collection" />
    <xsl:param name="root" />
    <xsl:param name="path-prefix" />
    <xsl:param name="prefix-parameters" />
    <xsl:param name="navigationPropertyRestriction" />
    <xsl:param name="navigation-prefix" />
    <xsl:param name="readRestrictions" />
    <xsl:param name="insertRestrictions" />
    <!-- TODO: check if these parameters are needed -->
    <xsl:param name="targetSet" />
    <xsl:param name="with-get" />
    <xsl:param name="with-post" />

    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$type" />
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
    <xsl:variable name="typename">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="qualifiedType">
      <xsl:value-of select="$namespace" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$typename" />
    </xsl:variable>
    <xsl:variable name="aliasQualifiedType">
      <xsl:value-of select="//edm:Schema[@Namespace=$namespace]/@Alias" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$typename" />
    </xsl:variable>
    <xsl:variable name="entityType" select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$typename]" />

    <xsl:variable name="bindingType">
      <xsl:if test="$return-collection">
        <xsl:text>Collection(</xsl:text>
      </xsl:if>
      <xsl:value-of select="$qualifiedType" />
      <xsl:if test="$return-collection">
        <xsl:text>)</xsl:text>
      </xsl:if>
    </xsl:variable>
    <xsl:variable name="bindingTypeAliased">
      <xsl:if test="$return-collection">
        <xsl:text>Collection(</xsl:text>
      </xsl:if>
      <xsl:value-of select="$aliasQualifiedType" />
      <xsl:if test="$return-collection">
        <xsl:text>)</xsl:text>
      </xsl:if>
    </xsl:variable>

    <xsl:text>"/</xsl:text>
    <xsl:value-of select="$path-prefix" />
    <xsl:text>":{</xsl:text>

    <xsl:if test="$prefix-parameters!=''">
      <xsl:text>"parameters":[</xsl:text>
      <xsl:value-of select="$prefix-parameters" />
      <xsl:text>]</xsl:text>
    </xsl:if>

    <xsl:if test="$with-get">
      <xsl:if test="$prefix-parameters!=''">
        <xsl:text>,</xsl:text>
      </xsl:if>
      <xsl:text>"get":{</xsl:text>

      <xsl:call-template name="operation-summary-description">
        <xsl:with-param name="restriction" select="$readRestrictions" />
        <xsl:with-param name="fallback-summary">
          <xsl:text>Get </xsl:text>
          <xsl:if test="$return-collection">
            <xsl:text>entities from </xsl:text>
          </xsl:if>
          <xsl:if test="contains($path-prefix,'/')">
            <xsl:text>related </xsl:text>
          </xsl:if>
          <xsl:value-of select="@Name" />
        </xsl:with-param>
      </xsl:call-template>

      <xsl:call-template name="operation-tag">
        <xsl:with-param name="sourceSet" select="$root" />
        <xsl:with-param name="targetSet" select="$targetSet" />
      </xsl:call-template>

      <xsl:text>,"parameters":[</xsl:text>
      <xsl:call-template name="query-options">
        <xsl:with-param name="navigationPropertyRestriction" select="$navigationPropertyRestriction" />
        <xsl:with-param name="target" select="$targetSet" />
        <xsl:with-param name="collection" select="$return-collection" />
        <xsl:with-param name="entityType" select="$entityType" />
      </xsl:call-template>
      <xsl:text>]</xsl:text>

      <xsl:variable name="delta">
        <xsl:call-template name="capability">
          <xsl:with-param name="term" select="'ChangeTracking'" />
          <xsl:with-param name="property" select="'Supported'" />
        </xsl:call-template>
      </xsl:variable>

      <xsl:call-template name="responses">
        <xsl:with-param name="code" select="'200'" />
        <xsl:with-param name="type" select="$bindingType" />
        <xsl:with-param name="delta" select="$delta" />
        <xsl:with-param name="description">
          <xsl:choose>
            <xsl:when test="not($return-collection)">
              <xsl:text>Retrieved entity</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>Retrieved entities</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:with-param>
      </xsl:call-template>

      <xsl:text>}</xsl:text>
    </xsl:if>

    <xsl:if test="$with-post">
      <xsl:if test="$prefix-parameters!='' or $with-get">
        <xsl:text>,</xsl:text>
      </xsl:if>

      <xsl:text>"post":{</xsl:text>

      <xsl:call-template name="operation-summary-description">
        <xsl:with-param name="restriction" select="$insertRestrictions" />
        <xsl:with-param name="fallback-summary">
          <xsl:text>Add new entity to </xsl:text>
          <xsl:if test="contains($path-prefix,'/')">
            <xsl:text>related </xsl:text>
          </xsl:if>
          <xsl:value-of select="@Name" />
        </xsl:with-param>
      </xsl:call-template>

      <xsl:call-template name="operation-tag">
        <xsl:with-param name="sourceSet" select="$root" />
        <xsl:with-param name="targetSet" select="$targetSet" />
      </xsl:call-template>

      <xsl:choose>
        <xsl:when test="$openapi-version='2.0'">
          <xsl:text>,"parameters":[{"name":"</xsl:text>
          <xsl:value-of select="$typename" />
          <xsl:text>","in":"body",</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>,"requestBody":{"required":true,</xsl:text>
        </xsl:otherwise>
      </xsl:choose>

      <xsl:call-template name="entityTypeDescription">
        <xsl:with-param name="entityType" select="$entityType" />
        <xsl:with-param name="default" select="'New entity'" />
      </xsl:call-template>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>"content":{"application/json":{</xsl:text>
      </xsl:if>
      <xsl:text>"schema":{</xsl:text>
      <xsl:call-template name="schema-ref">
        <xsl:with-param name="qualifiedName" select="$qualifiedType" />
        <xsl:with-param name="suffix" select="'-create'" />
      </xsl:call-template>
      <xsl:text>}</xsl:text>
      <xsl:if test="$openapi-version!='2.0'">
        <xsl:text>}}</xsl:text>
      </xsl:if>
      <xsl:text>}</xsl:text>
      <xsl:if test="$openapi-version='2.0'">
        <xsl:text>]</xsl:text>
      </xsl:if>

      <xsl:call-template name="responses">
        <xsl:with-param name="code" select="'201'" />
        <xsl:with-param name="type" select="$qualifiedType" />
        <xsl:with-param name="description" select="'Created entity'" />
      </xsl:call-template>

      <xsl:text>}</xsl:text>
    </xsl:if>

    <xsl:text>}</xsl:text>

    <xsl:apply-templates select="//edm:Function[@IsBound='true' and (edm:Parameter[1]/@Type=$bindingType or edm:Parameter[1]/@Type=$bindingTypeAliased)]" mode="bound">
      <xsl:with-param name="root" select="$root" />
      <xsl:with-param name="path-prefix" select="$path-prefix" />
      <xsl:with-param name="prefix-parameters" select="$prefix-parameters" />
    </xsl:apply-templates>
    <xsl:apply-templates select="//edm:Action[@IsBound='true' and (edm:Parameter[1]/@Type=$bindingType or edm:Parameter[1]/@Type=$bindingTypeAliased)]" mode="bound">
      <xsl:with-param name="root" select="$root" />
      <xsl:with-param name="path-prefix" select="$path-prefix" />
      <xsl:with-param name="prefix-parameters" select="$prefix-parameters" />
    </xsl:apply-templates>

  </xsl:template>

  <xsl:template name="pathItem-single-entity">
    <xsl:param name="type" />
    <xsl:param name="with-key" />
    <xsl:param name="root" />
    <xsl:param name="path-prefix" />
    <xsl:param name="prefix-parameters" />
    <xsl:param name="level" />
    <!-- TODO: should be sufficient to pass just the records within RestrictedProperties/Collection -->
    <xsl:param name="navigationRestrictions" />
    <xsl:param name="navigation-prefix" />
    <xsl:param name="readRestrictions" />
    <xsl:param name="selectSupport" />
    <xsl:param name="expandRestrictions" />
    <xsl:param name="updateRestrictions" />
    <xsl:param name="deleteRestrictions" />

    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$type" />
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
    <xsl:variable name="typename">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$type" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="qualifiedType">
      <xsl:value-of select="$namespace" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$typename" />
    </xsl:variable>
    <xsl:variable name="aliasQualifiedType">
      <xsl:value-of select="//edm:Schema[@Namespace=$namespace]/@Alias" />
      <xsl:text>.</xsl:text>
      <xsl:value-of select="$typename" />
    </xsl:variable>
    <xsl:variable name="entityType" select="//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$typename]" />

    <!-- for singleton first level we don't need the key -->
    <xsl:if test="$entityType or ($level=0 and not($with-key))">
      <xsl:if test="$level>0 or $with-key">
        <xsl:text>,</xsl:text>
      </xsl:if>

      <xsl:variable name="path-template">
        <xsl:value-of select="$path-prefix" />
        <xsl:if test="$with-key">
          <xsl:apply-templates select="$entityType" mode="key-in-path">
            <xsl:with-param name="level" select="$level" />
          </xsl:apply-templates>
        </xsl:if>
      </xsl:variable>
      <xsl:variable name="path-parameters">
        <xsl:value-of select="$prefix-parameters" />
        <xsl:if test="$prefix-parameters!='' and $with-key">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:if test="$with-key">
          <xsl:apply-templates select="$entityType" mode="parameter">
            <xsl:with-param name="level" select="$level" />
          </xsl:apply-templates>
        </xsl:if>
      </xsl:variable>

      <xsl:text>"/</xsl:text>
      <xsl:value-of select="$path-template" />
      <xsl:text>":{</xsl:text>

      <xsl:if test="$path-parameters!=''">
        <xsl:text>"parameters":[</xsl:text>
        <xsl:value-of select="$path-parameters" />
        <xsl:text>]</xsl:text>
      </xsl:if>

      <!-- GET -->
      <xsl:variable name="readable-p" select="$readRestrictions/edm:Record/edm:PropertyValue[@Property='Readable']" />
      <xsl:variable name="readable" select="$readable-p/@Bool|$readable-p/edm:Bool" />
      <xsl:variable name="readByKeyRestrictions" select="$readRestrictions/edm:Record/edm:PropertyValue[@Property='ReadByKeyRestrictions']" />
      <xsl:variable name="with-get">
        <xsl:choose>
          <xsl:when test="$with-key">
            <xsl:variable name="readByKeyRestrictions-readable" select="$readByKeyRestrictions/edm:Record/edm:PropertyValue[@Property='Readable']" />
            <xsl:variable name="readableByKey" select="$readByKeyRestrictions-readable/@Bool|$readByKeyRestrictions-readable/edm:Bool" />
            <xsl:value-of select="$readableByKey='true' or (not($readableByKey) and not($readable='false'))" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="not($readable='false')" />
          </xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <xsl:if test="$with-get='true'">
        <xsl:if test="$path-parameters!=''">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>"get":{</xsl:text>

        <xsl:call-template name="operation-summary-description">
          <xsl:with-param name="restriction" select="$readRestrictions[not($with-key)]|$readByKeyRestrictions[$with-key]" />
          <xsl:with-param name="fallback-summary">
            <xsl:text>Get </xsl:text>
            <xsl:if test="$with-key">
              <xsl:text>entity from </xsl:text>
            </xsl:if>
            <xsl:if test="contains($path-prefix,'/')">
              <xsl:text>related </xsl:text>
            </xsl:if>
            <xsl:value-of select="@Name" />
            <xsl:if test="$with-key">
              <xsl:text> by key</xsl:text>
            </xsl:if>
          </xsl:with-param>
        </xsl:call-template>

        <xsl:call-template name="operation-tag">
          <xsl:with-param name="sourceSet" select="$root" />
        </xsl:call-template>

        <xsl:text>,"parameters":[</xsl:text>

        <xsl:variable name="delta">
          <xsl:call-template name="capability">
            <xsl:with-param name="term" select="'ChangeTracking'" />
            <xsl:with-param name="property" select="'Supported'" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:if test="$delta='true'">
          <!-- TODO: Prefer, Preference-Applied -->
        </xsl:if>

        <xsl:variable name="selectable-p" select="$selectSupport/edm:Record/edm:PropertyValue[@Property='Supported']" />
        <xsl:variable name="selectable" select="$selectable-p/@Bool|$selectable-p/edm:Bool" />
        <xsl:variable name="selectable-properties" select="$entityType/edm:Property|$entityType/edm:NavigationProperty[$odata-version='2.0']" />
        <xsl:if test="not($selectable='false')">
          <xsl:apply-templates select="$selectable-properties" mode="select">
            <!-- TODO: $delta='true' -->
            <xsl:with-param name="after" select="false()" />
          </xsl:apply-templates>
        </xsl:if>

        <!-- TODO: this is not correct, ExpandRestrictions are on container-child-level only, not in navigation restrictions -->
        <xsl:variable name="expandable-p" select="$expandRestrictions/edm:Record/edm:PropertyValue[@Property='Expandable']" />
        <xsl:variable name="expandable" select="$expandable-p/@Bool|$expandable-p/edm:Bool" />
        <xsl:if test="not($expandable='false')">
          <!-- TODO: exclude properties that are listed in NonExpandableProperties -->
          <xsl:apply-templates select="$entityType/edm:NavigationProperty|$entityType/edm:Property[@Type='Edm.Stream' and /edmx:Edmx/@Version='4.01']" mode="expand">
            <!-- TODO: $delta='true' -->
            <xsl:with-param name="after" select="(not($selectable='false') and $selectable-properties)" />
          </xsl:apply-templates>
        </xsl:if>

        <xsl:text>]</xsl:text>

        <xsl:call-template name="responses">
          <xsl:with-param name="type" select="$qualifiedType" />
          <xsl:with-param name="delta" select="$delta" />
          <xsl:with-param name="description" select="'Retrieved entity'" />
        </xsl:call-template>
        <xsl:text>}</xsl:text>
      </xsl:if>

      <!-- PATCH -->
      <xsl:variable name="updatable-p" select="$updateRestrictions/edm:Record/edm:PropertyValue[@Property='Updatable']" />
      <xsl:variable name="updatable" select="$updatable-p/@Bool|$updatable-p/edm:Bool" />
      <xsl:if test="not($updatable='false')">
        <xsl:if test="$path-parameters!='' or $with-get='true'">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>"</xsl:text>
        <xsl:value-of select="$update-verb" />
        <xsl:text>":{</xsl:text>

        <xsl:call-template name="operation-summary-description">
          <xsl:with-param name="restriction" select="$updateRestrictions" />
          <xsl:with-param name="fallback-summary">
            <xsl:text>Update </xsl:text>
            <xsl:if test="$with-key">
              <xsl:text>entity in </xsl:text>
            </xsl:if>
            <xsl:if test="contains($path-prefix,'/')">
              <xsl:text>related </xsl:text>
            </xsl:if>
            <xsl:value-of select="@Name" />
          </xsl:with-param>
        </xsl:call-template>

        <xsl:call-template name="operation-tag">
          <xsl:with-param name="sourceSet" select="$root" />
        </xsl:call-template>

        <xsl:text>,</xsl:text>
        <xsl:choose>
          <xsl:when test="$openapi-version='2.0'">
            <xsl:text>"parameters":[{"name":"</xsl:text>
            <xsl:value-of select="$typename" />
            <xsl:text>","in":"body",</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>"requestBody":{"required":true,</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:call-template name="entityTypeDescription">
          <xsl:with-param name="entityType" select="$entityType" />
          <xsl:with-param name="default" select="'New property values'" />
        </xsl:call-template>
        <xsl:if test="$openapi-version!='2.0'">
          <xsl:text>"content":{"application/json":{</xsl:text>
        </xsl:if>
        <xsl:text>"schema":{</xsl:text>
        <xsl:if test="$odata-version='2.0'">
          <xsl:text>"title":"Modified </xsl:text>
          <xsl:value-of select="$typename" />
          <xsl:text>","type":"object","properties":{"d":{</xsl:text>
        </xsl:if>
        <xsl:call-template name="schema-ref">
          <xsl:with-param name="qualifiedName" select="$qualifiedType" />
          <xsl:with-param name="suffix" select="'-update'" />
        </xsl:call-template>
        <xsl:if test="$odata-version='2.0'">
          <xsl:text>}}</xsl:text>
        </xsl:if>
        <xsl:choose>
          <xsl:when test="$openapi-version='2.0'">
            <xsl:text>}}]</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>}}}}</xsl:text>
          </xsl:otherwise>
        </xsl:choose>

        <xsl:call-template name="responses" />

        <xsl:text>}</xsl:text>
      </xsl:if>

      <!-- DELETE -->
      <xsl:if test="local-name()!='Singleton'">
        <xsl:variable name="deletable-p" select="$deleteRestrictions/edm:Record/edm:PropertyValue[@Property='Deletable']" />
        <xsl:variable name="deletable" select="$deletable-p/@Bool|$deletable-p/edm:Bool" />
        <xsl:if test="not($deletable='false')">
          <xsl:if test="$path-parameters!='' or $with-get='true' or not($updatable='false')">
            <xsl:text>,</xsl:text>
          </xsl:if>
          <xsl:text>"delete":{</xsl:text>

          <xsl:call-template name="operation-summary-description">
            <xsl:with-param name="restriction" select="$deleteRestrictions" />
            <xsl:with-param name="fallback-summary">
              <xsl:text>Delete </xsl:text>
              <xsl:if test="$with-key">
                <xsl:text>entity from </xsl:text>
              </xsl:if>
              <xsl:if test="contains($path-prefix,'/')">
                <xsl:text>related </xsl:text>
              </xsl:if>
              <xsl:value-of select="@Name" />
            </xsl:with-param>
          </xsl:call-template>

          <xsl:call-template name="operation-tag">
            <xsl:with-param name="sourceSet" select="$root" />
          </xsl:call-template>
          <!-- TODO: depends on Core.OptimisticConcurrency
            <xsl:text>,"parameters":[</xsl:text>
            <xsl:call-template name="if-match">
            <xsl:with-param name="after" select="$path-parameters!=''" />
            </xsl:call-template>
            <xsl:text>]</xsl:text>
          -->
          <xsl:call-template name="responses" />
          <xsl:text>}</xsl:text>
        </xsl:if>
      </xsl:if>

      <xsl:text>}</xsl:text>

      <xsl:apply-templates select="//edm:Function[@IsBound='true' and (edm:Parameter[1]/@Type=$qualifiedType or edm:Parameter[1]/@Type=$aliasQualifiedType)]" mode="bound">
        <xsl:with-param name="root" select="$root" />
        <xsl:with-param name="path-prefix" select="$path-template" />
        <xsl:with-param name="prefix-parameters" select="$path-parameters" />
      </xsl:apply-templates>
      <xsl:apply-templates select="//edm:Action[@IsBound='true' and (edm:Parameter[1]/@Type=$qualifiedType or edm:Parameter[1]/@Type=$aliasQualifiedType)]" mode="bound">
        <xsl:with-param name="root" select="$root" />
        <xsl:with-param name="path-prefix" select="$path-template" />
        <xsl:with-param name="prefix-parameters" select="$path-parameters" />
      </xsl:apply-templates>

      <xsl:apply-templates select="$entityType/edm:NavigationProperty" mode="pathItem">
        <xsl:with-param name="entityType" select="$entityType" />
        <xsl:with-param name="root" select="$root" />
        <xsl:with-param name="navigationRestrictions" select="$navigationRestrictions" />
        <xsl:with-param name="navigation-prefix" select="$navigation-prefix" />
        <xsl:with-param name="path-prefix" select="$path-template" />
        <xsl:with-param name="prefix-parameters" select="$path-parameters" />
        <xsl:with-param name="level" select="1+$level" />
      </xsl:apply-templates>
    </xsl:if>
  </xsl:template>

  <xsl:template name="if-match">
    <xsl:param name="after" />
    <xsl:if test="$after">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"name":"If-Match","in":"header","description":"ETag",</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>"schema":{</xsl:text>
    </xsl:if>
    <xsl:text>"type":"string"</xsl:text>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template name="entityTypeDescription">
    <xsl:param name="entityType" />
    <xsl:param name="default" />
    <xsl:text>"description":"</xsl:text>
    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="$entityType" />
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
    <xsl:text>",</xsl:text>
  </xsl:template>

  <xsl:template match="edm:EntityType" mode="key-in-path">
    <xsl:param name="level" />
    <xsl:choose>
      <xsl:when test="edm:Key">
        <xsl:choose>
          <xsl:when test="$key-as-segment">
            <xsl:text>/</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>(</xsl:text>
          </xsl:otherwise>
        </xsl:choose>

        <xsl:apply-templates select="edm:Key/edm:PropertyRef" mode="key-in-path">
          <xsl:with-param name="level" select="$level" />
        </xsl:apply-templates>

        <xsl:if test="not($key-as-segment)">
          <xsl:text>)</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="@BaseType">
        <xsl:variable name="basetypeQualifier">
          <xsl:call-template name="substring-before-last">
            <xsl:with-param name="input" select="@BaseType" />
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
            <xsl:with-param name="input" select="@BaseType" />
            <xsl:with-param name="marker" select="'.'" />
          </xsl:call-template>
        </xsl:variable>

        <xsl:apply-templates select="//edm:Schema[@Namespace=$basetypeNamespace]/edm:EntityType[@Name=$basetype]" mode="key-in-path">
          <xsl:with-param name="level" select="$level" />
        </xsl:apply-templates>
      </xsl:when>
      <xsl:otherwise>
        <xsl:message>
          <xsl:text>ERROR: Entity type without key and without base type: </xsl:text>
          <xsl:value-of select="../@Namespace" />
          <xsl:text>.</xsl:text>
          <xsl:value-of select="@Name" />
        </xsl:message>
        <!-- produce valid json -->
        <xsl:text> - ERROR: neither key nor base type</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:PropertyRef" mode="key-in-path">
    <xsl:param name="level" />
    <xsl:variable name="name" select="@Name" />
    <xsl:variable name="type" select="../../edm:Property[@Name=$name]/@Type" />
    <xsl:if test="position()>1">
      <xsl:choose>
        <xsl:when test="$key-as-segment">
          <xsl:text>/</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>,</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>
    <xsl:if test="(@Alias or last()>1) and not($key-as-segment)">
      <xsl:choose>
        <xsl:when test="@Alias">
          <xsl:value-of select="@Alias" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@Name" />
        </xsl:otherwise>
      </xsl:choose>
      <xsl:text>=</xsl:text>
    </xsl:if>
    <xsl:call-template name="pathValuePrefix">
      <xsl:with-param name="type" select="$type" />
    </xsl:call-template>
    <xsl:text>{</xsl:text>
    <xsl:choose>
      <xsl:when test="@Alias">
        <xsl:value-of select="@Alias" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="@Name" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:if test="$level>0">
      <xsl:text>-</xsl:text>
      <xsl:value-of select="$level" />
    </xsl:if>
    <xsl:text>}</xsl:text>
    <xsl:call-template name="pathValueSuffix">
      <xsl:with-param name="type" select="$type" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="pathValuePrefix">
    <xsl:param name="type" />
    <xsl:choose>
      <xsl:when test="$odata-version='2.0' and $type='Edm.Binary'">
        <xsl:text>binary'</xsl:text>
      </xsl:when>
      <xsl:when test="$odata-version='2.0' and $type='Edm.Date'">
        <xsl:text>datetime'</xsl:text>
      </xsl:when>
      <xsl:when test="$odata-version='2.0' and $type='Edm.DateTimeOffset'">
        <xsl:text>datetimeoffset'</xsl:text>
      </xsl:when>
      <xsl:when test="$odata-version='2.0' and $type='Edm.Guid'">
        <xsl:text>guid'</xsl:text>
      </xsl:when>
      <xsl:when test="$odata-version='2.0' and $type='Edm.TimeOfDay'">
        <xsl:text>time'</xsl:text>
      </xsl:when>
      <xsl:when test="$type='Edm.Int64' or $type='Edm.Int32' or $type='Edm.Int16' or $type='Edm.SByte' or $type='Edm.Byte' or $type='Edm.Double' or $type='Edm.Single' or $type='Edm.Date' or $type='Edm.DateTimeOffset' or $type='Edm.Guid' or $type='Edm.TimeOfDay'" />
      <!-- TODO: handle other Edm types, enumeration types, and type definitions -->
      <xsl:otherwise>
        <xsl:if test="not($key-as-segment)">
          <xsl:text>'</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="pathValueSuffix">
    <xsl:param name="type" />
    <xsl:choose>
      <xsl:when test="$odata-version='2.0' and ($type='Edm.Binary' or $type='Edm.Date' or $type='Edm.DateTimeOffset' or $type='Edm.Guid' or $type='Edm.TimeOfDay')">
        <xsl:text>'</xsl:text>
      </xsl:when>
      <xsl:when test="$type='Edm.Int64' or $type='Edm.Int32' or $type='Edm.Int16' or $type='Edm.SByte' or $type='Edm.Byte' or $type='Edm.Double' or $type='Edm.Single' or $type='Edm.Date' or $type='Edm.DateTimeOffset' or $type='Edm.Guid' or $type='Edm.TimeOfDay'" />
      <!-- TODO: handle other Edm types, enumeration types, and type definitions -->
      <xsl:otherwise>
        <xsl:if test="not($key-as-segment)">
          <xsl:text>'</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:EntityType" mode="parameter">
    <xsl:param name="level" />
    <xsl:choose>
      <xsl:when test="edm:Key">
        <xsl:apply-templates select="edm:Key/edm:PropertyRef" mode="parameter">
          <xsl:with-param name="level" select="$level" />
        </xsl:apply-templates>
      </xsl:when>
      <xsl:when test="@BaseType">
        <xsl:variable name="basetypeQualifier">
          <xsl:call-template name="substring-before-last">
            <xsl:with-param name="input" select="@BaseType" />
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
            <xsl:with-param name="input" select="@BaseType" />
            <xsl:with-param name="marker" select="'.'" />
          </xsl:call-template>
        </xsl:variable>

        <xsl:apply-templates select="//edm:Schema[@Namespace=$basetypeNamespace]/edm:EntityType[@Name=$basetype]" mode="parameter">
          <xsl:with-param name="level" select="$level" />
        </xsl:apply-templates>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"ERROR: entity type with neither key nor base type"</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="edm:PropertyRef" mode="parameter">
    <xsl:param name="level" />
    <xsl:call-template name="key-property">
      <xsl:with-param name="name" select="@Name" />
      <xsl:with-param name="alias" select="@Alias" />
      <xsl:with-param name="structuredType" select="../.." />
      <xsl:with-param name="level" select="$level" />
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="key-property">
    <xsl:param name="name" />
    <xsl:param name="alias" />
    <xsl:param name="structuredType" />
    <xsl:param name="level" />

    <xsl:choose>
      <xsl:when test="contains($name,'/')">
        <xsl:variable name="first-segment" select="substring-before($name,'/')" />
        <xsl:variable name="property" select="$structuredType/edm:Property[@Name=$first-segment]" />
        <xsl:variable name="propertyType" select="$property/@Type" />
        <xsl:variable name="qualifier">
          <xsl:call-template name="substring-before-last">
            <xsl:with-param name="input" select="$propertyType" />
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
        <xsl:variable name="typename">
          <xsl:call-template name="substring-after-last">
            <xsl:with-param name="input" select="$propertyType" />
            <xsl:with-param name="marker" select="'.'" />
          </xsl:call-template>
        </xsl:variable>

        <xsl:call-template name="key-property">
          <xsl:with-param name="name" select="substring-after($name,'/')" />
          <xsl:with-param name="alias" select="$alias" />
          <xsl:with-param name="structuredType" select="//edm:Schema[@Namespace=$namespace]/edm:ComplexType[@Name=$typename]
                   |//edm:Schema[@Namespace=$namespace]/edm:EntityType[@Name=$typename]" />
          <xsl:with-param name="level" select="$level" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:variable name="property" select="$structuredType/edm:Property[@Name=$name]" />
        <xsl:variable name="propertyType" select="$property/@Type" />
        <xsl:if test="position()>1">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>{"name":"</xsl:text>
        <xsl:choose>
          <xsl:when test="$alias">
            <xsl:value-of select="$alias" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="$name" />
          </xsl:otherwise>
        </xsl:choose>
        <xsl:if test="$level>0">
          <xsl:text>-</xsl:text>
          <xsl:value-of select="$level" />
        </xsl:if>
        <xsl:text>","in":"path","required":true,"description":"</xsl:text>
        <xsl:variable name="description">
          <xsl:call-template name="description">
            <xsl:with-param name="node" select="$property" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:choose>
          <xsl:when test="$description!=''">
            <xsl:value-of select="$description" />
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>key: </xsl:text>
            <xsl:choose>
              <xsl:when test="$alias">
                <xsl:value-of select="$alias" />
              </xsl:when>
              <xsl:otherwise>
                <xsl:value-of select="$name" />
              </xsl:otherwise>
            </xsl:choose>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:text>",</xsl:text>

        <xsl:choose>
          <xsl:when test="not($propertyType)">
            <xsl:text>"x-error":"key property not found"</xsl:text>
            <xsl:message>
              <xsl:text>Key property </xsl:text>
              <xsl:value-of select="$name" />
              <xsl:text> not found for entity type </xsl:text>
              <xsl:value-of select="../../@Name" />
            </xsl:message>
          </xsl:when>
          <xsl:when test="$openapi-version='2.0'">
            <xsl:text>"type":</xsl:text>
            <xsl:choose>
              <xsl:when test="$propertyType='Edm.Int64'">
                <xsl:text>"integer","format":"int64"</xsl:text>
              </xsl:when>
              <xsl:when test="$propertyType='Edm.Int32'">
                <xsl:text>"integer","format":"int32"</xsl:text>
              </xsl:when>
              <!-- TODO: handle other Edm types, enumeration types, and type definitions -->
              <xsl:otherwise>
                <xsl:text>"string"</xsl:text>
              </xsl:otherwise>
            </xsl:choose>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>"schema":{</xsl:text>
            <xsl:call-template name="type">
              <xsl:with-param name="type" select="$propertyType" />
              <xsl:with-param name="nullableFacet" select="'false'" />
              <xsl:with-param name="target" select="$property" />
            </xsl:call-template>
            <xsl:text>}</xsl:text>
          </xsl:otherwise>
        </xsl:choose>

        <xsl:text>}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
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
    <xsl:variable name="actionName">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="@Action" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="action" select="//edm:Schema[@Namespace=$namespace]/edm:Action[@Name=$actionName and not(@IsBound='true')]" />

    <xsl:text>"/</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:text>":{"post":{</xsl:text>
    <xsl:call-template name="summary-description">
      <xsl:with-param name="node" select="." />
      <xsl:with-param name="node2" select="$action" />
      <xsl:with-param name="fallback-summary">
        <xsl:text>Invoke action </xsl:text>
        <xsl:value-of select="$action/@Name" />
      </xsl:with-param>
    </xsl:call-template>

    <xsl:variable name="action-for" select="edm:Annotation[@Term='SAP.ActionFor']/@String" />
    <xsl:variable name="entitySetName">
      <xsl:choose>
        <xsl:when test="@EntitySet">
          <xsl:value-of select="@EntitySet" />
        </xsl:when>
        <xsl:when test="//edm:EntitySet[@EntityType=$action-for]">
          <xsl:value-of select="//edm:EntitySet[@EntityType=$action-for]/@Name" />
        </xsl:when>
      </xsl:choose>
    </xsl:variable>
    <xsl:call-template name="operation-tag">
      <xsl:with-param name="sourceSet" select="//edm:EntitySet[@Name=$entitySetName]" />
      <xsl:with-param name="fallback" select="'Service Operations'" />
    </xsl:call-template>

    <xsl:if test="$action/edm:Parameter">
      <xsl:choose>
        <xsl:when test="$odata-version='2.0'">
          <xsl:text>,"parameters":[</xsl:text>
          <xsl:apply-templates select="$action/edm:Parameter" mode="parameter" />
          <xsl:text>]</xsl:text>
        </xsl:when>
        <xsl:otherwise>
          <xsl:choose>
            <xsl:when test="$openapi-version='2.0'">
              <xsl:text>,"parameters":[{"name":"body","in":"body",</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>,"requestBody":{</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>"description":"Action parameters",</xsl:text>
          <xsl:if test="$openapi-version!='2.0'">
            <xsl:text>"content":{"application/json":{</xsl:text>
          </xsl:if>
          <xsl:text>"schema":{"type":"object"</xsl:text>
          <xsl:apply-templates select="$action/edm:Parameter" mode="hash">
            <xsl:with-param name="name" select="'properties'" />
          </xsl:apply-templates>
          <xsl:choose>
            <xsl:when test="$openapi-version='2.0'">
              <xsl:text>}}]</xsl:text>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>}}}}</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:if>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="$action/edm:ReturnType/@Type" />
      <xsl:with-param name="nullableFacet" select="$action/edm:ReturnType/@Nullable" />
      <xsl:with-param name="target" select="$action/edm:ReturnType" />
      <xsl:with-param name="functionImport" select="." />
    </xsl:call-template>
    <xsl:text>}}</xsl:text>
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

    <xsl:apply-templates select="//edm:Schema[@Namespace=$namespace]/edm:Function[@Name=$function and not(@IsBound='true')]" mode="import">
      <xsl:with-param name="functionImport" select="." />
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template match="edm:Function" mode="import">
    <xsl:param name="functionImport" />

    <xsl:text>"/</xsl:text>
    <xsl:value-of select="$functionImport/@Name" />
    <xsl:if test="$odata-version!='2.0'">
      <xsl:text>(</xsl:text>
      <xsl:apply-templates select="edm:Parameter" mode="path" />
      <xsl:text>)</xsl:text>
    </xsl:if>
    <xsl:text>":{"get":{</xsl:text>
    <xsl:call-template name="summary-description">
      <xsl:with-param name="node" select="$functionImport" />
      <xsl:with-param name="node2" select="." />
      <xsl:with-param name="fallback-summary">
        <xsl:text>Invoke function </xsl:text>
        <xsl:value-of select="@Name" />
      </xsl:with-param>
    </xsl:call-template>

    <xsl:variable name="action-for" select="$functionImport/edm:Annotation[@Term='SAP.ActionFor']/@String" />
    <xsl:variable name="entitySetName">
      <xsl:choose>
        <xsl:when test="$functionImport/@EntitySet">
          <xsl:value-of select="$functionImport/@EntitySet" />
        </xsl:when>
        <xsl:when test="//edm:EntitySet[@EntityType=$action-for]">
          <xsl:value-of select="//edm:EntitySet[@EntityType=$action-for]/@Name" />
        </xsl:when>
      </xsl:choose>
    </xsl:variable>
    <xsl:call-template name="operation-tag">
      <xsl:with-param name="sourceSet" select="//edm:EntitySet[@Name=$entitySetName]" />
      <xsl:with-param name="fallback" select="'Service Operations'" />
    </xsl:call-template>

    <xsl:text>,"parameters":[</xsl:text>
    <xsl:apply-templates select="edm:Parameter" mode="parameter" />
    <xsl:text>]</xsl:text>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="edm:ReturnType/@Type" />
      <xsl:with-param name="nullableFacet" select="edm:ReturnType/@Nullable" />
      <xsl:with-param name="target" select="edm:ReturnType" />
      <xsl:with-param name="functionImport" select="$functionImport" />
    </xsl:call-template>
    <xsl:text>}}</xsl:text>
  </xsl:template>

  <xsl:template name="query-options">
    <xsl:param name="navigationPropertyRestriction" />
    <xsl:param name="target" />
    <xsl:param name="collection" />
    <xsl:param name="entityType" />

    <xsl:variable name="target-path" select="concat($target/../../@Namespace,'.',$target/../@Name,'/',$target/@Name)" />
    <xsl:variable name="target-path-aliased" select="concat($target/../../@Alias,'.',$target/../@Name,'/',$target/@Name)" />
    <xsl:variable name="target-annotations" select="$target/edm:Annotation|//edm:Annotations[(@Target=$target-path or @Target=$target-path-aliased)]/edm:Annotation" />

    <xsl:variable name="target-topSupported-p" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.TopSupported') or @Term=concat($capabilitiesAlias,'.TopSupported')]" />
    <xsl:variable name="target-topSupported" select="$target-topSupported-p/@Bool|$target-topSupported-p/edm:Bool" />
    <xsl:variable name="navigation-topSupported-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='TopSupported']" />
    <xsl:variable name="navigation-topSupported" select="$navigation-topSupported-p/@Bool|$navigation-topSupported-p/edm:Bool" />
    <xsl:variable name="with-top" select="not($navigation-topSupported='false' or (not($navigation-topSupported) and $target-topSupported='false'))" />

    <xsl:variable name="target-skipSupported-p" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.SkipSupported') or @Term=concat($capabilitiesAlias,'.SkipSupported')]" />
    <xsl:variable name="target-skipSupported" select="$target-skipSupported-p/@Bool|$target-skipSupported-p/edm:Bool" />
    <xsl:variable name="navigation-skipSupported-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='SkipSupported']" />
    <xsl:variable name="navigation-skipSupported" select="$navigation-skipSupported-p/@Bool|$navigation-skipSupported-p/edm:Bool" />
    <xsl:variable name="with-skip" select="not($navigation-skipSupported='false' or (not($navigation-skipSupported) and $target-skipSupported='false'))" />

    <xsl:variable name="target-searchable-p" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.SearchRestrictions') or @Term=concat($capabilitiesAlias,'.SearchRestrictions')]/edm:Record/edm:PropertyValue[@Property='Searchable']" />
    <xsl:variable name="target-searchable" select="$target-searchable-p/@Bool|$target-searchable-p/edm:Bool" />
    <xsl:variable name="navigation-searchable-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='SearchRestrictions']/edm:Record/edm:PropertyValue[@Property='Searchable']" />
    <xsl:variable name="navigation-searchable" select="$navigation-searchable-p/@Bool|$navigation-searchable-p/edm:Bool" />
    <xsl:variable name="with-search" select="not($navigation-searchable='false' or (not($navigation-searchable) and $target-searchable='false'))" />

    <xsl:variable name="target-filterRestrictions" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.FilterRestrictions') or @Term=concat($capabilitiesAlias,'.FilterRestrictions')]/edm:Record" />
    <xsl:variable name="target-filterable-p" select="$target-filterRestrictions/edm:PropertyValue[@Property='Filterable']" />
    <xsl:variable name="target-filterable" select="$target-filterable-p/@Bool|$target-filterable-p/edm:Bool" />
    <xsl:variable name="navigation-filterable-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='FilterRestrictions']/edm:Record/edm:PropertyValue[@Property='Filterable']" />
    <xsl:variable name="navigation-filterable" select="$navigation-filterable-p/@Bool|$navigation-filterable-p/edm:Bool" />
    <xsl:variable name="with-filter" select="not($navigation-filterable='false' or (not($navigation-filterable) and $target-filterable='false'))" />

    <xsl:variable name="target-countable-p" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.CountRestrictions') or @Term=concat($capabilitiesAlias,'.CountRestrictions')]/edm:Record/edm:PropertyValue[@Property='Countable']" />
    <xsl:variable name="target-countable" select="$target-countable-p/@Bool|$target-countable-p/edm:Bool" />
    <!-- TODO: with-count similar to other restrictions, see https://issues.oasis-open.org/browse/ODATA-1300 -->
    <xsl:variable name="with-count" select="not($target-filterable='false')" />

    <xsl:variable name="target-sortRestrictions" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.SortRestrictions') or @Term=concat($capabilitiesAlias,'.SortRestrictions')]/edm:Record" />
    <xsl:variable name="target-sortable-p" select="$target-sortRestrictions/edm:PropertyValue[@Property='Sortable']" />
    <xsl:variable name="target-sortable" select="$target-sortable-p/@Bool|$target-sortable-p/edm:Bool" />
    <xsl:variable name="navigation-sortRestrictions" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='SortRestrictions']/edm:Record" />
    <xsl:variable name="sortable-p" select="$navigation-sortRestrictions/edm:PropertyValue[@Property='Sortable']" />
    <xsl:variable name="navigation-sortable" select="$sortable-p/@Bool|$sortable-p/edm:Bool" />
    <xsl:variable name="with-sort" select="not($navigation-sortable='false' or (not($navigation-sortable) and $target-sortable='false'))" />

    <xsl:variable name="target-selectable-p" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.SelectSupport') or @Term=concat($capabilitiesAlias,'.SelectSupport')]/edm:Record/edm:PropertyValue[@Property='Supported']" />
    <xsl:variable name="target-selectable" select="$target-selectable-p/@Bool|$target-selectable-p/edm:Bool" />
    <xsl:variable name="navigation-selectSupported-p" select="$navigationPropertyRestriction/edm:PropertyValue[@Property='SelectSupport']/edm:Record/edm:PropertyValue[@Property='Supported']" />
    <xsl:variable name="navigation-selectable" select="$navigation-selectSupported-p/@Bool|$navigation-selectSupported-p/edm:Bool" />
    <xsl:variable name="selectable-properties" select="$entityType/edm:Property|$entityType/edm:NavigationProperty[$odata-version='2.0']" />
    <xsl:variable name="with-select" select="not($navigation-selectable='false' or (not($navigation-selectable) and $target-selectable='false')) and $selectable-properties" />

    <xsl:variable name="target-expandable-p" select="$target-annotations[@Term=concat($capabilitiesNamespace,'.ExpandRestrictions') or @Term=concat($capabilitiesAlias,'.ExpandRestrictions')]/edm:Record/edm:PropertyValue[@Property='Expandable']" />
    <xsl:variable name="target-expandable" select="$target-expandable-p/@Bool|$target-expandable-p/edm:Bool" />
    <!-- TODO: with-expand similar to other restrictions, see https://issues.oasis-open.org/browse/ODATA-1300 -->
    <xsl:variable name="with-expand" select="not($target-expandable='false')" />

    <xsl:if test="$collection">

      <xsl:if test="$with-top">
        <xsl:text>{"$ref":"</xsl:text>
        <xsl:value-of select="$reuse-parameters" />
        <xsl:text>top"}</xsl:text>
      </xsl:if>

      <xsl:if test="$with-skip">
        <xsl:if test="$with-top">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>{"$ref":"</xsl:text>
        <xsl:value-of select="$reuse-parameters" />
        <xsl:text>skip"}</xsl:text>
      </xsl:if>

      <xsl:if test="$with-search">
        <xsl:if test="$with-top or $with-skip">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>{"$ref":"</xsl:text>
        <xsl:value-of select="$reuse-parameters" />
        <xsl:text>search"}</xsl:text>
      </xsl:if>

      <xsl:if test="$with-filter">
        <xsl:if test="$with-top or $with-skip or $with-search">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>{"name":"</xsl:text>
        <xsl:value-of select="$option-prefix" />
        <xsl:text>filter","in":"query","description":"Filter items by property values, see [Filtering](</xsl:text>
        <xsl:choose>
          <xsl:when test="$odata-version='2.0'">
            <xsl:text>https://help.sap.com/doc/5890d27be418427993fafa6722cdc03b/Cloud/en-US/OdataV2.pdf#page=64</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:text>)</xsl:text>
        <xsl:call-template name="filter-RequiredProperties">
          <xsl:with-param name="target" select="$target" />
        </xsl:call-template>
        <xsl:text>",</xsl:text>
        <xsl:call-template name="parameter-type">
          <xsl:with-param name="type" select="'string'" />
        </xsl:call-template>
        <xsl:variable name="target-requiresfilter-p" select="$target-filterRestrictions/edm:PropertyValue[@Property='RequiresFilter']" />
        <xsl:variable name="target-requiresfilter" select="$target-requiresfilter-p/@Bool|$target-requiresfilter-p/edm:Bool" />
        <xsl:if test="$target-requiresfilter='true'">
          <xsl:text>,"required":true</xsl:text>
        </xsl:if>
        <xsl:text>}</xsl:text>
      </xsl:if>

      <xsl:if test="$with-count">
        <xsl:if test="$with-top or $with-skip or $with-search or $with-filter">
          <xsl:text>,</xsl:text>
        </xsl:if>
        <xsl:text>{"$ref":"</xsl:text>
        <xsl:value-of select="$reuse-parameters" />
        <xsl:text>count"}</xsl:text>
      </xsl:if>

      <xsl:if test="$with-sort">
        <xsl:variable name="navigation-non-sortable" select="$navigation-sortRestrictions/edm:PropertyValue[@Property='NonSortableProperties']/edm:Collection/edm:PropertyPath" />
        <xsl:variable name="target-non-sortable" select="$target-sortRestrictions/edm:PropertyValue[@Property='NonSortableProperties']/edm:Collection/edm:PropertyPath" />
        <xsl:variable name="non-sortable" select="$navigation-non-sortable|$target-non-sortable[not($navigation-non-sortable)]" />
        <xsl:apply-templates select="$entityType/edm:Property[not(@Name=$non-sortable)]" mode="orderby">
          <xsl:with-param name="after" select="$with-top or $with-skip or $with-search or $with-filter or $with-count" />
        </xsl:apply-templates>
      </xsl:if>

    </xsl:if>

    <xsl:if test="$with-select">
      <xsl:apply-templates select="$selectable-properties" mode="select">
        <xsl:with-param name="after" select="$collection and ($with-top or $with-skip or $with-search or $with-filter or $with-count or $with-sort)" />
      </xsl:apply-templates>
    </xsl:if>

    <xsl:if test="$with-expand">
      <xsl:apply-templates select="$entityType/edm:NavigationProperty|$entityType/edm:Property[@Type='Edm.Stream' and /edmx:Edmx/@Version='4.01']" mode="expand">
        <xsl:with-param name="after" select="($collection and ($with-top or $with-skip or $with-search or $with-filter or $with-count or $with-sort)) or $with-select" />
      </xsl:apply-templates>
    </xsl:if>
  </xsl:template>

  <xsl:template name="responses">
    <xsl:param name="code" select="'200'" />
    <xsl:param name="type" select="null" />
    <xsl:param name="nullableFacet" select="'false'" />
    <xsl:param name="target" select="null" />
    <xsl:param name="delta" select="'false'" />
    <xsl:param name="description" select="'Success'" />
    <xsl:param name="functionImport" select="null" />

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
    <xsl:variable name="typename">
      <xsl:call-template name="substring-after-last">
        <xsl:with-param name="input" select="$singleType" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="complexType" select="//edm:Schema[@Namespace=$qualifier or @Alias=$qualifier]/edm:ComplexType[@Name=$typename]" />

    <xsl:text>,"responses":{</xsl:text>
    <xsl:choose>
      <xsl:when test="not($type)">
        <xsl:text>"204":{"description":"</xsl:text>
        <xsl:value-of select="$description" />
        <xsl:text>"}</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>"</xsl:text>
        <xsl:value-of select="$code" />
        <xsl:text>":{"description":"</xsl:text>
        <xsl:value-of select="$description" />
        <xsl:text>",</xsl:text>
        <xsl:if test="$openapi-version!='2.0'">
          <xsl:text>"content":{"application/json":{</xsl:text>
        </xsl:if>
        <xsl:text>"schema":{</xsl:text>
        <xsl:if test="$collection or $odata-version='2.0'">
          <xsl:text>"title":"</xsl:text>
          <xsl:choose>
            <xsl:when test="$collection and $odata-version='2.0'">
              <xsl:text>Wrapper</xsl:text>
            </xsl:when>
            <xsl:when test="$collection">
              <xsl:text>Collection of </xsl:text>
              <xsl:value-of select="$typename" />
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="$typename" />
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>","type":"object","properties":{"</xsl:text>
          <xsl:choose>
            <xsl:when test="$odata-version='2.0'">
              <xsl:text>d</xsl:text>
              <xsl:if test="not($collection) and $complexType and $functionImport">
                <xsl:text>":{"type":"object","properties":{"</xsl:text>
                <xsl:value-of select="$functionImport/@Name" />
              </xsl:if>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>@</xsl:text>
              <xsl:if test="$odata-version='4.0'">
                <xsl:text>odata.</xsl:text>
              </xsl:if>
              <xsl:text>count":{"$ref":"</xsl:text>
              <xsl:value-of select="$reuse-schemas" />
              <xsl:text>count"},"value</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:text>":{</xsl:text>
        </xsl:if>
        <xsl:if test="$delta='true' and not($collection)">
          <xsl:text>"allOf":[{</xsl:text>
        </xsl:if>
        <xsl:variable name="schema">
          <xsl:call-template name="type">
            <xsl:with-param name="type" select="$type" />
            <xsl:with-param name="nullableFacet" select="$nullableFacet" />
            <xsl:with-param name="target" select="$target" />
            <xsl:with-param name="inResponse" select="true()" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:variable name="text">
          <xsl:call-template name="title-description">
            <xsl:with-param name="target" select="$target" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:if test="$openapi-version!='2.0' and $text!='' and starts-with($schema,'&quot;$ref&quot;')">
          <xsl:text>"anyOf":[{</xsl:text>
        </xsl:if>
        <xsl:value-of select="$schema" />
        <xsl:if test="$openapi-version!='2.0' and $text!='' and starts-with($schema,'&quot;$ref&quot;')">
          <xsl:text>}]</xsl:text>
        </xsl:if>
        <xsl:value-of select="$text" />
        <xsl:if test="$delta='true'">
          <xsl:text>},</xsl:text>
          <xsl:if test="not($collection)">
            <xsl:text>{"properties":{</xsl:text>
          </xsl:if>
          <xsl:text>"@</xsl:text>
          <!-- TODO: V2 only for collections: __delta next to results similar to __next, see http://services.odata.org/V2/Northwind/Northwind.svc/Customers -->
          <xsl:if test="/edmx:Edmx/@Version='4.0'">
            <xsl:text>odata.</xsl:text>
          </xsl:if>
          <xsl:text>deltaLink":{"type":"string","example":"</xsl:text>
          <xsl:value-of select="$basePath" />
          <xsl:text>/</xsl:text>
          <xsl:value-of select="@Name" />
          <xsl:text>?$deltatoken=opaque server-generated token for fetching the delta"</xsl:text>
          <xsl:if test="not($collection)">
            <xsl:text>}}}]</xsl:text>
          </xsl:if>
        </xsl:if>
        <xsl:if test="$odata-version='2.0' and not($collection) and $complexType and $functionImport">
          <xsl:text>}}</xsl:text>
        </xsl:if>
        <xsl:if test="$collection or $odata-version='2.0'">
          <xsl:text>}}</xsl:text>
        </xsl:if>
        <xsl:if test="$openapi-version!='2.0'">
          <xsl:text>}}</xsl:text>
        </xsl:if>
        <xsl:text>}}</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>,</xsl:text>
    <xsl:value-of select="$defaultResponse" />
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Action" mode="bound">
    <xsl:param name="root" />
    <xsl:param name="path-prefix" />
    <xsl:param name="prefix-parameters" />

    <xsl:text>,"/</xsl:text>
    <xsl:value-of select="$path-prefix" />
    <xsl:text>/</xsl:text>
    <xsl:choose>
      <xsl:when test="../edm:Annotation[(@Term=concat($coreNamespace,'.DefaultNamespace') or @Term=concat($coreAlias,'.DefaultNamespace')) and not(@Qualifier)]" />
      <xsl:when test="../@Alias">
        <xsl:value-of select="../@Alias" />
        <xsl:text>.</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="../@Namespace" />
        <xsl:text>.</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:value-of select="@Name" />
    <xsl:text>":{"post":{</xsl:text>
    <xsl:call-template name="summary-description">
      <xsl:with-param name="fallback-summary">
        <xsl:text>Invoke action </xsl:text>
        <xsl:value-of select="@Name" />
      </xsl:with-param>
    </xsl:call-template>

    <xsl:call-template name="operation-tag">
      <xsl:with-param name="sourceSet" select="$root" />
    </xsl:call-template>

    <xsl:if test="$prefix-parameters!='' or $openapi-version='2.0'">
      <xsl:text>,"parameters":[</xsl:text>
    </xsl:if>
    <xsl:value-of select="$prefix-parameters" />

    <xsl:choose>
      <xsl:when test="$openapi-version='2.0'">
        <xsl:if test="edm:Parameter[position()>1]">
          <xsl:if test="$prefix-parameters!=''">
            <xsl:text>,</xsl:text>
          </xsl:if>
          <xsl:text>{"name":"body","in":"body",</xsl:text>
          <xsl:text>"description":"Action parameters",</xsl:text>
          <xsl:text>"schema":{"type":"object"</xsl:text>
          <xsl:apply-templates select="edm:Parameter[position()>1]" mode="hash">
            <xsl:with-param name="name" select="'properties'" />
          </xsl:apply-templates>
          <xsl:text>}}</xsl:text>
        </xsl:if>
        <xsl:text>]</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:if test="$prefix-parameters!=''">
          <xsl:text>]</xsl:text>
        </xsl:if>
        <xsl:if test="edm:Parameter[position()>1]">
          <xsl:text>,"requestBody":{</xsl:text>
          <xsl:text>"description":"Action parameters",</xsl:text>
          <xsl:text>"content":{"application/json":{</xsl:text>
          <xsl:text>"schema":{"type":"object"</xsl:text>
          <xsl:apply-templates select="edm:Parameter[position()>1]" mode="hash">
            <xsl:with-param name="name" select="'properties'" />
          </xsl:apply-templates>
          <xsl:text>}}}}</xsl:text>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="edm:ReturnType/@Type" />
      <xsl:with-param name="nullableFacet" select="edm:ReturnType/@Nullable" />
      <xsl:with-param name="target" select="edm:ReturnType" />
    </xsl:call-template>
    <xsl:text>}}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Function" mode="bound">
    <xsl:param name="root" />
    <xsl:param name="path-prefix" />
    <xsl:param name="prefix-parameters" />

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
    <xsl:value-of select="$path-prefix" />
    <xsl:text>/</xsl:text>

    <xsl:choose>
      <xsl:when test="../edm:Annotation[(@Term=concat($coreNamespace,'.DefaultNamespace') or @Term=concat($coreAlias,'.DefaultNamespace')) and not(@Qualifier)]" />
      <xsl:when test="../@Alias">
        <xsl:value-of select="../@Alias" />
        <xsl:text>.</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="../@Namespace" />
        <xsl:text>.</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:value-of select="@Name" />
    <xsl:text>(</xsl:text>
    <xsl:apply-templates select="edm:Parameter[position()>1]" mode="path" />
    <xsl:text>)":{"get":{</xsl:text>
    <xsl:call-template name="summary-description">
      <xsl:with-param name="fallback-summary">
        <xsl:text>Invoke function </xsl:text>
        <xsl:value-of select="@Name" />
      </xsl:with-param>
    </xsl:call-template>

    <xsl:call-template name="operation-tag">
      <xsl:with-param name="sourceSet" select="$root" />
    </xsl:call-template>

    <xsl:text>,"parameters":[</xsl:text>
    <xsl:value-of select="$prefix-parameters" />
    <xsl:apply-templates select="edm:Parameter[position()>1]" mode="parameter">
      <xsl:with-param name="after" select="$prefix-parameters!=''" />
    </xsl:apply-templates>
    <xsl:text>]</xsl:text>

    <xsl:call-template name="responses">
      <xsl:with-param name="type" select="edm:ReturnType/@Type" />
      <xsl:with-param name="nullableFacet" select="edm:ReturnType/@Nullable" />
      <xsl:with-param name="target" select="edm:ReturnType" />
    </xsl:call-template>
    <xsl:text>}}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Action/edm:Parameter" mode="hashvalue">
    <xsl:variable name="type">
      <xsl:call-template name="type">
        <xsl:with-param name="type" select="@Type" />
        <xsl:with-param name="nullableFacet" select="@Nullable" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="text">
      <xsl:call-template name="title-description" />
    </xsl:variable>
    <xsl:if test="$openapi-version!='2.0' and $text!='' and starts-with($type,'&quot;$ref&quot;')">
      <xsl:text>"anyOf":[{</xsl:text>
    </xsl:if>
    <xsl:value-of select="$type" />
    <xsl:if test="$openapi-version!='2.0' and $text!='' and starts-with($type,'&quot;$ref&quot;')">
      <xsl:text>}]</xsl:text>
    </xsl:if>
    <xsl:value-of select="$text" />
  </xsl:template>

  <xsl:template match="edm:Action/edm:Parameter|edm:Function/edm:Parameter" mode="parameter">
    <xsl:param name="after" />
    <xsl:if test="$after or position() > 1">
      <xsl:text>,</xsl:text>
    </xsl:if>
    <xsl:text>{"name":"</xsl:text>
    <xsl:value-of select="@Name" />
    <xsl:choose>
      <xsl:when test="$odata-version='2.0'">
        <xsl:text>","in":"query",</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>","in":"path",</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <!-- only in V4 and if not nullable in V2 -->
    <xsl:if test="$odata-version!='2.0' or not(@Nullable='true')">
      <xsl:text>"required":true,</xsl:text>
    </xsl:if>
    <xsl:variable name="description">
      <xsl:call-template name="description">
        <xsl:with-param name="node" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="hint">
      <xsl:if test="$odata-version='2.0'">
        <xsl:choose>
          <xsl:when test="@Type='Edm.Binary'">
            <xsl:text>Value needs to be in hex-pair format, enclosed in single quotes, and prefixed with `X`, e.g. `X'4F44617461'`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.Boolean'" />
          <xsl:when test="@Type='Edm.Byte'" />
          <xsl:when test="@Type='Edm.Date'">
            <!-- Note: was Edm.DateTime in the V2 source XML -->
            <xsl:text>Value needs to be enclosed in single quotes and prefixed with `datetime`, e.g. `datetime'2017-12-31T00:00'`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.DateTimeOffset'">
            <xsl:text>Value needs to be enclosed in single quotes and prefixed with `datetimeoffset`, e.g. `datetimeoffset'2017-12-31T23:59:59Z'`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.TimeOfDay'">
            <xsl:text>Value needs to be in duration format, enclosed in single quotes, and prefixed with `time`, e.g. `time'PT23H59M59.999S'`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.Decimal' and @Scale>0">
            <xsl:text>Value needs to be suffixed with `M`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.Guid'">
            <xsl:text>Value needs to be enclosed in single quotes and prefixed with `guid`, e.g. `guid'01234567-0123-0123-0123-0123456789ab'`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.SByte'" />
          <xsl:when test="@Type='Edm.Int16'" />
          <xsl:when test="@Type='Edm.Int32'" />
          <xsl:when test="@Type='Edm.Int64'">
            <xsl:text>Value needs to be suffixed with `L`</xsl:text>
          </xsl:when>
          <xsl:when test="@Type='Edm.String'">
            <xsl:text>Value needs to be enclosed in single quotes</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:message>
              <xsl:text>Parameter of type </xsl:text>
              <xsl:value-of select="@Type" />
            </xsl:message>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:if>
    </xsl:variable>
    <xsl:if test="$description!='' or $hint!=''">
      <xsl:text>"description":"</xsl:text>
      <xsl:value-of select="$description" />
      <xsl:if test="$description!='' and $hint!=''">
        <xsl:text>  \n(</xsl:text>
      </xsl:if>
      <xsl:value-of select="$hint" />
      <xsl:if test="$description!='' and $hint!=''">
        <xsl:text>)</xsl:text>
      </xsl:if>
      <xsl:text>",</xsl:text>
    </xsl:if>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>"schema":{</xsl:text>
    </xsl:if>
    <xsl:call-template name="type">
      <xsl:with-param name="type" select="@Type" />
      <xsl:with-param name="nullableFacet" select="@Nullable" />
      <xsl:with-param name="inParameter" select="true()" />
    </xsl:call-template>
    <xsl:if test="$openapi-version!='2.0'">
      <xsl:text>}</xsl:text>
    </xsl:if>
    <xsl:text>}</xsl:text>
  </xsl:template>

  <xsl:template match="edm:Parameter/@MaxLength">
    <xsl:if test=".!='max'">
      <xsl:text>,"maxLength":</xsl:text>
      <xsl:choose>
        <xsl:when test="$odata-version='2.0' and ../@Type='Edm.String'">
          <xsl:value-of select=".+2" />
        </xsl:when>
        <xsl:when test="$odata-version='2.0' and ../@Type='Edm.Binary'">
          <xsl:value-of select="2*.+3" />
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="." />
        </xsl:otherwise>
      </xsl:choose>
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

  <xsl:template name="operation-summary-description">
    <xsl:param name="restriction" />
    <xsl:param name="fallback-summary" />

    <xsl:variable name="description-p" select="$restriction/edm:Record/edm:PropertyValue[@Property='Description']" />
    <xsl:variable name="summary">
      <xsl:call-template name="escape">
        <xsl:with-param name="string" select="$description-p/@String|$description-p/edm:String" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:text>"summary":"</xsl:text>
    <xsl:choose>
      <xsl:when test="$summary!=''">
        <xsl:value-of select="$summary" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$fallback-summary" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"</xsl:text>

    <xsl:variable name="longDescription-p" select="$restriction/edm:Record/edm:PropertyValue[@Property='LongDescription']" />
    <xsl:variable name="description">
      <xsl:call-template name="escape">
        <xsl:with-param name="string" select="$longDescription-p/@String|$longDescription-p/edm:String" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="$description!=''">
      <xsl:text>,"description":"</xsl:text>
      <xsl:value-of select="$description" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="summary-description">
    <xsl:param name="node" select="." />
    <xsl:param name="node2" select="." />
    <xsl:param name="fallback-summary" />

    <xsl:variable name="label">
      <xsl:variable name="first">
        <xsl:call-template name="Common.Label">
          <xsl:with-param name="node" select="$node" />
        </xsl:call-template>
      </xsl:variable>
      <xsl:value-of select="$first" />
      <xsl:if test="$first='' and $node2">
        <xsl:call-template name="Common.Label">
          <xsl:with-param name="node" select="$node2" />
        </xsl:call-template>
      </xsl:if>
    </xsl:variable>

    <xsl:variable name="quickinfo">
      <xsl:variable name="first">
        <xsl:call-template name="Common.QuickInfo">
          <xsl:with-param name="node" select="$node" />
        </xsl:call-template>
      </xsl:variable>
      <xsl:value-of select="$first" />
      <xsl:if test="$first='' and $node2">
        <xsl:call-template name="Common.QuickInfo">
          <xsl:with-param name="node" select="$node2" />
        </xsl:call-template>
      </xsl:if>
    </xsl:variable>

    <xsl:variable name="description">
      <xsl:variable name="first">
        <xsl:call-template name="Core.Description">
          <xsl:with-param name="node" select="$node" />
        </xsl:call-template>
      </xsl:variable>
      <xsl:value-of select="$first" />
      <xsl:if test="$first='' and $node2">
        <xsl:call-template name="Core.Description">
          <xsl:with-param name="node" select="$node2" />
        </xsl:call-template>
      </xsl:if>
    </xsl:variable>

    <xsl:variable name="longdescription">
      <xsl:if test="$property-longDescription">
        <xsl:variable name="first">
          <xsl:call-template name="Core.LongDescription">
            <xsl:with-param name="node" select="$node" />
          </xsl:call-template>
        </xsl:variable>
        <xsl:value-of select="$first" />
        <xsl:if test="$first='' and $node2">
          <xsl:call-template name="Core.LongDescription">
            <xsl:with-param name="node" select="$node2" />
          </xsl:call-template>
        </xsl:if>
      </xsl:if>
    </xsl:variable>

    <xsl:text>"summary":"</xsl:text>
    <xsl:choose>
      <xsl:when test="$label!=''">
        <xsl:value-of select="$label" />
      </xsl:when>
      <xsl:when test="$description!=''">
        <xsl:value-of select="$description" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$fallback-summary" />
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>"</xsl:text>

    <xsl:if test="$quickinfo!='' or ($label!='' and $description!='') or $longdescription!=''">
      <xsl:text>,"description":"</xsl:text>
      <xsl:value-of select="$quickinfo" />
      <xsl:if test="$label!=''">
        <!-- i.e. $description has not been used for summary -->
        <xsl:if test="$quickinfo!='' and $description!=''">
          <xsl:text>  \n</xsl:text>
        </xsl:if>
        <xsl:value-of select="$description" />
      </xsl:if>
      <xsl:if test="($quickinfo!='' or ($label!='' and $description!='')) and $longdescription!=''">
        <xsl:text>  \n</xsl:text>
      </xsl:if>
      <xsl:value-of select="$longdescription" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="title-description">
    <xsl:param name="fallback-title" select="null" />
    <xsl:param name="suffix" select="null" />
    <xsl:param name="target" select="." />

    <xsl:variable name="label">
      <xsl:call-template name="Common.Label">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="quickinfo">
      <xsl:call-template name="Common.QuickInfo">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="$target" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="longdescription">
      <xsl:if test="$property-longDescription">
        <xsl:call-template name="Core.LongDescription">
          <xsl:with-param name="node" select="$target" />
        </xsl:call-template>
      </xsl:if>
    </xsl:variable>

    <xsl:choose>
      <xsl:when test="$label!=''">
        <xsl:text>,"title":"</xsl:text>
        <xsl:value-of select="$label" />
        <xsl:value-of select="$suffix" />
        <xsl:text>"</xsl:text>
      </xsl:when>
      <xsl:when test="$description!=''">
        <xsl:text>,"title":"</xsl:text>
        <xsl:value-of select="$description" />
        <xsl:value-of select="$suffix" />
        <xsl:text>"</xsl:text>
      </xsl:when>
      <xsl:when test="$fallback-title">
        <xsl:text>,"title":"</xsl:text>
        <xsl:value-of select="$fallback-title" />
        <xsl:value-of select="$suffix" />
        <xsl:text>"</xsl:text>
      </xsl:when>
    </xsl:choose>

    <xsl:if test="$quickinfo!='' or ($label!='' and $description!='') or $longdescription!=''">
      <xsl:text>,"description":"</xsl:text>
      <xsl:value-of select="$quickinfo" />
      <xsl:if test="$label!=''">
        <!-- i.e. $description has not been used for title -->
        <xsl:if test="$quickinfo!='' and $description!=''">
          <xsl:text>  \n</xsl:text>
        </xsl:if>
        <xsl:value-of select="$description" />
      </xsl:if>
      <xsl:if test="($quickinfo!='' or ($label!='' and $description!='')) and $longdescription!=''">
        <xsl:text>  \n</xsl:text>
      </xsl:if>
      <xsl:value-of select="$longdescription" />
      <xsl:text>"</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template name="description">
    <xsl:param name="node" />

    <xsl:variable name="quickinfo">
      <xsl:call-template name="Common.QuickInfo">
        <xsl:with-param name="node" select="$node" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="description">
      <xsl:call-template name="Core.Description">
        <xsl:with-param name="node" select="$node" />
      </xsl:call-template>
    </xsl:variable>

    <xsl:variable name="longdescription">
      <xsl:if test="$property-longDescription">
        <xsl:call-template name="Core.LongDescription">
          <xsl:with-param name="node" select="$node" />
        </xsl:call-template>
      </xsl:if>
    </xsl:variable>

    <xsl:choose>
      <xsl:when test="$quickinfo!='' or $description!='' or $longdescription!=''">
        <xsl:value-of select="$quickinfo" />
        <xsl:if test="$quickinfo!='' and $description!=''">
          <xsl:text>  \n</xsl:text>
        </xsl:if>
        <xsl:value-of select="$description" />
        <xsl:if test="($quickinfo!='' or $description!='') and $longdescription!=''">
          <xsl:text>  \n</xsl:text>
        </xsl:if>
        <xsl:value-of select="$longdescription" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="Common.Label">
          <xsl:with-param name="node" select="$node" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
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
          <xsl:with-param name="new" select="''" />
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

  <!-- name: hash -->
  <xsl:template match="*" mode="hash">
    <xsl:param name="name" />
    <xsl:param name="key" select="'Name'" />
    <xsl:param name="after" select="'something'" />
    <xsl:param name="constantProperties" />
    <xsl:param name="suffix" select="null" />
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
      <xsl:with-param name="suffix" select="$suffix" />
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
    <xsl:param name="suffix" select="null" />
    <xsl:text>"</xsl:text>
    <xsl:value-of select="@*[local-name()=$key]" />
    <xsl:text>":{</xsl:text>
    <xsl:apply-templates select="." mode="hashvalue">
      <xsl:with-param name="name" select="$name" />
      <xsl:with-param name="key" select="$key" />
      <xsl:with-param name="suffix" select="$suffix" />
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
    <xsl:param name="root" select="''" />
    <xsl:variable name="jsonUrl">
      <xsl:choose>
        <xsl:when test="substring($url,string-length($url)-3) = '.xml'">
          <xsl:value-of select="substring($url,1,string-length($url)-4)" />
          <xsl:text>.openapi</xsl:text>
          <xsl:if test="$openapi-version!='2.0'">
            <xsl:text>3</xsl:text>
          </xsl:if>
          <xsl:text>.json</xsl:text>
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
      <!--
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
      -->
      <xsl:when test="substring($jsonUrl,1,2) = './' and $root!=''">
        <xsl:value-of select="$root" />
        <xsl:value-of select="substring($jsonUrl,3)" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$jsonUrl" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="normalizedQualifiedName">
    <xsl:param name="qualifiedName" />
    <xsl:variable name="qualifier">
      <xsl:call-template name="substring-before-last">
        <xsl:with-param name="input" select="$qualifiedName" />
        <xsl:with-param name="marker" select="'.'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="//edm:Schema[@Namespace=$qualifier and @Alias]">
        <xsl:value-of select="//edm:Schema[@Namespace=$qualifier]/@Alias" />
      </xsl:when>
      <xsl:when test="//edmx:Include[@Namespace=$qualifier and @Alias]">
        <xsl:value-of select="//edmx:Include[@Namespace=$qualifier]/@Alias" />
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

</xsl:stylesheet>