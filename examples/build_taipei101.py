#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Taipei 101 — 외형 개념 스켈레톤(External-shape concept skeleton)
MIDAS Gen NX Open API(REST)를 직접 호출해 한 번에 생성.

사용법:
    python build_taipei101.py <MAPI-Key> [base_url]
    기본 base_url = https://moa-engineers.midasit.com:443/gen

전제:
    - Gen NX 실행 + 모델 열림 + Apps→Connect ON (MAPI-Key는 인라인 인자로만; 커밋 금지)
    - doc/new 로 새 문서에서 시작(기존 열린 모델 대체)

⚠ 범위: 형상(지오메트리)만. 재료는 RC C420 대체(실제 강재/CFT 아님),
   아웃리거·벨트는 형상 브레이스, 설계·해석 미실시. 학습/외관용.

원리 요약 (자세히는 101_modeling_method.md):
    1) 규칙 6x6 격자(49기둥/층)를 106레벨(지하5+지상101) 쌓는다.
    2) 각 레벨의 X/Y를 중심 기준 scale(iz)로 축소 → 101 특유 실루엣을 "형상 몰핑".
       (토폴로지 불변, 절점 좌표만 높이의 함수로 스케일 → 기둥이 자연히 경사)
    3) 층고: 지하 지표 아래, 포디움 6.3m, 기준층 4.2m → 옥상 449m/첨탑끝 509m.
    4) 상부: 축소 크라운 + 팔각 원반 + 등폭 팔각 10단 첨탑 + 안테나.
    5) 벨트트러스(모듈 상단 perimeter) + 아웃리거(중앙 격자) 브레이스.
"""
import json, urllib.request, sys, math

BASE = sys.argv[2] if len(sys.argv) > 2 else "https://moa-engineers.midasit.com:443/gen"
KEY  = sys.argv[1]

def call(method, ep, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+ep, data=data, method=method,
        headers={"MAPI-Key":KEY, "Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        try: return r.status, json.loads(r.read().decode())
        except: return r.status, {}
def put(path, assign): return call("PUT", "/db/"+path, {"Assign":assign})
def chunks(d, n):
    it = list(d.items())
    for i in range(0, len(it), n): yield dict(it[i:i+n])

# ───────────────────────── parameters ─────────────────────────
NB, SPAN = 6, 10000            # 6 bays x 10 m = 60 m square, 7x7 grid points
NP  = NB + 1
CX  = CY = NB*SPAN/2.0         # plan centre (30 m)
S   = 106                      # 5 basement + 101 above-ground

def story_h(iz):               # per-story height (mm)
    if iz <= 5:  return 4200   # B5..B1
    if iz <= 17: return 6300   # F1..F12 podium (6.3 m)
    return 4200                # F13..F101 tower (4.2 m)

# elevations; shift so ground(top of basement, iz5)=0, basement below grade
elev = [0.0]
for iz in range(1, S+1): elev.append(elev[-1] + story_h(iz))
elev = [e - elev[5] for e in elev]
ZR   = elev[S]                 # roof (~449.4 m)

def scale(iz):                 # plan width factor about centre → 101 silhouette
    F = iz - 5                 # above-ground floor (basement: F<=0)
    if F <= 1:  return 1.00                                   # base skirt (60 m, widest)
    if F <= 25: return 1.00 + (0.72-1.00)*((F-1)/24.0)        # taper to waist (43 m)
    if F <= 89: return 0.72 + (0.88-0.72)*(((F-26)%8)/7.0)    # 8 flared modules, end wide
    return 0.33                                                # F90-101 slim crown (~20 m)

def nid(ix, iy, iz): return iz*NP*NP + iy*NP + ix + 1

# 8 mega-columns: 4 corners + 4 edge-midpoints
MEGA = {(0,0),(NB,0),(0,NB),(NB,NB),(NB//2,0),(NB//2,NB),(0,NB//2),(NB,NB//2)}

# ───────────────────────── sections & material ─────────────────────────
def sect(name,H,B):
    return {"SECTTYPE":"DBUSER","SECT_NAME":name,"SECT_BEFORE":{"SHAPE":"SB","DATATYPE":2,
            "SECT_I":{"vSIZE":[H,B,0,0,0,0,0]},"USE_SHEAR_DEFORM":True,"USE_WARPING_EFFECT":False}}
SECTS = {1:sect("MEGA3000x2400",3000,2400), 2:sect("CORE1400x1400",1400,1400),
         3:sect("B500x900",900,500), 4:sect("SPIRE500",500,500), 5:sect("BRACE400",400,400)}
MATL  = {1:{"TYPE":"CONC","NAME":"C420","DAMP_RAT":0.05,
            "PARAM":[{"P_TYPE":1,"STANDARD":"CNS560(RC)","DB":"C420"}]}}

# ───────────────────────── nodes (shape baked in) ─────────────────────────
nodes = {}
for iz in range(0, S+1):
    s = scale(iz)
    for iy in range(NP):
        for ix in range(NP):
            nodes[nid(ix,iy,iz)] = {"X":round(CX+(ix*SPAN-CX)*s,3),
                                    "Y":round(CY+(iy*SPAN-CY)*s,3), "Z":round(elev[iz],3)}
MAXGRID = nid(NB,NB,S)

# ───────────────────────── elements ─────────────────────────
elems = {}; eid = 0
def E(n1,n2,sc):
    global eid; eid += 1; elems[eid] = {"TYPE":"BEAM","MATL":1,"SECT":sc,"NODE":[n1,n2],"ANGLE":0,"STYPE":0}

# columns (mega on perimeter 8 spots, core elsewhere)
for iz in range(0, S):
    for iy in range(NP):
        for ix in range(NP):
            E(nid(ix,iy,iz), nid(ix,iy,iz+1), 1 if (ix,iy) in MEGA else 2)
# beams (both directions, each floor)
for iz in range(1, S+1):
    for iy in range(NP):
        for ix in range(NB): E(nid(ix,iy,iz), nid(ix+1,iy,iz), 3)
    for ix in range(NP):
        for iy in range(NB): E(nid(ix,iy,iz), nid(ix,iy+1,iz), 3)

# trusses (SECT5): belt = perimeter X at module tops; outrigger = centre-line X
def panel(fixed, along, s):    # X-brace one story panel, along 'X' or 'Y', line at index 'fixed'
    for k in range(NB):
        if along=='X': a,b,c,d = nid(k,fixed,s-1),nid(k+1,fixed,s-1),nid(k+1,fixed,s),nid(k,fixed,s)
        else:          a,b,c,d = nid(fixed,k,s-1),nid(fixed,k+1,s-1),nid(fixed,k+1,s),nid(fixed,k,s)
        E(a,c,5); E(b,d,5)
BELT = [38,46,54,62,70,78,86,94]     # iz of 8 module-top floors (F33,41,..,89)
OUTR = [38,54,70,86]
for s in BELT: panel(0,'X',s); panel(NB,'X',s); panel(0,'Y',s); panel(NB,'Y',s)
for s in OUTR: panel(NB//2,'X',s); panel(NB//2,'Y',s)

# ───────────────────────── top: crown → octagon disc → 10-tier mast → antenna ─────────────────────────
CROWN = [nid(NB,3,S),nid(NB,NB,S),nid(3,NB,S),nid(0,NB,S),
         nid(0,3,S),nid(0,0,S),nid(3,0,S),nid(NB,0,S)]   # F101 perimeter at angles 0,45,..315
nx = MAXGRID
def N(x,y,z):
    global nx; nx += 1; nodes[nx] = {"X":round(x,2),"Y":round(y,2),"Z":round(z,2)}; return nx
def oct_ring(R,z): return [N(CX+R*math.cos(k*math.pi/4), CY+R*math.sin(k*math.pi/4), z) for k in range(8)]

sauc = oct_ring(13000, ZR+3000)                       # overhang platform disc
for k in range(8): E(sauc[k], sauc[(k+1)%8], 4)       # brim ring
for k in range(8): E(sauc[k], CROWN[k], 4)            # eave spokes to crown
Rm, z0, dz = 1800, ZR+8000, 4500                      # CONSTANT-radius octagonal mast
rings = [oct_ring(Rm, z0+k*dz) for k in range(11)]    # 11 rings = 10 tiers
for k in range(8): E(sauc[k], rings[0][k], 4)         # cone: disc -> mast base
for r in rings:
    for k in range(8): E(r[k], r[(k+1)%8], 4)         # tier bands
for j in range(10):
    for k in range(8): E(rings[j][k], rings[j+1][k], 4)   # vertical chords (parallel)
TOPC = N(CX,CY,z0+10*dz)
for k in range(8): E(rings[-1][k], TOPC, 4)           # flat cap
E(TOPC, N(CX,CY,ZR+60000), 4)                         # thin antenna to tip (509.4 m)

# ───────────────────────── supports & load ─────────────────────────
base = [nid(ix,iy,0) for iy in range(NP) for ix in range(NP)]
cons = {n:{"ITEMS":[{"ID":1,"CONSTRAINT":"1111110","GROUP_NAME":""}]} for n in base}

# ───────────────────────── send ─────────────────────────
print("roof %.1f m  tip %.1f m  |  nodes %d  elems %d" % (ZR/1000, (ZR+60000)/1000, len(nodes), len(elems)))
print("doc/new:",  call("POST","/doc/new",{})[0])
print("unit:",     put("unit",{1:{"FORCE":"N","DIST":"MM","HEAT":"KJ","TEMPER":"C"}})[0])
print("matl:",     put("matl",MATL)[0])
print("sect:",     put("sect",SECTS)[0])
print("nodes:",   [put("node",c)[0] for c in chunks(nodes,2000)])
print("elems:",   [put("elem",c)[0] for c in chunks(elems,1500)])
print("cons:",     put("cons",cons)[0])
print("loadcase:", put("stld",{1:{"NO":1,"NAME":"DL","TYPE":"D","DESC":""}})[0])
print("selfwt:",   put("BODF",{1:{"LCNAME":"DL","GROUP_NAME":"","FV":[0,0,-1]}})[0])
print("iso:",      call("POST","/view/ANGLE",{"Argument":{"HORIZONTAL":30,"VERTICAL":15}})[0])
print("DONE")
