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
    d.evidencePoints=Array.isArray(d.evidencePoints)?d.evidencePoints.slice(0,6):[];
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
    d.consequences=Array.isArray(d.consequences)?d.consequences.slice(0,5):[];
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
    const prompt=`${curatedContext(p,lang)}\n${en?'Write entirely in English.':'Viết hoàn toàn bằng tiếng Việt.'}\nHISTORICAL DECISION ROLE-PLAY. ${en?rp.learnerRole?.en:rp.learnerRole?.vi}\nSETTING: ${en?rp.setting?.en:rp.setting?.vi}\nOPENING PROBLEM: ${en?rp.opening?.en:rp.opening?.vi}\nFACTORS: ${(en?rp.evaluationFactors?.en:rp.evaluationFactors?.vi||[]).join(', ')}\nRULES: ${en?rp.rules?.en:rp.rules?.vi}\nThis is turn ${turn}/${maxTurns}. Return JSON exactly with keys: npcDialogue, feedback, evaluation (object with military, diplomacy, publicSupport, logistics, politics, governance), sourceIds, choices, isGameOver, endReason. Every evaluation value must be an integer from 1 to 5 and is only a SIMULATION INDICATOR, never a historical fact. On turn 1 use the configured baseline evaluation exactly. On later turns, change scores only when justified by the learner's simulated choice and normally by at most 1 point per factor. Source IDs may support only real background stated in npcDialogue or feedback; never attach historical sources to the simulated scores themselves. Clearly label simulated consequences as simulation. Unless game over, choices must contain exactly 3 distinct actionable options. End no later than turn ${maxTurns}.`;
    const d=await jsonChat([{role:'system',content:prompt},...hist(req.body.history)],.55);
    d.sourceIds=filterSourceIds(p,d.sourceIds);
    const defaultEvaluation={military:3,diplomacy:2,publicSupport:4,logistics:2,politics:3,governance:2};
    const configuredEvaluation=rp.initialEvaluation&&typeof rp.initialEvaluation==='object'?rp.initialEvaluation:{};
    const baselineEvaluation=Object.fromEntries(Object.keys(defaultEvaluation).map(k=>[k,Number.isFinite(Number(configuredEvaluation[k]))?Math.max(1,Math.min(5,Math.round(Number(configuredEvaluation[k])))):defaultEvaluation[k]]));
    const normalizeScore=v=>{const n=Number(v);return Number.isFinite(n)?Math.max(1,Math.min(5,Math.round(n))):3};
    if(turn===1){
      d.evaluation={...baselineEvaluation};
    }else{
      const raw=d.evaluation&&typeof d.evaluation==='object'?d.evaluation:{};
      d.evaluation=Object.fromEntries(Object.keys(baselineEvaluation).map(k=>[k,normalizeScore(raw[k]) ]));
    }
    if(turn>=maxTurns)d.isGameOver=true;
    if(d.isGameOver)d.choices=[];
    else{
      d.choices = Array.isArray(d.choices)
        ? d.choices
            .map(c => {
              if (typeof c === 'string') return c.trim();
              if (c && typeof c === 'object') {
                return clean(c.text || c.label || c.choice || c.action || c.title || '', 500);
              }
              return '';
            })
            .filter(Boolean)
            .slice(0, 3)
        : [];
      while(d.choices.length<3)d.choices.push(en?`Reassess the situation before action ${d.choices.length+1}`:`Đánh giá lại tình hình trước phương án ${d.choices.length+1}`);
    }
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
