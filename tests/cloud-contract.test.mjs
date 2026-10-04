import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const base = new URL('../', import.meta.url);
function source(path) { return readFileSync(new URL(path, base),'utf8'); }
function compile(src) {
 return stripTypeScriptTypes(src, {mode:'transform'}).replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
}
const env = new Map(); let handler, calls=[];
const context = vm.createContext({ Request, Response, Headers, URL, crypto, TextEncoder, TextDecoder,
 console, AbortController, setTimeout, clearTimeout,
 Deno:{env:{get:n=>env.get(n)},serve:h=>{handler=h;}},
 createClient:(url,key)=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{saved:args.p_matches.length},error:null};}})
});
vm.runInContext(compile(source('supabase/functions/winmix-ingest/index.ts')) + '\nglobalThis.key=getServiceRoleKey;',context);
let response=await handler(new Request('https://example.test',{method:'OPTIONS'}));
assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
assert.match(response.headers.get('Access-Control-Allow-Headers'),/x-winmix-ingest-token/);
assert.equal(response.headers.get('X-WinMix-Build'),'winmix-ingest-20261004-v2');
response=await handler(new Request('https://example.test',{method:'POST'}));
assert.equal(response.status,503);assert.equal(calls.length,0);
const token='a'.repeat(64);env.set('WINMIX_INGEST_TOKEN',token);
response=await handler(new Request('https://example.test',{method:'POST'}));assert.equal(response.status,401);
response=await handler(new Request('https://example.test',{method:'POST',headers:{'x-winmix-ingest-token':'b'.repeat(64)}}));
assert.equal(response.status,403);assert.equal(calls.length,0);
env.set('SUPABASE_SECRET_KEYS',JSON.stringify({default:'sb_secret_test'}));assert.equal(context.key(),'sb_secret_test');
env.set('SUPABASE_SECRET_KEYS',JSON.stringify({custom:'sb_secret_test'}));assert.equal(context.key(),'sb_secret_test');
env.set('SUPABASE_SECRET_KEYS',JSON.stringify({one:'sb_secret_1',two:'sb_secret_2'}));assert.throws(()=>context.key());
env.set('WINMIX_SECRET_KEY_NAME','two');assert.equal(context.key(),'sb_secret_2');
env.delete('WINMIX_SECRET_KEY_NAME');env.set('SUPABASE_SECRET_KEYS',JSON.stringify({default:'sb_secret_test'}));
env.set('SUPABASE_URL','https://dpmyxypqcsugycqhifaf.supabase.co');
const match={home_team:'A',away_team:'B',home_score:2,away_score:1,ht_home_score:3,ht_away_score:0};
const season={league:'angol',seasonIndex:1,name:'Test',orderMode:'source-order',matches:[match]};
const request=(body)=>new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json','x-winmix-ingest-token':token},body:JSON.stringify(body)});
response=await handler(request({seasons:[season]}));assert.equal(response.status,200);
assert.equal(calls[0].name,'winmix_ingest_season_v2');assert.equal(calls[0].args.p_matches[0].ht_home_score,null);
assert.equal(calls[0].args.p_matches[0].home_team_key,'a');
calls=[];response=await handler(request({seasons:[{...season,matches:[{...match,home_score:1.5}]}]}));
assert.equal(response.status,422);assert.equal(calls.length,0);
response=await handler(request({seasons:[{...season,orderMode:'chronological'}]}));assert.equal(response.status,422);assert.equal(calls.length,0);
const config=vm.createContext({URL});
vm.runInContext(compile(source('src/utils/cloudConfig.ts').replace('import.meta','({})'))+'\nglobalThis.resolve=resolveCloudEnv;',config);
const valid={VITE_SUPABASE_URL:'https://dpmyxypqcsugycqhifaf.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
assert.equal(config.resolve(valid).source,'env');
assert.equal(config.resolve({...valid,VITE_SUPABASE_URL:'https://wrong.supabase.co'}),null);
assert.equal(config.resolve({...valid,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}),null);
assert.equal(config.resolve({VITE_SUPABASE_URL:valid.VITE_SUPABASE_URL}),null);
assert.equal(config.resolve({}).source,'fallback');
let replies=[],requests=[];
const client=vm.createContext({URL,Headers,TextEncoder,AbortController,window:{setTimeout,clearTimeout},
 readCloudEnv:()=>({url:valid.VITE_SUPABASE_URL,anonKey:'sb_publishable_test',source:'env'}),
 fetch:async(url,options)=>{requests.push({url,options});return replies.shift();}});
vm.runInContext(compile(source('src/utils/supabaseTier.ts'))+'\nglobalThis.ingest=ingestSeasonsToCloud;globalThis.ratings=fetchCloudTeamRatings;',client);
const incoming={...season,id:'s',fileName:'',createdAt:'',contentHash:null,matches:[{...match,match_no:1,date:''}]};
replies=[Response.json({success:true,seasons:1,matches:1,rejected:0,repaired:1,errors:[],requestId:'first'}),
 Response.json({success:false,seasons:0,errors:['bad row'],rowErrors:[{season:'Second',matchNo:1,reason:'invalid'}],requestId:'second'},{status:422})];
const result=await client.ingest({seasons:[incoming,{...incoming,seasonIndex:2,name:'Second'}],importToken:token});
assert.equal(result.partial,true);assert.equal(result.seasons,1);assert.equal(result.rowErrors.length,1);
assert.equal(result.requestIds.length,2);assert.equal(requests.length,2);
assert.equal(requests[0].options.headers.Authorization,undefined);
assert.equal(requests[0].options.headers['x-winmix-ingest-token'],token);
requests=[];await client.ingest({seasons:[{...incoming,matches:Array(2001).fill(match)}],importToken:token});assert.equal(requests.length,0);
replies=[Response.json([{canonical_key:'a'}],{headers:{'content-range':'0-0/2'}}),Response.json([{canonical_key:'b'}],{headers:{'content-range':'1-1/2'}})];
const ratings=await client.ratings('angol');assert.equal(ratings.length,2);assert.equal(ratings[0].comparable,false);
assert.match(requests[1].url,/offset=1/);
console.log('PASS: preflight, auth fail-closed, named keys, validation/no writes, project pinning, batching, detailed errors, pagination.');
