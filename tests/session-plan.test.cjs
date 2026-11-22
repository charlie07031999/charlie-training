const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
function load(file,imports={}){
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>imports[name]??require(name),process,URL,Intl,Date,console});
  return exports;
}
const links=load('lib/auth-link.ts');
const plan=load('lib/hyrox-week.ts');
const url='https://example.supabase.co';
test('email link remains in app and rejects unrelated or non-login links',()=>{
  assert.equal(links.parseRecoveryLink(url+'/auth/v1/verify?token=one-use&type=magiclink',url).token_hash,'one-use');
  for(const link of ['https://evil.test/auth/v1/verify?token=x&type=magiclink',url+'/auth/v1/verify?token=x&type=recovery',url+'/?token=x&type=magiclink','bad',url+'/auth/v1/verify?type=magiclink']) assert.throws(()=>links.parseRecoveryLink(link,url));
});
test('HYROX dates use Paris midnight and expire after Saturday',()=>{
  assert.equal(plan.isHyroxWeek(Date.parse('2026-11-21T22:59:59Z')),false);
  assert.equal(plan.isHyroxWeek(Date.parse('2026-11-21T23:00:00Z')),true);
  assert.equal(plan.isHyroxWeek(Date.parse('2026-11-28T22:59:59Z')),true);
  assert.equal(plan.isHyroxWeek(Date.parse('2026-11-28T23:00:00Z')),false);
});
function cloud(auth){return load('lib/cloud.ts',{'./auth-link':links,'@supabase/supabase-js':{createClient:(_url,_key,options)=>{assert.equal(options.auth.persistSession,true);assert.equal(options.auth.autoRefreshToken,true);return {auth};}}});}
test('network auth error cannot masquerade as a signed-out account',async()=>{
  const error=new Error('offline');
  const api=cloud({getSession:async()=>({data:{session:null},error})});
  await assert.rejects(api.loadCloudState(),/offline/);
  await assert.rejects(api.startAnonymousAccount(),/offline/);
});
test('genuine missing session requests recovery without creating an account',async()=>{
  const api=cloud({getSession:async()=>({data:{session:null},error:null})});
  assert.equal(await api.loadCloudState(),null);
});
test('existing session is reused instead of creating an anonymous account',async()=>{
  const user={id:'existing',is_anonymous:false};
  const api=cloud({getSession:async()=>({data:{session:{user}},error:null})});
  assert.equal(await api.startAnonymousAccount(),user);
});
