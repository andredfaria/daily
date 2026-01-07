// #region agent log
fetch('http://127.0.0.1:7243/ingest/f3bbdc52-c0e4-4b62-aa51-616cd49760b7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-check.js:1',message:'Verificando dependências',data:{hypothesis:'H1'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-check',hypothesisId:'H1'})}).catch(()=>{});
// #endregion

const fs = require('fs');
const path = require('path');

const checks = {
  packageJsonExists: fs.existsSync('./package.json'),
  nodeModulesExists: fs.existsSync('./node_modules'),
  supabaseSSRExists: fs.existsSync('./node_modules/@supabase/ssr'),
  supabaseSSRPackageJson: fs.existsSync('./node_modules/@supabase/ssr/package.json'),
};

// #region agent log
fetch('http://127.0.0.1:7243/ingest/f3bbdc52-c0e4-4b62-aa51-616cd49760b7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-check.js:10',message:'Resultado das verificações',data:checks,timestamp:Date.now(),sessionId:'debug-session',runId:'pre-check',hypothesisId:'H1'})}).catch(()=>{});
// #endregion

console.log('Verificações:', JSON.stringify(checks, null, 2));

if (checks.supabaseSSRPackageJson) {
  const pkg = JSON.parse(fs.readFileSync('./node_modules/@supabase/ssr/package.json', 'utf8'));
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/f3bbdc52-c0e4-4b62-aa51-616cd49760b7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'debug-check.js:17',message:'Versão do @supabase/ssr encontrada',data:{version:pkg.version},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-check',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  console.log('Versão @supabase/ssr:', pkg.version);
}
