<xsl:stylesheet version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"
	xmlns:edm="http://docs.oasis-open.org/odata/ns/edm"
	xmlns:p0="http://docs.oasis-open.org/odata/ns/edm/non-final-segments"
	xmlns:p1="http://docs.oasis-open.org/odata/ns/edm/final-segment"
	xmlns:p2="http://docs.oasis-open.org/odata/ns/edm/termcast-segment"
	xmlns:p3="http://docs.oasis-open.org/odata/ns/edm/after-termcast-segment"
	exclude-result-prefixes="edm">
	<xsl:strip-space elements="*" />
	<xsl:output doctype-system="csdl-ext.dtd" method="xml"
		indent="yes" />

	<xsl:template match="/">
		<xsl:apply-templates select="." mode="ids" />
	</xsl:template>

	<!-- All templates below this line can be used for a first-pass transformation -->

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

	<xsl:template match="@*|node()" mode="ids">
		<xsl:copy>
			<xsl:apply-templates select="@*|node()"
				mode="ids" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edmx:Edmx" mode="ids">
		<edmx:Edmx>
			<xsl:apply-templates select="@*|node()"
				mode="ids" />
		</edmx:Edmx>
	</xsl:template>

	<xsl:template match="edm:*" mode="ids">
		<xsl:call-template name="copy-ids" />
	</xsl:template>

	<xsl:template name="copy-ids">
		<xsl:copy>
			<xsl:if test="self::*">
				<xsl:attribute name="id">
					<xsl:value-of select="generate-id()" />
				</xsl:attribute>
			</xsl:if>
			<xsl:if test="edm:EnumMember">
				<xsl:attribute name="p2:EnumMember">
					<xsl:call-template name="p2-attribute">
						<xsl:with-param name="qname" select="edm:EnumMember" />
					</xsl:call-template>
				</xsl:attribute>
			</xsl:if>
			<xsl:apply-templates select="@*|node()"
				mode="ids" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edm:Annotation/@Term | edm:*/@EnumMember" mode="ids">
		<xsl:copy-of select="." />
		<xsl:attribute name="p2:{local-name()}">
			<xsl:call-template name="p2-attribute">
				<xsl:with-param name="qname" select="." />
			</xsl:call-template>
		</xsl:attribute>
	</xsl:template>

	<xsl:template name="p2-attribute">
		<xsl:param name="qname" />
		<xsl:variable name="namespace">
			<xsl:call-template name="namespace">
				<xsl:with-param name="qname" select="$qname" />
			</xsl:call-template>
		</xsl:variable>
		<xsl:variable name="ns" select="//edmx:Include[@Alias=$namespace or @Namespace=$namespace]
			/@Namespace" />
		<xsl:choose>
			<xsl:when test="$ns">
				<xsl:value-of select="concat($ns,'.')" />
				<xsl:call-template name="name">
					<xsl:with-param name="qname" select="." />
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:message>
					<xsl:value-of
						select="concat('Invalid qualifier in name &quot;',$qname,'&quot; in ',generate-id(ancestor-or-self::*[1]))" />
				</xsl:message>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="@*|*" mode="invalid">
		<xsl:message>
			<xsl:text>Invalid </xsl:text>
			<xsl:if test="not(self::*)">
				<xsl:text>@</xsl:text>
			</xsl:if>
			<xsl:value-of
				select="concat(name(),' &quot;',.,'&quot; in ',generate-id(ancestor-or-self::*[1]))" />
		</xsl:message>
	</xsl:template>

	<xsl:template match="edm:Annotations/edm:Annotation"
		mode="ids" priority="1">
		<xsl:copy>
			<xsl:attribute name="id">
				<xsl:value-of select="generate-id()" />
			</xsl:attribute>
			<xsl:variable name="target">
				<xsl:apply-templates select="/" mode="path">
					<xsl:with-param name="p" select="../@Target" />
				</xsl:apply-templates>
			</xsl:variable>
			<xsl:choose>
				<xsl:when test="string($target)">
					<xsl:variable name="namespace">
						<xsl:call-template name="namespace">
							<xsl:with-param name="qname" select="$target" />
							<xsl:with-param name="sep" select="' '" />
						</xsl:call-template>
					</xsl:variable>
					<xsl:if test="string($namespace)">
						<xsl:attribute name="path-to-target">
							<xsl:value-of select="$namespace" />
							<xsl:text> </xsl:text>
						</xsl:attribute>
					</xsl:if>
					<xsl:attribute name="target">
						<xsl:call-template name="name">
							<xsl:with-param name="qname" select="$target" />
							<xsl:with-param name="sep" select="' '" />
						</xsl:call-template>
					</xsl:attribute>
				</xsl:when>
				<xsl:when test="not(preceding-sibling::edm:Annotation)">
					<xsl:apply-templates select="../@Target"
						mode="invalid" />
				</xsl:when>
			</xsl:choose>
			<xsl:apply-templates select="edm:*" mode="toattr" />
			<xsl:apply-templates select="@*|node()"
				mode="ids" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edm:Annotation" mode="ids">
		<xsl:copy>
			<xsl:attribute name="id">
				<xsl:value-of select="generate-id()" />
			</xsl:attribute>
			<xsl:variable name="target"
				select="ancestor::edm:*[not(
					self::edm:Annotation |
					self::edm:Collection |
					self::edm:Record |
					self::edm:PropertyValue
				)][1]" />
			<xsl:variable name="path-to-target">
				<xsl:apply-templates select="$target/.." mode="path-to-target" />
			</xsl:variable>
			<xsl:if test="$path-to-target">
				<xsl:attribute name="path-to-target">
					<xsl:value-of select="$path-to-target" />
				</xsl:attribute>
			</xsl:if>
			<xsl:attribute name="target">
				<xsl:value-of select="generate-id($target)" />
			</xsl:attribute>
			<xsl:apply-templates select="edm:*" mode="toattr" />
			<xsl:apply-templates select="@*|node()"
				mode="ids" />
		</xsl:copy>
	</xsl:template>

	<xsl:template match="edm:*" mode="path-to-target">
		<xsl:apply-templates select=".." mode="path-to-target" />
		<xsl:value-of select="generate-id()" />
		<xsl:text> </xsl:text>
	</xsl:template>

	<xsl:template match="edm:Schema" mode="path-to-target" />

	<xsl:template match="edm:*" mode="toattr" />

	<xsl:template
		match="edm:Binary |
			edm:Bool |
			edm:Date |
			edm:DateTimeOffset |
			edm:Decimal |
			edm:Duration |
			edm:Float |
			edm:Guid |
			edm:Int |
			edm:String |
			edm:TimeOfDay"
		mode="toattr">
		<xsl:attribute name="{local-name()}">
			<xsl:value-of select="." />
		</xsl:attribute>
	</xsl:template>

	<xsl:template
		match="edm:Annotations/edm:Annotation//@Path |
			edm:Annotations/edm:Annotation//@PropertyPath |
			edm:Annotations/edm:Annotation//@NavigationPropertyPath |
			edm:Annotations/edm:Annotation//@AnyPropertyPath |
			edm:Annotations/edm:Annotation//@AnnotationPath |
			edm:Annotations/edm:Annotation//@ModelElementPath |
			edm:Annotations/edm:Annotation//edm:Path |
			edm:Annotations/edm:Annotation//edm:PropertyPath |
			edm:Annotations/edm:Annotation//edm:NavigationPropertyPath |
			edm:Annotations/edm:Annotation//edm:AnyPropertyPath |
			edm:Annotations/edm:Annotation//edm:AnnotationPath |
			edm:Annotations/edm:Annotation//edm:ModelElementPath"
		mode="ids" priority="1">
		<xsl:variable name="target">
			<xsl:apply-templates select="/" mode="path">
				<xsl:with-param name="p"
					select="ancestor::edm:Annotations/@Target" />
			</xsl:apply-templates>
		</xsl:variable>
		<xsl:choose>
			<xsl:when test="string($target)">
				<xsl:variable name="final-segment">
					<xsl:call-template name="name">
						<xsl:with-param name="qname" select="$target" />
						<xsl:with-param name="sep" select="' '" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:apply-templates select="."
					mode="external-targeting">
					<xsl:with-param name="target" select="$target" />
					<xsl:with-param name="host"
						select="//edm:*[generate-id()=$final-segment]" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:call-template name="copy-ids" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="@*|*" mode="external-targeting">
		<xsl:param name="target" />
		<xsl:param name="host" />
		<xsl:variable name="first-segment"
			select="substring-before(concat($target,' '),' ')" />
		<xsl:variable name="root"
			select="//edm:*[generate-id()=$first-segment]" />
		<xsl:choose>
			<xsl:when
				test="$host/self::edm:Annotation or
					$host/self::edm:Collection or
					$host/self::edm:Record or
					$host/self::edm:PropertyValue">
				<xsl:apply-templates select="."
					mode="external-targeting">
					<xsl:with-param name="target" select="$target" />
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
			<xsl:when
				test="$host/self::edm:Property or
					$host/self::edm:NavigationProperty">
				<xsl:apply-templates select="."
					mode="external-targeting">
					<xsl:with-param name="target"
						select="substring-after($target,' ')" />
					<xsl:with-param name="host" select="$host" />
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
		match="edm:Annotation//@Path |
			edm:Annotation//@PropertyPath |
			edm:Annotation//@NavigationPropertyPath |
			edm:Annotation//@AnyPropertyPath |
			edm:Annotation//@AnnotationPath |
			edm:Annotation//@ModelElementPath |
			edm:Annotation//edm:Path |
			edm:Annotation//edm:PropertyPath |
			edm:Annotation//edm:NavigationPropertyPath |
			edm:Annotation//edm:AnyPropertyPath |
			edm:Annotation//edm:AnnotationPath |
			edm:Annotation//edm:ModelElementPath |
			edm:Annotations/edm:Annotation//@Path"
		mode="ids">
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

	<xsl:template
		match="edm:Annotations/edm:Annotation//edm:Annotation//@PropertyPath |
			edm:Annotations/edm:Annotation//edm:Annotation//@NavigationPropertyPath |
			edm:Annotations/edm:Annotation//edm:Annotation//@AnyPropertyPath |
			edm:Annotations/edm:Annotation//edm:Annotation//@AnnotationPath |
			edm:Annotations/edm:Annotation//edm:Annotation//@ModelElementPath |
			edm:Annotations/edm:Annotation//edm:Annotation//edm:Path |
			edm:Annotations/edm:Annotation//edm:Annotation//edm:PropertyPath |
			edm:Annotations/edm:Annotation//edm:Annotation//edm:NavigationPropertyPath |
			edm:Annotations/edm:Annotation//edm:Annotation//edm:AnyPropertyPath |
			edm:Annotations/edm:Annotation//edm:Annotation//edm:AnnotationPath |
			edm:Annotations/edm:Annotation//edm:Annotation//edm:ModelElementPath"
		mode="ids" priority="2">
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

	<!-- Absolute references -->
	<xsl:template
		match="edm:*/@Type | edm:*/@EntityType | edm:*/@BaseType |
			edm:Term/@BaseTerm |
			edm:ActionImport/@Action | edm:FunctionImport/@Function"
		mode="ids">
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to" select="/" />
		</xsl:apply-templates>
	</xsl:template>

	<!-- Paths relative to a property of a structured type -->
	<xsl:template
		match="edm:NavigationPropertyBinding/@Path |
			edm:ReferentialConstraint/@ReferencedProperty"
		mode="ids">
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to" select="../.." />
		</xsl:apply-templates>
	</xsl:template>

	<!-- Paths relative to a structured type -->
	<xsl:template
		match="edm:PropertyRef/@Name |
			edm:NavigationPropertyBinding/@Target |
			edm:ReferentialConstraint/@Property"
		mode="ids">
		<xsl:apply-templates select="." mode="eval-path">
			<xsl:with-param name="relative-to" select="../../.." />
		</xsl:apply-templates>
	</xsl:template>

	<xsl:template match="@*|*" mode="eval-path">
		<xsl:param name="relative-to" />
		<xsl:choose>
			<xsl:when test="string(.)">
				<xsl:variable name="path">
					<xsl:apply-templates select="$relative-to"
						mode="path">
						<xsl:with-param name="p" select="." />
					</xsl:apply-templates>
				</xsl:variable>
				<xsl:choose>
					<xsl:when test="string($path)">
						<xsl:choose>
							<xsl:when test="self::*">
								<xsl:copy>
									<xsl:attribute name="id">
										<xsl:value-of select="generate-id()" />
									</xsl:attribute>
									<xsl:call-template name="path-attributes">
										<xsl:with-param name="path" select="$path" />
									</xsl:call-template>
									<xsl:apply-templates select="@*|node()"
										mode="ids" />
								</xsl:copy>
							</xsl:when>
							<xsl:otherwise>
								<xsl:copy-of select="." />
								<xsl:call-template name="path-attributes">
									<xsl:with-param name="path" select="$path" />
								</xsl:call-template>
							</xsl:otherwise>
						</xsl:choose>
					</xsl:when>
					<xsl:when test="not(self::*) and contains(.,'.')">
						<xsl:copy-of select="." />
						<xsl:if
							test="not(starts-with(.,'Edm.') or starts-with(.,'Collection(Edm.'))">
							<xsl:attribute name="p2:{name()}">
								<xsl:call-template name="p2-attribute">
									<xsl:with-param name="qname" select="." />
								</xsl:call-template>
							</xsl:attribute>
						</xsl:if>
					</xsl:when>
					<xsl:otherwise>
						<xsl:apply-templates select="." mode="invalid" />
						<xsl:call-template name="copy-ids" />
					</xsl:otherwise>
				</xsl:choose>
			</xsl:when>
			<xsl:when test="$relative-to/self::edm:*">
				<xsl:call-template name="path-attributes">
					<xsl:with-param name="path"
						select="generate-id($relative-to)" />
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:apply-templates select="." mode="invalid" />
				<xsl:call-template name="copy-ids" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="path-attributes">
		<xsl:param name="path" />
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
		<xsl:if test="string($non-final-segments)">
			<xsl:attribute name="p0:{name()}">
				<xsl:value-of select="$non-final-segments" />
				<xsl:text> </xsl:text>
			</xsl:attribute>
		</xsl:if>
		<xsl:choose>
			<xsl:when test="starts-with($final-segment,'@')">
				<xsl:attribute name="p2:{name()}">
					<xsl:call-template name="p2-attribute">
						<xsl:with-param name="qname"
					select="substring-after(substring-before(concat($final-segment,'/'),'/'),'@')" />
					</xsl:call-template>
				</xsl:attribute>
				<xsl:if test="contains($final-segment,'/')">
					<xsl:attribute name="p3:{name()}">
						<xsl:value-of
						select="substring-after($final-segment,'/')" />
					</xsl:attribute>
				</xsl:if>
			</xsl:when>
			<xsl:otherwise>
				<xsl:attribute name="p1:{name()}">
					<xsl:value-of select="$final-segment" />
				</xsl:attribute>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="@*" mode="path" />

	<xsl:template match="/ | *" mode="path">
		<xsl:param name="p" />
		<xsl:variable name="q"
			select="substring-before(concat($p,'/'),'/')" />
		<xsl:choose>
			<xsl:when test="$q=''">
				<xsl:apply-templates select="." mode="path">
					<xsl:with-param name="p"
						select="substring-after($p,'/')" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="starts-with($q,'Collection(')">
				<xsl:apply-templates select="." mode="path">
					<xsl:with-param name="p"
						select="substring($q,12,string-length($q)-12)" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="starts-with($q,'@')">
				<xsl:value-of select="$p" />
			</xsl:when>
			<xsl:when test="contains($q,'(')">
				<xsl:variable name="namespace">
					<xsl:call-template name="namespace">
						<xsl:with-param name="qname"
							select="substring-before($q,'(')" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="name">
					<xsl:call-template name="name">
						<xsl:with-param name="qname"
							select="substring-before($q,'(')" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:apply-templates
					select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
						/*[@Name=$name]"
					mode="path-overload">
					<xsl:with-param name="parameters"
						select="substring-after(substring($q,1,string-length($q)-1),'(')" />
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="contains($q,'.')">
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
				<xsl:apply-templates
					select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
						/*[@Name=$name][1]"
					mode="path-remainder">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="@Type | @EntityType">
				<xsl:variable name="type">
					<xsl:choose>
						<xsl:when
							test="starts-with(@Type | @EntityType,'Collection(')">
							<xsl:value-of
								select="substring(@Type | @EntityType,12,string-length(@Type | @EntityType)-12)" />
						</xsl:when>
						<xsl:otherwise>
							<xsl:value-of select="@Type | @EntityType" />
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
				<xsl:apply-templates
					select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
						/*[@Name=$name]"
					mode="path">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="$q='$ReturnType'">
				<xsl:apply-templates select="edm:ReturnType"
					mode="path-remainder">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:otherwise>
				<xsl:apply-templates select="*[@Name=$q]"
					mode="path-remainder">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="@*|*" mode="path-overload" />

	<xsl:template match="edm:Action"
		mode="path-overload">
		<xsl:param name="parameters" />
		<xsl:param name="p" />
		<xsl:choose>
			<xsl:when
				test="$parameters='' and not(@IsBound='true')">
				<xsl:apply-templates select="."
					mode="path-remainder">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="$parameters!=''">
				<xsl:variable name="param">
					<xsl:call-template name="normalize-type">
						<xsl:with-param name="type" select="$parameters" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="type">
					<xsl:call-template name="normalize-type">
						<xsl:with-param name="type"
							select="edm:Parameter[1]/@Type" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:if test="$param=$type">
					<xsl:apply-templates select="."
						mode="path-remainder">
						<xsl:with-param name="p" select="$p" />
					</xsl:apply-templates>
				</xsl:if>
			</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="edm:Function"
		mode="path-overload">
		<xsl:param name="parameters" />
		<xsl:param name="parameter-count" select="1" />
		<xsl:param name="p" />
		<xsl:choose>
			<xsl:when
				test="$parameters='' and count(edm:Parameter)=$parameter-count - 1">
				<xsl:apply-templates select="."
					mode="path-remainder">
					<xsl:with-param name="p" select="$p" />
				</xsl:apply-templates>
			</xsl:when>
			<xsl:when test="$parameters!=''">
				<xsl:variable name="param">
					<xsl:call-template name="normalize-type">
						<xsl:with-param name="type"
							select="substring-before(concat($parameters,','),',')" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:variable name="type">
					<xsl:call-template name="normalize-type">
						<xsl:with-param name="type"
							select="edm:Parameter[$parameter-count]/@Type" />
					</xsl:call-template>
				</xsl:variable>
				<xsl:if test="$param=$type">
					<xsl:apply-templates select="."
						mode="path-overload">
						<xsl:with-param name="parameters"
							select="substring-after($parameters,',')" />
						<xsl:with-param name="parameter-count"
							select="$parameter-count + 1" />
						<xsl:with-param name="p" select="$p" />
					</xsl:apply-templates>
				</xsl:if>
			</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="normalize-type">
		<xsl:param name="type" />
		<xsl:choose>
			<xsl:when test="starts-with($type,'Collection(')">
				<xsl:text>Collection(</xsl:text>
				<xsl:call-template name="normalize-type">
					<xsl:with-param name="type"
						select="substring($type,12,string-length($type)-12)" />
				</xsl:call-template>
				<xsl:text>)</xsl:text>
			</xsl:when>
			<xsl:otherwise>
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
				<xsl:choose>
					<xsl:when test="$namespace='Edm'">
						<xsl:text>Edm</xsl:text>
					</xsl:when>
					<xsl:otherwise>
						<xsl:value-of
							select="//edm:Schema[@Alias=$namespace or @Namespace=$namespace]
								/@Namespace" />
					</xsl:otherwise>
				</xsl:choose>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="*" mode="path-remainder">
		<xsl:param name="p" />
		<xsl:choose>
			<xsl:when test="contains($p,'/')">
				<xsl:variable name="remainder">
					<xsl:apply-templates select="." mode="path">
						<xsl:with-param name="p"
							select="substring-after($p,'/')" />
					</xsl:apply-templates>
				</xsl:variable>
				<xsl:if test="string($remainder)">
					<xsl:value-of
						select="concat(generate-id(),' ',$remainder)" />
				</xsl:if>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="generate-id()" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>
