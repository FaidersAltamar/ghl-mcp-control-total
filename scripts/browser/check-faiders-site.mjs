// Revisa si faidersaltamar.com es scrapeable (HTML estático vs SPA).
try {
  const r = await fetch('https://faidersaltamar.com', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const t = await r.text();
  console.log('status', r.status, 'len', t.length);
  const title = (t.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
  console.log('title:', title);
  console.log('has _next:', t.includes('_next') || t.includes('__NEXT_DATA__'));
  console.log('has id=root:', t.includes('id="root"'));
  console.log('sample:', t.slice(0, 400).replace(/\s+/g, ' '));
} catch (e) {
  console.log('ERR', e.message);
}
