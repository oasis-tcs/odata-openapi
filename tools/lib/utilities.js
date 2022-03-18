module.exports = { deleteUnusedSchemas };

function deleteUnusedSchemas(openapi) {
  const ref = { used: {}, list: [], paths: {} };

  collectReferences(openapi.paths || {}, ref);

  for (const name of ref.list) {
    collectReferences(schema(openapi, name), ref);
  }

  // remove everything that is not referenced
  for (const [path, schemas] of Object.entries(ref.paths)) {
    const container = schema(openapi, path);
    for (const name of Object.keys(container)) {
      if (!schemas[name]) delete container[name];
    }
  }

  deleteEmptyPathItems(openapi);

  deleteIfEmpty(openapi.components, "schemas");
  deleteIfEmpty(openapi.components, "parameters");
  deleteIfEmpty(openapi.components, "responses");
  deleteIfEmpty(openapi, "components");

  deleteIfEmpty(openapi, "definitions");
  deleteIfEmpty(openapi, "parameters");
  deleteIfEmpty(openapi, "responses");
}

function collectReferences(document, ref) {
  for (const [name, value] of Object.entries(document)) {
    if (name === "$ref") {
      if (value.startsWith("#")) addReference(ref, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => collectReferences(item, ref));
    } else if (typeof value === "object" && value !== null) {
      collectReferences(value, ref);
    }
  }
}

function addReference(ref, value) {
  if (ref.used[value]) return;
  ref.used[value] = true;
  ref.list.push(value);
  const pos = value.lastIndexOf("/");
  const path = value.substring(0, pos);
  const name = value.substring(pos + 1);
  if (!ref.paths[path]) ref.paths[path] = {};
  ref.paths[path][name] = true;
}

function schema(document, name) {
  const path = name.split("/");
  let s = document;
  for (let i = 1; i < path.length; i++) {
    s = s[path[i]];
  }
  return s;
}

function deleteEmptyPathItems(openapi) {
  for (const [path, item] of Object.entries(openapi.paths || {})) {
    const keys = Object.keys(item);
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "parameters"))
      delete openapi.paths[path];
  }
}

function deleteIfEmpty(object, key) {
  if (object && object[key] && Object.keys(object[key]).length === 0)
    delete object[key];
}
