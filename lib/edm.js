/**
 * Entity Data Model for OData
 *
 * Latest version: https://github.com/oasis-tcs/odata-openapi/blob/master/lib/edm.js
 */

class EDM {
  //TODO: multi-document models
  addDocument(csdl, messages) {
    //TODO: should we really store the whole CSDL, or better extract its parts?
    this.csdl = csdl;
    this.preProcess(messages);
  }

  //TODO: stronger encapsulation
  namespace = { Edm: "Edm" }; // Map of namespace or alias to namespace
  alias = {}; // Map of namespace or alias to alias
  boundOverloads = {}; // Map of action/function names to bound overloads
  derivedTypes = {}; // Map of type names to derived types
  namespaceUrl = {}; // Map of namespace to reference URL
  voc = {}; // Map of vocabularies and terms

  preProcess(messages) {
    Object.keys(this.csdl.$Reference || {}).forEach((url) => {
      const reference = this.csdl.$Reference[url];
      (reference.$Include || []).forEach((include) => {
        const qualifier = include.$Alias || include.$Namespace;
        this.alias[include.$Namespace] = qualifier;
        this.namespace[qualifier] = include.$Namespace;
        this.namespace[include.$Namespace] = include.$Namespace;
        this.namespaceUrl[include.$Namespace] = url;
      });
    });

    vocabularies(this.voc, this.alias);

    Object.keys(this.csdl)
      .filter((name) => isIdentifier(name))
      .forEach((name) => {
        const schema = this.csdl[name];
        const qualifier = schema.$Alias || name;
        const isDefaultNamespace = schema[this.voc.Core.DefaultNamespace];

        this.alias[name] = qualifier;
        this.namespace[qualifier] = name;
        this.namespace[name] = name;

        Object.keys(schema)
          .filter((name) => isIdentifier(name))
          .forEach((name) => {
            const qualifiedName = qualifier + "." + name;
            const element = schema[name];
            if (Array.isArray(element)) {
              element
                .filter((overload) => overload.$IsBound)
                .forEach((overload) => {
                  const type =
                    overload.$Parameter[0].$Type +
                    (overload.$Parameter[0].$Collection ? "-c" : "");
                  if (!this.boundOverloads[type])
                    this.boundOverloads[type] = [];
                  this.boundOverloads[type].push({
                    name: isDefaultNamespace ? name : qualifiedName,
                    overload: overload,
                  });
                });
            } else if (element.$BaseType) {
              const base = namespaceQualifiedName(
                this.namespace,
                element.$BaseType
              );
              if (!this.derivedTypes[base]) this.derivedTypes[base] = [];
              this.derivedTypes[base].push(qualifiedName);
            }
          });

        Object.keys(schema.$Annotations || {}).forEach((target) => {
          const annotations = schema.$Annotations[target];
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
        });
      });
  }

  vocabularies() {}

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

  Object.keys(terms).forEach((vocab) => {
    voc[vocab] = {};
    const namespace = `Org.OData.${vocab}.V1`;
    terms[vocab].forEach((term) => {
      voc[vocab][term] = `@${alias[namespace] || namespace}.${term}`;
    });
  });
}

module.exports = {
  EDM,
  isIdentifier,
  nameParts,
  namespaceQualifiedName,
};
