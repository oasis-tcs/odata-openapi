<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
	xmlns:edm="http://docs.oasis-open.org/odata/ns/edm"
	xmlns:qname="http://docs.oasis-open.org/odata/ns/edm/qname"
	xmlns:p0="http://docs.oasis-open.org/odata/ns/edm/non-final-segments"
	xmlns:p1="http://docs.oasis-open.org/odata/ns/edm/final-segment">
	<xsl:strip-space elements="*" />
	<xsl:output method="xml" indent="yes" />

	<xsl:template name="namespace">
		<xsl:param name="qname" />
		<xsl:param name="sep" select="'.'" />
		<xsl:variable name="q"
			select="substring-before($qname,$sep)" />
		<xsl:if test="$q">
			<xsl:value-of select="$q" />
			<xsl:variable name="r">
				<xsl:call-template name="namespace">
					<xsl:with-param name="qname"
						select="substring-after($qname,$sep)" />
					<xsl:with-param name="sep" select="$sep" />
				</xsl:call-template>
			</xsl:variable>
			<xsl:if test="string($r)">
				<xsl:value-of select="concat($sep,$r)" />
			</xsl:if>
		</xsl:if>
	</xsl:template>

	<xsl:template name="name">
		<xsl:param name="qname" />
		<xsl:param name="sep" select="'.'" />
		<xsl:variable name="q"
			select="substring-after($qname,$sep)" />
		<xsl:choose>
			<xsl:when test="$q">
				<xsl:call-template name="name">
					<xsl:with-param name="qname" select="$q" />
					<xsl:with-param name="sep" select="$sep" />
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

	<xsl:template match="edmx:Edmx">
		<edmx:Edmx>
			<xsl:apply-templates select="@*|node()" />
		</edmx:Edmx>
	</xsl:template>

	<xsl:template match="edm:*">
		<xsl:copy>
			<xsl:attribute name="id" select="generate-id()" />
			<xsl:apply-templates select="@*|node()" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edm:Annotations/@Target">
		<xsl:variable name="target">
			<xsl:apply-templates
				select="ancestor::edm:Schema" mode="path">
				<xsl:with-param name="p"
					select="ancestor::edm:Annotations/@Target" />
			</xsl:apply-templates>
		</xsl:variable>
		<xsl:variable name="namespace">
			<xsl:call-template name="namespace">
				<xsl:with-param name="qname" select="$target" />
				<xsl:with-param name="sep" select="' '" />
			</xsl:call-template>
		</xsl:variable>
		<xsl:copy-of select="." />
		<xsl:if test="string($namespace)">
			<xsl:attribute name="p0:Target" select="$namespace" />
		</xsl:if>
		<xsl:attribute name="p1:Target">
			<xsl:call-template name="name">
				<xsl:with-param name="qname" select="$target" />
				<xsl:with-param name="sep" select="' '" />
			</xsl:call-template>
		</xsl:attribute>
	</xsl:template>

	<xsl:template match="edm:Annotation/@Term">
		<xsl:variable name="namespace">
			<xsl:call-template name="namespace">
				<xsl:with-param name="qname" select="." />
			</xsl:call-template>
		</xsl:variable>
		<xsl:copy-of select="." />
		<xsl:attribute name="qname:Term">
			<xsl:value-of
			select="//edmx:Include[@Alias=$namespace or @Namespace=$namespace]/@Namespace" />
			<xsl:text>.</xsl:text>
			<xsl:call-template name="name">
				<xsl:with-param name="qname" select="." />
			</xsl:call-template>
		</xsl:attribute>
	</xsl:template>

	<xsl:template
		match="edm:Annotations/descendant::edm:Annotation" priority="1">
		<xsl:copy>
			<xsl:attribute name="id" select="generate-id()" />
			<xsl:attribute name="target">
				<xsl:call-template name="name">
					<xsl:with-param name="qname">
						<xsl:apply-templates
				select="ancestor::edm:Schema" mode="path">
							<xsl:with-param name="p"
				select="ancestor::edm:Annotations/@Target" />
						</xsl:apply-templates>
					</xsl:with-param>
					<xsl:with-param name="sep" select="' '" />
				</xsl:call-template>
			</xsl:attribute>
			<xsl:apply-templates select="@*|node()" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edm:Annotation">
		<xsl:copy>
			<xsl:attribute name="id" select="generate-id()" />
			<xsl:attribute name="target"
				select="generate-id(ancestor::edm:*[not(
					self::edm:Annotation |
					self::edm:Collection |
					self::edm:Record |
					self::edm:PropertyValue
				)][1])" />
			<xsl:apply-templates select="@*|node()" />
		</xsl:copy>
	</xsl:template>

	<xsl:template
		match="edm:Annotations/descendant::edm:Annotation/@Path |
			edm:Annotations/descendant::edm:Annotation/@PropertyPath |
			edm:Annotations/descendant::edm:Annotation/@NavigationPropertyPath |
			edm:Annotations/descendant::edm:Annotation/@AnnotationPath |
			edm:Annotations/descendant::edm:Annotation/@ModelElementPath |
			edm:Annotations/descendant::edm:Annotation/edm:Path |
			edm:Annotations/descendant::edm:Annotation/edm:PropertyPath |
			edm:Annotations/descendant::edm:Annotation/edm:NavigationPropertyPath |
			edm:Annotations/descendant::edm:Annotation/edm:AnnotationPath |
			edm:Annotations/descendant::edm:Annotation/edm:ModelElementPath"
		priority="1">
		<xsl:variable name="target">
			<xsl:apply-templates
				select="ancestor::edm:Schema" mode="path">
				<xsl:with-param name="p"
					select="ancestor::edm:Annotations/@Target" />
			</xsl:apply-templates>
		</xsl:variable>
		<xsl:variable name="first-segment"
			select="substring-before(concat($target,' '),' ')" />
		<xsl:variable name="final-segment">
			<xsl:call-template name="name">
				<xsl:with-param name="qname" select="$target" />
				<xsl:with-param name="sep" select="' '" />
			</xsl:call-template>
		</xsl:variable>
		<xsl:apply-templates select="."
			mode="external-targeting">
			<xsl:with-param name="root"
				select="//edm:*[generate-id()=$first-segment]" />
			<xsl:with-param name="host"
				select="//edm:*[generate-id()=$final-segment]" />
		</xsl:apply-templates>
	</xsl:template>

	<xsl:template match="*" mode="external-targeting">
		<xsl:param name="root" />
		<xsl:param name="host" />
		<xsl:choose>
			<xsl:when
				test="$host/self::edm:Annotation or
					$host/self::edm:Collection or
					$host/self::edm:Record or
					$host/self::edm:PropertyValue">
				<xsl:apply-templates select="."
					mode="external-targeting">
					<xsl:with-param name="root" select="$root" />
					<xsl:with-param name="host"
						select="$host/ancestor-or-self::edm:Annotation" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when
				test="($host/self::edm:Property or
					$host/self::edm:NavigationProperty) and
					$root/self::edm:EntityContainer">
				<xsl:apply-templates select="." mode="eval-path">
					<xsl:with-param name="relative-to"
						select="$host/ancestor-or-self::edm:ComplexType |
							$host/ancestor-or-self::edm:EntityType" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when
				test="($host/self::edm:Property or
					$host/self::edm:NavigationProperty) and
					($root/self::edm:ComplexType or $root/self::edm:EntityType)">
				<xsl:apply-templates select="." mode="eval-path">
					<xsl:with-param name="relative-to" select="$root" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:apply-templates select="." mode="eval-path">
					<xsl:with-param name="relative-to" select="$host" />
				</xsl:apply-templates>
			</xsl:otherwise>
		</xsl:choose>
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
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to"
				select="ancestor::edm:*[not(
					self::edm:Annotation |
					self::edm:Collection |
					self::edm:Record |
					self::edm:PropertyValue |
					self::edm:Property |
					self::edm:NavigationProperty
				)][1]" />
		</xsl:apply-templates>
	</xsl:template>

	<xsl:template match="@*|*" mode="eval-path">
		<xsl:param name="relative-to" />
		<xsl:variable name="path">
			<xsl:apply-templates select="$relative-to"
				mode="path">
				<xsl:with-param name="p" select="." />
			</xsl:apply-templates>
		</xsl:variable>
		<xsl:choose>
			<xsl:when test="string($path)">
				<xsl:variable name="non-final-segments">
					<xsl:call-template name="namespace">
						<xsl:with-param name="qname" select="$path" />
						<xsl:with-param name="sep" select="' '" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="final-segment">
					<xsl:call-template name="name">
						<xsl:with-param name="qname" select="$path" />
						<xsl:with-param name="sep" select="' '" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:choose>
					<xsl:when test="self::*">
						<xsl:copy>
							<xsl:if test="string($non-final-segments)">
								<xsl:attribute name="p0:{name()}"
									select="$non-final-segments" />
							</xsl:if>
							<xsl:attribute name="p1:{name()}"
								select="$final-segment" />
							<xsl:apply-templates select="@*|node()" />
						</xsl:copy>
					</xsl:when>
					<xsl:otherwise>
						<xsl:copy-of select="." />
						<xsl:if test="string($non-final-segments)">
							<xsl:attribute name="p0:{name()}"
								select="$non-final-segments" />
						</xsl:if>
						<xsl:attribute name="p1:{name()}"
							select="$final-segment" />
					</xsl:otherwise>
				</xsl:choose>
			</xsl:when>
			<xsl:otherwise>
				<xsl:copy>
					<xsl:apply-templates select="@*|node()" />
				</xsl:copy>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="edm:PropertyRef/@Name">
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to" select="../../.." />
		</xsl:apply-templates>
	</xsl:template>

	<xsl:template match="edm:NavigationPropertyBinding/@Path">
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to" select="../.." />
		</xsl:apply-templates>
	</xsl:template>

	<xsl:template match="edm:NavigationPropertyBinding/@Target">
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to" select="../../.." />
		</xsl:apply-templates>
	</xsl:template>

	<xsl:template match="@*|*" mode="path">
		<xsl:param name="p" />
		<xsl:choose>
			<xsl:when test="@Type | @EntityType">
				<xsl:variable name="type">
					<xsl:apply-templates
						select="@Type | @EntityType" mode="path">
						<xsl:with-param name="p"
							select="@Type | @EntityType" />
					</xsl:apply-templates>
				</xsl:variable>
				<xsl:apply-templates
					select="//edm:*[generate-id()=$type]" mode="path">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="q"
					select="substring-before($p,'/')" />
				<xsl:choose>
					<xsl:when test="contains($q,'.')">
						<xsl:variable name="top">
							<xsl:apply-templates select="." mode="path">
								<xsl:with-param name="p" select="$q" />
							</xsl:apply-templates>
						</xsl:variable>
						<xsl:value-of select="$top" />
						<xsl:text> </xsl:text>
						<xsl:apply-templates
							select="//edm:*[generate-id()=$top]" mode="path">
							<xsl:with-param name="p"
								select="substring-after($p,'/')" />
						</xsl:apply-templates>
					</xsl:when>
					<xsl:when
						test="$q and (self::edm:ComplexType or self::edm:EntityType)">
						<xsl:variable name="prop" select="*[@Name=$q]" />
						<xsl:value-of select="generate-id($prop)" />
						<xsl:text> </xsl:text>
						<xsl:variable name="type">
							<xsl:apply-templates select="." mode="path">
								<xsl:with-param name="p">
									<xsl:choose>
										<xsl:when
											test="starts-with($prop/@Type | $prop/@EntityType,
												'Collection(')">
											<xsl:value-of
												select="substring-before(substring-after($prop/@Type | $prop/@EntityType,
													'Collection('),')')" />
										</xsl:when>
										<xsl:otherwise>
											<xsl:value-of
												select="$prop/@Type | $prop/@EntityType" />
										</xsl:otherwise>
									</xsl:choose>
								</xsl:with-param>
							</xsl:apply-templates>
						</xsl:variable>
						<xsl:apply-templates
							select="//edm:*[generate-id()=$type]" mode="path">
							<xsl:with-param name="p"
								select="substring-after($p,'/')" />
						</xsl:apply-templates>
					</xsl:when>
					<xsl:when test="$q">
						<xsl:variable name="member" select="*[@Name=$q]" />
						<xsl:value-of select="generate-id($member)" />
						<xsl:text> </xsl:text>
						<xsl:apply-templates select="$member"
							mode="path">
							<xsl:with-param name="p"
								select="substring-after($p,'/')" />
						</xsl:apply-templates>
					</xsl:when>
					<xsl:when test="contains($p,'.')">
						<xsl:variable name="namespace">
							<xsl:call-template name="namespace">
								<xsl:with-param name="qname" select="$p" />
							</xsl:call-template>
						</xsl:variable>
						<xsl:variable name="name">
							<xsl:call-template name="name">
								<xsl:with-param name="qname" select="$p" />
							</xsl:call-template>
						</xsl:variable>
						<xsl:value-of
							select="generate-id(//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
								/*[@Name=$name])" />
					</xsl:when>
					<xsl:otherwise>
						<xsl:value-of select="generate-id(*[@Name=$p])" />
					</xsl:otherwise>
				</xsl:choose>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>
