/* GitHub Pages adapter. No collector endpoint, credentials, or network writes. */
(function (global) {
'use strict';
const TRACKS=['delta','baseline','all'];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const clone=value=>JSON.parse(JSON.stringify(value));
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];
const emptyPersonal=()=>({schema_version:1,exclusions:{},notes:{}});
const validPersonalKey=value=>typeof value==='string'&&/^family:[a-f0-9]{64}$/.test(value);
function gzipDecoder(environment){
  if(typeof environment?.DecompressionStream!=='function'||typeof environment?.Response!=='function')return null;
  return response=>new environment.Response(response.body.pipeThrough(new environment.DecompressionStream('gzip'))).json();
}
function createOnline(options) {
  const baseURL=new URL('./',options.baseURL),fetcher=options.fetch;
  const decodeGzip=options.decodeGzip===undefined?gzipDecoder(global):options.decodeGzip;
  const gzipTimeoutMs=Number.isFinite(options.gzipTimeoutMs)?Math.max(0,options.gzipTimeoutMs):8000;
  const storageKey='policy-monitor:personal:v1:'+baseURL.pathname;
  let snapshot=null,loading=null;
  function withTimeout(promise,ms){
    if(!ms)return promise;
    let timer;
    const timeout=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error('compressed snapshot timed out')),ms);});
    return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
  }
  function storage(){try{return typeof options.storage==='function'?options.storage():options.storage;}catch(error){throw new Error('无法读取浏览器个人存储；请允许本站使用本地存储后重试。');}}
  function readPersonal(source=snapshot){
    let raw;
    try{raw=storage().getItem(storageKey);}catch(error){throw new Error('无法读取浏览器个人存储；原有排除和备注未能加载。');}
    if(raw===null)return emptyPersonal();
    let value;try{value=JSON.parse(raw);}catch(error){throw new Error('浏览器个人设置已损坏，未覆盖原有记录。');}
    if(!record(value)||value.schema_version!==1||!record(value.exclusions)||!record(value.notes)||Object.values(value.notes).some(note=>typeof note!=='string')||Object.values(value.exclusions).some(entry=>!record(entry)||typeof entry.excluded!=='boolean'||typeof entry.note!=='string'))throw new Error('浏览器个人设置已损坏，未覆盖原有记录。');
    return migratePersonal(value,source);
  }
  function savePersonal(value){
    const json=JSON.stringify(value);
    try{const target=storage();target.setItem(storageKey,json);if(target.getItem(storageKey)!==json)throw new Error('write not retained');}
    catch(error){throw new Error('保存到当前浏览器失败，请检查浏览器存储权限和可用空间后重试。');}
  }
  function migratePersonal(value,source){
    // Version IDs locate a snapshot; only the opaque family hash owns a
    // personal exclusion. Migrate exact known identities, never title guesses.
    const identities=new Map();
    for(const current of [snapshot,source])for(const [id,policy] of Object.entries(current?.library_details||{}))if(validPersonalKey(policy.personal_key))identities.set(id,policy.personal_key);
    let changed=false;
    for(const [oldKey,entry] of Object.entries(value.exclusions)){
      let pair;try{pair=JSON.parse(oldKey);}catch(error){continue;}
      if(!Array.isArray(pair)||pair.length!==2||typeof pair[1]!=='string')continue;
      const identity=identities.get(pair[0]);
      if(!identity||identity===pair[0])continue;
      const nextKey=JSON.stringify([identity,pair[1]]);
      // An explicit newer restoration takes precedence over an old ID.
      if(!own(value.exclusions,nextKey))value.exclusions[nextKey]=entry;
      delete value.exclusions[oldKey];changed=true;
    }
    if(changed)savePersonal(value);
    return value;
  }
  function personalKey(policy){
    const identity=policy.personal_key||snapshot?.library_details[policy.policy_id]?.personal_key;
    return validPersonalKey(identity)?identity:policy.policy_id;
  }
  function validate(value){
    if(!record(value)||value.schema_version!==1||typeof value.generated_at!=='string'||!record(value.business)||!['items','groups','implementation'].every(key=>Array.isArray(value.business[key]))||!record(value.status)||!record(value.tracks)||!record(value.library_details)||!record(value.topic_details)||!record(value.exports)||!TRACKS.every(track=>record(value.tracks[track])&&Array.isArray(value.tracks[track].policies)&&record(value.tracks[track].library)&&Array.isArray(value.tracks[track].library.items)&&Array.isArray(value.tracks[track].library.references)))throw new Error('已发布政策数据格式不完整，请稍后刷新。');
    return value;
  }
  async function readSnapshot(){
    if(typeof decodeGzip==='function'){
      // A transport or decompression failure permits one plain-JSON fallback.
      // Successfully decoded but invalid JSON/schema must still fail visibly.
      let compressed;
      try{compressed=await withTimeout(fetcher(new URL('policy-data.json.gz',baseURL).href,{cache:'no-store',credentials:'omit',headers:{Accept:'application/gzip'}}),gzipTimeoutMs);}catch(error){/* Fall back once below. */}
      if(compressed?.ok){
        try{return await withTimeout(decodeGzip(compressed),gzipTimeoutMs);}
        catch(error){if(error?.name==='SyntaxError')throw new Error('政策数据不是有效 JSON，请稍后刷新。');}
      }
    }
    const response=await fetcher(new URL('policy-data.json',baseURL).href,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`政策数据读取失败（${response.status}），请稍后刷新。`);
    try{return await response.json();}catch(error){throw new Error('政策数据不是有效 JSON，请稍后刷新。');}
  }
  async function refresh(){
    if(loading)return loading;
    loading=(async()=>{
      const next=validate(await readSnapshot());readPersonal(next);snapshot=next;return {generated_at:snapshot.generated_at};
    })();
    try{return await loading;}finally{loading=null;}
  }
  async function ready(){if(!snapshot)await refresh();}
  function trackFor(params){const track=params.get('track')||'delta';if(!TRACKS.includes(track))throw new Error('请选择有效的政策范围。');return snapshot.tracks[track];}
  function visibilityFor(params){const value=params.get('visibility')||'active';if(!['active','excluded','all'].includes(value))throw new Error('请选择有效的显示范围。');return value;}
  function exclusion(personal,id,topic=''){
    const whole=personal.exclusions[JSON.stringify([id,''])],single=topic?personal.exclusions[JSON.stringify([id,topic])]:null;
    const chosen=whole?.excluded?whole:single?.excluded?single:null;
    return {excluded:Boolean(chosen),exclusion_scope:chosen?(whole?.excluded?'policy':'topic'):null,exclusion_note:chosen?.note||'',excluded_at:null};
  }
  function applyPersonal(original,personal,id=personalKey(original),topic=''){
    const value=clone(original),ids=[];
    for(const [key,entry] of Object.entries(personal.exclusions)){
      let pair;try{pair=JSON.parse(key);}catch(error){continue;}
      if(Array.isArray(pair)&&pair[0]===id&&pair[1]&&entry.excluded)ids.push(pair[1]);
    }
    Object.assign(value,exclusion(personal,id,topic||value.topic_id||''),{excluded_topic_ids:ids,has_excluded_topics:Boolean(ids.length)});
    if(record(value.topic_details))for(const tid of Object.keys(value.topic_details))value.topic_details[tid]=applyPersonal(value.topic_details[tid],personal,id,tid);
    if(Array.isArray(value.reference_materials))value.reference_materials=value.reference_materials.map(ref=>applyPersonal(ref,personal));
    return value;
  }
  function visible(value,visibility,library=false){return visibility==='all'||(visibility==='excluded'?(value.excluded||(library&&value.has_excluded_topics)):!value.excluded);}
  function filterTopics(value,visibility){
    if(!record(value.topic_details))return value;
    value.topic_details=Object.fromEntries(Object.entries(value.topic_details).filter(([,detail])=>visible(detail,visibility)));
    value.topic_ids=Object.keys(value.topic_details);
    return value;
  }
  function policies(track,personal,visibility){
    return track.policies.map(value=>applyPersonal(value,personal)).map(value=>filterTopics(value,visibility)).filter(value=>value.topic_ids?.length||visible(value,visibility,true)&&!value.all_topic_ids?.length&&!Object.keys(value.topic_details||{}).length);
  }
  function library(track,personal,visibility){
    const select=entries=>entries.map(value=>applyPersonal(value,personal)).filter(value=>visible(value,visibility,true)).map(value=>filterTopics(value,visibility));
    const items=select(track.library.items),references=select(track.library.references);
    return {items,references,stats:{total:items.length,reference_total:references.length,linked_reference_total:references.filter(value=>value.parent_policy_id).length,unmatched_reference_total:references.filter(value=>!value.parent_policy_id).length,...Object.fromEntries(['mapped','unmapped','pending_content','pending_date','conflict'].map(status=>[status,items.filter(value=>value.library_status===status).length]))}};
  }
  function status(){return {...clone(snapshot.status),running:false,snapshot_generated_at:snapshot.generated_at};}
  function knownPolicy(id){return typeof id==='string'&&own(snapshot.library_details,id);}
  function noteValues(body){
    if(typeof body.topic_id!=='string'||!snapshot.business.items.some(item=>item.id===body.topic_id)&&body.topic_id!=='implementation_rules')throw new Error('请选择有效的事项。');
    if(!['北京','天津','石家庄','三亚','陵水'].includes(body.city))throw new Error('请选择有效的城市。');
    return JSON.stringify([body.topic_id,body.city]);
  }
  async function api(path,body){
    await ready();
    const parsed=new URL(path,'https://policy.invalid'),route=parsed.pathname,params=parsed.searchParams;
    const personal=readPersonal();
    if(body!==undefined){
      if(!record(body))throw new Error('无效的个人设置。');
      if(route==='/api/notes'){
        const key=noteValues(body);if(typeof body.note!=='string'||body.note.length>2000)throw new Error('备注不能超过 2000 字。');
        personal.notes[key]=body.note;savePersonal(personal);return {ok:true,note:body.note,storage_scope:'browser'};
      }
      if(route==='/api/exclusion'){
        if(!knownPolicy(body.policy_id))throw new Error('该政策不在当前快照中，请刷新后重试。');
        const topic=body.topic_id||'',policy=snapshot.library_details[body.policy_id];
        const identity=personalKey(policy);
        if(!validPersonalKey(identity))throw new Error('当前发布数据缺少稳定政策标识，请刷新数据后重试。');
        const key=JSON.stringify([identity,topic]);
        if(typeof topic!=='string'||topic&&!strings(policy.all_topic_ids).includes(topic)&&!strings(policy.topic_ids).includes(topic)&&!own(personal.exclusions,key))throw new Error('该事项未关联此政策。');
        if(typeof body.excluded!=='boolean'||body.note!==undefined&&typeof body.note!=='string'||(body.note||'').length>2000)throw new Error('排除说明不能超过 2000 字。');
        personal.exclusions[key]={excluded:body.excluded,note:body.note||''};savePersonal(personal);return {ok:true,storage_scope:'browser'};
      }
      throw new Error('线上展示页不支持此操作。');
    }
    if(route==='/api/bootstrap')return {business:clone(snapshot.business),topics:clone(snapshot.topics||[]),publication_channels:clone(snapshot.publication_channels||[]),status:status(),token:'',policies:policies(snapshot.tracks.delta,personal,'active'),policy_library:library(snapshot.tracks.delta,personal,'active')};
    if(route==='/api/business-status')return status();
    if(route==='/api/policy-events')return {items:[]};
    if(route==='/api/policies')return {items:policies(trackFor(params),personal,visibilityFor(params))};
    if(route==='/api/policy-library')return library(trackFor(params),personal,visibilityFor(params));
    if(route.startsWith('/api/policy-library/')){
      const id=decodeURIComponent(route.slice('/api/policy-library/'.length));
      if(!knownPolicy(id))throw new Error('当前快照缺少这份政策的详情，请刷新数据后重试。');
      return applyPersonal(snapshot.library_details[id],personal);
    }
    if(route.startsWith('/api/policies/')){
      const version=decodeURIComponent(route.slice('/api/policies/'.length)),topic=params.get('topic')||'',city=params.get('city')||'';
      const key=[version,topic,city].join('|');
      if(!own(snapshot.topic_details,key))throw new Error('当前快照缺少该城市事项的政策详情，请刷新数据后重试。');
      return applyPersonal(snapshot.topic_details[key],personal,personalKey(snapshot.topic_details[key]),topic);
    }
    if(route==='/api/notes'){const key=noteValues({topic_id:params.get('topic_id'),city:params.get('city')});return {note:personal.notes[key]||'',storage_scope:'browser'};}
    throw new Error('线上展示页不支持此查询。');
  }
  function exportParameters(options={}){const track=options.track||'delta';if(!TRACKS.includes(track))throw new Error('请选择有效的政策范围。');return {track};}
  function exportInfo(request){
    if(!snapshot)throw new Error('请先加载政策数据。');
    const {track}=exportParameters(request),path=snapshot.exports[track];
    if(typeof path!=='string'||!/^exports\/[a-zA-Z0-9_-]+\.xlsx$/.test(path))throw new Error('快照导出地址无效，请稍后重试。');
    const day=snapshot.generated_at.slice(0,10),title={delta:'8.28 起新政',baseline:'历史基准',all:'新政与历史基准'}[track];
    return {url:new URL(path,baseURL).href,filename:`政策监测表_${track}_${day}_完整快照.xlsx`,period:track==='delta'?'2026-08-28 起已发布的新政':'该轨道全部已发布政策',scope:`全部城市 · 全部发布渠道 · ${title}`,notice:'完整快照（不应用当前筛选或个人排除）',generated_at:snapshot.generated_at};
  }
  return Object.freeze({api,refresh,exportParameters,exportInfo});
}
if(typeof module!=='undefined'&&module.exports)module.exports={createOnline,gzipDecoder};
if(global&&typeof document!=='undefined'){
  const script=document.currentScript;
  global.PolicyOnline=createOnline({baseURL:new URL('./',script?.src||document.baseURI).href,fetch:global.fetch.bind(global),storage:()=>global.localStorage});
}
})(typeof window==='undefined'?null:window);
