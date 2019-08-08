<div>
<h2>README</h2>

<p>Members of the <a href="https://www.oasis-open.org/committees/odata/">OASIS Open Data Protocol (OData) Technical Committee</a> create and manage technical content in this TC GitHub repository ( <a href="https://github.com/oasis-tcs/odata-openapi">https://github.com/oasis-tcs/odata-openapi</a> ) as part of the TC's chartered work (<i>i.e.</i>, the program of work and deliverables described in its <a href="https://www.oasis-open.org/committees/odata/charter.php">charter</a>).</p>

<p>OASIS TC GitHub repositories, as described in <a href="https://www.oasis-open.org/resources/tcadmin/github-repositories-for-oasis-tc-members-chartered-work">GitHub Repositories for OASIS TC Members' Chartered Work</a>, are governed by the OASIS <a href="https://www.oasis-open.org/policies-guidelines/tc-process">TC Process</a>, <a href="https://www.oasis-open.org/policies-guidelines/ipr">IPR Policy</a>, and other policies, similar to TC Wikis, TC JIRA issues tracking instances, TC SVN/Subversion repositories, etc.  While they make use of public GitHub repositories, these TC GitHub repositories are distinct from <a href="https://www.oasis-open.org/resources/open-repositories">OASIS Open Repositories</a>, which are used for development of open source <a href="https://www.oasis-open.org/resources/open-repositories/licenses">licensed</a> content.</p>
</div>

<div>
<h3>Description</h3>

<p>The purpose of this repository is to support development of tools for producing <a href="https://github.com/OAI/OpenAPI-Specification">OpenAPI</a> descriptions for OData services.</p>
<p>Planned work items include:
<ul>
<li>XSLT transformation from OData CSDL XML to OpenAPI JSON</li>
<li>example XML files</li>
<li>example openapi.json files</li>
<li>example files for the live odata.org services</li>
</ul></p>

</div>

<div>
<h3>Contributions</h3>
<p>As stated in this repository's <a href="https://github.com/oasis-tcs/odata-openapi/blob/master/CONTRIBUTING.md">CONTRIBUTING file</a>, contributors to this repository are expected to be Members of the OASIS OData TC, for any substantive change requests.  Anyone wishing to contribute to this GitHub project and <a href="https://www.oasis-open.org/join/participation-instructions">participate</a> in the TC's technical activity is invited to join as an OASIS TC Member.  Public feedback is also accepted, subject to the terms of the <a href="https://www.oasis-open.org/policies-guidelines/ipr#appendixa">OASIS Feedback License</a>.</p>
</div>

<div>
<h3>Licensing</h3>
<p>Please see the <a href="https://github.com/oasis-tcs/odata-openapi/blob/master/LICENSE.md">LICENSE</a> file for description of the license terms and OASIS policies applicable to the TC's work in this GitHub project. Content in this repository is intended to be part of the OData TC's permanent record of activity, visible and freely available for all to use, subject to applicable OASIS policies, as presented in the repository <a href="https://github.com/oasis-tcs/odata-openapi/blob/master/LICENSE.md">LICENSE</a> file.</p>
</div>


<h3>Further Description of this Repository</h3>

The OData TC has published the [OData to OpenAPI Mapping Version 1.0](http://docs.oasis-open.org/odata/odata-openapi/v1.0/odata-openapi-v1.0.html), a recommendation on how to create OpenAPI descriptions for OData services. This project contains two proof-of-concept implementations of that mapping, [one using JavaScript](lib), and [one using XSLT](tools).

The [`examples` folder](examples) contains OpenAPI/Swagger 2.0 and [OpenAPI 3.0.2](https://github.com/OAI/OpenAPI-Specification) descriptions that have been created from the XML `$metadata` documents of live and example OData services with these proof-of-concept implementations. 

The entity-relationship diagrams visualizing the resource models of each service are generated on-the-fly with [yUML](http://yuml.me/).

OpenAPI descriptions for live example OData services at [www.odata.org](http://www.odata.org/)
 - [TripPin (read/write)](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/TripPin.openapi3.json)
 - [Simple read/write service](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/example.openapi3.json)
 - [Northwind (read)](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/Northwind.openapi3.json)

OpenAPI descriptions for OData services that reference each other (cross-service references)
 - [People](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/People.openapi3.json)
 - [Products](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/oasis-tcs/odata-openapi/master/examples/Products.openapi3.json)

<div>
<h3>Contact</h3>
<p>Please send questions or comments about <a href="https://www.oasis-open.org/resources/tcadmin/github-repositories-for-oasis-tc-members-chartered-work">OASIS TC GitHub repositories</a> to <a href="mailto:robin@oasis-open.org">Robin Cover</a> and <a href="mailto:chet.ensign@oasis-open.org">Chet Ensign</a>.  For questions about content in this repository, please contact the TC Chair or Co-Chairs as listed on the the OData TC's <a href="https://www.oasis-open.org/committees/odata/">home page</a>.</p>
</div>
