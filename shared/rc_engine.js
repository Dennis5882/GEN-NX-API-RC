/* ════════════════════════════════════════════════════════════
   RC ENGINE — 공용 도메인 코어 (UI 비의존)
   MIDAS Gen NX · 대만(Taiwan) RC · 표준층 기반 모델링

   이 파일은 폼형 Wizard 와 대화형 Agent 가 공유하는 단일 진실원천이다.
   순수(pure) 로직만 둔다: DOM·MAPI 전송·상태(S)·i18n(t/L3) 의존 없음.
   - 건물 카탈로그 / 재료 / 용도별 하중 프리셋 (대만 규격)
   - 골조 지오메트리 생성 (buildFrame)
   - 표준층 전개 (deriveFloorGroups / specToGroupRows)
   - 대만 하중조합 (taiwanCombos, TWD-USD112)
   - 자연어 건물유형 인식 (detectBuildingType)

   실제 전송(putMaterial/applyFloorLoads/putCombos…)·렌더·i18n 은 각 프런트엔드가 담당.
   classic script 로 로드 → 전역 const/function + window.RCEngine 네임스페이스 노출.
════════════════════════════════════════════════════════════ */

/* ── 재료: 콘크리트 CNS560(RC) 등급 매핑 (대만은 kgf/cm² 표기) ── */
const _MPA2CNS={'C24':'C245','C28':'C280','C30':'C315','C35':'C350','C40':'C420'};
const _CNS_CONC=['C210','C245','C280','C315','C350','C420'];

/* 材料庫（編輯卡選單用）— 切換材料時自動帶入 E/poisn/den */
const MATERIALS = {
  'C210':{E:21660,poisn:0.18,den:2.4e-9}, 'C245':{E:23380,poisn:0.18,den:2.4e-9},
  'C280':{E:24990,poisn:0.18,den:2.4e-9}, 'C315':{E:26500,poisn:0.18,den:2.4e-9},
  'C350':{E:27940,poisn:0.18,den:2.4e-9}, 'C420':{E:30600,poisn:0.18,den:2.4e-9}
};

/* ── 用途別 바닥하중 프리셋 (kN/m²) — 대만 건축기술규칙 기준 ── */
const FLOOR_USE={
  Residential:{sdl:1.5,live:'LL',liveVal:2.0},   // 住宅 200 kgf/m²
  Office:{sdl:1.5,live:'LL',liveVal:3.0},         // 辦公 300
  Commercial:{sdl:2.0,live:'LL',liveVal:5.0},     // 商場/賣場 ~500
  School:{sdl:1.5,live:'LL',liveVal:2.5},         // 學校教室 250 (복도는 별도 그룹으로 상향)
  Hospital:{sdl:1.5,live:'LL',liveVal:2.0},       // 醫院病房 200 (설비층은 Equipment로 분리)
  Equipment:{sdl:2.5,live:'LL',liveVal:7.5},      // 設備層/機房 ~750
  Roof:{sdl:2.5,live:'LR',liveVal:1.0}            // 屋頂 100
};
const TYPE_USE={apartment:'Residential',office:'Office',commercial:'Commercial',hospital:'Hospital',school:'School'};
function useOf(p){ return TYPE_USE[p.bldgType]||'Residential'; }

/* 표준층 전개: spec → 자연층별 {role,use,dia} 맵 */
function deriveFloorGroups(p){
  const g={};
  if(p.groups&&p.groups.length){ p.groups.forEach(gr=>{for(let s=gr.from;s<=gr.to;s++) g[s]={role:gr.role||'TYPICAL',use:gr.use||useOf(p),dia:(gr.dia!==false)};}); return g; }
  const u=useOf(p);
  for(let iz=1;iz<=p.stories;iz++) g[iz]={role:'TYPICAL',use:u};
  if(p.podium) for(let iz=1;iz<=Math.min(p.podium,p.stories);iz++) g[iz]={role:'PODIUM',use:p.podiumUse||'Commercial'};
  if(p.stories>=2) g[p.stories]={role:'ROOF',use:'Roof'};
  return g;
}
/* 표준층 표 행: 연속 동일 그룹을 from~to 범위로 압축 */
function specToGroupRows(p){
  const g=deriveFloorGroups(p);
  const rows=[]; const keys=Object.keys(g).map(Number).sort((a,b)=>a-b);
  for(const s of keys){
    const cur=g[s]; const h=((s===1?p.h1:p.hTyp)||p.hTyp||3000);
    const dia=(cur.dia!==false);
    const last=rows[rows.length-1];
    if(last && last.role===cur.role && last.use===cur.use && last.dia===dia && last.h===h && last.to===s-1){ last.to=s; }
    else rows.push({role:cur.role,from:s,to:s,h,use:cur.use,dia});
  }
  return rows;
}

/* 표준층 표 옵션 */
const FG_ROLES=['TYPICAL','PODIUM','TRANSFER','ROOF','BASEMENT'];
const FG_USES=['Residential','Office','Commercial','School','Hospital','Equipment','Roof'];

/* ════════════════════════════════════════════════════════════
   FRAME GENERATOR
════════════════════════════════════════════════════════════ */
/* 스팬을 per-bay 배열로 정규화 (숫자 → 균일, 배열 → 가변) + 누적 좌표 */
function asSpans(span, bays){ return Array.isArray(span)?span.map(Number):Array.from({length:Math.max(1,bays||1)},()=>+span); }
function cumPos(arr){ const o=[0]; arr.forEach(d=>o.push(o[o.length-1]+(+d||0))); return o; }

function buildFrame(p){
  const nodes=[],cols=[],beams=[],links=[],map={}; let nid=0;
  const colMeta=[],beamMeta=[],linkMeta=[];
  const elev=[0];
  if(p.groups&&p.groups.length){ const hByS={}; p.groups.forEach(g=>{for(let s=g.from;s<=g.to;s++) hByS[s]=g.h;});
    for(let s=1;s<=p.stories;s++) elev.push(elev[s-1]+(hByS[s]||p.hTyp||3000)); }
  else { for(let s=1;s<=p.stories;s++) elev.push(elev[s-1]+(s===1?p.h1:p.hTyp)); }
  const sx=asSpans(p.spanX,p.bayX), sy=asSpans(p.spanY,p.bayY);
  const nbx=sx.length, nby=sy.length;          // 실제 X/Y 跨 수
  const Xp=cumPos(sx), Yp=cumPos(sy);           // 누적 좌표 (길이 = 跨수+1)
  const npx=nbx+1, npy=nby+1, bW=Xp[nbx];
  const floorGroups={};
  for(let b=0;b<p.buildings;b++){ const ox=b*(bW+p.gap);
    for(let iz=0;iz<=p.stories;iz++) for(let iy=0;iy<npy;iy++) for(let ix=0;ix<npx;ix++){
      nid++; nodes.push({id:nid,x:ox+Xp[ix],y:Yp[iy],z:elev[iz]});
      map[`${b},${ix},${iy},${iz}`]=nid;
      if(iz>=1){ (floorGroups[b+'_'+iz]=floorGroups[b+'_'+iz]||[]).push(nid); } } }
  const N=(b,ix,iy,iz)=>map[`${b},${ix},${iy},${iz}`];
  for(let b=0;b<p.buildings;b++) for(let iz=0;iz<p.stories;iz++)
    for(let iy=0;iy<npy;iy++) for(let ix=0;ix<npx;ix++){
      const n1=N(b,ix,iy,iz),n2=N(b,ix,iy,iz+1); cols.push([n1,n2]);
      colMeta.push({n1,n2,b,iz:iz+1}); }
  for(let b=0;b<p.buildings;b++) for(let iz=1;iz<=p.stories;iz++){
    for(let iy=0;iy<npy;iy++) for(let ix=0;ix<nbx;ix++){
      const n1=N(b,ix,iy,iz),n2=N(b,ix+1,iy,iz); beams.push([n1,n2]); beamMeta.push({n1,n2,b,iz}); }
    for(let ix=0;ix<npx;ix++) for(let iy=0;iy<nby;iy++){
      const n1=N(b,ix,iy,iz),n2=N(b,ix,iy+1,iz); beams.push([n1,n2]); beamMeta.push({n1,n2,b,iz}); } }
  if(p.buildings>=2 && p.connectFloor>=1 && p.connectFloor<=p.stories){ const iz=p.connectFloor;
    for(let iy=0;iy<npy;iy++){ const n1=N(0,nbx,iy,iz),n2=N(1,0,iy,iz);
      links.push([n1,n2]); linkMeta.push({n1,n2,iz}); } }
  const baseNodes=nodes.filter(n=>n.z===0).map(n=>n.id);
  const floorCorners={};
  for(let b=0;b<p.buildings;b++) for(let iz=1;iz<=p.stories;iz++)
    floorCorners[b+'_'+iz]=[N(b,0,0,iz),N(b,nbx,0,iz),N(b,nbx,nby,iz),N(b,0,nby,iz)];
  return {nodes,cols,beams,links,colMeta,beamMeta,linkMeta,baseNodes,elev,floorGroups,floorCorners};
}

/* ════════════════════════════════════════════════════════════
   TAIWAN LOAD COMBINATIONS (TWD-USD112, ACI-style USD)
════════════════════════════════════════════════════════════ */
function taiwanCombos(loadCases){
  const by={}; (loadCases||[]).forEach(l=>{(by[l.type]=by[l.type]||[]).push(l.name);});
  const D=(by.D||[]).concat(by.DC||[],by.DW||[]); const L=by.L||[];
  const roof=(by.LR||by.S||by.R||[]); const W=by.W||[]; const E=by.E||[];
  const T=(...pp)=>{const o=[];pp.forEach(([ns,f])=>ns.forEach(n=>o.push([n,f])));return o;};
  if(!D.length) return [];
  const defs=[
    ['cLCB1','1.4D',true,T([D,1.4])],
    ['cLCB2','1.2D+1.6L+0.5Lr',true,T([D,1.2],[L,1.6],[roof,0.5])],
    ['cLCB3','1.2D+1.6Lr+1.0L',roof.length>0,T([D,1.2],[roof,1.6],[L,1.0])],
    ['cLCB4','1.2D+1.0W+1.0L+0.5Lr',W.length>0,T([D,1.2],[W,1.0],[L,1.0],[roof,0.5])],
    ['cLCB5','1.2D+1.0E+1.0L',E.length>0,T([D,1.2],[E,1.0],[L,1.0])],
    ['cLCB6','0.9D+1.0W',W.length>0,T([D,0.9],[W,1.0])],
    ['cLCB7','0.9D+1.0E',E.length>0,T([D,0.9],[E,1.0])],
  ];
  return defs.filter(d=>d[2]&&d[3].length).map(d=>({name:d[0],desc:d[1],terms:d[3]}));
}

/* ════════════════════════════════════════════════════════════
   BUILDING TYPE TEMPLATES (대만 RC 5종, 표준층 구조)
════════════════════════════════════════════════════════════ */
const DEFAULT_SPEC={
  buildings:2, bayX:4, bayY:2, spanX:7000, spanY:8000, stories:10, h1:3600, hTyp:2900,
  gap:12000, connectFloor:8,
  matName:'C280', E:7100, poisn:0.18, den:2.4e-9,
  colName:'C600x600', colH:600, colB:600,
  beamName:'B400x600', beamH:600, beamB:400
};

const BUILDING_TYPES = {
  apartment:{
    icon:'🏠',
    label:{ko:'주거',en:'Residential',zh:'住宅'},
    desc:{ko:'주거용 RC 라멘조 · 소형 스팬',en:'Residential RC frame · short spans',zh:'住宅用 RC 構架 · 小跨距'},
    tip:{ko:'층수·동수를 바꿔 말할 수 있어요. 예) <code>25층 2동 주거</code>',en:'You can change stories and buildings. e.g. <code>build a 25 story 2 building residential</code>',zh:'可變更樓層數與棟數。例）<code>建立 25 層 2 棟住宅</code>'},
    buildings:1, bayX:4, bayY:3, spanX:6500, spanY:7000,
    stories:15, h1:2900, hTyp:2800, gap:14000, connectFloor:0,
    podium:1, podiumUse:'Commercial',
    matName:'C280', E:8700, poisn:0.18, den:2.4e-9,
    colName:'C500x500', colH:500, colB:500, beamName:'B300x500', beamH:500, beamB:300
  },
  office:{
    icon:'🏢',
    label:{ko:'사무',en:'Office',zh:'辦公'},
    desc:{ko:'업무용 RC · 오픈플랜 대형 스팬',en:'Office RC · open-plan long spans',zh:'辦公用 RC · 開放式大跨距'},
    tip:{ko:'층수·스팬을 조정할 수 있어요. 예) <code>20층 사무 스팬 10000</code>',en:'Adjust stories and span. e.g. <code>build a 20 story office span 10000</code>',zh:'可調整樓層數與跨距。例）<code>建立 20 層辦公 跨距 10000</code>'},
    buildings:1, bayX:4, bayY:3, spanX:9000, spanY:9000,
    stories:10, h1:4500, hTyp:4000, gap:0, connectFloor:0,
    podium:1, podiumUse:'Commercial',
    matName:'C350', E:8700, poisn:0.18, den:2.4e-9,
    colName:'C600x600', colH:600, colB:600, beamName:'B350x700', beamH:700, beamB:350
  },
  commercial:{
    icon:'🏬',
    label:{ko:'상가',en:'Commercial',zh:'商場'},
    desc:{ko:'상업시설 RC · 대형 스팬 · 중활하중',en:'Commercial RC · large spans · heavy live load',zh:'商業設施 RC · 大跨距 · 重活載重'},
    tip:{ko:'층수·스팬을 조정하세요. 예) <code>상가 6층</code>',en:'Adjust stories and spans. e.g. <code>build a 6 story mall</code>',zh:'可調整樓層與跨距。例）<code>建立 6 層商場</code>'},
    buildings:1, bayX:5, bayY:4, spanX:9000, spanY:9000,
    stories:6, h1:5000, hTyp:4500, gap:0, connectFloor:0,
    podium:1, podiumUse:'Commercial',
    matName:'C350', E:8700, poisn:0.18, den:2.4e-9,
    colName:'C700x700', colH:700, colB:700, beamName:'B400x750', beamH:750, beamB:400
  },
  hospital:{
    icon:'🏥',
    label:{ko:'병원',en:'Hospital',zh:'醫院'},
    desc:{ko:'의료시설 RC · 중하중 설비층 대형 스팬',en:'Hospital RC · heavy MEP floors, large spans',zh:'醫療設施 RC · 重載設備層大跨距'},
    tip:{ko:'층수를 바꿀 수 있어요. 예) <code>병원 12층</code>',en:'Change the number of stories. e.g. <code>build a 12 story hospital</code>',zh:'可變更樓層數。例）<code>建立 12 層醫院</code>'},
    buildings:1, bayX:4, bayY:4, spanX:8500, spanY:8500,
    stories:8, h1:4500, hTyp:4200, gap:0, connectFloor:0,
    podium:1, podiumUse:'Commercial',
    matName:'C350', E:9600, poisn:0.18, den:2.4e-9,
    colName:'C700x700', colH:700, colB:700, beamName:'B400x700', beamH:700, beamB:400
  },
  school:{
    icon:'🏫',
    label:{ko:'학교',en:'School',zh:'學校'},
    desc:{ko:'교육시설 RC · 복도형 장방형 평면',en:'School RC · corridor-type rectangular plan',zh:'教育設施 RC · 走廊型長方形平面'},
    tip:{ko:'층수를 바꿀 수 있어요. 예) <code>학교 4층</code>',en:'Change the number of stories. e.g. <code>build a 4 story school</code>',zh:'可變更樓層數。例）<code>建立 4 層學校</code>'},
    buildings:1, bayX:6, bayY:2, spanX:7200, spanY:8400,
    stories:5, h1:3800, hTyp:3600, gap:0, connectFloor:0,
    podium:1, podiumUse:'Office',
    matName:'C280', E:7100, poisn:0.18, den:2.4e-9,
    colName:'C550x550', colH:550, colB:550, beamName:'B350x550', beamH:550, beamB:350
  }
};

/* ── 자연어 건물유형 인식 ── */
const TYPE_KEYWORDS = {
  apartment:  /공동주택|아파트|주거|公寓|住宅|集合住宅|apartment|apt|residential/,
  office:     /사무실|사무|오피스|업무|辦公室|辦公|商辦|office/,
  commercial: /상가|상업|쇼핑|백화점|商場|商场|購物|百貨|賣場|商業|mall|commercial|retail/,
  hospital:   /병원|의료|醫院|醫療|hospital/,
  school:     /학교|교육|學校|校舍|教學|教育|school/
};
function detectBuildingType(t){
  for(const [key,re] of Object.entries(TYPE_KEYWORDS)) if(re.test(t)) return key;
  return null;
}

/* ── 네임스페이스 노출 (M2 확장·다른 프런트엔드용) ── */
if(typeof window!=='undefined'){
  window.RCEngine={
    MATERIALS, FLOOR_USE, TYPE_USE, useOf, deriveFloorGroups, specToGroupRows,
    FG_ROLES, FG_USES, asSpans, cumPos, buildFrame, taiwanCombos,
    DEFAULT_SPEC, BUILDING_TYPES, TYPE_KEYWORDS, detectBuildingType,
    _MPA2CNS, _CNS_CONC
  };
}
