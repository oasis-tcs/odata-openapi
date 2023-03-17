/**
 * Entity Data Model for OData
 *
 * Latest version: https://github.com/oasis-tcs/odata-openapi/blob/master/lib/edm.js
 */

//TODO:
// - move to odata-csdl repository?

class EDM {
  //TODO: multi-document models
  addDocument(csdl, messages) {
    //TODO: should we really store the whole CSDL, or better extract its parts?
    this.csdl = csdl;
    this.preProcess(messages);
    this.entityContainer = csdl.$EntityContainer
      ? this.element(csdl.$EntityContainer)
      : {};
  }

  //TODO: stronger encapsulation
  namespace = { Edm: "Edm" }; // Map of namespace or alias to namespace
  alias = {}; // Map of namespace or alias to alias
  boundOverloads = {}; // Map of action/function names to bound overloads
  derivedTypes = {}; // Map of type names to derived types
  namespaceUrl = {}; // Map of namespace to reference URL
  voc = {}; // Map of vocabularies and terms

  preProcess(messages) {
    for (const [url, reference] of Object.entries(this.csdl.$Reference ?? {})) {
      for (const include of reference.$Include ?? []) {
        const qualifier = include.$Alias ?? include.$Namespace;
        this.alias[include.$Namespace] = qualifier;
        this.namespace[qualifier] = include.$Namespace;
        this.namespace[include.$Namespace] = include.$Namespace;
        this.namespaceUrl[include.$Namespace] = url;
      }
    }

    vocabularies(this.voc, this.alias);

    for (const [namespace, schema] of Object.entries(this.csdl)) {
      if (!isIdentifier(namespace)) continue;
      //TODO: store schema?
      const isDefaultNamespace = schema[this.voc.Core.DefaultNamespace];

      const qualifier = schema.$Alias || namespace;
      this.alias[namespace] = qualifier;
      this.namespace[qualifier] = namespace;
      this.namespace[namespace] = namespace;

      for (const [name, element] of Object.entries(schema)) {
        if (!isIdentifier(name)) continue;
        //TODO: store element for access by element() method, and namespace-qualify any type references inside?
        //TODO: use namespace-qualified name instead to become independent of document-local aliases?
        const qualifiedName = qualifier + "." + name;

        if (Array.isArray(element)) {
          for (const overload of element) {
            if (!overload.$IsBound) continue;
            //TODO: this seems a bit hacky
            const type =
              overload.$Parameter[0].$Type +
              (overload.$Parameter[0].$Collection ? "-c" : "");
            if (!this.boundOverloads[type]) this.boundOverloads[type] = [];
            this.boundOverloads[type].push({
              name: isDefaultNamespace ? name : qualifiedName,
              overload: overload,
            });
          }
        } else if (element.$BaseType) {
          const base = namespaceQualifiedName(
            this.namespace,
            element.$BaseType
          );
          if (!this.derivedTypes[base]) this.derivedTypes[base] = [];
          this.derivedTypes[base].push(qualifiedName);
        }
      }

      for (const [target, annotations] of Object.entries(
        schema.$Annotations ?? {}
      )) {
        const segments = target.split("/");
        const open = segments[0].indexOf("(");
        let element;
        if (open == -1) {
          element = this.element(segments[0]);
        } else {
          element = this.element(segments[0].substring(0, open));
          let args = segments[0].substring(open + 1, segments[0].length - 1);
          element = element.find(
            (overload) =>
              (overload.$Kind == "Action" &&
                overload.$IsBound != true &&
                args == "") ||
              (overload.$Kind == "Action" &&
                args ==
                  (overload.$Parameter?.[0].$Collection
                    ? `Collection(${overload.$Parameter[0].$Type})`
                    : overload.$Parameter[0].$Type || "")) ||
              (overload.$Parameter || [])
                .map((p) => {
                  const type = p.$Type || "Edm.String";
                  return p.$Collection ? `Collection(${type})` : type;
                })
                .join(",") == args
          );
        }
        if (!element) {
          messages.push(`Invalid annotation target '${target}'`);
        } else if (Array.isArray(element)) {
          messages.push(
            `Ignoring annotations targeting all overloads of '${target}'`
          );
          //TODO: action or function:
          //- loop over all overloads
          //- if there are more segments, a parameter or the return type is targeted
        } else {
          switch (segments.length) {
            case 1:
              Object.assign(element, annotations);
              break;
            case 2:
              if (["Action", "Function"].includes(element.$Kind)) {
                if (segments[1] == "$ReturnType") {
                  if (element.$ReturnType)
                    Object.assign(element.$ReturnType, annotations);
                } else {
                  const parameter = element.$Parameter.find(
                    (p) => p.$Name == segments[1]
                  );
                  Object.assign(parameter, annotations);
                }
              } else {
                if (element[segments[1]]) {
                  Object.assign(element[segments[1]], annotations);
                } else {
                  messages.push(`Invalid annotation target '${target}'`);
                }
              }
              break;
            default:
              messages.push("More than two annotation target path segments");
          }
        }
      }
    }
  }

  /**
   * Find model element by qualified name
   * @param {string} qname Qualified name of model element
   * @return {object} Model element
   */
  element(qname) {
    const q = nameParts(qname);
    const schema =
      this.csdl[q.qualifier] || this.csdl[this.namespace[q.qualifier]];
    return schema ? schema[q.name] : null;
  }
}

//TODO: these could become methods of EDM

/**
 * an identifier does not start with $ and does not contain @
 * @param {string} name
 * @return {boolean} name is an identifier
 */
function isIdentifier(name) {
  return !name.startsWith("$") && !name.includes("@");
}

/**
 * a qualified name consists of a namespace or alias, a dot, and a simple name
 * @param {string} qualifiedName
 * @return {object} with components qualifier and name
 */
function nameParts(qualifiedName) {
  const pos = qualifiedName.lastIndexOf(".");
  return {
    qualifier: qualifiedName.substring(0, pos),
    name: qualifiedName.substring(pos + 1),
  };
}

/**
 * a qualified name consists of a namespace or alias, a dot, and a simple name
 * @param {string} qualifiedName
 * @return {string} namespace-qualified name
 */
function namespaceQualifiedName(namespace, qualifiedName) {
  let np = nameParts(qualifiedName);
  return namespace[np.qualifier] + "." + np.name;
}

/**
 * Construct map of qualified term names
 * @param {object} voc Map of vocabularies and terms
 * @param {object} alias Map of namespace or alias to alias
 */
function vocabularies(voc, alias) {
  const terms = {
    Aggregation: ["ApplySupported"],
    Authorization: ["Authorizations", "SecuritySchemes"],
    Capabilities: [
      "BatchSupport",
      "BatchSupported",
      "ChangeTracking",
      "CountRestrictions",
      "DeleteRestrictions",
      "DeepUpdateSupport",
      "ExpandRestrictions",
      "FilterRestrictions",
      "IndexableByKey",
      "InsertRestrictions",
      "KeyAsSegmentSupported",
      "NavigationRestrictions",
      "OperationRestrictions",
      "ReadRestrictions",
      "SearchRestrictions",
      "SelectSupport",
      "SkipSupported",
      "SortRestrictions",
      "TopSupported",
      "UpdateRestrictions",
    ],
    Core: [
      "AcceptableMediaTypes",
      "Computed",
      "DefaultNamespace",
      "Description",
      "Example",
      "Immutable",
      "LongDescription",
      "OptionalParameter",
      "Permissions",
      "SchemaVersion",
    ],
    JSON: ["Schema"],
    Validation: ["AllowedValues", "Exclusive", "Maximum", "Minimum", "Pattern"],
  };

  for (const vocab of Object.keys(terms)) {
    voc[vocab] = {};
    const namespace = `Org.OData.${vocab}.V1`;
    for (const term of terms[vocab]) {
      voc[vocab][term] = `@${alias[namespace] || namespace}.${term}`;
    }
  }
}

module.exports = {
  EDM,
  isIdentifier, //TODO: should not be needed outside of this module
  nameParts, //TODO: should only need shortName() or unqualifiedName() outside of this module
  namespaceQualifiedName, //TODO: should not be needed outside of this module
};
