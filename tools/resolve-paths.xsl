<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:edm="http://docs.oasis-open.org/odata/ns/edm">

	<xsl:template name="namespace">
		<xsl:param name="qname" />
		<xsl:variable name="q"
			select="substring-before($qname,'.')" />
		<xsl:if test="$q">
			<xsl:value-of select="$q" />
			<xsl:variable name="r">
				<xsl:call-template name="namespace">
					<xsl:with-param name="qname"
						select="substring-after($qname,'.')" />
				</xsl:call-template>
			</xsl:variable>
			<xsl:if test="string($r)">
				<xsl:text>.</xsl:text>
				<xsl:value-of select="$r" />
			</xsl:if>
		</xsl:if>
	</xsl:template>

	<xsl:template name="name">
		<xsl:param name="qname" />
		<xsl:variable name="q"
			select="substring-after($qname,'.')" />
		<xsl:choose>
			<xsl:when test="$q">
				<xsl:call-template name="name">
					<xsl:with-param name="qname" select="$q" />
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$qname" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="@*|node()">
		<xsl:copy>
			<xsl:apply-templates select="@*|node()" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edm:*">
		<xsl:copy>
			<xsl:attribute name="id" select="generate-id()" />
			<xsl:apply-templates select="@*|node()" />
		</xsl:copy>
	</xsl:template>

	<xsl:template
		match="edm:Annotation/@Path |
			edm:Annotation/@PropertyPath |
			edm:Annotation/@NavigationPropertyPath |
			edm:Annotation/@AnnotationPath |
			edm:Annotation/@ModelElementPath |
			edm:Annotation/edm:Path |
			edm:Annotation/edm:PropertyPath |
			edm:Annotation/edm:NavigationPropertyPath |
			edm:Annotation/edm:AnnotationPath |
			edm:Annotation/edm:ModelElementPath">
		<xsl:copy-of select="." />
		<xsl:variable name="path">
			<xsl:apply-templates
				select="ancestor::edm:ComplexType|ancestor::edm:EntityType"
				mode="path">
				<xsl:with-param name="p" select="." />
			</xsl:apply-templates>
		</xsl:variable>
		<xsl:if test="string($path)">
			<xsl:variable name="non-final-segments">
				<xsl:call-template name="namespace">
					<xsl:with-param name="qname" select="$path" />
				</xsl:call-template>
			</xsl:variable>
			<xsl:variable name="final-segment">
				<xsl:call-template name="name">
					<xsl:with-param name="qname" select="$path" />
				</xsl:call-template>
			</xsl:variable>
			<xsl:choose>
				<xsl:when test="self::*">
					<xsl:copy>
						<xsl:if test="string($non-final-segments)">
							<xsl:attribute name="non-final-segments">
					<xsl:value-of select="$non-final-segments" />
					</xsl:attribute>
						</xsl:if>
						<xsl:attribute name="final-segment">
					<xsl:value-of select="$final-segment" />
					</xsl:attribute>
					</xsl:copy>
				</xsl:when>
				<xsl:otherwise>
					<xsl:if test="string($non-final-segments)">
						<xsl:attribute name="{name()}-non-final-segments">
					<xsl:value-of select="$non-final-segments" />
					</xsl:attribute>
					</xsl:if>
					<xsl:attribute name="{name()}-final-segment">
					<xsl:value-of select="$final-segment" />
					</xsl:attribute>
				</xsl:otherwise>
			</xsl:choose>
		</xsl:if>
	</xsl:template>

	<xsl:template match="*" mode="path">
		<xsl:param name="p" />
		<xsl:variable name="q" select="substring-after($p,'/')" />
		<xsl:choose>
			<xsl:when test="$q">
				<xsl:variable name="prop"
					select="(edm:Property|edm:NavigationProperty)[@Name=substring-before($p,'/')]" />
				<xsl:variable name="type">
					<xsl:choose>
						<xsl:when test="starts-with($prop/@Type,'Collection(')">
							<xsl:value-of
								select="substring-before(substring-after($prop/@Type,'Collection('),')')" />
						</xsl:when>
						<xsl:otherwise>
							<xsl:value-of select="$prop/@Type" />
						</xsl:otherwise>
					</xsl:choose>
				</xsl:variable>
				<xsl:variable name="namespace">
					<xsl:call-template name="namespace">
						<xsl:with-param name="qname" select="$type" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="name">
					<xsl:call-template name="name">
						<xsl:with-param name="qname" select="$type" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:value-of select="generate-id($prop)" />
				<xsl:text>.</xsl:text>
				<xsl:apply-templates
					select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
						/(edm:ComplexType|edm:EntityType)[@Name=$name]"
					mode="path">
					<xsl:with-param name="p" select="$q" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of
					select="generate-id((edm:Property|edm:NavigationProperty)[@Name=$p])" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>