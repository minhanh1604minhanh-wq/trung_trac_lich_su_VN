'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const fail=[];
const ok=[];
function check(name,condition,detail=''){
  if(condition)ok.push(name);
  else fail.push(`${name}${detail?`: ${detail}`:''}`);
}
function idsFromHtml(html){return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);}
function refsFromJs(js){
  const refs=new Set();
  for(const m of js.matchAll(/\$\(['"]([^'"]+)['"]\)/g))refs.add(m[1]);
  for(const m of js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g))refs.add(m[1]);
  return [...refs];
}
const dataPath='public/data/trung-trac.json';
let profile;
try{profile=JSON.parse(read(dataPath));check('JSON hợp lệ',true)}catch(e){check('JSON hợp lệ',false,e.message);profile={}}
const sourceIds=new Set((profile.sources||[]).map(s=>s.id));
check('Slug nhân vật',profile.id==='trung-trac');
check('Tên VI/EN',Boolean(profile.name&&profile.nameEn));
check('Ít nhất 6 mục hồ sơ',(profile.profileSections||[]).length>=6);
check('Timeline ít nhất 6 mốc',(profile.timeline||[]).length>=6);
check('Facts nền hiện diện',(profile.facts||[]).length>=10);
check('Nhập vai tối đa 6 lượt',Number(profile.roleplay?.maxTurns)===6);
check('Nhập vai đúng nhân vật',profile.roleplay?.learnerRole?.vi?.includes('Trưng Trắc'));
const historicalCollections=[...(profile.profileSections||[]),...(profile.timeline||[]),...(profile.facts||[])];
check('Mọi mục lịch sử có sourceIds',historicalCollections.every(x=>Array.isArray(x.sourceIds)&&x.sourceIds.length>0));
check('Mọi sourceId đều tồn tại',historicalCollections.every(x=>x.sourceIds.every(id=>sourceIds.has(id))));
check('Metadata lịch sử có sourceIds',['name','period','years','reign','dynasty','capital'].every(k=>profile.metadataEvidence?.[k]?.sourceIds?.length));
check('Intro và màn bụi có nguồn',profile.intro?.sourceIds?.length&&profile.dustSecret?.sourceIds?.length);
check('Hồ sơ song ngữ',(profile.profileSections||[]).every(x=>x.title&&x.titleEn&&x.body&&x.bodyEn));
check('Timeline song ngữ',(profile.timeline||[]).every(x=>x.vi&&x.en));
check('Facts song ngữ',(profile.facts||[]).every(x=>x.vi&&x.en));
check('Gợi ý VI/EN',profile.qaSuggestions?.vi?.length&&profile.qaSuggestions?.en?.length&&profile.whatifSuggestions?.vi?.length&&profile.whatifSuggestions?.en?.length);
const allowedHosts=new Set(['nguoikesu.com','www.nguoikesu.com','nghiencuulichsu.com','www.nghiencuulichsu.com','nlv.gov.vn','www.nlv.gov.vn']);
check('URL nguồn chỉ thuộc whitelist',(profile.sources||[]).every(s=>{try{return allowedHosts.has(new URL(s.url).hostname)}catch{return false}}));
const assetPaths=[profile.model,profile.narration?.vi,profile.narration?.en].filter(Boolean).map(p=>'public/'+p.replace(/^\.\//,''));
for(const p of assetPaths)check(`Asset tồn tại: ${p}`,exists(p));
if(exists(assetPaths[0])){
  const b=fs.readFileSync(path.join(root,assetPaths[0]));
  const declared=b.length>=12?b.readUInt32LE(8):0;
  check('GLB magic glTF',b.length>=12&&b.subarray(0,4).toString('ascii')==='glTF');
  check('GLB version 2',b.length>=12&&b.readUInt32LE(4)===2);
  check('GLB length hợp lệ',declared===b.length,`${declared} != ${b.length}`);
}
for(const p of assetPaths.slice(1))if(exists(p)){
  const b=fs.readFileSync(path.join(root,p));
  const mp3=b.length>3&&(b.subarray(0,3).toString('ascii')==='ID3'||(b[0]===0xff&&(b[1]&0xe0)===0xe0));
  check(`MP3 hợp lệ: ${p}`,mp3);
}
const html=read('public/index.html');
const js=read('public/app.js');
const server=read('server.js');
const config=read('public/config.js');
const css=read('public/styles.css');
const htmlIds=idsFromHtml(html);
const idSet=new Set(htmlIds);
const duplicates=htmlIds.filter((id,i)=>htmlIds.indexOf(id)!==i);
const missing=refsFromJs(js).filter(id=>!idSet.has(id));
check('HTML không trùng ID',duplicates.length===0,[...new Set(duplicates)].join(', '));
check('Mọi ID JS đều có trong HTML',missing.length===0,missing.join(', '));
check('DEFAULT_CHARACTER_ID đúng',/DEFAULT_CHARACTER_ID\s*:\s*["']trung-trac["']/.test(config));
check('API_BASE_URL cùng domain',/API_BASE_URL\s*:\s*["']["']/.test(config));
for(const ep of ['/health','/ask','/whatif','/roleplay','/speak','/save-report'])check(`Endpoint ${ep}`,server.includes(`'${ep}'`)||server.includes(`"${ep}"`));
check('OpenAI key chỉ ở backend',server.includes('process.env.OPENAI_API_KEY')&&!js.includes('OPENAI_API_KEY'));
check('Câu mới hủy request cũ',/function beginAIRequest\(\)\{[\s\S]*?stopAIResponseAudio\(\);[\s\S]*?abortCurrentAIRequest\(\)/.test(js));
check('Câu mới xóa kết quả cũ',/sendQa\(\)[\s\S]*?qaResult['"]\)\.textContent=['"]['"]/.test(js)&&/sendWhatif\(\)[\s\S]*?whatifResult['"]\)\.textContent=['"]['"]/.test(js));
check('Tra cứu chỉ đọc reply',/function buildQaSpeech\(data=\{\}\)\{\s*return String\(data\.reply\|\|['"]['"]\)\.trim\(\);\s*\}/.test(js));
check('Tốc độ audio AI 1.08',/AI_SPEECH_RATE=1\.08/.test(js));
check('Không fallback giọng Anh cho VI',/Tiếng Việt chỉ dùng giọng Việt/.test(js)&&/startsWith\(['"]vi['"]\)/.test(js));
for(const label of ['Mốc có thật','Điều kiện thay đổi','Hệ quả có thể','Điểm bất định'])check(`Giả định đọc nhãn: ${label}`,js.includes(label));
check('Responsive mobile còn nguyên',/@media\s*\(max-width:\s*(?:640|420|390)px\)/.test(css));
check('PDF filename theo slug',js.includes('Tong_ket_${profile.id}.pdf')&&js.includes('Nhap_vai_${profile.id}.pdf'));
const sourceFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name==='.git')continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else sourceFiles.push(p)}}
walk(root);
const banned=[['Lê','Hoàn'].join(' '),['le','hoan'].join('-'),['Le','Hoan.glb'].join('_'),['le','hoan'].join('_')];
const hits=[];
for(const file of sourceFiles){if(file.endsWith('.glb')||file.endsWith('.mp3')||file.endsWith('.zip'))continue;let s='';try{s=fs.readFileSync(file,'utf8')}catch{continue}for(const term of banned)if(s.includes(term))hits.push(`${path.relative(root,file)} => ${term}`)}
check('Không còn dấu vết nhân vật mẫu',hits.length===0,hits.join('; '));
const env=read('.env.example');
check('.env.example không chứa khóa thật',!/(sk-[A-Za-z0-9_-]{20,}|^OPENAI_API_KEY[ \t]*=[ \t]*\S+)/m.test(env));
if(fail.length){console.error(`FAILED (${fail.length})`);for(const x of fail)console.error('✗',x);process.exit(1)}
console.log(`PASS (${ok.length})`);for(const x of ok)console.log('✓',x);
