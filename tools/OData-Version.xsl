<?xml version="1.0" encoding="UTF-8"?>

-<edmx:Edmx xmlns:sap="http://www.sap.com/Protocols/SAPData" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0">


-<edmx:DataServices m:DataServiceVersion="2.0">


-<Schema xml:lang="it" xmlns="http://schemas.microsoft.com/ado/2008/09/edm" sap:schema-version="1" Namespace="ZFICA_DIMPAG_SRV">


-<EntityType sap:content-version="1" Name="Response">


-<Key>

<PropertyRef Name="EsitoResponse"/>

</Key>

<Property Name="Vkont" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Conto contr." sap:unicode="false" MaxLength="12" Nullable="false" Type="Edm.String"/>

<Property Name="EsitoResponse" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Esito Response" sap:unicode="false" MaxLength="2" Nullable="false" Type="Edm.String"/>

<Property Name="CodiceEsito" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice esito" sap:unicode="false" MaxLength="3" Nullable="false" Type="Edm.String"/>

<Property Name="DescrEsito" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Decrizione Esito" sap:unicode="false" MaxLength="100" Nullable="false" Type="Edm.String"/>

</EntityType>


-<EntityType sap:content-version="1" Name="Request">


-<Key>

<PropertyRef Name="EsitoResponse"/>

<PropertyRef Name="IdDocumento"/>

</Key>

<Property Name="Vkont" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Conto contr." sap:unicode="false" MaxLength="12" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="EsitoResponse" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Esito Response" sap:unicode="false" MaxLength="2" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="CodiceEsito" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice esito" sap:unicode="false" MaxLength="3" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="DescrEsito" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Decrizione Esito" sap:unicode="false" MaxLength="100" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="IdDocumento" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Num. Bollettino" sap:unicode="false" MaxLength="16" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="TipoDim" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Tipo dim. Pagam." sap:unicode="false" MaxLength="2" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZdtDim" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Data Creazione" sap:unicode="false" MaxLength="8" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZtmDim" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Ora creazione Dimostrato" sap:unicode="false" MaxLength="6" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="Ernam" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Creato da" sap:unicode="false" MaxLength="12" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZdtPag" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Data pagamento" sap:unicode="false" MaxLength="8" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="Zprtcl" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="N. protocollo" sap:unicode="false" MaxLength="12" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZdtAcqPag" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Data acquisizione dimostrato" sap:unicode="false" MaxLength="8" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZtmAcqPag" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Ora acquisizione dimostrato" sap:unicode="false" MaxLength="6" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZimpDim" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Importo Dim. pag." sap:unicode="false" Nullable="false" Type="Edm.Decimal" sap:creatable="false" Scale="3" Precision="14"/>

<Property Name="ZpVcy" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="VCY" sap:unicode="false" MaxLength="6" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZpLoc" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice Località" sap:unicode="false" MaxLength="10" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZpSport" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice Sportello" sap:unicode="false" MaxLength="10" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZpCc" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="N. c/c postale" sap:unicode="false" MaxLength="18" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZAbi" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice ABI" sap:unicode="false" MaxLength="5" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZbCab" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice CAB" sap:unicode="false" MaxLength="5" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZbIban" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="IBAN" sap:unicode="false" MaxLength="34" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZdesBanca" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Descr. banca" sap:unicode="false" MaxLength="50" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZlTermin" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Terminale" sap:unicode="false" MaxLength="8" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZlOper" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Operazione" sap:unicode="false" MaxLength="8" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZlTransaz" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="N. rif. transaz." sap:unicode="false" MaxLength="16" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZtmPag" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Ora acq. dimostrato" sap:unicode="false" MaxLength="6" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZacodRic" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Codice Ricevuta" sap:unicode="false" MaxLength="16" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="ZModPag" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Mod. Pagamento" sap:unicode="false" MaxLength="80" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="Idrichiesta" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="char15" sap:unicode="false" MaxLength="15" Nullable="false" Type="Edm.String" sap:creatable="false"/>

<Property Name="Canalechiamante" sap:filterable="false" sap:sortable="false" sap:updatable="false" sap:label="Indicatore a una posizione" sap:unicode="false" MaxLength="1" Nullable="false" Type="Edm.String" sap:creatable="false"/>

</EntityType>


-<EntityContainer Name="ZFICA_DIMPAG_SRV_Entities" sap:supported-formats="atom json xlsx" m:IsDefaultEntityContainer="true">

<EntitySet sap:content-version="1" Name="ResponseSet" sap:updatable="false" sap:pageable="false" sap:deletable="false" EntityType="ZFICA_DIMPAG_SRV.Response"/>

<EntitySet sap:content-version="1" Name="RequestSet" sap:updatable="false" sap:pageable="false" sap:deletable="false" EntityType="ZFICA_DIMPAG_SRV.Request"/>

</EntityContainer>

<atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="https://isd-as1.enelint.global:44311/sap/opu/odata/SAP/ZFICA_DIMPAG_SRV/$metadata" rel="self"/>

<atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="https://isd-as1.enelint.global:44311/sap/opu/odata/SAP/ZFICA_DIMPAG_SRV/$metadata" rel="latest-version"/>

</Schema>

</edmx:DataServices>

</edmx:Edmx>
