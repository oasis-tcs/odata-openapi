module.exports = { deleteUnusedSchemas };

function deleteUnusedSchemas(openapi) {
  let referenced;
  let deleted;

  while (true) {
    referenced = {};
    getReferencedSchemas(openapi, referenced);

    if (openapi.hasOwnProperty("components"))
      deleted = deleteUnreferenced(
        openapi.components.schemas || {},
        referenced,
        "#/components/schemas/"
      );
    else
      deleted = deleteUnreferenced(
        openapi.definitions || {},
        referenced,
        "#/definitions/"
      );

    if (!deleted) break;
  }

  if (openapi.hasOwnProperty("components")) {
    deleteUnreferenced(
      openapi.components.parameters || {},
      referenced,
      "#/components/parameters/"
    );
    if (
      openapi.components.parameters &&
      Object.keys(openapi.components.parameters).length == 0
    )
      delete openapi.components.parameters;
  } else {
    deleteUnreferenced(openapi.parameters || {}, referenced, "#/parameters/");
    if (openapi.parameters && Object.keys(openapi.parameters).length == 0)
      delete openapi.parameters;
  }
}

function getReferencedSchemas(document, referenced) {
  Object.keys(document).forEach((key) => {
    let value = document[key];
    if (key == "$ref") {
      if (value.startsWith("#")) referenced[value] = true;
    } else {
      if (Array.isArray(value)) {
        value.forEach((item) => getReferencedSchemas(item, referenced));
      } else if (typeof value == "object" && value != null) {
        getReferencedSchemas(value, referenced);
      }
    }
  });
}

function deleteUnreferenced(schemas, referenced, prefix) {
  let deleted = false;

  Object.keys(schemas).forEach((key) => {
    if (!referenced[prefix + key]) {
      delete schemas[key];
      deleted = true;
    }
  });

  return deleted;
}
