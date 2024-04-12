<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
	xmlns:edm="http://docs.oasis-open.org/odata/ns/edm"
	xmlns:qname="http://docs.oasis-open.org/odata/ns/edm/qname"
	xmlns:path="http://docs.oasis-open.org/odata/ns/edm/path"
	xmlns:target="http://docs.oasis-open.org/odata/ns/edm/target">

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
		<xsl:variable name="name">
			<xsl:call-template name="name">
				<xsl:with-param name="qname" select="$target" />
				<xsl:with-param name="sep" select="' '" />
			</xsl:call-template>
		</xsl:variable>
		<xsl:copy-of select="." />
		<xsl:if test="string($namespace)">
			<xsl:attribute name="path:{name()}" select="$namespace" />
		</xsl:if>
		<xsl:attribute name="target:{name()}" select="$name" />
	</xsl:template>

	<xsl:template match="edm:Annotation/@Term">
		<xsl:variable name="namespace">
			<xsl:call-template name="namespace">
				<xsl:with-param name="qname" select="." />
			</xsl:call-template>
		</xsl:variable>
		<xsl:variable name="name">
			<xsl:call-template name="name">
				<xsl:with-param name="qname" select="." />
			</xsl:call-template>
		</xsl:variable>
		<xsl:copy-of select="." />
		<xsl:attribute name="qname:{name()}"
			select="concat(//edmx:Include[@Alias=$namespace or @Namespace=$namespace]/@Namespace,'.',$name)" />
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
		</xsl:variable>
		<xsl:choose>
			<xsl:when test="contains($target,'*')">
				<xsl:apply-templates select="." mode="eval-path">
					<!-- outermost type -->
					<xsl:with-param name="relative-to"
						select="//edm:*[contains($target,concat(generate-id(),'*'))]" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="relative-to"
					select="//edm:*[generate-id()=$target]" />
				<xsl:apply-templates select="." mode="eval-path">
					<xsl:with-param name="relative-to"
						select="$relative-to/ancestor-or-self::edm:ComplexType|
					$relative-to/ancestor-or-self::edm:EntityType" />
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
				select="ancestor::edm:ComplexType|ancestor::edm:EntityType" />
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
								<xsl:attribute name="path:{name()}"
									select="$non-final-segments" />
							</xsl:if>
							<xsl:attribute name="target:{name()}"
								select="$final-segment" />
							<xsl:apply-templates select="@*|node()" />
						</xsl:copy>
					</xsl:when>
					<xsl:otherwise>
						<xsl:copy-of select="." />
						<xsl:if test="string($non-final-segments)">
							<xsl:attribute name="path:{name()}"
								select="$non-final-segments" />
						</xsl:if>
						<xsl:attribute name="target:{name()}"
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

	<xsl:template match="*" mode="path">
		<xsl:param name="p" />
		<xsl:variable name="q" select="substring-before($p,'/')" />
		<xsl:choose>
			<xsl:when
				test="contains($q,'.') and not(self::edm:EntityContainer)">
				<xsl:variable name="namespace">
					<xsl:call-template name="namespace">
						<xsl:with-param name="qname" select="$q" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="name">
					<xsl:call-template name="name">
						<xsl:with-param name="qname" select="$q" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="top"
					select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]/*[@Name=$name]" />
				<xsl:value-of select="generate-id($top)" />
				<xsl:if
					test="($top/self::edm:ComplexType or $top/self::edm:EntityType)
						and not($p/self::*) and $p/parent::edm:Annotations and name($p)='Target'">
					<xsl:text>*</xsl:text>
				</xsl:if>
				<xsl:text> </xsl:text>
				<xsl:apply-templates select="$top" mode="path">
					<xsl:with-param name="p"
						select="substring-after($p,'/')" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="self::edm:EntityContainer">
				<xsl:variable name="top" select="*[@Name=$q]" />
				<xsl:value-of select="generate-id($top)" />
				<xsl:text> </xsl:text>
				<xsl:apply-templates select="$top" mode="path">
					<xsl:with-param name="p"
						select="substring-after($p,'/')" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="$q">
				<xsl:variable name="prop"
					select="(edm:Property|edm:NavigationProperty)[@Name=$q]" />
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
				<xsl:text> </xsl:text>
				<xsl:apply-templates
					select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
						/(edm:ComplexType|edm:EntityType)[@Name=$name]"
					mode="path">
					<xsl:with-param name="p"
						select="substring-after($p,'/')" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="generate-id(*[@Name=$p])" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>