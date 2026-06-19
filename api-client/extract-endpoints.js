/**
 * Extrae TODOS los endpoints del SDK oficial de GHL.
 * Lee los archivos compilados y extrae URLs + parámetros.
 */

const fs = require('fs');
const path = require('path');

const SDK_DIR = path.join(__dirname, 'node_modules', '@gohighlevel', 'api-client', 'dist', 'lib', 'code');

function extractFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const endpoints = [];

  // Busca métodos: async nombreMetodo(...) { ... url: buildUrl('...') ... }
  const methodRegex = /async\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)url:\s*\(0,\s*request_utils_1\.buildUrl\)\s*\(\s*'([^']+)'/g;

  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const block = match[2];
    const url = match[3];

    // Extrae method: 'GET'|'POST'|...
    const methodMatch = block.match(/method:\s*'(\w+)'/);
    const httpMethod = methodMatch ? methodMatch[1] : 'UNKNOWN';

    // Extrae paramDefs
    const paramDefsMatch = block.match(/const\s+paramDefs\s*=\s*(\[[\s\S]*?\]);/);
    let params = [];
    if (paramDefsMatch) {
      try {
        params = eval(paramDefsMatch[1]);
      } catch (e) {
        params = [];
      }
    }

    // Extrae requirements
    const reqMatch = block.match(/requirements\s*=\s*(\[[^\]]+\])/);
    let requirements = [];
    if (reqMatch) {
      try {
        requirements = eval(reqMatch[1]);
      } catch (e) {}
    }

    endpoints.push({
      methodName,
      httpMethod,
      url,
      params,
      requirements
    });
  }

  return endpoints;
}

function walk(dir) {
  const results = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (file.endsWith('.js') && !file.endsWith('.map')) {
      results.push(full);
    }
  }
  return results;
}

const allFiles = walk(SDK_DIR);
const allEndpoints = {};

for (const file of allFiles) {
  const serviceName = path.basename(path.dirname(file));
  const endpoints = extractFromFile(file);
  if (endpoints.length > 0) {
    if (!allEndpoints[serviceName]) allEndpoints[serviceName] = [];
    allEndpoints[serviceName].push(...endpoints);
  }
}

const total = Object.values(allEndpoints).reduce((sum, arr) => sum + arr.length, 0);
console.log(JSON.stringify({
  totalEndpoints: total,
  services: Object.keys(allEndpoints).length,
  endpoints: allEndpoints
}, null, 2));
