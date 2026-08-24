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
check('NPC nhập vai đúng cố vấn',profile.roleplay?.npcRole?.vi?.includes('cố vấn'));
check('Khóa xưng hô Trưng Trắc',profile.roleplay?.addressRule?.vi?.includes('Không bao giờ tự nhận mình là Trưng Trắc'));
check('Có cụm nhận diện đảo vai',profile.roleplay?.identityGuard?.forbiddenNpcPhrases?.vi?.includes('Tôi là Trưng Trắc'));
check('Có thoại dự phòng đúng vai',profile.roleplay?.identityGuard?.fallbackNpcDialogue?.vi?.startsWith('Trưng Trắc'));
check('Baseline chỉ số mô phỏng đúng',JSON.stringify(profile.roleplay?.initialEvaluation)===JSON.stringify({military:3,diplomacy:2,publicSupport:4,logistics:2,politics:3,governance:2}));
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
check('Thư viện PDF được đóng gói cục bộ',exists('public/vendor/html2pdf.bundle.min.js')&&fs.statSync(path.join(root,'public/vendor/html2pdf.bundle.min.js')).size>800000&&html.includes('./vendor/html2pdf.bundle.min.js')&&!html.includes('cdnjs.cloudflare.com/ajax/libs/html2pdf'));
let responseUtils={};
try{responseUtils=require(path.join(root,'public/app.js'));check('Nạp được tiện ích frontend',true)}catch(e){check('Nạp được tiện ích frontend',false,e.message)}
const sampleHistory=[
  {role:'assistant',content:JSON.stringify({npcDialogue:'Trưng Trắc, xin cân nhắc kỹ.',feedback:'Lựa chọn cần cân bằng.',evaluation:{military:3,diplomacy:2,publicSupport:4,logistics:2,politics:3,governance:2},sourceIds:['S1'],choices:['A','B','C'],isGameOver:false,endReason:''})},
  {role:'user',content:'Củng cố hậu cần.'},
  {role:'assistant',content:JSON.stringify({npcDialogue:'Phương án đã được ghi nhận.',feedback:'Hậu cần được cải thiện.',evaluation:{military:3,diplomacy:2,publicSupport:4,logistics:3,politics:3,governance:2},sourceIds:['S1'],choices:[],isGameOver:true,endReason:'Hoàn tất mô phỏng.'})}
];
const sampleMarkup=typeof responseUtils.buildRoleplayWorksheetMarkup==='function'?responseUtils.buildRoleplayWorksheetMarkup({profile,participant:{name:'Nguyễn Văn A',className:'10A1',school:'Trường mẫu'},history:sampleHistory,lang:'vi'}):'';
check('Phiếu PDF chứa đủ lịch sử lượt',sampleMarkup.includes('Lượt 1')&&sampleMarkup.includes('Lượt 2')&&sampleMarkup.includes('Củng cố hậu cần.'));
check('Phiếu PDF chứa người học và không có dữ liệu kỹ thuật',sampleMarkup.includes('Nguyễn Văn A')&&!sampleMarkup.includes('[object Object]')&&!/session[_ -]?id/i.test(sampleMarkup));
const htmlIds=idsFromHtml(html);
const idSet=new Set(htmlIds);
const duplicates=htmlIds.filter((id,i)=>htmlIds.indexOf(id)!==i);
const missing=refsFromJs(js).filter(id=>!idSet.has(id));
check('HTML không trùng ID',duplicates.length===0,[...new Set(duplicates)].join(', '));
check('Mọi ID JS đều có trong HTML',missing.length===0,missing.join(', '));
check('DEFAULT_CHARACTER_ID đúng',/DEFAULT_CHARACTER_ID\s*:\s*["']trung-trac["']/.test(config));
check('Slug query frontend được giới hạn',js.includes("/^[a-z0-9-]+$/i.test(requested)"));
check('Frontend kiểm tra HTTP và dữ liệu hồ sơ',js.includes('if(!response.ok)')&&js.includes("if(!profile?.id||!profile?.model"));
check('API_BASE_URL cùng domain',/API_BASE_URL\s*:\s*["']["']/.test(config));
for(const ep of ['/health','/ask','/whatif','/roleplay','/speak','/analytics-event'])check(`Endpoint ${ep}`,server.includes(`'${ep}'`)||server.includes(`"${ep}"`));
check('Không còn endpoint lưu báo cáo ngoài',!server.includes(['/save','report'].join('-')));
check('Tên người tham gia bắt buộc',html.includes('id="playerName"')&&html.includes('required aria-required="true"')&&js.includes("nameRequired:'Vui lòng nhập tên người tham gia trước khi bắt đầu.'")&&js.includes("if(!name){$('participantError').textContent=t('nameRequired')"));
check('Lớp và trường tùy chọn',html.includes('id="playerClass"')&&html.includes('id="playerSchool"')&&js.includes("state.className=$('playerClass').value.trim()")&&js.includes("state.school=$('playerSchool').value.trim()"));
check('Thông tin người tham gia sẵn sàng cho analytics',js.includes('function participantSnapshot()')&&js.includes('name:state.name')&&js.includes('className:state.className')&&js.includes('school:state.school'));
check('Không lưu dai dẳng thông tin cá nhân trên kiosk',!js.includes('localStorage.setItem(\'history_name\'')&&!js.includes('localStorage.setItem(\'history_class\'')&&!js.includes('localStorage.setItem(\'history_school\''));
check('Không còn vòng tròn trang trí tool-card',!css.includes('.tool-card::after'));
check('Không còn Google Sheets runtime',!server.match(/GOOGLE_SHEET_URL|google-apps-script|script\.google\.com|spreadsheets/i)&&!js.match(/GOOGLE_SHEET_URL|google-apps-script|script\.google\.com|spreadsheets/i)&&!config.match(/GOOGLE_SHEET_URL|google-apps-script|script\.google\.com|spreadsheets/i));

check('Analytics key chỉ ở backend',server.includes('process.env.ANALYTICS_INGEST_KEY')&&!js.includes('ANALYTICS_INGEST_KEY'));
check('Analytics URL chỉ ở backend/env',server.includes('process.env.ANALYTICS_API_URL')&&!js.includes('ANALYTICS_API_URL'));
check('Frontend gửi analytics qua backend cùng domain',js.includes("fetch(API+'/analytics-event'"));
check('Analytics có participant bắt buộc',js.includes('participant:{name:state.name,className:state.className,schoolName:state.school}'));
check('Analytics ghi Tra cứu/Giả định/Nhập vai',js.includes("'ask_question'")&&js.includes("'whatif_question'")&&js.includes("'roleplay_choice'"));
check('Analytics đủ event bắt buộc',['session_start','session_end','character_open','profile_open','timeline_view','narration_play','narration_pause','ask_question','whatif_question','roleplay_start','roleplay_new_scenario','roleplay_choice','roleplay_end','language_change','pdf_export'].every(x=>js.includes(`'${x}'`)));
check('Không hiển thị nhãn kỹ thuật lịch sử',!js.includes("esc(x.evidenceType)")&&!js.includes("esc(d.answerType)"));
check('Bảo vệ chuỗi AI ở backend',server.includes("typeof d.npcDialogue==='string'")&&server.includes("typeof c==='string'")&&server.includes("c?.text||c?.label||c?.choice"));
check('Backend khóa và tự sửa lỗi đảo vai',server.includes('roleIdentityPrompt')&&server.includes('roleIdentityViolation')&&server.includes('JSON trước đã đảo vai'));
check('Backend có chốt thoại an toàn sau retry',server.includes('fallbackNpcDialogue'));
check('Chỉ số mỗi lượt chỉ đổi tối đa một mức',server.includes('Math.max(previous-1,Math.min(previous+1,proposed))'));
check('Lựa chọn nhập vai được loại trùng',server.includes('d.choices=[...new Set(normalized)].slice(0,3)'));

check('Nút nhập vai có trạng thái tình huống mới',js.includes("roleRestart:'Bắt đầu tình huống mới'")&&js.includes('state.roleActive?t(\'roleRestart\'):t(\'roleStart\')'));
check('Tình huống mới reset lịch sử và lượt',/function startNewRoleScenario\(\)\{[\s\S]*?state\.roleHistory=\[\];[\s\S]*?state\.roleTurn=1;[\s\S]*?roleTurn\(\)/.test(js));
check('Chỉ số mô phỏng dùng nhãn định tính',js.includes("2:'Trung bình'")&&js.includes("3:'Khá'")&&js.includes("4:'Tốt'")&&js.includes("roleMetrics:'Chỉ số mô phỏng'"));
check('Nút đóng không còn vòng tròn',/\.panel-close\{[^}]*border:0;[^}]*background:transparent;[^}]*border-radius:0/.test(css));
check('OpenAI key chỉ ở backend',server.includes('process.env.OPENAI_API_KEY')&&!js.includes('OPENAI_API_KEY'));
check('Câu mới hủy request cũ',/function beginAIRequest\(\)\{[\s\S]*?stopAIResponseAudio\(\);[\s\S]*?abortCurrentAIRequest\(\)/.test(js));
check('Câu mới xóa kết quả cũ',/sendQa\(\)[\s\S]*?qaResult['"]\)\.textContent=['"]['"]/.test(js)&&/sendWhatif\(\)[\s\S]*?whatifResult['"]\)\.textContent=['"]['"]/.test(js));
check('Tra cứu chỉ đọc reply',/function buildQaSpeech\(data=\{\}\)\{\s*return String\(data\.reply\|\|['"]['"]\)\.trim\(\);\s*\}/.test(js));
check('Tốc độ audio AI 1.12',/AI_SPEECH_RATE=1\.12/.test(js));
check('Không fallback giọng Anh cho VI',/Tiếng Việt chỉ dùng giọng Việt/.test(js)&&/startsWith\(['"]vi['"]\)/.test(js));
for(const label of ['Mốc có thật','Điều kiện thay đổi','Hệ quả có thể','Điểm bất định'])check(`Giả định đọc nhãn: ${label}`,js.includes(label));
check('Responsive mobile còn nguyên',/@media\s*\(max-width:\s*(?:640|420|390)px\)/.test(css));
check('PDF filename theo slug',js.includes('Tong_ket_${profile.id}.pdf')&&js.includes('Nhap_vai_${profile.id}.pdf'));
check('PDF dùng phiếu độc lập, không chụp panel ngoài màn hình',js.includes('buildRoleplayWorksheetMarkup')&&js.includes('createRoleplayExportSheet')&&js.includes('savePdfSheet')&&!js.includes("left='-10000px'")&&!js.includes("left='-100000px'"));
check('CSS PDF có chống ngắt khối và nền trắng',css.includes('.pdf-export-sheet')&&css.includes('page-break-inside:avoid')&&css.includes('background:#fff'));
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
