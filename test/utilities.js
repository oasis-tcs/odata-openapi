module.exports = { paths, operations, schemas };

function paths(openapi) {
  return Object.keys(openapi.paths).sort();
}

function operations(openapi) {
  const p = {};
  Object.keys(openapi.paths).forEach((template) => {
    p[template] = Object.keys(openapi.paths[template]).filter(
      (op) => op != "parameters"
    );
  });
  return p;
}

function schemas(openapi) {
  return Object.keys(openapi.components.schemas)
    .sort()
    .filter((s) => s.includes("."));
}
