const r = await fetch('https://faidersaltamar.com', { headers: { 'user-agent': 'Mozilla/5.0' } });
const h = await r.text();
const links = [...h.matchAll(/https?:\/\/[^"'<>\s]+/g)].map((m) => m[0]);
const uniq = [...new Set(links)];
console.log('DROPILINKS:');
console.log(uniq.filter((l) => /dropi/i.test(l)).join('\n') || '(ninguno en HTML)');
console.log('---TODOS LOS LINKS (primeros)---');
console.log(uniq.slice(0, 60).join('\n'));
