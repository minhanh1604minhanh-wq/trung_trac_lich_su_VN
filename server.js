'use strict';
const express=require('express');
const path=require('path');
const fs=require('fs');
const cors=require('cors');
const OpenAIPackage=require('openai');
const OpenAI=OpenAIPackage.OpenAI||OpenAIPackage.default||OpenAIPackage;
require('dotenv').config();

const app=express();
const PORT=process.env.PORT||3000;
const PUBLIC=path.join(__dirname,'public');
const DATA=path.join(PUBLIC,'data');
const openai=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;
const ANALYTICS_API_URL=String(process.env.ANALYTICS_API_URL||'').trim().replace(/\/+$/,'');
const ANALYTICS_INGEST_KEY=String(process.env.ANALYTICS_INGEST_KEY||'').trim();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({limit:'700kb'}));

function profile(id='trung-trac'){
  const safe=String(id).replace(/[^a-z0-9-]/gi,'');
  const file=path.join(DATA,`${safe}.json`);
  if(!fs.existsSync(file))return null;
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
function clean(v,n=1200){return String(v??'').trim().slice(0,n)}
function hist(v){return Array.isArray(v)?v.slice(-14).map(x=>({role:x.role==='assistant'?'assistant':'user',content:clean(x.content,4000)})):[]}
function allowedSourceIds(p){return new Set((p.sources||[]).map(s=>s.id))}
function filterSourceIds(p,ids){const allowed=allowedSourceIds(p);return [...new Set((Array.isArray(ids)?ids:[]).filter(id=>allowed.has(id)))]}
function curatedContext(p,lang='vi'){
  const en=lang==='en';
  const facts=(p.facts||[]).map(f=>`[${(f.sourceIds||f.sources||[]).join(',')}] (${f.kind||'fact'}) ${en?f.en:f.vi}`).join('\n');
  const sources=(p.sources||[]).map(s=>`${s.id}: ${en?s.titleEn:s.title}`).join('\n');
  const noEvidence=en?'Insufficient evidence to confirm.':'Chưa đủ nguồn để khẳng định.';
  return `${en?'HISTORICAL FIGURE':'NHÂN VẬT'}: ${en?p.nameEn:p.name}\n${en?'CURATED FACTS':'DỮ KIỆN NỀN ĐÃ BIÊN TẬP'}:\n${facts}\n${en?'ALLOWED SOURCE IDS':'MÃ NGUỒN ĐƯỢC PHÉP'}:\n${sources}\n${en?'RULES':'QUY TẮC'}:\n- ${en?'Use only the curated facts above as historical background. Do not use memory or outside knowledge.':'Chỉ dùng các dữ kiện nền ở trên làm bối cảnh lịch sử. Không dùng trí nhớ hoặc kiến thức ngoài bộ facts.'}\n- ${en?'Every historical statement must be supported by one or more listed source IDs.':'Mỗi phát biểu lịch sử phải được hỗ trợ bởi ít nhất một sourceId trong danh sách.'}\n- ${en?'Keep historical fact, author judgement, legend, disputed point and simulation distinct.':'Phân biệt rõ dữ kiện lịch sử, nhận định tác giả, truyền thuyết, điểm tranh luận và mô phỏng.'}\n- ${en?'When the facts do not support a claim, write exactly: '+noEvidence:'Khi facts không đủ hỗ trợ, phải ghi đúng câu: '+noEvidence}\n- ${en?'Never invent dates, places, offices, quotations, figures, page numbers, issue numbers or URLs.':'Không bịa niên đại, địa danh, chức vụ, trích dẫn, số liệu, số trang, số tạp chí hoặc URL.'}`;
}
function roleIdentityPrompt(rp={},lang='vi'){
  const en=lang==='en';
  const learner=rp.learnerRole?.[lang]||'';
  const npc=rp.npcRole?.[lang]||'';
  const address=rp.addressRule?.[lang]||'';
  return `${en?'ROLE LOCK - NEVER SWAP THESE ROLES':'KHÓA VAI - TUYỆT ĐỐI KHÔNG ĐẢO VAI'}:\n- ${en?'Human learner':'Người học'}: ${learner}\n- ${en?'AI/NPC':'AI/NPC'}: ${npc}\n- ${en?'Address rule':'Quy tắc xưng hô'}: ${address}\n- ${en?'npcDialogue contains only the NPC words addressed to the human learner. feedback is a neutral facilitator comment. Never write the learner response for them.':'npcDialogue chỉ chứa lời của NPC nói với người học. feedback là nhận xét trung lập của người hướng dẫn. Không viết thay câu trả lời của người học.'}`;
}
function normalizeRoleResponse(value={}){
  const d=value&&typeof value==='object'?value:{};
  d.npcDialogue=clean(typeof d.npcDialogue==='string'?d.npcDialogue:(d.npcDialogue?.text||d.npcDialogue?.dialogue||''),4000);
  d.feedback=clean(typeof d.feedback==='string'?d.feedback:(d.feedback?.text||d.feedback?.comment||''),2500);
  d.endReason=clean(typeof d.endReason==='string'?d.endReason:(d.endReason?.text||d.endReason?.reason||''),2500);
  return d;
}
function roleIdentityViolation(rp={},lang='vi',response={}){
  const dialogue=String(response.npcDialogue||'').toLocaleLowerCase(lang==='vi'?'vi-VN':'en-US');
  const forbidden=rp.identityGuard?.forbiddenNpcPhrases?.[lang]||[];
  return forbidden.some(phrase=>dialogue.includes(String(phrase).toLocaleLowerCase(lang==='vi'?'vi-VN':'en-US')));
}
function lastRoleEvaluation(history=[]){
  for(let i=(Array.isArray(history)?history.length:0)-1;i>=0;i--){
    const item=history[i];
    if(item?.role!=='assistant')continue;
    try{
      const data=typeof item.content==='string'?JSON.parse(item.content):item.content;
      if(data?.evaluation&&typeof data.evaluation==='object')return data.evaluation;
    }catch{}
  }
  return {};
}
function booleanValue(value){return value===true||String(value).toLowerCase()==='true'}
async function jsonChat(messages,temp=.35){
  if(!openai)throw new Error('OPENAI_API_KEY missing');
  const r=await openai.chat.completions.create({
    model:process.env.OPENAI_TEXT_MODEL||'gpt-4o-mini',
    messages,
    temperature:temp,
    response_format:{type:'json_object'}
  });
  return JSON.parse(r.choices[0].message.content);
}

app.get('/health',(_,res)=>res.json({ok:true,character:'trung-trac',aiReady:Boolean(openai),analyticsReady:Boolean(ANALYTICS_API_URL&&ANALYTICS_INGEST_KEY)}));


async function forwardAnalyticsEvent(body={}){
  if(!ANALYTICS_API_URL||!ANALYTICS_INGEST_KEY)return {skipped:true,reason:'ANALYTICS_NOT_CONFIGURED'};
  const p=profile(body.characterId||'trung-trac');
  if(!p)throw new Error('Character not configured');

  const participant=body.participant&&typeof body.participant==='object'?body.participant:{};
  const participantName=clean(participant.name,250);
  const sessionId=clean(body.sessionId,200);
  const visitorId=clean(body.visitorId,200);
  const eventType=clean(body.eventType,120);
  if(!participantName||!sessionId||!visitorId||!eventType)throw new Error('Missing analytics identity fields');

  const payload={
    eventId:clean(body.eventId,200)||undefined,
    sessionId,
    visitorId,
    eventType,
    feature:clean(body.feature,120)||undefined,
    content:clean(body.content,5000)||undefined,
    language:body.language==='en'?'en':'vi',
    occurredAt:body.occurredAt||new Date().toISOString(),
    startedAt:body.startedAt||undefined,
    endedAt:body.endedAt||undefined,
    durationSeconds:Math.max(0,Number(body.durationSeconds)||0),
    participant:{
      name:participantName,
      className:clean(participant.className,200)||undefined,
      schoolName:clean(participant.schoolName,300)||undefined
    },
    character:{
      slug:p.id||'trung-trac',
      nameVi:p.name||'Trưng Trắc',
      nameEn:p.nameEn||'Trung Trac'
    },
    sessionMetadata:body.sessionMetadata&&typeof body.sessionMetadata==='object'?body.sessionMetadata:{},
    metadata:body.metadata&&typeof body.metadata==='object'?body.metadata:{}
  };

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6500);
  try{
    const r=await fetch(`${ANALYTICS_API_URL}/api/events`,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-analytics-key':ANALYTICS_INGEST_KEY},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.ok===false)throw new Error(d.error||`Analytics HTTP ${r.status}`);
    return {skipped:false,eventId:d.eventId||payload.eventId||null};
  }finally{clearTimeout(timer)}
}

app.post('/analytics-event',async(req,res)=>{
  try{
    const result=await forwardAnalyticsEvent(req.body||{});
    res.status(result.skipped?202:200).json({ok:true,...result});
  }catch(e){
    console.warn('analytics forward error',e?.message||e);
    res.status(502).json({ok:false,message:'Analytics service unavailable'});
  }
});

app.post('/ask',async(req,res)=>{
  const p=profile(req.body.characterId);
  if(!p)return res.status(400).json({message:'Character not configured'});
  const q=clean(req.body.question,600),lang=req.body.lang==='en'?'en':'vi';
  if(!q)return res.status(400).json({message:lang==='en'?'Question is required.':'Cần nhập câu hỏi.'});
  try{
    const prompt=`${curatedContext(p,lang)}\n${lang==='en'?'Answer entirely in English.':'Trả lời hoàn toàn bằng tiếng Việt.'}\nYou are a source-locked historical inquiry assistant. Return JSON exactly with keys: answerType, reply, evidencePoints (array), sourceIds (array), evidenceNote, confidence, suggestions (array). The reply is the main answer and must be understandable on its own. Evidence points must not add facts absent from the curated set. If the question is counterfactual, direct the learner to the counterfactual tool. Do not include headings inside reply.`;
    const d=await jsonChat([{role:'system',content:prompt},{role:'user',content:q}],.25);
    d.sourceIds=filterSourceIds(p,d.sourceIds);
    d.reply=clean(typeof d.reply==='string'?d.reply:(d.reply?.text||d.reply?.answer||''),5000);
    d.evidenceNote=clean(typeof d.evidenceNote==='string'?d.evidenceNote:(d.evidenceNote?.text||''),2000);
    d.evidencePoints=Array.isArray(d.evidencePoints)?d.evidencePoints.map(x=>clean(typeof x==='string'?x:(x?.text||x?.point||''),1000)).filter(Boolean).slice(0,6):[];
    d.suggestions=Array.isArray(d.suggestions)?d.suggestions.slice(0,4):[];
    res.json(d);
  }catch(e){res.status(500).json({message:lang==='en'?'AI inquiry is unavailable.':'Tra cứu AI đang tạm gián đoạn.'})}
});

app.post('/whatif',async(req,res)=>{
  const p=profile(req.body.characterId),lang=req.body.lang==='en'?'en':'vi';
  if(!p)return res.status(400).json({message:'Character not configured'});
  const scenario=clean(req.body.scenario,700);
  if(!scenario)return res.status(400).json({message:lang==='en'?'Scenario is required.':'Cần nhập giả định.'});
  try{
    const prompt=`${curatedContext(p,lang)}\n${lang==='en'?'Write entirely in English.':'Viết hoàn toàn bằng tiếng Việt.'}\nGuide counterfactual historical thinking. Return JSON exactly with keys: baseline, sourceIds, changedAssumption, consequences (array of 3-5 strings), uncertainty, suggestions (array). The four displayed sections are: historical baseline, changed condition, possible consequences, uncertainty. The baseline alone is factual and requires sourceIds. Changed assumptions and consequences are simulations and must be phrased conditionally. Never give fabricated success rates, casualty percentages, troop counts or other invented quantitative predictions.`;
    const d=await jsonChat([{role:'system',content:prompt},...hist(req.body.history),{role:'user',content:scenario}],.45);
    d.sourceIds=filterSourceIds(p,d.sourceIds);
    d.baseline=clean(typeof d.baseline==='string'?d.baseline:(d.baseline?.text||''),3000);
    d.changedAssumption=clean(typeof d.changedAssumption==='string'?d.changedAssumption:(d.changedAssumption?.text||''),3000);
    d.uncertainty=clean(typeof d.uncertainty==='string'?d.uncertainty:(d.uncertainty?.text||''),3000);
    d.consequences=Array.isArray(d.consequences)?d.consequences.map(x=>clean(typeof x==='string'?x:(x?.text||x?.consequence||''),1200)).filter(Boolean).slice(0,5):[];
    d.suggestions=Array.isArray(d.suggestions)?d.suggestions.slice(0,4):[];
    res.json(d);
  }catch(e){res.status(500).json({message:lang==='en'?'Counterfactual analysis is unavailable.':'Phân tích giả định đang tạm gián đoạn.'})}
});

app.post('/roleplay',async(req,res)=>{
  const p=profile(req.body.characterId),lang=req.body.lang==='en'?'en':'vi';
  const maxTurns=Math.max(1,Number(p?.roleplay?.maxTurns||6));
  const turn=Math.min(maxTurns,Math.max(1,Number(req.body.turn||1)));
  if(!p)return res.status(400).json({message:'Character not configured'});
  try{
    const rp=p.roleplay||{};
    const en=lang==='en';
    const defaultEvaluation={military:3,diplomacy:2,publicSupport:4,logistics:2,politics:3,governance:2};
    const configuredEvaluation=rp.initialEvaluation&&typeof rp.initialEvaluation==='object'?rp.initialEvaluation:{};
    const baselineEvaluation=Object.fromEntries(Object.keys(defaultEvaluation).map(k=>[k,Number.isFinite(Number(configuredEvaluation[k]))?Math.max(1,Math.min(5,Math.round(Number(configuredEvaluation[k])))):defaultEvaluation[k]]));
    const prompt=`${curatedContext(p,lang)}\n${en?'Write entirely in English.':'Viết hoàn toàn bằng tiếng Việt.'}\n${roleIdentityPrompt(rp,lang)}\nHISTORICAL DECISION ROLE-PLAY.\nSETTING: ${en?rp.setting?.en:rp.setting?.vi}\nOPENING PROBLEM: ${en?rp.opening?.en:rp.opening?.vi}\nFACTORS: ${(en?rp.evaluationFactors?.en:rp.evaluationFactors?.vi||[]).join(', ')}\nBASELINE EVALUATION: ${JSON.stringify(baselineEvaluation)}\nRULES: ${en?rp.rules?.en:rp.rules?.vi}\nThis is turn ${turn}/${maxTurns}. Return JSON exactly with keys: npcDialogue, feedback, evaluation (object with military, diplomacy, publicSupport, logistics, politics, governance), sourceIds, choices, isGameOver, endReason. Every evaluation value must be an integer from 1 to 5 and is only a SIMULATION INDICATOR, never a historical fact. On turn 1 use the configured baseline evaluation exactly. On later turns, change scores only when justified by the learner's simulated choice and normally by at most 1 point per factor. Source IDs may support only real background stated in npcDialogue or feedback; never attach historical sources to the simulated scores themselves. Clearly label simulated consequences as simulation. Unless game over, choices must contain exactly 3 distinct actionable options. End no later than turn ${maxTurns}.`;
    const messages=[{role:'system',content:prompt},...hist(req.body.history)];
    let d=normalizeRoleResponse(await jsonChat(messages,.42));
    if(roleIdentityViolation(rp,lang,d)){
      const correction=en?'Your previous JSON swapped the learner and NPC roles. Regenerate it now with the ROLE LOCK obeyed. Return only the corrected JSON.':'JSON trước đã đảo vai người học và NPC. Hãy tạo lại, tuân thủ tuyệt đối KHÓA VAI và chỉ trả JSON đã sửa.';
      d=normalizeRoleResponse(await jsonChat([...messages,{role:'assistant',content:JSON.stringify(d)},{role:'user',content:correction}],.15));
    }
    if(roleIdentityViolation(rp,lang,d))d.npcDialogue=clean(rp.identityGuard?.fallbackNpcDialogue?.[lang]||(en?'Consider the three options below.':'Hãy cân nhắc ba phương án dưới đây.'),4000);
    d.sourceIds=filterSourceIds(p,d.sourceIds);
    const normalizeScore=v=>{const n=Number(v);return Number.isFinite(n)?Math.max(1,Math.min(5,Math.round(n))):3};
    if(turn===1){
      d.evaluation={...baselineEvaluation};
    }else{
      const raw=d.evaluation&&typeof d.evaluation==='object'?d.evaluation:{};
      const previousRaw=lastRoleEvaluation(req.body.history);
      d.evaluation=Object.fromEntries(Object.keys(baselineEvaluation).map(k=>{
        const previous=normalizeScore(previousRaw[k]??baselineEvaluation[k]);
        const proposed=normalizeScore(raw[k]??previous);
        return [k,Math.max(previous-1,Math.min(previous+1,proposed))];
      }));
    }
    d.isGameOver=booleanValue(d.isGameOver)||turn>=maxTurns;
    if(d.isGameOver)d.choices=[];
    else{
      const normalized=Array.isArray(d.choices)?d.choices.map(c=>typeof c==='string'?clean(c,500):clean(c?.text||c?.label||c?.choice||c?.action||c?.title||'',500)).filter(Boolean):[];
      d.choices=[...new Set(normalized)].slice(0,3);
      const fallback=en?['Coordinate the local leaders before acting.','Secure food, transport and communications.','Consult communities and reassess the risks.']:['Phối hợp các thủ lĩnh địa phương trước khi hành động.','Củng cố lương thực, vận chuyển và liên lạc.','Tham vấn cộng đồng rồi đánh giá lại rủi ro.'];
      for(const choice of fallback)if(d.choices.length<3&&!d.choices.includes(choice))d.choices.push(choice);
    }
    if(d.isGameOver&&!d.endReason)d.endReason=en?'The simulation has reached its final turn. Review how the choices affected each indicator.':'Mô phỏng đã đến lượt cuối. Hãy đối chiếu cách các lựa chọn tác động đến từng chỉ số.';
    res.json(d);
  }catch(e){res.status(500).json({message:lang==='en'?'Role-play is unavailable.':'Nhập vai đang tạm gián đoạn.'})}
});

app.post('/speak',async(req,res)=>{
  const text=clean(req.body.text,3500),lang=req.body.lang==='en'?'en':'vi';
  if(!text)return res.status(400).end();
  if(!openai)return res.status(503).end();
  try{
    const a=await openai.audio.speech.create({
      model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',
      voice:lang==='vi'?'cedar':'marin',
      input:text,
      instructions:lang==='vi'?'Đọc tiếng Việt rõ ràng, nhịp vừa, giọng thuyết minh lịch sử trang trọng nhưng gần gũi.':'Read clearly at a moderate pace in a calm museum-guide tone.',
      response_format:'mp3'
    });
    res.type('audio/mpeg').send(Buffer.from(await a.arrayBuffer()));
  }catch(e){res.status(500).end()}
});


app.use(express.static(PUBLIC,{index:'index.html',setHeaders(res,file){if(file.endsWith('.glb'))res.setHeader('Content-Type','model/gltf-binary')}}));
app.use((req,res)=>res.status(404).json({message:'Not found'}));

if(require.main===module){app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`))}
module.exports=app;
