(() => {
'use strict';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Reading aids only: association is supplied by the evidence-backed topic model.
const TOPIC_KEYWORDS = {
  implementation_rules:['实施导则','实施细则','实施意见','施行日期'],
  sheet_row_10:['建设工程规划许可证','工规证','2026年8月28日','已取得','未取得'],
  sheet_row_11:['预售许可证','预售许可','2026年8月28日','已取得','未取得'],
  sheet_row_12:['后续分期','分期','建设工程规划许可证','预售许可','原政策'],
  sheet_row_14:['建设工程规划许可证','工规证','分期','调整'],
  sheet_row_15:['建设工程规划许可证','工规证','最小分期','分期'],
  sheet_row_17:['预售许可','预售条件','封顶','主体结构','主体分部验收'],
  sheet_row_18:['竣工备案','竣工验收备案','竣备','按揭贷款','公积金贷款','贷款发放','发放贷款'],
  sheet_row_19:['竣工备案','竣工验收备案','竣备','按揭贷款','公积金贷款','贷款发放','发放贷款','续销'],
  sheet_row_21:['现房销售','现房比例','试点','新出让'],
  sheet_row_22:['现房销售','试点','主城区','首次登记','销售备案'],
  sheet_row_23:['定金','施工许可证','总价款','1%','百分之一'],
  sheet_row_25:['精装修','全装修','毛坯','竣工备案','竣工验收备案'],
  sheet_row_26:['分期','竣工备案','竣工验收备案','建设工程规划许可证'],
  sheet_row_27:['精装修','全装修','毛坯','交付','竣工备案','竣工验收备案'],
  sheet_row_28:['竣工备案','竣工验收备案','最小单元','规划核验','联合验收','隔墙'],
  sheet_row_30:['土地出让价款','土地出让金','土地款','延期','分期缴纳','分期支付'],
  sheet_row_31:['土地出让价款','土地出让金','土地款','分期缴纳','分期支付','两年','2年'],
  sheet_row_32:['土地出让价款','土地款','不动产权证','不动产登记','未付清'],
  sheet_row_34:['预售资金','监管资金','监管账户','开发贷款','开发贷','联合验收','全部纳入','解除监管'],
  sheet_row_35:['保函','置换','预售资金','监管资金'],
  sheet_row_36:['保函','金融机构','商业银行'],
  sheet_row_40:['股东借款','偿还','监管资金','工程款'],
  sheet_row_41:['股东分红','利润分配','分红'],
  sheet_row_45:['主办银行','自主选择','政府指定','遴选'],
  sheet_row_46:['主办银行','在途项目','存量项目','新取得土地'],
  sheet_row_47:['开发贷款','开发贷','提款','放款'],
  support_fund_loan_limit:['最高贷款额度','贷款额度','单方缴存','双方缴存','提高20万元','商品住房现房'],
  support_fund_eligibility:['住房套数','贷款资格','首套','未结清','核减','不叠加','不予受理'],
  support_renovation_withdrawal:['装修提取','提取金额','15万元','10年','一次','两人','不动产权证书']
};
function topicKeywords(id){return TOPIC_KEYWORDS[id]||[];}
function highlightText(value,keywords=[]){
  const text=String(value??''),positions=[],characters=[];
  for(let i=0;i<text.length;i++)if(!/\s/.test(text[i])){positions.push(i);characters.push(text[i].toLowerCase());}
  const compact=characters.join(''),ranges=[];
  const terms=[...new Set(keywords.filter(term=>typeof term==='string').map(term=>term.replace(/\s+/g,'').toLowerCase()).filter(Boolean))];
  for(const term of terms){
    for(let at=compact.indexOf(term);at!==-1;at=compact.indexOf(term,at+term.length))ranges.push([positions[at],positions[at+term.length-1]+1]);
  }
  ranges.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
  let cursor=0,result='';
  for(const [start,end] of ranges){if(start<cursor)continue;result+=esc(text.slice(cursor,start))+`<mark class="pm-keyword">${esc(text.slice(start,end))}</mark>`;cursor=end;}
  return result+esc(text.slice(cursor));
}
function topicEvidenceIds(policy,topicId){
  const ids=new Set();
  for(const entry of [...(policy.provisions||policy.summary?.provisions||[]),...(policy.conditions||policy.summary?.conditions||[])]){
    if(!entry.topic_ids?.includes(topicId))continue;
    for(const evidence of entry.evidence||[])if(evidence.segment_id)ids.add(evidence.segment_id);
  }
  return ids;
}
const labels = {beijing:'北京',tianjin:'天津',shijiazhuang:'河北（石家庄）',hainan:'海南（三亚、陵水）',sanya:'三亚',lingshui:'陵水'};
const apiCities = {beijing:'北京',tianjin:'天津',shijiazhuang:'石家庄',hainan:'海南',sanya:'三亚',lingshui:'陵水'};
const aliases = {beijing:'北京',北京市:'北京',tianjin:'天津',天津市:'天津',shijiazhuang:'石家庄',石家庄市:'石家庄','河北（石家庄）':'石家庄',hainan:'海南',海南省:'海南','海南（三亚、陵水）':'海南',sanya:'三亚',三亚市:'三亚',lingshui:'陵水',陵水黎族自治县:'陵水',全国:'国家',national:'国家'};
function normalizeScope(value) { return aliases[String(value ?? '')] || String(value ?? ''); }
function policyRegion(policy, city) {
  const scope=normalizeScope(policy.scope),target=normalizeScope(city);
  if(scope==='国家')return 'national';
  if(scope===target)return 'local';
  return Array.isArray(policy.reference_cities)&&policy.reference_cities.some(value=>normalizeScope(value)===target)?'provincial':null;
}
function matchesCity(policy, city) { return policyRegion(policy,city)!==null; }
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
function publicationRangeError(options={}) {
  if((options.dateFrom&&!validDate(options.dateFrom))||(options.dateTo&&!validDate(options.dateTo)))return '请输入有效的发布日期。';
  return options.dateFrom&&options.dateTo&&options.dateFrom>options.dateTo?'发布日期开始日期不能晚于结束日期。':'';
}
const MONITOR_START='2026-08-28';
function beijingToday(){return new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);}
function collectionPayload(options={},today=beijingToday()) {
  return {mode:'extractive',since:MONITOR_START,until:today,channel:null,cities:null};
}
function exportParameters(options={},today=beijingToday()) {
  const track=options.track||'delta';
  if(!['delta','baseline','all'].includes(track))throw new RangeError('请选择有效的政策范围。');
  const dateFrom=options.dateFrom||(track==='delta'?MONITOR_START:'1900-01-01'),dateTo=options.dateTo||today;
  const error=publicationRangeError({dateFrom,dateTo});if(error)throw new RangeError(error);
  if(dateFrom>today||dateTo>today)throw new RangeError('导出日期不能晚于今天。');
  const region=options.region||'all';
  if(region!=='all'&&!Object.prototype.hasOwnProperty.call(apiCities,region))throw new RangeError('请选择有效的城市范围。');
  return {region,track,channel:options.channel||'',published_from:dateFrom,published_to:dateTo,visibility:['active','excluded','all'].includes(options.visibility)?options.visibility:'active'};
}
function collectionDescription(payload,channels=[]) {
  const city=payload.cities?.join('、')||'全部城市';
  const channel=payload.channel?(channels.find(item=>item.id===payload.channel)?.label||payload.channel):'全部发布渠道';
  return `${city} · ${channel} · ${payload.since} 至 ${payload.until||'今'}`;
}
function matchesPublication(policy,options={}) {
  const channel=options.channel;
  if(channel&&!(policy.channels||[]).includes(channel)&&!(policy.official_sources||[]).some(source=>source.channel===channel))return false;
  if(!options.dateFrom&&!options.dateTo)return true;
  return validDate(policy.original_date)&&(!options.dateFrom||policy.original_date>=options.dateFrom)&&(!options.dateTo||policy.original_date<=options.dateTo);
}
function safeURL(value) { try { const u = new URL(String(value)); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function summaryText(policy) { if (!policy) return ''; return typeof policy.summary === 'string' ? policy.summary : policy.summary?.summary || ''; }
function newestPolicyFirst(a,b){
  const left=validDate(a.original_date)?a.original_date:'',right=validDate(b.original_date)?b.original_date:'';
  return right.localeCompare(left)||String(a.title||'').localeCompare(String(b.title||''),'zh-CN')||String(a.version_id||'').localeCompare(String(b.version_id||''));
}
function orderTopicPolicies(records,city){
  const rank={local:0,provincial:1,national:2};
  return [...records].sort((a,b)=>(rank[policyRegion(a,city)]??3)-(rank[policyRegion(b,city)]??3)||newestPolicyFirst(a,b));
}
function topicPolicy(policy, topicId) {
  if (!policy) return null;
  if (policy.topic_details) {
    const detail = policy.topic_details[topicId];
    if (!detail) return null;
    const globalExclusion=policy.excluded&&policy.exclusion_scope==='policy'?{excluded:true,exclusion_scope:'policy',exclusion_note:policy.exclusion_note}:{};
    return {...policy,...detail,...globalExclusion,topic_id:topicId,topic_details:undefined,official_sources:policy.official_sources || detail.official_sources || []};
  }
  return policy.topic_id === topicId ? policy : null;
}
function matchesVisibility(policy,visibility='active',library=false) {
  const excluded=Boolean(policy.excluded),hasExcluded=excluded||(library&&Boolean(policy.has_excluded_topics));
  return visibility==='all'||(visibility==='excluded'?hasExcluded:!excluded);
}
function visiblePolicies(policies,topicId,city,options={}) {
  const error=publicationRangeError(options);if(error)throw new RangeError(error);
  return policies.map(p=>topicPolicy(p,topicId)).filter(p=>p&&matchesCity(p,city)&&matchesPublication(p,options)&&matchesVisibility(p,options.visibility)).sort(newestPolicyFirst);
}
function policyCounts(policies,topicId,city,options={}) {
  const records=visiblePolicies(policies,topicId,city,options);
  return {collected:records.filter(p=>policyRegion(p,city)==='local').length,nationalCollected:records.filter(p=>policyRegion(p,city)==='national').length,provincialCollected:records.filter(p=>policyRegion(p,city)==='provincial').length};
}
function exclusionPayload(policy,topicId='',excluded=true,note='',exactTopic=false) {
  if(!policy?.policy_id)throw new Error('缺少政策标识，请重新打开政策。');
  return {policy_id:policy.policy_id,topic_id:!excluded&&policy.exclusion_scope==='policy'&&!exactTopic?'':topicId,excluded:Boolean(excluded),note};
}
function policyNatureLabel(policy){return policy.nature_label||({formal:'正式文件',explanation:'政策解读',draft:'征求意见稿（未生效）',qa:'政策答问',unknown:'性质待核验'})[policy.nature]||'性质待核验';}
function libraryDatePending(policy){return policy.library_status==='pending_date'||!validDate(policy.original_date);}
function visibleLibraryPolicies(policies,options={}) {
  const error=publicationRangeError(options);if(error)throw new RangeError(error);
  const q=String(options.query||'').trim().toLowerCase(),region=options.region||'all';
  return policies.filter(policy=>{
    const cities=region==='hainan'?['三亚','陵水']:region==='all'?[]:[apiCities[region]||region];
    return (!cities.length||cities.some(city=>matchesCity(policy,city)))&&matchesPublication(policy,options)
      &&(!(options.dateFrom||options.dateTo)||!libraryDatePending(policy))
      &&matchesVisibility(policy,options.visibility,true)
      &&(!q||[policy.title,policy.doc_no,policy.issuer,policy.summary_available?summaryText(policy):'',...(policy.topic_titles||[])].join(' ').toLowerCase().includes(q));
  }).sort((a,b)=>Number(libraryDatePending(a))-Number(libraryDatePending(b))||String(b.original_date||'').localeCompare(String(a.original_date||''))||String(a.title||'').localeCompare(String(b.title||''),'zh-CN'));
}
if (typeof module !== 'undefined' && module.exports) module.exports = {esc,highlightText,topicKeywords,topicEvidenceIds,normalizeScope,matchesCity,safeURL,summaryText,orderTopicPolicies,topicPolicy,matchesVisibility,visiblePolicies,policyCounts,exclusionPayload,visibleLibraryPolicies,policyNatureLabel,collectionPayload,collectionDescription,exportParameters};
if (typeof document === 'undefined') return;
const online=typeof window!=='undefined'?window.PolicyOnline:null;
const root = document.getElementById('pm-business');
const $ = selector => root.querySelector(selector);
const names = labels;
const sectionNames = {implementation:'省市房地产新规实施导则及细则出台情况',sales:'商品房销售制度',company:'项目公司制政策情况（若有）',bank:'主办银行制政策情况（若有）',support:'购房金融与支持政策'};
let data = {groups:[],items:[],implementation:[]};
let token = '', allPolicies = [], policyLibrary = [], policyReferences = [], libraryStats = {}, status = {}, publicationChannels = [];
let beforeDetailScroll = 0, cellSequence = 0, detailSequence = 0, pollTimer = null;
let connected = false, requestBusy = false, detailBusy = false, lastUpdated = null, submittedCollection = null, listSequence = 0;
let exportRequest=null,exportBusy=false,policyEvents=[],helpAnchor=null,helpPanel=null;
const state = {view:'matrix',detailMode:null,libraryId:null,libraryRecord:null,section:'sales',region:'all',group:'all',query:'',channel:'',dateFrom:'',dateTo:'',track:'delta',material:'formal',visibility:'active',exclusionDraft:'',open:['cutoff','presale'],selected:null,detailTab:'summary',notice:'',cellDocs:[],policy:null,loading:false,detailError:'',selectedVersion:null};
const shortDate = value => { if (!value) return '未记录'; const raw=String(value); if (!raw.includes('T')) return raw; const d=new Date(raw); return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京）'; };
const human = value => typeof value === 'string' ? value : value == null ? '' : value.text || value.summary || value.condition || value.description || '';
const list = value => Array.isArray(value) ? value : value ? [value] : [];
function policyDisplayLabel(p){return p?.excluded?'已排除':p?.has_newer_version?'已有更新版本':'';}
function link(url,text) { const href=safeURL(url); return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>` : `<span>${esc(text)}（链接待核验）</span>`; }
function cityCoverage(city) {
  const target=normalizeScope(apiCities[city]||city),entries=status.coverage_by_city;
  const coverage=Array.isArray(entries)?entries.find(entry=>normalizeScope(entry.city)===target):entries?.[target];
  return coverage?.status_label||coverage?.label||coverage?.status||'采集状态待确认';
}
function localCoverage(city) { return normalizeScope(apiCities[city]||city)==='海南'?`三亚：${cityCoverage('sanya')}；陵水：${cityCoverage('lingshui')}`:cityCoverage(city); }
function displayFilters() { return {channel:state.channel,dateFrom:state.dateFrom,dateTo:state.dateTo,visibility:state.visibility,track:state.track}; }
function matchingPolicies(id,city) { return visiblePolicies(allPolicies,id,apiCities[city] || city,displayFilters()); }
function selectedCellPolicies(selection){
  const city=apiCities[selection.city];
  const records=matchingPolicies(selection.id,selection.city);
  if(selection.layer==='national')return records.filter(p=>normalizeScope(p.scope)==='国家');
  return records.filter(p=>policyRegion(p,city)!=='national');
}
async function api(path, body) {
  if(online)return online.api(path,body);
  const headers = {'Accept':'application/json'};
  const options = {method:body === undefined ? 'GET' : 'POST',headers,credentials:'same-origin',cache:'no-store'};
  if (body !== undefined) { headers['Content-Type']='application/json'; headers['X-Policy-Token']=token; options.body=JSON.stringify(body); }
  const response = await fetch(path,options);
  let payload; try { payload=await response.json(); } catch { throw new Error(`服务返回非 JSON 内容（${response.status}）`); }
  if (!response.ok) throw new Error(payload.error || payload.message || `请求失败（${response.status}）`);
  return payload;
}
function runMessage(message,isError=false) { $('#pm-run-message').textContent=message; $('#pm-run-message').classList.toggle('pm-error',isError); }
function renderStatus() {
  $('#pm-query-summary').disabled=!connected;
  if(status.running)runMessage('正在检查官方政策，已有政策仍可查看。');
  $('#pm-run').disabled=(!online&&!connected) || Boolean(status.running) || requestBusy;
  $('#pm-export').disabled=!connected || exportBusy;
  $('#pm-run').textContent=online?(requestBusy?'刷新中…':'刷新数据'):status.running ? '采集中…' : requestBusy ? '提交中…' : '采集';
  if(online)$('#pm-run').title='读取已发布的最新政策数据';
  $('#pm-freshness').textContent=online?`数据截至 ${shortDate(status.last_updated||status.snapshot_generated_at)}${status.daily_update_enabled===true?' · 每日更新':''}`:status.last_updated?'最近采集 '+shortDate(status.last_updated):'尚无采集记录';
}
async function refreshEvents(){
  const response=await api('/api/policy-events');policyEvents=list(response.items);
  const unread=policyEvents.filter(item=>!item.read_at).length;
  $('#pm-updates').hidden=!policyEvents.length;
  $('#pm-updates-label').textContent=`政策更新 · 最近 ${policyEvents.length}条${unread?' · '+unread+'条未读':''}`;
  $('#pm-updates-list').innerHTML=policyEvents.map(item=>`<article class="pm-update"><p>${esc(({new_policy:'新增文件',content_changed:'原文变化',content_ready:'原文补齐'})[item.kind]||'政策更新')} · ${esc(item.scope||'范围待核验')} · ${esc(item.original_date||'日期待核验')}${item.read_at?' · 已读':''}</p><strong>${esc(item.title)}</strong><p>${esc(item.message)}</p>${item.current_policy_id?`<button type="button" class="pm-action" data-event-policy="${esc(item.current_policy_id)}">查看政策</button>`:link(item.source_url,'官方原文')}</article>`).join('');
  $('#pm-updates-read').disabled=!unread;
}
async function readUpdates(){
  try{await api('/api/policy-events/read',{event_ids:policyEvents.filter(item=>!item.read_at).map(item=>item.id)});await refreshEvents();}
  catch(error){runMessage('更新阅读状态未保存：'+error.message,true);}
}
function groups(){return data.groups.filter(g=>g.section===state.section);}
function columns(){return state.region==='all'?['beijing','tianjin','shijiazhuang','sanya','lingshui']:state.region==='hainan'?['sanya','lingshui']:[state.region];}
function effective(item,city){if(['sanya','lingshui'].includes(city)&&Object.prototype.hasOwnProperty.call(item.values,'hainan'))return {text:item.values.hainan||'',shared:true};return {text:item.values[city]??'',shared:city==='hainan'&&Object.prototype.hasOwnProperty.call(item.values,'hainan')};}
function matching(){const ids=new Set(groups().map(g=>g.id)),q=state.query.trim().toLowerCase();return data.items.filter(item=>ids.has(item.group)&&(state.group==='all'||item.group===state.group)&&(!q||[item.title,item.focus,data.groups.find(g=>g.id===item.group)?.title,...columns().flatMap(city=>city==='hainan'?['sanya','lingshui']:[city]).flatMap(city=>matchingPolicies(item.id,city)).map(p=>p.title+' '+summaryText(p))].join(' ').toLowerCase().includes(q)));}
function cell(item,city,small=false) {
  const selected=state.selected?.id===item.id&&state.selected.city===city&&!state.selected.layer;
  const counts=policyCounts(allPolicies,item.id,apiCities[city]||city,displayFilters());
  return `<button type="button" class="pm-cell" data-cell="${esc(item.id)}|${esc(city)}" aria-pressed="${selected}" aria-label="查看${esc(names[city])}：${esc(item.title)}，本地${counts.collected}条${counts.provincialCollected?'，省级参考'+counts.provincialCollected+'条':''}">${small?`<span class="pm-cell-title"><strong>${esc(names[city])}</strong></span>`:''}<span class="pm-cell-meta"><span class="pm-cell-count${counts.collected?'':' pm-pending'}">本地 ${counts.collected} 条</span>${counts.provincialCollected?`<span class="pm-reference-count">省级 ${counts.provincialCollected} 条</span>`:''}</span></button>`;
}
function baselineCell(item,standalone=false){
  const records=matchingPolicies(item.id,columns()[0]).filter(p=>normalizeScope(p.scope)==='国家');
  const selected=state.selected?.id===item.id&&state.selected.layer==='national';
  return `${standalone?'<div class="pm-implementation-baseline">':'<td class="pm-baseline-cell">'}<button type="button" class="pm-cell" data-baseline="${esc(item.id)}" aria-pressed="${selected}" aria-label="查看${esc(item.title)}的国家基准，${records.length}条">${standalone?'<span class="pm-cell-title"><strong>国家基准</strong></span>':''}<span class="pm-cell-count${records.length?'':' pm-pending'}">${records.length} 条</span></button>${standalone?'</div>':'</td>'}`;
}
function topicHeading(item){
  if(!String(item.focus||'').trim())return `<span class="pm-topic-label">${esc(item.title)}</span>`;
  const id='pm-topic-help-'+item.id;
  return `<span class="pm-topic-heading"><span class="pm-topic-label">${esc(item.title)}</span><button type="button" class="pm-topic-help" data-topic-help="${esc(item.id)}" aria-label="查看${esc(item.title)}的事项说明" aria-expanded="false" aria-controls="${esc(id)}">?</button></span><div id="${esc(id)}" class="pm-topic-help-popover" role="tooltip" hidden></div>`;
}
function closeTopicHelp(restoreFocus=false){
  if(!helpAnchor)return;
  const anchor=helpAnchor;helpAnchor=null;
  helpPanel.hidden=true;helpPanel.textContent='';helpPanel=null;
  anchor.setAttribute('aria-expanded','false');anchor.removeAttribute('aria-describedby');
  if(restoreFocus)anchor.focus({preventScroll:true});
}
function toggleTopicHelp(button){
  if(helpAnchor===button){closeTopicHelp();return;}
  closeTopicHelp();
  const item=data.items.find(item=>item.id===button.dataset.topicHelp),text=String(item?.focus||'').trim();
  if(!text)return;
  const id='pm-topic-help-'+item.id,panel=$('#'+id);
  panel.textContent=text;panel.hidden=false;helpAnchor=button;helpPanel=panel;
  button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby',id);
}
function renderMatrix(){
  if(renderFilterError())return;
  const items=matching(),cols=columns(),gs=groups().filter(g=>items.some(i=>i.group===g.id));
  const force=state.group!=='all'||Boolean(state.query.trim()),total=3+cols.length;
  const width=36+208+120*(cols.length+1);
  const head=`<colgroup><col style="width:36px"><col style="width:208px"><col style="width:120px">${cols.map(()=>'<col style="width:120px">').join('')}</colgroup><thead><tr><th class="pm-num" scope="col">序号</th><th class="pm-topic" scope="col">监测事项</th><th scope="col">国家基准</th>${cols.map(c=>`<th scope="col">${esc(names[c])}</th>`).join('')}</tr></thead>`;
  let shown=0;
  let body=gs.map(g=>{const open=force||state.open.includes(g.id),sub=items.filter(i=>i.group===g.id);return `<tr class="pm-group-row"><th colspan="${total}" scope="rowgroup"><button type="button" class="pm-group-button" data-group-toggle="${esc(g.id)}" aria-expanded="${open}"><span class="pm-group-arrow" aria-hidden="true">${open?'▾':'▸'}</span>${g.number?`${g.number}. `:''}${esc(g.title)}<span>${sub.length}项</span></button></th></tr>`+(open?sub.map((item,index)=>{shown++;return `<tr><td class="pm-num">${index+1}</td><th scope="row" class="pm-topic">${topicHeading(item)}</th>${baselineCell(item)}${cols.map(c=>`<td>${cell(item,c)}</td>`).join('')}</tr>`;}).join(''):'');}).join('');
  if(!gs.length)body=`<tr><td colspan="${total}" class="pm-empty">没有匹配的监测事项，可调整筛选或重置。</td></tr>`;
  $('#pm-table-wrap').innerHTML=`<table class="pm-matrix" style="min-width:${Math.max(width,570)}px" aria-label="${esc(sectionNames[state.section])}城市对照表">${head}<tbody>${body}</tbody></table>`;
  $('#pm-table-title').innerHTML=esc(sectionNames[state.section])+` <span>${items.length}项 · ${gs.length}组</span>`;
  $('#pm-table-count').textContent=`当前展开 ${shown}项 / 匹配 ${items.length}项${state.section==='support'?' · 扩展事项':' · 原表共27个监测事项'}`;
}
function splitOverview(text){const out={};for(const m of String(text||'').matchAll(/(三亚|陵水)[：:]([\s\S]*?)(?=(?:三亚|陵水)[：:]|$)/g))out[m[1]==='三亚'?'sanya':'lingshui']=m[2].trim();return out;}
function implementationItems(){return data.implementation.filter(i=>(state.region==='all'||i.region===state.region||i.region==='hainan'&&['sanya','lingshui'].includes(state.region))&&(!state.query||i.title.includes(state.query)));}
function renderImplementation(){
  if(renderFilterError())return;
  const rows=implementationItems();$('#pm-table-title').textContent=sectionNames.implementation;
  $('#pm-table-count').textContent=`${rows.length}个地区 · 政策范围与生效时间以原文为准`;
  $('#pm-table-wrap').innerHTML=`${baselineCell({id:'implementation_rules',title:'实施导则及细则'},true)}<table class="pm-overview" aria-label="省市实施导则出台情况"><colgroup><col style="width:44px"><col style="width:235px"><col style="width:300px"><col style="width:190px"></colgroup><thead><tr><th class="pm-num">序号</th><th class="pm-topic">事项</th><th>事项政策</th><th>采集范围</th></tr></thead><tbody>${rows.map((r,index)=>{const local=splitOverview(r.raw),cities=r.region==='hainan'?(state.region==='all'||state.region==='hainan'?['sanya','lingshui']:[state.region]):[r.region];return `<tr><td class="pm-num">${index+1}</td><th class="pm-topic" scope="row">${esc(r.title)}</th><td>${cities.map(city=>cell({id:'implementation_rules',title:'实施导则及细则',values:{[city]:local[city]||r.raw}},city,true)).join('')}</td><td><span class="pm-caption">${esc(localCoverage(r.region))}<br>未采到文件不作出台结论</span></td></tr>`;}).join('')||'<tr><td colspan="4" class="pm-empty">没有匹配的地区记录</td></tr>'}</tbody></table>`;
}
function selectedInfo(){if(!state.selected)return null;const{id,city}=state.selected;if(id==='implementation_rules'){const r=data.implementation.find(i=>i.region===city||i.region==='hainan'&&['sanya','lingshui'].includes(city));if(!r)return null;return {id,city,title:'省市房地产新规实施导则及细则出台情况',row:r.row,text:splitOverview(r.raw)[city]||r.raw,focus:'正式出台日期、发文机关、文号及官方原文链接',shared:false,groupTitle:'实施导则及细则'};}const item=data.items.find(i=>i.id===id);return item?{...item,...effective(item,city),city,groupTitle:data.groups.find(g=>g.id===item.group)?.title||''}:null;}
function block(title,body){return `<div class="pm-detail-block"><h3>${esc(title)}</h3>${body}</div>`;}
function identityDates(p){return `原始发布：${esc(p.original_date||'待核实')}${p.issued_date?`<br>成文日期：${esc(p.issued_date)}`:''}${p.repost_date?`<br>转载日期：${esc(p.repost_date)}`:''}<br>生效日期：${esc(p.effectivity_label||(p.nature==='draft'?'征求意见稿，不能作为生效依据':p.effective_date||'未明确，待核实'))}`;}
function referenceMaterials(p){
  const materials=list(p.reference_materials);
  if(!materials.length)return '';
  return block(`官方解读（${materials.length}份）`,materials.map(ref=>`<details class="pm-reference-material"><summary>${esc(ref.title)}</summary><p class="pm-caption">${esc(ref.original_date||'发布日期待核实')} · ${esc(ref.issuer||ref.scope||'')}</p><p>${esc(librarySummary(ref))}</p><p>${link(ref.source_url||ref.url,'官方解读原文')}</p></details>`).join(''));
}
function numericRules(p){
  const metrics={loan_limit:'最高贷款额度',loan_limit_increase:'额度上浮',loan_price_ratio_limit:'贷款占房款上限',withdrawal_limit:'提取上限',withdrawal_count_limit:'可提取次数',same_property_person_limit:'同一住房提取人数'};
  const rules=list(p.numeric_rules);if(!rules.length)return '';
  const note=[...new Set(rules.map(rule=>rule.note).filter(Boolean))].join(' ');
  return block('额度与适用条件',rules.map(rule=>{
    const qualifier=rule.metric==='loan_limit_increase'?'购买商品住房现房':rule.metric==='loan_price_ratio_limit'&&list(rule.conditions).some(c=>human(c).includes('非住宅建设用地'))?'购买非住宅建设用地上住房':'';
    return `<div class="pm-numeric-rule"><p>${esc(metrics[rule.metric]||rule.metric)}${rule.household?' · '+esc(rule.household):''} <strong>${rule.metric==='loan_limit_increase'?'+':''}${esc(rule.value)}${esc(rule.unit)}</strong></p>${list(rule.areas).length?`<p>${list(rule.areas).map(esc).join('、')}</p>`:''}${qualifier?`<p>${esc(qualifier)}</p>`:''}<details><summary>适用条件与依据</summary>${textList(rule.conditions)}${list(rule.evidence).map(e=>`<blockquote>${esc(e.quote||'')}</blockquote>`).join('')}</details></div>`;
  }).join('')+`<p class="pm-caption">${esc(note)}</p>`);
}
function textList(values,keywords=[]){const entries=list(values);return entries.length?`<ul>${entries.map(v=>`<li>${highlightText(human(v),keywords)}</li>`).join('')}</ul>`:'<p class="pm-caption">未提取到，需核验原文。</p>';}
function noPolicy(item){
  if(state.selected?.layer==='national')return `<div class="pm-info"><p>${state.loading?'正在读取国家基准…':state.detailError?esc(state.detailError):'该事项暂无符合查询条件的国家基准。'}</p></div>`;
  return `<div class="pm-info"><p>${state.loading?'正在读取政策…':state.detailError?esc(state.detailError):state.visibility==='excluded'?'该事项暂无已排除政策。':'该事项暂无已采集政策。'}</p><p>${esc(localCoverage(item.city))}；未采到文件不作出台结论。</p></div>`;
}
function sourceMeta(p){
  const isNational=normalizeScope(p.scope)==='国家',isProvincial=policyRegion(p,apiCities[state.selected?.city])==='provincial';
  const sources=list(p.official_sources),urls=new Set();
  const official=sources.filter(source=>{const url=source.url || source.source_url;if(!url || urls.has(url))return false;urls.add(url);return true;});
  const channels=[...new Set([...(p.channels||[]),...official.map(source=>source.channel).filter(Boolean)])].map(id=>publicationChannels.find(channel=>channel.id===id)?.label||official.find(source=>source.channel===id)?.channel_label||id);
  return `<details class="pm-source-disclosure"><summary>发文信息与日期</summary><div class="pm-policy-meta"><p class="pm-policy-title">${esc(p.title||'政策标题待核实')}</p><p class="${isNational||isProvincial?'pm-national-label':''}">${esc(isNational?'国家基准：不等于本地落地执行':isProvincial?`省级政策参考：${p.scope}；城市执行细则需另行核实`:`适用范围：${p.scope_label||p.scope||'待核实'}`)}${policyDisplayLabel(p)?' · '+esc(policyDisplayLabel(p)):''}</p>${channels.length?`<p>发布渠道：${esc(channels.join('、'))}</p>`:''}${p.issuer?`<p>发文机关：${esc(p.issuer)}</p>`:''}${p.source_issuer&&p.source_issuer!==p.issuer?`<p>${p.issuer?'转载来源':'采集来源'}：${esc(p.source_issuer)}</p>`:''}<p>${identityDates(p)}</p><p>${esc(p.evidence_status_label||policyNatureLabel(p))}</p>${p.effective_date_rule?`<p>生效依据：${esc(human(p.effective_date_rule))}</p>`:''}${p.doc_no?`<p>${esc(p.doc_no)}</p>`:''}<p>${official.length?official.map((source,index)=>link(source.url||source.source_url,`官方原文${official.length>1?' '+(index+1):''}${source.channel_label?' · '+source.channel_label:''}`)).join(' · '):link(p.source_url||p.url,'官方原文')}</p>${p.source_conflict?'<p class="pm-caution">原文存在差异，待核实。</p>':''}</div></details>`;
}
function renderEvidence(p){
  const provisions=list(p.provisions || p.summary?.provisions),conditions=list(p.conditions || p.summary?.conditions);
  const keywords=topicKeywords(state.selected?.id),seen=new Set();
  const evidence=[...provisions,...conditions].filter(entry=>{const key=JSON.stringify([human(entry),entry.evidence]);if(seen.has(key))return false;seen.add(key);return true;}).map(entry=>`<div class="pm-evidence">${list(entry.evidence).some(e=>e.quote===human(entry))?'':`<p>${highlightText(human(entry),keywords)}</p>`}${list(entry.evidence).map(e=>`<blockquote class="pm-quote">${highlightText(e.quote||'',keywords)}<br><cite>${link(e.source_url||p.source_url||p.url,'查看官方依据')}</cite></blockquote>`).join('')}</div>`).join('');
  const related=topicEvidenceIds(p,state.selected?.id);
  const original=list(p.segments).length?`<details class="pm-original"><summary>查看政策全文</summary>${list(p.segments).map(segment=>`<p class="pm-original-segment${related.has(segment.id)?' pm-related-segment':''}">${related.has(segment.id)?highlightText(segment.text,keywords):esc(segment.text)}</p>`).join('')}</details>`:'';
  return block('本事项条款与适用条件',evidence || '<p class="pm-caption">尚无可用的条款引文，请核验官方原文。</p>')+original+(list(p.attachments).length?block('相关附件',`<ul>${list(p.attachments).map(a=>`<li>${link(a.source_url||a.url,a.name||a.filename||a.title||'附件')}</li>`).join('')}</ul>`):'');
}
function exclusionActions(p,item=null){
  if(!p)return '';
  const topicId=item?.id||'',whole=Boolean(p.excluded&&p.exclusion_scope==='policy'),excluded=Boolean(p.excluded);
  const label=excluded?(whole?'恢复整份政策':topicId?'恢复本事项':'恢复整份政策'):(topicId?'从本事项排除':'排除整份政策');
  const explanation=whole?'整份政策已排除。恢复整份后，原先单独排除的事项仍保持排除。':topicId?'只影响当前事项；不影响该政策在其他事项或政策列表的展示。':'整份排除将同时隐藏本政策关联的事项内容。可在“显示范围：已排除”中找回并恢复。';
  return `<div class="pm-exclusion"><p class="pm-caption">${explanation}${online?' 仅当前浏览器，不影响其他人。':''}</p>${p.exclusion_note?`<p class="pm-caption">排除说明：${esc(p.exclusion_note)}</p>`:''}<label>说明（选填）<textarea id="pm-exclusion-note" rows="2" maxlength="2000" placeholder="记录排除原因或恢复说明">${esc(state.exclusionDraft)}</textarea></label><div class="pm-exclusion-actions"><button type="button" data-exclude="${!excluded}" data-exclusion-topic="${esc(topicId)}" ${detailBusy||!p.policy_id?'disabled':''}>${label}</button></div></div>`;
}
function renderDetail(){
  if(state.detailMode==='library'){renderLibraryDetail();return;}
  const item=selectedInfo();$('#pm-detail').hidden=!item;if(!item)return;
  const p=state.policy,tab=state.detailTab,baseline=state.selected.layer==='national';
  const history=online||baseline?'':`<details class="pm-history"><summary>历史填报（原业务表）</summary><div class="pm-quote">${esc(item.text||'原表未填写')}</div><p class="pm-caption">${item.shared?'海南合并反馈，具体适用城市待核实。':''}快照 ${esc(data.snapshot_date||'未知')}；历史填报不能代替当前政策。${link(data.reference_url,'原监测表')}</p></details>`;
  let body='';
  if(tab==='summary'){
    if(p){
      const excerpt=summaryText(p),normalize=text=>text.replace(/\s+/g,''),seen=new Set();
      const extraConditions=list(p.conditions||p.summary?.conditions).filter(condition=>{
        const text=normalize(human(condition));
        if(!text||normalize(excerpt).includes(text)||seen.has(text))return false;
        seen.add(text);return true;
      });
      body=numericRules(p)+block('事项要点',`<p>${highlightText(excerpt||'本事项暂无可用的政策要点。',topicKeywords(item.id))}</p>`)
        +(extraConditions.length?block('适用条件 / 例外',textList(extraConditions,topicKeywords(item.id))):'')
        +(list(p.unresolved||p.summary?.unresolved).length?block('待核实',textList(p.unresolved||p.summary?.unresolved)):'')+referenceMaterials(p);
    }else body=noPolicy(item);
  }
  if(tab==='evidence')body=p?renderEvidence(p):noPolicy(item);
  if(tab==='changes')body=p?block('与此前政策的变化',textList(p.changes||p.summary?.changes))+block('判定说明','<p class="pm-caption">文件更新不自动替代既有政策；效力关系和项目适用性需结合原文核实。</p>'):noPolicy(item);
  const optionGroup=(label,region)=>{
    const records=state.cellDocs.filter(d=>policyRegion(d,apiCities[item.city])===region);
    const open=true;
    return records.length?`<details class="pm-policy-group" ${open?'open':''}><summary>${label}<span>${records.length}条</span></summary>${records.map(d=>`<button type="button" class="pm-policy-option" data-policy-version="${esc(d.version_id)}" aria-pressed="${String(d.version_id)===String(state.selectedVersion)}" ${state.loading?'disabled':''}><span class="pm-policy-option-date">${esc(d.original_date||'日期待核实')}</span><span class="pm-policy-option-title">${esc(d.title)}${policyDisplayLabel(d)?' · '+esc(policyDisplayLabel(d)):''}</span></button>`).join('')}</details>`:'';
  };
  const options=optionGroup('本地政策','local')+optionGroup('省级参考','provincial')+optionGroup('国家基准','national');
  const emptyPolicyText=baseline?'暂无符合查询条件的国家基准政策':'暂无符合查询条件的本地政策';
  const policyList=state.cellDocs.length?`<div class="pm-policy-list"><h3>相关政策（${state.cellDocs.length}条）</h3><div class="pm-policy-list-head"><span title="原始发布日期">发布时间</span><span>政策名称</span></div>${options}</div>`:`<p class="pm-caption pm-empty-policy-list">${emptyPolicyText}</p>`;
  const scope=p?policyRegion(p,apiCities[item.city]):null;
  const selectedPolicy=p?`<div class="pm-selected-policy"><p class="pm-policy-title">${esc(p.title)}</p><p class="pm-caption">${esc(p.original_date||'日期待核实')} · ${esc(scope==='national'?'国家基准':scope==='provincial'?'省级参考':p.scope_label||p.scope||'范围待核实')} · ${link(p.source_url||p.url||p.official_sources?.[0]?.url||p.official_sources?.[0]?.source_url,'官方原文')}</p>${scope==='national'?'<p class="pm-caption">国家要求；本地执行需结合地方细则。</p>':scope==='provincial'?'<p class="pm-caption">省级规定；具体城市执行口径需核实。</p>':''}</div>`:'';
  const tabs=[['summary','事项要点'],['evidence','政策依据'],['changes','政策变化']];
  const header=`${state.view==='library'&&state.libraryId?'<button type="button" id="pm-back-policy" class="pm-back-policy">← 返回整份政策</button>':''}<div class="pm-detail-header"><div><p>${esc(baseline?'国家基准':names[item.city])} / ${esc(item.groupTitle)}</p><h2>${esc(item.title)}</h2></div><button type="button" class="pm-close" id="pm-close" aria-label="关闭详情侧边栏">关闭</button></div>`;
  if(!state.selectedVersion){$('#pm-detail').innerHTML=header+policyList+`<p class="pm-success" role="status">${esc(state.notice)}</p>`+history;return;}
  $('#pm-detail').innerHTML=header+`<button type="button" class="pm-back-list" id="pm-back-policies">← 返回政策列表</button><div class="pm-detail-tabs" role="tablist" aria-label="事项政策详情">${tabs.map(([k,label])=>`<button type="button" class="pm-detail-tab" role="tab" id="pm-tab-${k}" data-detail-tab="${k}" aria-selected="${k===tab}" aria-controls="pm-detail-content">${label}</button>`).join('')}</div><div class="pm-detail-content" id="pm-detail-content" role="tabpanel" aria-labelledby="pm-tab-${tab}">${selectedPolicy}${body}${p?sourceMeta(p):''}${p?`<details class="pm-source-disclosure"><summary>排除设置</summary>${exclusionActions(p,item)}</details>`:''}<p class="pm-success" role="status">${esc(state.notice)}</p>${history}</div>`;
}
function topicTitle(id){return id==='implementation_rules'?'实施导则及细则':data.items.find(item=>item.id===id)?.title||id;}
function topicLabel(id){
  const item=data.items.find(item=>item.id===id),title=topicTitle(id);
  return item&&(title==='新项目'||title.startsWith('已获取项目'))?`${data.groups.find(group=>group.id===item.group)?.title||''} · ${title}`:title;
}
function libraryTopicLinks(policy){
  if(['explanation','qa'].includes(policy.nature))return policy.parent_policy_id?`<button type="button" class="pm-topic-link" data-library-policy="${esc(policy.parent_policy_id)}">查看对应正式政策 ↗</button>`:'<span class="pm-caption">对应正式政策待核实</span>';
  const ids=policy.topic_ids||[];
  if(!ids.length)return '<span class="pm-caution">待关联事项</span>';
  const buttons=ids.map(id=>`<button type="button" class="pm-topic-link" data-policy-topic="${esc(id)}" data-policy-id="${esc(policy.policy_id)}">${esc(topicLabel(id))}<span aria-hidden="true"> ↗</span></button>`).join('');
  return ids.length>2?`<details class="pm-topic-disclosure"><summary><span class="pm-topic-list">${ids.slice(0,2).map(id=>esc(topicLabel(id))).join('；')}</span><span class="pm-topic-expand">查看全部 ${ids.length} 项</span><span class="pm-topic-collapse">收起 ${ids.length} 项</span></summary><div class="pm-topic-options">${buttons}</div></details>`:`<div class="pm-topic-options">${buttons}</div>`;
}
function channelLabels(policy){return [...new Set([...(policy.channels||[]),...(policy.official_sources||[]).map(source=>source.channel).filter(Boolean)])].map(id=>publicationChannels.find(channel=>channel.id===id)?.label||(policy.official_sources||[]).find(source=>source.channel===id)?.channel_label||id).join('、')||'官方来源待核实';}
function libraryStatusLabel(policy){if(policy.record_kind==='reference')return policy.reference_status_label||'待核验参考资料';return policy.library_status_label||({mapped:'已关联事项',unmapped:'待关联事项',pending_content:'正文待补齐',pending_date:'发布日期待核实',conflict:'原文差异待核实'}[policy.library_status])||'待核实';}
function librarySummary(policy){return policy.summary_available&&summaryText(policy)?summaryText(policy):'政策要点待原文核实后展示。';}
function libraryScope(policy){if(policy.scope_label)return policy.scope_label;const scope=normalizeScope(policy.scope);return scope==='国家'?'国家基准':policy.reference_cities?.length?`${scope} · 省级参考`:scope||'范围待核实';}
function renderLibrary(){
  if(renderFilterError())return;
  const references=state.material==='reference',records=references?policyReferences:policyLibrary;
  const items=visibleLibraryPolicies(records.map(policy=>({...policy,topic_titles:(policy.topic_ids||[]).map(topicTitle)})),{...displayFilters(),region:state.region,query:state.query});
  $('#pm-table-title').innerHTML=`${references?'解读参考':state.track==='baseline'?'历史基准':'政策列表'} <span>${references?items.length+'份':'采集 '+items.length+'条'}</span>`;
  $('#pm-table-count').textContent=references?`参考资料 ${items.length}份 · 不计入政策条数`:`当前查询 ${items.length}条 · 同文多渠道合并展示`;
  $('#pm-table-wrap').innerHTML=`<table class="pm-library-table" aria-label="已采集相关政策列表"><colgroup><col style="width:42%"><col style="width:12%"><col style="width:14%"><col style="width:12%"><col style="width:20%"></colgroup><thead><tr><th scope="col">政策名称 / 要点</th><th scope="col">适用范围</th><th scope="col">发布渠道</th><th scope="col">原始发布日期</th><th scope="col">关联事项</th></tr></thead><tbody>${items.map(policy=>{
    const topics=policy.topic_ids||[],selected=state.libraryId===policy.policy_id;
    const visibilityNote=policy.excluded?'已排除整份政策':policy.has_excluded_topics?'部分事项已排除':'';
    return `<tr class="${selected?'pm-library-selected':''}"><td><button type="button" class="pm-library-open" data-library-policy="${esc(policy.policy_id)}" aria-pressed="${selected}" aria-label="查看政策：${esc(policy.title)}"><strong>${esc(policy.title||'政策标题待核实')}</strong><span class="pm-library-mobile-meta">${esc(libraryScope(policy))} · ${esc(policy.original_date||'日期待核实')}<br>${esc(channelLabels(policy))}</span><span class="pm-library-excerpt">${esc(librarySummary(policy))}</span><span class="pm-caption">${esc(policyNatureLabel(policy))} · ${esc(libraryStatusLabel(policy))}${visibilityNote?' · '+visibilityNote:''} ↗</span></button></td><td>${esc(libraryScope(policy))}${policy.scope_note?`<span class="pm-caption">${esc(policy.scope_note)}</span>`:''}</td><td>${esc(channelLabels(policy))}</td><td>${esc(policy.original_date||'待核实')}</td><td>${libraryTopicLinks(policy)}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="pm-empty">没有符合查询条件的政策，可调整查询或重置。</td></tr>'}</tbody></table>`;
}
function renderLibraryDetail(){
  $('#pm-detail').hidden=!state.libraryId;if(!state.libraryId)return;
  const p=state.libraryRecord;
  const head=`<div class="pm-detail-header"><div><p>政策详情</p><h2>${esc(p?.title||'正在读取政策…')}</h2></div><button type="button" class="pm-close" id="pm-close" aria-label="关闭详情侧边栏">关闭</button></div>`;
  if(!p){$('#pm-detail').innerHTML=head+`<div class="pm-detail-content"><p class="pm-caption">${esc(state.detailError||'正在读取政策…')}</p></div>`;return;}
  const topics=p.topic_ids||[],sources=list(p.official_sources),urls=new Set();
  const official=sources.filter(source=>{const url=source.url||source.source_url;if(!url||urls.has(url))return false;urls.add(url);return true;});
  const attachments=list(p.attachments),canOpenTopics=!['pending_content','pending_date'].includes(p.library_status);
  const missingTopics=[...new Set(list(p.excluded_topic_ids))].filter(id=>!p.topic_details?.[id]);
  const historicalExclusions=missingTopics.length?block('历史排除事项',missingTopics.map(id=>`<div class="pm-info"><h3>${esc(topicTitle(id))}</h3><p>此版本未关联该事项；这里只撤销历史单项排除，不补建政策条款。</p>${p.excluded?'<p>整份政策的排除设置保持不变。</p>':''}<button type="button" class="pm-action" data-restore-topic="${esc(id)}" ${detailBusy?'disabled':''}>恢复该事项</button></div>`).join('')):'';
  const topicButtons=topics.map(id=>`<button type="button" class="pm-linked-topic" data-library-topic="${esc(id)}" ${!canOpenTopics?'disabled':''}><span>${esc(topicLabel(id))}</span><span>${topicPolicy(p,id)?.excluded?'已排除':'查看条款'} ↗</span></button>`).join('');
  $('#pm-detail').innerHTML=head+`<div class="pm-policy-meta"><p class="${normalizeScope(p.scope)==='国家'||p.reference_cities?.length?'pm-national-label':''}">${esc(libraryScope(p))}${normalizeScope(p.scope)==='国家'?' · 不等于本地落地执行':p.reference_cities?.length?' · 城市执行细则需另行核实':''}</p>${p.scope_note?`<p class="pm-caution">${esc(p.scope_note)}</p>`:''}<p>文件性质：${esc(policyNatureLabel(p))}</p><p>发布渠道：${esc(channelLabels(p))}</p>${p.issuer?`<p>发文机关：${esc(p.issuer)}</p>`:''}${p.source_issuer&&p.source_issuer!==p.issuer?`<p>${p.issuer?'转载来源':'采集来源'}：${esc(p.source_issuer)}</p>`:''}<p>${identityDates(p)}</p>${p.doc_no?`<p>${esc(p.doc_no)}</p>`:''}<p>${esc(p.evidence_status_label||policyNatureLabel(p))}</p><p>${esc(libraryStatusLabel(p))}${p.excluded?' · 已排除整份政策':p.has_excluded_topics?' · 部分事项已排除':''}</p></div><div class="pm-detail-content">${numericRules(p)}${block('政策要点',`<p>${esc(librarySummary(p))}</p>`)}${block('官方原文',official.length?official.map((source,index)=>`<p>${link(source.url||source.source_url,`官方原文${official.length>1?' '+(index+1):''}${source.channel_label?' · '+source.channel_label:''}`)}</p>`).join(''):'<p class="pm-caption">官方原文链接待核实。</p>')}${attachments.length?block('相关附件',`<ul>${attachments.map(a=>`<li>${link(a.source_url||a.url,a.name||a.filename||a.title||'附件')}</li>`).join('')}</ul>`):''}${p.nature==='formal'?block(`关联事项${topics.length?'（'+topics.length+'）':''}`,topicButtons?`<p class="pm-caption">进入具体事项查看条款、适用条件或恢复已排除事项。</p><div class="pm-linked-topics">${topicButtons}</div>`:'<p class="pm-caption">待关联监测事项；当前文件尚未形成事项结论。</p>'):''}${referenceMaterials(p)}${p.parent_policy_id?block('对应正式政策',`<button type="button" class="pm-topic-link" data-library-policy="${esc(p.parent_policy_id)}">查看正式政策 ↗</button>`):''}${historicalExclusions}${block('排除 / 恢复',exclusionActions(p))}<p class="pm-success" role="status">${esc(state.notice)}</p></div>`;
}
async function openLibraryPolicy(id){
  const priorScroll=$('#pm-table-wrap').scrollLeft;
  clearDetail();beforeDetailScroll=priorScroll;state.libraryId=id;state.detailMode='library';state.loading=true;render();
  const sequence=++detailSequence;
  try{const result=await api('/api/policy-library/'+encodeURIComponent(id));if(sequence!==detailSequence||state.view!=='library'||state.libraryId!==id)return;state.libraryRecord=result.item||result;return true;}
  catch(error){if(sequence===detailSequence)state.detailError=online?error.message:'政策暂时无法读取，请稍后重试。';}
  finally{if(sequence===detailSequence){state.loading=false;renderDetail();}}
}
function openLibraryTopic(id){
  const p=state.libraryRecord;if(!p||!(p.topic_ids||[]).includes(id)||['pending_content','pending_date'].includes(p.library_status))return;
  const targets=state.region==='hainan'?['sanya','lingshui']:state.region!=='all'?[state.region]:[];
  const city=[...targets,'beijing','tianjin','shijiazhuang','sanya','lingshui'].find(key=>matchesCity(p,apiCities[key]));
  if(!city)return;
  state.selected={id,city};state.detailMode='topic';state.detailTab='summary';state.notice='';state.policy=null;state.cellDocs=[];
  render();loadCell(topicPolicy(p,id)?.version_id,topicPolicy(p,id));
}
async function openPolicyTopic(policyId,topicId){
  const loaded=await openLibraryPolicy(policyId);
  if(loaded&&state.libraryId===policyId&&state.detailMode==='library')openLibraryTopic(topicId);
}
function renderFilterError(){
  const error=publicationRangeError(displayFilters());
  $('#pm-filter-error').textContent=error;
  $('#pm-filter-error').hidden=!error;
  for(const id of ['#pm-date-from','#pm-date-to'])$(id).setAttribute('aria-invalid',String(Boolean(error)));
  if(!error)return false;
  $('#pm-table-title').textContent=state.view==='library'?'政策列表':sectionNames[state.section];
  $('#pm-table-wrap').innerHTML='<p class="pm-empty pm-error">请修正发布日期范围后查看政策。</p>';
  $('#pm-table-count').textContent='发布日期范围待修正';
  return true;
}
function render(){
  const scrollLeft=$('#pm-table-wrap').scrollLeft;
  $('#pm-workarea').classList.toggle('pm-with-detail',Boolean(state.selected||state.libraryId));
  root.classList.toggle('pm-library-view',state.view==='library');
  for(const tab of root.querySelectorAll('[data-view]'))tab.setAttribute('aria-selected',String(tab.dataset.view===state.view));
  $('#pm-section-tabs').hidden=state.view==='library';
  $('#pm-table-hint').textContent=state.view==='library'?'点击政策，在右侧查看整份政策与关联事项':'点击单元格，在右侧查看详情';
  for(const tab of root.querySelectorAll('[data-section]'))tab.setAttribute('aria-selected',String(tab.dataset.section===state.section));
  $('#pm-main-panel').setAttribute('aria-labelledby',state.view==='library'?'pm-view-library':'pm-section-'+state.section);
  $('#pm-region').value=state.region;$('#pm-search').value=state.query;$('#pm-visibility').value=state.visibility;
  $('#pm-track').value=state.track;$('#pm-material').value=state.material;$('#pm-material-label').hidden=state.view!=='library';
  $('#pm-channel').innerHTML='<option value="">全部发布渠道</option>'+publicationChannels.map(channel=>`<option value="${esc(channel.id)}">${esc(channel.label)}</option>`).join('');
  $('#pm-channel').value=state.channel;$('#pm-date-from').value=state.dateFrom;$('#pm-date-to').value=state.dateTo;
  const gs=groups();if(state.group!=='all'&&!gs.some(g=>g.id===state.group))state.group='all';
  $('#pm-group').innerHTML='<option value="all">全部事项分组</option>'+gs.map(g=>`<option value="${esc(g.id)}">${esc(g.title)}</option>`).join('');$('#pm-group').value=state.group;
  $('#pm-group-label').hidden=state.view==='library'||!['sales','support'].includes(state.section);$('#pm-expand-all').hidden=state.view==='library'||state.section==='implementation';$('#pm-collapse-all').hidden=state.view==='library'||state.section==='implementation';
  const chosen=[state.region!=='all',state.group!=='all',Boolean(state.query.trim()),Boolean(state.channel),Boolean(state.dateFrom),Boolean(state.dateTo),state.visibility!=='active',state.track!=='delta',state.view==='library'&&state.material!=='formal'].filter(Boolean).length;
  $('#pm-query-summary').textContent=chosen?`查询条件（已选 ${chosen}项）`:'查询条件';
  renderResults();
  renderDetail();$('#pm-table-wrap').scrollLeft=scrollLeft;
}
function renderResults(){closeTopicHelp();if(state.view==='library')renderLibrary();else if(state.section==='implementation')renderImplementation();else renderMatrix();}
function clearDetail(){cellSequence++;detailSequence++;state.detailMode=null;state.libraryId=null;state.libraryRecord=null;state.selected=null;state.policy=null;state.cellDocs=[];state.selectedVersion=null;state.notice='';state.detailTab='summary';state.loading=false;state.detailError='';state.exclusionDraft='';}
async function loadPolicy(version){
  if(!state.selected)return;
  const sequence=++detailSequence,selection={...state.selected};state.selectedVersion=version;state.policy=null;state.exclusionDraft='';state.loading=true;state.detailError='';renderDetail();
  try {
    const params=new URLSearchParams({topic:selection.id,city:apiCities[selection.city]});
    const result=await api('/api/policies/'+encodeURIComponent(version)+'?'+params);
    if(sequence!==detailSequence||!state.selected)return;
    const detail={...(result.item||result),topic_id:selection.id};
    if(!matchesCity(detail,apiCities[selection.city]))throw new Error('适用范围已变化，请重新选择。');
    state.policy=detail;state.cellDocs=orderTopicPolicies([...state.cellDocs.filter(d=>String(d.version_id)!==String(version)),detail],apiCities[selection.city]);
  }
  catch(error){if(sequence===detailSequence)state.detailError=online?error.message:'政策暂时无法读取，请稍后重试。';}
  finally{if(sequence===detailSequence){state.loading=false;renderDetail();}}
}
async function loadCell(preferredVersion=null,directPolicy=null){
  if(!state.selected)return;
  const sequence=++cellSequence,selection={...state.selected};
  detailSequence++;state.loading=true;state.detailError='';state.policy=null;state.selectedVersion=null;
  state.cellDocs=selectedCellPolicies(selection);
  if(directPolicy&&!state.cellDocs.some(d=>d.version_id===directPolicy.version_id))state.cellDocs.push(directPolicy);
  state.cellDocs=orderTopicPolicies(state.cellDocs,apiCities[selection.city]);
  state.loading=false;renderDetail();
  if(sequence!==cellSequence||!state.selected)return;
  const chosen=preferredVersion?state.cellDocs.find(d=>String(d.version_id)===String(preferredVersion)):null;
  if(chosen)await loadPolicy(chosen.version_id);
}
function openCell(value,layer=null){const[id,city]=value.split('|');if(!names[city])return;state.detailMode='topic';if(!state.selected)beforeDetailScroll=$('#pm-table-wrap').scrollLeft;detailSequence++;state.selected={id,city,layer};state.notice='';state.detailTab='summary';state.policy=null;state.selectedVersion=null;state.cellDocs=[];render();loadCell();}
async function setExclusion(excluded,topicId='',exactTopic=false){
  const p=state.detailMode==='library'?state.libraryRecord:state.policy;if(!p||detailBusy)return;
  if(exactTopic&&(excluded||!list(p.excluded_topic_ids).includes(topicId)||p.topic_details?.[topicId]))return;
  let payload;try{payload=exclusionPayload(p,topicId,excluded,state.exclusionDraft,exactTopic);}catch(error){state.notice=error.message;renderDetail();return;}
  const sequence=detailSequence,mode=state.detailMode,version=p.version_id,id=p.policy_id;
  let saved=false;
  detailBusy=true;state.notice='正在保存…';renderDetail();
  try{
    await api('/api/exclusion',payload);saved=true;
    await refreshPolicies();
    if(sequence===detailSequence){
      if(mode==='library'){const result=await api('/api/policy-library/'+encodeURIComponent(id));if(sequence!==detailSequence)return;state.libraryRecord=result.item||result;}
      else {const nextSequence=detailSequence+1;await loadPolicy(version);if(detailSequence!==nextSequence)return;}
      state.notice=excluded?(payload.topic_id?'已从本事项排除，可随时恢复。':'已排除整份政策，可随时恢复。'):(payload.topic_id?'已恢复本事项。':'已恢复整份政策；单独排除的事项保持原设置。');
      if(exactTopic)state.notice='已撤销此事项的历史排除；本版本尚无该事项条款。'+(state.libraryRecord?.excluded?'整份政策仍处于排除状态。':'');
      if(online)state.notice+=' 仅当前浏览器。';
      state.exclusionDraft='';
    }
  }catch(error){if(sequence===detailSequence)state.notice=`${saved?'排除设置已保存，但页面刷新未完成':'保存未完成'}：${error.message}`;}
  finally{detailBusy=false;renderDetail();}
}
async function refreshPolicies(){
  const sequence=++listSequence,query=new URLSearchParams({visibility:state.visibility,track:state.track});
  const [response,library]=await Promise.all([api('/api/policies?'+query),api('/api/policy-library?'+query)]);
  if(sequence!==listSequence)return;
  allPolicies=list(response.items);policyLibrary=list(library.items);policyReferences=list(library.references);libraryStats=library.stats||{};
  const scroll=$('#pm-table-wrap').scrollLeft;renderResults();$('#pm-table-wrap').scrollLeft=scroll;
  if(state.selected&&!state.selectedVersion){
    state.cellDocs=orderTopicPolicies(selectedCellPolicies(state.selected),apiCities[state.selected.city]);
    renderDetail();
  }
}
async function refreshStatus(){status=await api('/api/business-status');connected=true;renderStatus();await refreshEvents();}
async function poll(){
  clearTimeout(pollTimer);
  try{
    const wasRunning=status.running;await refreshStatus();
    if(!status.running && (wasRunning || status.last_updated!==lastUpdated)){
      lastUpdated=status.last_updated;await refreshPolicies();if(state.selected)await loadCell(state.selectedVersion);else if(state.detailMode==='library'&&state.libraryId)await openLibraryPolicy(state.libraryId);
      if(wasRunning)runMessage('本轮检查已结束，可按查询条件查看入库政策。城市列仍保留实际覆盖状态。');
    }
  }catch(error){connected=false;renderStatus();runMessage('暂时无法连接本机服务，请稍后重试。',true);}
  pollTimer=setTimeout(poll,status.running?2000:15000);
}
async function startRun(){
  if(online){
    if(requestBusy)return;
    requestBusy=true;renderStatus();runMessage('正在读取最新政策数据…');
    try{
      await online.refresh();
      const response=await api('/api/bootstrap');data=response.business;publicationChannels=list(response.publication_channels);status=response.status||{};connected=true;lastUpdated=status.last_updated;
      await refreshPolicies();render();
      if(state.selected)await loadCell(state.selectedVersion);else if(state.detailMode==='library'&&state.libraryId)await openLibraryPolicy(state.libraryId);
      runMessage('已读取最新发布数据。');
    }catch(error){runMessage('刷新未完成：'+error.message,true);}
    finally{requestBusy=false;renderStatus();}
    return;
  }
  if(!connected||status.running||requestBusy)return;
  const payload=collectionPayload(),description=collectionDescription(payload,publicationChannels);
  requestBusy=true;renderStatus();runMessage(`正在提交采集：${description}。`);
  try{const result=await api('/api/collect',{});submittedCollection=description;status.running=true;status.collection_scope=result.collection_scope||payload;runMessage(`正在采集：${submittedCollection}。查询条件不影响本轮采集。`);clearTimeout(pollTimer);pollTimer=setTimeout(poll,500);}
  catch(error){runMessage(`未能启动采集：${error.message}`,true);}
  finally{requestBusy=false;renderStatus();}
}
function showExport() {
  if(online){
    try{
      exportRequest=online.exportParameters(state);const info=online.exportInfo(exportRequest);
      $('#pm-export-period').textContent=info.period;$('#pm-export-scope').textContent=info.scope;$('#pm-export-visibility').textContent=info.notice;
      $('#pm-export-filter-note').textContent='下载当前政策范围的完整发布快照；不应用城市、渠道、日期、关键词或个人排除。';
      $('#pm-export-error').textContent='';$('#pm-export-dialog').showModal();
    }catch(error){runMessage(error.message,true);}
    return;
  }
  try {
    if(['#pm-date-from','#pm-date-to'].some(id=>$(id).validity?.badInput))throw new RangeError('请输入有效的发布日期。');
    exportRequest=exportParameters(state);
  }catch(error){runMessage(error.message,true);return;}
  $('#pm-export-period').textContent=`${exportRequest.published_from==='1900-01-01'?'最早已存政策':exportRequest.published_from} 至 ${exportRequest.published_to}`;
  const channel=publicationChannels.find(item=>item.id===exportRequest.channel)?.label||'全部发布渠道';
  $('#pm-export-scope').textContent=`${names[exportRequest.region]||'全部城市'} · ${channel} · ${{delta:'8.28起新政',baseline:'历史基准',all:'新政与历史基准'}[exportRequest.track]}`;
  $('#pm-export-visibility').textContent=exportRequest.visibility==='excluded'?'仅导出已排除整份政策或事项，明确标注排除范围。':exportRequest.visibility==='all'?'导出全部政策，包含已排除记录并标注排除范围。':'仅导出未排除记录；已排除政策或事项不纳入。';
  $('#pm-export-error').textContent='';
  $('#pm-export-dialog').showModal();
}
async function downloadExport() {
  if(exportBusy||!exportRequest)return;
  const request={...exportRequest};
  exportBusy=true;$('#pm-export-download').disabled=true;$('#pm-export-download').textContent=online?'正在下载…':'正在生成…';$('#pm-export-error').textContent='';renderStatus();
  try{
    const info=online?online.exportInfo(request):null;
    const response=online?await fetch(info.url,{credentials:'omit',cache:'no-store'}):await fetch('/api/export.xlsx?'+new URLSearchParams(request),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
    if(!response.ok){if(online)throw new Error(`快照文件下载失败（${response.status}），请刷新数据后重试。`);const error=await response.json();throw new Error(error.error||'导出未完成，请重试。');}
    const blob=await response.blob();
    if(online){const signature=new Uint8Array(await blob.slice(0,2).arrayBuffer());if(signature[0]!==80||signature[1]!==75)throw new Error('快照文件格式不正确，请刷新数据后重试。');}
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=online?info.filename:`${request.track==='delta'?'8.28新政监测表':'政策监测表'}_${request.published_from==='1900-01-01'?'历史':request.published_from}_${request.published_to}${request.visibility==='excluded'?'_已排除':request.visibility==='all'?'_全部':''}.xlsx`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('#pm-export-dialog').close();runMessage('导出已完成。');
  }catch(error){const message=error.message||'导出未完成，请重试。';$('#pm-export-error').textContent=message;runMessage(`导出未完成：${message}`,true);}
  finally{exportBusy=false;$('#pm-export-download').disabled=false;$('#pm-export-download').textContent='下载 Excel';renderStatus();}
}
root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.topicHelp)toggleTopicHelp(b);
  else if(b.dataset.view){if(state.view!==b.dataset.view){state.view=b.dataset.view;clearDetail();render();}}
  else if(b.dataset.eventPolicy){state.view='library';openLibraryPolicy(b.dataset.eventPolicy);}
  else if(b.id==='pm-updates-read')readUpdates();
  else if(b.id==='pm-query-summary'){const open=!$('#pm-query').open;$('#pm-query').open=open;b.setAttribute('aria-expanded',String(open));}
  else if(b.dataset.policyTopic)openPolicyTopic(b.dataset.policyId,b.dataset.policyTopic);
  else if(b.dataset.libraryPolicy)openLibraryPolicy(b.dataset.libraryPolicy);
  else if(b.dataset.libraryTopic)openLibraryTopic(b.dataset.libraryTopic);
  else if(b.id==='pm-back-policy'&&state.libraryId)openLibraryPolicy(state.libraryId);
  else if(b.dataset.section){state.section=b.dataset.section;state.group='all';state.open=groups().map(g=>g.id);if(state.section==='sales')state.open=['cutoff','presale'];clearDetail();render();}
  else if(b.dataset.groupToggle){state.query='';state.group='all';const id=b.dataset.groupToggle;state.open=state.open.includes(id)?state.open.filter(x=>x!==id):[...state.open,id];render();}
  else if(b.dataset.baseline)openCell(`${b.dataset.baseline}|${columns()[0]}`,'national');
  else if(b.dataset.cell)openCell(b.dataset.cell);
  else if(b.dataset.policyVersion){state.detailTab='summary';loadPolicy(b.dataset.policyVersion);$('#pm-detail').scrollTop=0;}
  else if(b.id==='pm-back-policies'){detailSequence++;state.selectedVersion=null;state.policy=null;state.loading=false;state.detailError='';state.notice='';state.detailTab='summary';state.cellDocs=orderTopicPolicies(selectedCellPolicies(state.selected),apiCities[state.selected.city]);renderDetail();$('#pm-detail').scrollTop=0;}
  else if(b.dataset.detailTab){state.detailTab=b.dataset.detailTab;state.notice='';renderDetail();}
  else if(b.dataset.restoreTopic)setExclusion(false,b.dataset.restoreTopic,true);
  else if(b.dataset.exclude!==undefined)setExclusion(b.dataset.exclude==='true',b.dataset.exclusionTopic||'');
  else if(b.id==='pm-reset'){state.region='all';state.group='all';state.query='';state.channel='';state.dateFrom='';state.dateTo='';const visibilityChanged=state.visibility!=='active'||state.track!=='delta';state.visibility='active';state.track='delta';state.material='formal';if(visibilityChanged){allPolicies=[];policyLibrary=[];policyReferences=[];}clearDetail();render();if(visibilityChanged)refreshPolicies().catch(error=>runMessage('查询失败：'+error.message,true));}
  else if(b.id==='pm-expand-all'||b.id==='pm-collapse-all'){state.query='';state.group='all';state.open=b.id==='pm-expand-all'?groups().map(g=>g.id):[];clearDetail();render();}
  else if(b.id==='pm-close'){const selected=state.selected,libraryId=state.libraryId;clearDetail();render();$('#pm-table-wrap').scrollLeft=beforeDetailScroll;if(libraryId)Array.from(root.querySelectorAll('[data-library-policy]')).find(el=>el.dataset.libraryPolicy===libraryId)?.focus({preventScroll:true});else if(selected)Array.from(root.querySelectorAll(selected.layer==='national'?'[data-baseline]':'[data-cell]')).find(el=>selected.layer==='national'?el.dataset.baseline===selected.id:el.dataset.cell===`${selected.id}|${selected.city}`)?.focus({preventScroll:true});}
  else if(b.id==='pm-run')startRun();
  else if(b.id==='pm-export')showExport();
  else if(b.id==='pm-export-download')downloadExport();
  else if(b.id==='pm-export-cancel')$('#pm-export-dialog').close();
});
$('#pm-region').addEventListener('change',e=>{state.region=e.target.value;clearDetail();render();});
$('#pm-track').addEventListener('change',async e=>{state.track=e.target.value;clearDetail();allPolicies=[];policyLibrary=[];policyReferences=[];render();try{await refreshPolicies();}catch(error){runMessage('查询失败：'+error.message,true);}});
$('#pm-material').addEventListener('change',e=>{state.material=e.target.value;clearDetail();render();});
$('#pm-group').addEventListener('change',e=>{state.group=e.target.value;clearDetail();render();});
$('#pm-search').addEventListener('input',e=>{state.query=e.target.value;clearDetail();render();});
$('#pm-visibility').addEventListener('change',e=>{state.visibility=e.target.value;clearDetail();render();refreshPolicies().catch(error=>runMessage('查询失败：'+error.message,true));});
for(const [id,key] of [['#pm-channel','channel'],['#pm-date-from','dateFrom'],['#pm-date-to','dateTo']])$(id).addEventListener('change',e=>{state[key]=e.target.value;clearDetail();render();});
// Query changes only read and filter stored records; collection has a separate fixed contract.
root.addEventListener('input',e=>{if(e.target.id==='pm-exclusion-note')state.exclusionDraft=e.target.value;});
root.addEventListener('keydown',e=>{if(e.key==='Escape'&&helpAnchor){closeTopicHelp(true);e.stopPropagation();return;}if(e.key==='Escape'&&!$('#pm-export-dialog').open&&(state.selected||state.libraryId))$('#pm-close')?.click();});
document.addEventListener?.('click',event=>{if(helpAnchor&&!helpAnchor.contains(event.target)&&!helpPanel.contains(event.target))closeTopicHelp();});
document.addEventListener?.('keydown',event=>{if(event.key==='Escape'&&helpAnchor)closeTopicHelp(true);});
async function boot(){
  try{
    const response=await api('/api/bootstrap');data=response.business;token=response.token;status=response.status||{};allPolicies=list(response.policies);policyLibrary=list(response.policy_library?.items);policyReferences=list(response.policy_library?.references);libraryStats=response.policy_library?.stats||{};publicationChannels=list(response.publication_channels);connected=true;lastUpdated=status.last_updated;
    if(!data||!Array.isArray(data.items)||!Array.isArray(data.groups)||!Array.isArray(data.implementation))throw new Error('业务表结构不完整');
    render();renderStatus();await refreshEvents();if(!online)pollTimer=setTimeout(poll,status.running?1000:15000);
  }catch(error){console.error('Policy page initialization failed',error);connected=false;$('#pm-table-wrap').innerHTML=online?`<div class="pm-data-error">政策数据未能加载：${esc(error.message)}。可点击刷新数据重试。</div>`:'<div class="pm-data-error">暂时无法加载政策表，请确认本机服务已启动后刷新。</div>';$('#pm-run').disabled=!online;}
}
renderStatus();
boot();
})();
