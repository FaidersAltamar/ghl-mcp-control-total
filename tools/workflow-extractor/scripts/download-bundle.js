// Download all the JS chunks captured during Playwright recon
// into docs/recon-samples/bundle-cache/ for offline grepping.
//
// Run: node scripts/download-bundle.js
//
// CDN assets are content-hashed and publicly cacheable — no auth needed.

const fs = require('fs');
const path = require('path');
const https = require('https');

const CHUNKS = [
  'index-DrASS8UJ.js',
  'sentry-qxzHDyGs.js',
  'vendor-oTieZUVo.js',
  'ghl-ui-JxcoaUoA.js',
  'firebase-cXhYtr83.js',
  'ghl-text-editor-iFm9D5tc.js',
  'WorkflowNew-c-uqGvfV.js',
  'use-advance-canvas-autosave-MH6DL7Pu.js',
  'use-unsaved-change-store-HJe6Mfc4.js',
  'aiTracking-5ZGbdwql.js',
  'custom-objects-inKT8HTx.js',
  'ActionBar-nPYy_KaZ.js',
  'workflow-configs-OTLGKAtq.js',
  'use-advanace-builder-telemetry-PAxzDE4o.js',
  'use-workflow-settings-nGTf1O0v.js',
  'LoadingIndicator.vue_vue_type_style_index_0_lang-ws3nPJFi.js',
  'use-event-bus-listeners-RC4hrKUH.js',
  'use-get-default-builder-gUduBQbc.js',
  'workflow_table_helper-AlJk-r-0.js',
  'AutoSaveSettingsService-fLOblaew.js',
  'use-canvas-utils-pEk7cpZ5.js',
  'KeybordShortcutToolTip.vue_vue_type_script_setup_true_lang-hhjXPfxy.js',
  'SidebarTransition-OBIfXSfn.js',
  'AsideSection-WXylXedp.js',
  'session-id-G2gqjAaY.js',
  'use-get-users-4fcaPJuB.js',
  'InfoModal-dGfKYZua.js',
  'UIPaginatedSelect-HKKf8VbB.js',
  'use-advance-canvas-dnd-98qEnkdQ.js',
  'SearchContactV2-VqdVW7I8.js',
  'use-workflow-overview-yTKnnjqg.js',
  'PhoneSystemService-2jZVfMp8.js',
  'index-5BQ5-yj2.js',
  'use-workflow-ai-CjZb_jet.js',
  'useVoiceRecording-XF7F2tcF.js',
  'Setting-6lQB5mi2.js',
  'GlobalWindow-eE0Eped_.js',
  'use-create-workflow-KBoK5uU8.js',
  'index-uYV3f99D.js',
  'marketplace-EY4uE5nx.js',
  'WorkflowTreeWrapper-2DV4lrhH.js',
  'use-version-history-loading-fce1iQqM.js',
  'DeleteConfirmation.vue_vue_type_script_setup_true_lang-l9QThzsE.js',
  'StatModalV2-l9u2UUJq.js',
  'WorkflowTreeV2-Rw4J7CM3.js',
  'vue-flow-background-WpBaYuk4.js',
  'WorkflowBuilderAI.vue_vue_type_style_index_0_lang-n3ajqIBQ.js',
  'value_formatter.util-6ixP_7Df.js',
  'useAiBuilderUI-Ybag_Lo1.js',
  'drip-helpers-7bLXQEpP.js',
  'ToolIcon.vue_vue_type_script_setup_true_lang-sSnP9pc3.js',
  'ai-ndsTLiMu.js',
  'NoDataSvg-7Am-t4Ya.js'
];

const OUTDIR = path.join(__dirname, '..', 'docs', 'recon-samples', 'bundle-cache');
fs.mkdirSync(OUTDIR, { recursive: true });

const HOST = 'client-app-automation-workflows.leadconnectorhq.com';

function download(name) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(OUTDIR, name);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      return resolve({ name, size: fs.statSync(outPath).size, cached: true });
    }
    const req = https.get(`https://${HOST}/assets/${name}`, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`${res.statusCode} for ${name}`));
      }
      const out = fs.createWriteStream(outPath);
      res.pipe(out);
      out.on('finish', () => {
        out.close(() => resolve({ name, size: fs.statSync(outPath).size, cached: false }));
      });
      out.on('error', reject);
    });
    req.on('error', reject);
  });
}

(async () => {
  const results = [];
  // Limit parallelism to be polite
  const concurrency = 5;
  for (let i = 0; i < CHUNKS.length; i += concurrency) {
    const batch = CHUNKS.slice(i, i + concurrency);
    const r = await Promise.all(batch.map(c => download(c).catch(e => ({ name: c, error: String(e.message || e) }))));
    for (const x of r) {
      results.push(x);
      if (x.error) console.log(`✗ ${x.name}: ${x.error}`);
      else console.log(`${x.cached ? '·' : '✓'} ${x.name}  ${(x.size / 1024).toFixed(0)} KB`);
    }
  }
  const ok = results.filter(r => !r.error);
  const totalKB = ok.reduce((s, r) => s + r.size, 0) / 1024;
  console.log(`\nDone: ${ok.length}/${CHUNKS.length} chunks, ${(totalKB / 1024).toFixed(1)} MB total`);
})();
