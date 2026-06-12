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
  /* ── 전단벽/코어 패널 (PLATE) — 그리드 정렬, 기존 절점 재사용, 베이·층 단위 메시 ──
     spec.walls 항목:
       {kind:'wall', dir:'X'|'Y', ix, iy, bays, from, to, thick}  // 한 줄 벽
       {kind:'core', ix0, iy0, ix1, iy1, from, to, thick}          // 사각 코어(4면)
     ix/iy = 0-based 그리드 교점 인덱스, from/to = 1-based story(미지정 시 전층), thick = mm */
  const walls=[]; const wallThks=new Set();
  (p.walls||[]).forEach((w,wi)=>{
    const from=Math.max(1,w.from||1), to=Math.min(p.stories,w.to||p.stories);
    const b=Math.min(w.building||0,p.buildings-1), thick=+w.thick||250;
    const edges=[];
    const addRun=(dir,ix,iy,bays)=>{ for(let k=0;k<Math.max(1,bays);k++){
      if(dir==='Y') edges.push([ix,iy+k,ix,iy+k+1]); else edges.push([ix+k,iy,ix+k+1,iy]); } };
    if(w.kind==='core'){
      const x0=Math.min(w.ix0,w.ix1), x1=Math.max(w.ix0,w.ix1);
      const y0=Math.min(w.iy0,w.iy1), y1=Math.max(w.iy0,w.iy1);
      addRun('X',x0,y0,x1-x0); addRun('X',x0,y1,x1-x0);   // 하·상변
      addRun('Y',x0,y0,y1-y0); addRun('Y',x1,y0,y1-y0);   // 좌·우변
    } else addRun(w.dir||'X', w.ix||0, w.iy||0, w.bays||1);
    for(let s=from;s<=to;s++){ const izb=s-1, izt=s;
      edges.forEach(e=>{ const n1=N(b,e[0],e[1],izb),n2=N(b,e[2],e[3],izb),
        n3=N(b,e[2],e[3],izt),n4=N(b,e[0],e[1],izt);
        if(n1&&n2&&n3&&n4){ walls.push({nodes:[n1,n2,n3,n4],thick,story:s,building:b,w:wi}); wallThks.add(thick); } }); }
  });
  return {nodes,cols,beams,links,colMeta,beamMeta,linkMeta,baseNodes,elev,floorGroups,floorCorners,
          walls,wallThks:[...wallThks].sort((a,b)=>a-b)};
}

/* 자동 중앙코어: 평면 중앙 1베이에 사각 코어(전단벽 4면, 전층) 배치.
   대부분의 표준층 RC가 중앙코어형(계단·EV) — 토글 ON 시 spec.walls 에 추가. */
function autoCore(p, thick){
  const nbx=asSpans(p.spanX,p.bayX).length, nby=asSpans(p.spanY,p.bayY).length;
  const bx=Math.max(0,Math.floor((nbx-1)/2)), by=Math.max(0,Math.floor((nby-1)/2));
  return {kind:'core', ix0:bx, iy0:by, ix1:Math.min(bx+1,nbx), iy1:Math.min(by+1,nby),
          from:1, to:p.stories, thick:+thick||250};
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

/* ════════════════════════════════════════════════════════════
   M2-A1 — 지진 等效靜力 (Equivalent Static Lateral Force)
   대만 건축물내진설계규범 기반. 스펙트럼계수식 + 수동 override.
   ⚠ 정확한 SaD·R·αy 계수는 工址/構造系統에 따라 사용자가 확정(UI 노출·조정).
   순수 함수 — DOM/MAPI/상태 비의존. 힘 단위 kN, 길이 mm(높이 계산 시 m 변환).
════════════════════════════════════════════════════════════ */
/* 층 표고 elev[0..stories] (buildFrame 과 동일 규칙) */
function storyElevations(spec){
  const elev=[0];
  if(spec.groups&&spec.groups.length){ const hByS={}; spec.groups.forEach(g=>{for(let s=g.from;s<=g.to;s++) hByS[s]=g.h;});
    for(let s=1;s<=spec.stories;s++) elev.push(elev[s-1]+(hByS[s]||spec.hTyp||3000)); }
  else for(let s=1;s<=spec.stories;s++) elev.push(elev[s-1]+(s===1?spec.h1:spec.hTyp));
  return elev;
}
/* 평면 면적 (m²) — 1개 동 기준 */
function planAreaM2(spec){
  const Xp=cumPos(asSpans(spec.spanX,spec.bayX)), Yp=cumPos(asSpans(spec.spanY,spec.bayY));
  const Lx=Xp[Xp.length-1]||0, Ly=Yp[Yp.length-1]||0;
  return (Lx*Ly)/1e6;
}
/* 층별 지진중량 W_i (kN) = 층면적 × (단위중량 w0 + 활하중비율·활하중) × 동수
   w0: 자중 추정(kN/m², 기본 12), liveRatio: 활하중 질량 반영비(기본 0.25) */
function seismicStoryWeights(spec, params){
  params=params||{};
  const w0=(params.w0!=null?params.w0:12), lr=(params.liveRatio!=null?params.liveRatio:0.25);
  const area=planAreaM2(spec)*(spec.buildings||1);
  const g=deriveFloorGroups(spec); const W=[];
  for(let s=1;s<=spec.stories;s++){
    const use=(g[s]&&g[s].use)||'Residential';
    const live=(FLOOR_USE[use]?FLOOR_USE[use].liveVal:0);
    W[s]=area*(w0+lr*live);
  }
  return W;   // W[1..stories]
}
/* 기본진동주기 T(s). 수동 입력 없으면 콘크리트 모멘트골조 경험식 Ta=0.0466·hn^0.9 (hn: m) */
function fundamentalPeriod(spec, params){
  if(params&&params.T) return params.T;
  const elev=storyElevations(spec); const hn=(elev[elev.length-1]||0)/1000;
  return 0.0466*Math.pow(Math.max(hn,0.1),0.9);
}
/* SD1 환산: 직접 주어지면 그대로, 없고 T0(전환주기)가 있으면 SD1=SDS·T0
   (臺北盆地 등 Sederes가 Sa1을 N/A로 주고 T0만 줄 때 — 감쇠구간 SD1/T = SDS·T0/T) */
function effSD1(params){
  if(params.SD1!=null) return params.SD1;
  if(params.SDS && params.T0) return params.SDS*params.T0;
  return 0;
}
/* 밑면전단계수 Cs = SDS·I/R, 상한 SD1·I/(R·T), 하한 max(0.044·SDS·I, 0.01) */
function seismicCs(params, T){
  params=params||{};
  const I=(params.I!=null?params.I:1.0), R=(params.R!=null?params.R:4.5);
  const SDS=params.SDS||0, SD1=effSD1(params);
  let Cs=R>0?SDS*I/R:0;
  if(SD1>0 && T>0 && R>0) Cs=Math.min(Cs, SD1*I/(R*T));
  return Math.max(Cs, 0.044*SDS*I, 0.01);
}
/* 수직분포 지수 k: T≤0.5→1, T≥2.5→2, 사이 선형보간 */
function seismicKExp(T){ return T<=0.5?1:(T>=2.5?2:1+(T-0.5)/2); }
/* 等效靜力: spec+params → {T,k,Cs,V,Wtot,W,forces[{story,h,w,F(kN)}]}
   override 우선순위: params.V(직접 밑면전단) > params.Cs(계수) > 스펙트럼식 */
function seismicStoryForces(spec, params){
  params=params||{};
  const W=seismicStoryWeights(spec,params);
  const elev=storyElevations(spec);
  const Wtot=W.reduce((a,b)=>a+(b||0),0);
  const T=fundamentalPeriod(spec,params);
  let Cs, V;
  if(params.V!=null){ V=params.V; Cs=Wtot>0?V/Wtot:0; }
  else { Cs=(params.Cs!=null?params.Cs:seismicCs(params,T)); V=Cs*Wtot; }
  const k=seismicKExp(T);
  let denom=0; for(let s=1;s<=spec.stories;s++) denom+=(W[s]||0)*Math.pow((elev[s]||0)/1000,k);
  const forces=[];
  for(let s=1;s<=spec.stories;s++){
    const cvx=denom>0?((W[s]||0)*Math.pow((elev[s]||0)/1000,k))/denom:0;
    forces.push({story:s, h:elev[s], w:W[s], F:V*cvx});
  }
  return {T,k,Cs,V,Wtot,W,forces};
}

/* ════════════════════════════════════════════════════════════
   M2-A2 — 풍하중 (간이 정적풍, 建築物風力規範 기반)
   ⚠ 간이 모델(투명·조정 가능). 정밀 陣風反應係數/地形/방향계수는 사용자 확정.
   qz=0.613·Vz²(Pa)→kN/㎡, Vz=V10·(z/10)^α. 층력 F=G·Cf·I·qz·면폭·분담높이.
   풍방향: WX(+X)는 Y폭(깊이) 면에, WY(+Y)는 X폭 면에 작용.
════════════════════════════════════════════════════════════ */
const WIND_EXPOSURE={A:0.32,B:0.25,C:0.15};   // 地況 A(도심)/B(교외)/C(해안·개활)
function windStoryForces(spec, params){
  params=params||{};
  const V10=(params.V10!=null?params.V10:42.5);          // 기본설계풍속 (m/s, 10m)
  const alpha=(params.alpha!=null?params.alpha:(WIND_EXPOSURE[params.exposure]||0.25));
  const G=(params.G!=null?params.G:1.9), Cf=(params.Cf!=null?params.Cf:1.3), I=(params.I!=null?params.I:1.0);
  const Xp=cumPos(asSpans(spec.spanX,spec.bayX)), Yp=cumPos(asSpans(spec.spanY,spec.bayY));
  const Lx=(Xp[Xp.length-1]||0)/1000, Ly=(Yp[Yp.length-1]||0)/1000;  // m
  const bldgs=spec.buildings||1;
  const elev=storyElevations(spec);
  const fxx=[], fyy=[]; let Vx=0, Vy=0;
  for(let s=1;s<=spec.stories;s++){
    const z=Math.max((elev[s]||0)/1000, 10);             // level height (m), 최소 10
    const hb=((elev[s]||0)-(elev[s-1]||0))/1000, ha=(s<spec.stories?((elev[s+1]||0)-(elev[s]||0))/1000:0);
    const htrib=hb/2 + ha/2;                              // 분담 높이 (m)
    const Vz=V10*Math.pow(z/10,alpha);
    const qz=0.613*Vz*Vz/1000;                            // kN/m²
    const base=G*Cf*I*qz*htrib*bldgs;                     // kN per unit face width
    const Fx=base*Ly, Fy=base*Lx;                         // WX는 Y폭 면, WY는 X폭 면
    fxx.push({story:s,h:elev[s],qz,F:Fx}); fyy.push({story:s,h:elev[s],qz,F:Fy}); Vx+=Fx; Vy+=Fy;
  }
  return {V10,alpha,G,Cf,I,Vx,Vy,forcesX:fxx,forcesY:fyy};
}

/* ── 지진 工址 프리셋 (대만 건축물내진설계규범 113년판, 表2-6b 一般震區) ──
   설계 수평스펙트럼가속도계수 SDS(=S_S^D), SD1(=S_1^D). 全區所有里 단위만 수록.
   ⚠ 臺北盆地(表2-6a, 臺北一/二/三區) 행정구는 미분구 설계스펙트럼 別表 필요 → 미수록.
   ⚠ 그 외 縣市는 해당 震區表 입수 후 확장. */
const SEISMIC_ZONES=[
  /* 臺北盆地 微分區 (表2-6a, Sederes 조회값) — Sa1=N/A, T0로 정의 → SD1=SDS·T0 */
  {city:'臺北盆地', dist:'臺北三區', SDS:0.6, T0:1.6, SD1:0.96, note:'盆地(예: 大安區 仁愛里). 부지별 상이 — Sederes 확인 권장'},
  {city:'新北市', dist:'三峽區',  SDS:0.7, SD1:0.40},
  {city:'新北市', dist:'石碇區',  SDS:0.7, SD1:0.40},
  {city:'新北市', dist:'坪林區',  SDS:0.7, SD1:0.40},
  {city:'新北市', dist:'雙溪區',  SDS:0.7, SD1:0.40},
  {city:'新北市', dist:'貢寮區',  SDS:0.7, SD1:0.40},
  {city:'新北市', dist:'烏來區',  SDS:0.7, SD1:0.40},
  {city:'新北市', dist:'鶯歌區',  SDS:0.6, SD1:0.35},
  {city:'新北市', dist:'瑞芳區',  SDS:0.6, SD1:0.35},
  {city:'新北市', dist:'深坑區',  SDS:0.6, SD1:0.35},
  {city:'新北市', dist:'平溪區',  SDS:0.6, SD1:0.35},
  {city:'新北市', dist:'林口區',  SDS:0.5, SD1:0.30},
  {city:'新北市', dist:'三芝區',  SDS:0.5, SD1:0.30},
  {city:'新北市', dist:'石門區',  SDS:0.5, SD1:0.30},
  {city:'新北市', dist:'金山區',  SDS:0.5, SD1:0.30},
  {city:'新北市', dist:'萬里區',  SDS:0.5, SD1:0.30}
];

/* ════════════════════════════════════════════════════════════
   M2-B — 기존 모델 표준층 자동판정 (GET node/elem 기반, 순수)
   네이티브 story 엔드포인트 없음(라이브 확인) → 지오메트리로 판정:
   Z군집 → 층고 / 부재분류(수직 BEAM=기둥, 수평=보, PLATE/WALL=슬래브·벽) /
   시그니처(층고·기둥단면·보단면·슬래브유무) 연속 동일 = 한 표준층 그룹.
   (라이브 검증된 알고리즘 — 단면이 바뀌는 모델에서 기단부/표준층 복원 확인)
   입력: GET 응답형 {id:{X,Y,Z}}·{id:{TYPE,SECT,NODE}} 또는 배열 모두 허용.
════════════════════════════════════════════════════════════ */
function detectTypicalFloors(nodes, elems){
  const N={};
  if(Array.isArray(nodes)) nodes.forEach(n=>{ N[n.id]={x:+n.x,y:+n.y,z:+n.z}; });
  else for(const id in (nodes||{})){ const v=nodes[id]; N[id]={x:+v.X,y:+v.Y,z:+v.Z}; }
  const E=Array.isArray(elems)?elems:Object.values(elems||{});
  const R1=z=>Math.round(z*10)/10;
  const zof=id=>N[id]?R1(N[id].z):null;
  const levels=[...new Set(Object.values(N).map(n=>R1(n.z)))].sort((a,b)=>a-b);
  const lvi={}; levels.forEach((z,i)=>{ lvi[z]=i; });
  const nstory=levels.length-1;
  const colS={}, beamS={}, plate={};
  E.forEach(e=>{ const nd=(e.NODE||[]).filter(x=>x); const zs=nd.map(zof).filter(z=>z!=null);
    if(!zs.length) return;
    if(e.TYPE==='BEAM'){
      if([...new Set(zs)].length>=2){ const s=lvi[Math.max(...zs)]; if(s>=1)(colS[s]=colS[s]||[]).push(e.SECT); }
      else { const s=lvi[zs[0]]; if(s>=1)(beamS[s]=beamS[s]||[]).push(e.SECT); }
    } else if(e.TYPE==='PLATE'||e.TYPE==='WALL'){ const s=lvi[Math.max(...zs)]; if(s>=1) plate[s]=true; }
  });
  const sig=s=>JSON.stringify([R1(levels[s]-levels[s-1]),
    [...new Set(colS[s]||[])].sort(), [...new Set(beamS[s]||[])].sort(), !!plate[s]]);
  const groups=[];
  for(let s=1;s<=nstory;s++){ const g=sig(s); const last=groups[groups.length-1];
    if(last&&last.sig===g){ last.to=s; }
    else groups.push({from:s,to:s,sig:g,h:R1(levels[s]-levels[s-1]),
      colSects:[...new Set(colS[s]||[])].sort((a,b)=>a-b),
      beamSects:[...new Set(beamS[s]||[])].sort((a,b)=>a-b), hasSlab:!!plate[s]}); }
  return {levels, stories:nstory, baseZ:levels[0], groups};
}

/* ════════════════════════════════════════════════════════════
   M3 — RC 배근 (配筋) 자체계산 · TWD-USD112 (USD/ACI-318 계열)
   부재력은 프런트엔드가 post/table BEAMFORCE 로 회수(N·mm) → 아래 순수함수로 배근.
   단위: 힘 N, 길이 mm, 응력 MPa(N/mm²). CNS 등급번호 = fc'(kgf/cm²) → MPa 환산.
   ⚠ 보 휨·전단 MVP. 단철근 가정, 조합 포락 Mu/Vu 입력. 상세 정착·이음·SMRF 디테일은 후속.
════════════════════════════════════════════════════════════ */
const KGFCM2_TO_MPA=0.0980665;
function fcMPa(matName){ const g=_CNS_CONC.includes(matName)?matName:(_MPA2CNS[matName]||'C280'); return (+g.slice(1))*KGFCM2_TO_MPA; }
const REBAR_FY={SD280:280,SD420:420,SD490:490};                 // MPa(공칭)
const BAR_AREA={D13:127,D16:199,D19:287,D22:387,D25:507,D29:642,D32:794};  // mm²(대만 D호칭)
const DEFAULT_REBAR={fy:420,fyt:280,cover:40};                  // SD420 주근 / SD280 스터럽 / 피복 40mm
function beamEffDepth(h,cover){ return h-(cover||40)-10-13; }   // 스터럽 D10 + 주근반경(~D25)
/* 휨 주철근 As(mm²): Mu(N·mm), φ=0.9, 단철근. 한계 초과 시 NaN(복철근/증대 필요) */
function flexAs(Mu,b,d,fc,fy){
  if(!(Mu>0)) return 0;
  const Mn=Mu/0.9, Rn=Mn/(b*d*d), t=1-2*Rn/(0.85*fc);
  if(t<=0) return NaN;
  return (0.85*fc/fy)*(1-Math.sqrt(t))*b*d;
}
function flexAsMin(b,d,fc,fy){ return Math.max(0.25*Math.sqrt(fc)/fy,1.4/fy)*b*d; }
function beta1(fc){ return fc<=28?0.85:Math.max(0.65,0.85-0.05*(fc-28)/7); }
function flexRhoMax(fc,fy){ return 0.85*beta1(fc)*(fc/fy)*(0.003/(0.003+0.005)); }  // εt=0.005(인장지배)
function shearVc(b,d,fc){ return 0.17*Math.sqrt(fc)*b*d; }                          // N
/* 전단 스터럽 간격 s(mm). Vu(N), φ=0.75, Av=스터럽 전단면적(mm²) */
function stirrupSpacing(Vu,b,d,fc,fyt,Av){
  const Vc=shearVc(b,d,fc), Vs=Vu/0.75-Vc, sMax=Math.min(d/2,600);
  if(Vs<=0) return {s:sMax,Vs:0,Vc,note:'min'};
  if(Vs>0.66*Math.sqrt(fc)*b*d) return {s:0,Vs,Vc,note:'section'};   // 단면 부족
  const sCap=(Vs>0.33*Math.sqrt(fc)*b*d)?Math.min(d/4,300):sMax;
  return {s:Math.min(Av*fyt*d/Vs,sCap),Vs,Vc,note:'ok'};
}
function pickBars(As){
  if(!(As>0)) return {dia:'-',n:0,As:0};
  for(const [dia,a] of [['D19',287],['D22',387],['D25',507],['D29',642]]){
    const n=Math.ceil(As/a); if(n<=8) return {dia,n:Math.max(2,n),As:Math.max(2,n)*a}; }
  const n=Math.max(2,Math.ceil(As/794)); return {dia:'D32',n,As:n*794};
}
/* 보 1개 종합: demand{MuPos,MuNeg,Vu}(N·mm,N) + geom{b,h} + mat{fc,fy,fyt,cover} → 배근 */
function rcBeamDesign(demand,geom,mat){
  mat=Object.assign({},DEFAULT_REBAR,mat||{});
  const b=geom.b, h=geom.h, d=beamEffDepth(h,mat.cover), fc=mat.fc, fy=mat.fy, fyt=mat.fyt;
  const asMin=flexAsMin(b,d,fc,fy), rhoMax=flexRhoMax(fc,fy), asMax=rhoMax*b*d;
  const rawBot=flexAs(demand.MuPos||0,b,d,fc,fy), rawTop=flexAs(demand.MuNeg||0,b,d,fc,fy);
  const over=(isNaN(rawBot)||isNaN(rawTop)||rawBot>asMax||rawTop>asMax);
  const asBot=Math.max(isNaN(rawBot)?asMax:rawBot,asMin), asTop=Math.max(isNaN(rawTop)?asMax:rawTop,asMin);
  const Av=2*BAR_AREA.D13||2*127, sh=stirrupSpacing(demand.Vu||0,b,d,fc,fyt,2*113);  // 2-leg D10(≈113)
  return {b,h,d,asMin,asMax, asTop,asBot, barsTop:pickBars(asTop), barsBot:pickBars(asBot),
          stirrup:{dia:'D10',leg:2,Av:226,s:Math.max(50,Math.floor(sh.s/10)*10),note:sh.note}, over};
}

/* ── 기둥 P-M 배근 (TWD-USD112, 변형률적합 + 사각형 응력블록, 대칭 2층배근) ──
   demand{Pu(N,압축),Mux,Muy(N·mm)} + geom{b,h} + mat → 필요 철근비 ρ(1~6%)·주근·띠철근.
   ⚠ 주축(지배축) 단축 P-M MVP. 이축(Bresler)·세장효과(P-Δ)·SMRF 디테일은 후속. */
const ES_STEEL=200000, ECU=0.003;
function colPMpoints(rho,b,h,fc,fy,cover){
  const Ag=b*h, As=rho*Ag, dp=(cover||40)+10+13, d=h-dp, b1=beta1(fc);
  const layers=[{A:As/2,di:dp},{A:As/2,di:d}], pts=[];
  for(let c=0.04*h;c<=2.2*h;c*=1.05){
    const a=Math.min(b1*c,h), Cc=0.85*fc*b*a; let Ps=0,Ms=0,etl=0;
    layers.forEach(L=>{ const es=ECU*(c-L.di)/c; let fs=Math.max(-fy,Math.min(fy,ES_STEEL*es));
      const f=(L.di<a)?(fs-0.85*fc):fs; Ps+=L.A*f; Ms+=L.A*f*(h/2-L.di); if(L.di===d) etl=-es; });
    const Pn=Cc+Ps, Mn=Cc*(h/2-a/2)+Ms;
    let phi=0.65; const ety=fy/ES_STEEL;
    if(etl>=0.005)phi=0.9; else if(etl>ety)phi=0.65+(etl-ety)*0.25/(0.005-ety);
    pts.push({P:phi*Pn,M:phi*Math.abs(Mn)});
  }
  return pts;
}
function colMcapAt(rho,b,h,fc,fy,cover,Pu){
  const pts=colPMpoints(rho,b,h,fc,fy,cover); let best=0;
  for(let i=1;i<pts.length;i++){ const A=pts[i-1],Bp=pts[i];
    if((A.P-Pu)*(Bp.P-Pu)<=0){ const t=(Pu-A.P)/((Bp.P-A.P)||1); best=Math.max(best,A.M+t*(Bp.M-A.M)); } }
  return best;
}
function pickColBars(As){
  for(const [dia,a] of [['D22',387],['D25',507],['D29',642],['D32',794]]){
    let n=Math.ceil(As/a); if(n%2)n++; n=Math.max(4,n); if(n<=16) return {dia,n,As:n*a}; }
  let n=Math.max(4,Math.ceil(As/794)); if(n%2)n++; return {dia:'D32',n,As:n*794};
}
function rcColumnDesign(demand,geom,mat){
  mat=Object.assign({},DEFAULT_REBAR,mat||{});
  const b=geom.b,h=geom.h,fc=mat.fc,fy=mat.fy,cover=mat.cover;
  const Pu=Math.abs(demand.Pu||0), Mu=Math.max(Math.abs(demand.Mux||0),Math.abs(demand.Muy||0));
  let lo=0.01,hi=0.06,ok=false;
  for(let it=0;it<26;it++){ const mid=(lo+hi)/2; if(colMcapAt(mid,b,h,fc,fy,cover,Pu)>=Mu){hi=mid;ok=true;} else lo=mid; }
  const rho=ok?hi:0.06, over=!ok;
  const As=rho*b*h, dlong=22;
  const tieS=Math.min(16*dlong,48*10,Math.min(b,h));   // 띠철근 간격: min(16db, 48dt, 최소변)
  return {b,h,rho,As,bars:pickColBars(As),tie:{dia:'D10',s:Math.floor(tieS/10)*10},over,Pu,Mu};
}

/* ── 네임스페이스 노출 (M2 확장·다른 프런트엔드용) ── */
if(typeof window!=='undefined'){
  window.RCEngine={
    MATERIALS, FLOOR_USE, TYPE_USE, useOf, deriveFloorGroups, specToGroupRows,
    FG_ROLES, FG_USES, asSpans, cumPos, buildFrame, taiwanCombos,
    DEFAULT_SPEC, BUILDING_TYPES, TYPE_KEYWORDS, detectBuildingType, autoCore,
    _MPA2CNS, _CNS_CONC,
    storyElevations, planAreaM2, seismicStoryWeights, fundamentalPeriod,
    effSD1, seismicCs, seismicKExp, seismicStoryForces, SEISMIC_ZONES,
    WIND_EXPOSURE, windStoryForces, detectTypicalFloors,
    KGFCM2_TO_MPA, fcMPa, REBAR_FY, BAR_AREA, DEFAULT_REBAR, beamEffDepth,
    flexAs, flexAsMin, flexRhoMax, shearVc, stirrupSpacing, pickBars, rcBeamDesign,
    ES_STEEL, beta1, colPMpoints, colMcapAt, pickColBars, rcColumnDesign
  };
}
