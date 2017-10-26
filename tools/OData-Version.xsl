<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
  xmlns:edmx1="http://schemas.microsoft.com/ado/2007/06/edmx" xmlns:edm2="http://schemas.microsoft.com/ado/2008/09/edm"
  xmlns:edm3="http://schemas.microsoft.com/ado/2009/11/edm" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"
>
  <!--
    This style sheet extracts the OData version numver from a $metadata document.

    Latest version: https://github.com/oasis-tcs/odata-openapi/blob/master/tools/OData-Version.xsl

  -->
  <xsl:output method="text" indent="yes" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:strip-space elements="*" />

  <xsl:template match="edmx:Edmx">
    <xsl:value-of select="@Version" />
  </xsl:template>

  <xsl:template match="edmx1:Edmx">
    <xsl:apply-templates select="edmx1:DataServices" />
  </xsl:template>

  <xsl:template match="edmx1:DataServices">
    <xsl:choose>
      <xsl:when test="@m:MaxDataServiceVersion">
        <xsl:value-of select="@m:MaxDataServiceVersion" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>2.0</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="@*|node()" />

</xsl:stylesheet>