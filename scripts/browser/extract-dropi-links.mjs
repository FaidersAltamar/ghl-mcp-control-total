const base = 'https://faidersaltamar.com';
const bundles = [
  '/assets/dropi-CP_roiGU.js',
  '/assets/index-BOc9LFBO.js',
];
for (const b of bundles) {
  const r = await fetch(base + b, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const t = await r.text();
  console.log('\n########## ' + b + ' (' + t.length + ' bytes) ##########');
  // Extraer todas las URLs que parezcan enlaces de registro/afiliado Dropi
  const urls = [...t.matchAll(/https?:\/\/[^"'`\s\\]+/g)].map((m) => m[0]);
  const dropi = [...new Set(urls.filter((l) => /dropi/i.test(l)))];
  console.log('--- URLs con dropi ---');
  console.log(dropi.join('\n') || '(ninguna)');
  // Buscar palabras clave de registro/afiliado
  const kw = [...new Set(urls.filter((l) => /register|registro|refer|aff|invite|join|signup|sign-up|ref=/i.test(l)))];
  console.log('--- URLs con register/refer/aff ---');
  console.log(kw.join('\n') || '(ninguna)');
  // Buscar fragmentos cerca de "Chile", "Colombia", etc.
  const countries = ['Colombia','México','Mexico','Panamá','Panama','Chile','Ecuador','Perú','Peru','Paraguay','Venezuela','Guatemala'];
  for (const c of countries) {
    const idx = t.indexOf(c);
    if (idx >= 0) {
      console.log(`\n--- contexto de "${c}" ---`);
      console.log(t.slice(Math.max(0, idx - 200), idx + 300).replace(/\s+/g, ' '));
    }
  }
}
