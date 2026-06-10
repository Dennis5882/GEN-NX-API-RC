// RC Building parametric modeler
// Input: { product, apiKey, rcParams }
// Generates geometry → pushes to MIDAS in sequence

const MIDAS_BASE = {
  gen:   'https://moa-engineers.midasit.com:443/gen',
  civil: 'https://moa-engineers.midasit.com:443/civil'
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function mPut(base, key, ep, body) {
  const r = await fetch(`${base}${ep}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'MAPI-Key': key },
    body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PUT ${ep}: ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

async function mDelete(base, key, ep) {
  try {
    await fetch(`${base}${ep}`, {
      method: 'DELETE',
      headers: { 'MAPI-Key': key }
    });
  } catch (_) {}
}

// ─── Geometry builder ────────────────────────────────────────────────────────

function buildRCGeometry(p) {
  const xCoords = [0];
  for (const s of p.xSpans) xCoords.push(xCoords[xCoords.length - 1] + s);
  const yCoords = [0];
  for (const s of p.ySpans) yCoords.push(yCoords[yCoords.length - 1] + s);
  const zCoords = [0];
  for (const h of p.storyHeights) zCoords.push(zCoords[zCoords.length - 1] + h);

  const nX = xCoords.length;
  const nY = yCoords.length;
  const nS = p.storyHeights.length;

  // Nodes
  const nodes = [];
  const nodeMap = {};
  let nid = 0;
  for (let iz = 0; iz <= nS; iz++)
    for (let iy = 0; iy < nY; iy++)
      for (let ix = 0; ix < nX; ix++) {
        nid++;
        nodes.push({ id: nid, X: xCoords[ix], Y: yCoords[iy], Z: zCoords[iz] });
        nodeMap[`${ix},${iy},${iz}`] = nid;
      }

  const N = (ix, iy, iz) => nodeMap[`${ix},${iy},${iz}`];

  // Section ID lookup per floor
  const colSects  = p.colSects  || [{ H: 60, B: 60, fromFloor: 1, toFloor: nS }];
  const beamSects = p.beamSects || [{ H: 60, B: 35, fromFloor: 1, toFloor: nS }];

  const sections = [];
  let sectId = 0;
  const colSectByFloor  = {};
  const beamSectByFloor = {};

  for (const cs of colSects) {
    sectId++;
    sections.push({ id: sectId, name: `C${cs.H}x${cs.B}`, H: cs.H, B: cs.B });
    for (let f = cs.fromFloor; f <= cs.toFloor; f++) colSectByFloor[f] = sectId;
  }
  for (const bs of beamSects) {
    sectId++;
    sections.push({ id: sectId, name: `B${bs.H}x${bs.B}`, H: bs.H, B: bs.B });
    const from = bs.fromFloor || 1, to = bs.toFloor || nS;
    for (let f = from; f <= to; f++) beamSectByFloor[f] = sectId;
  }
  // fill gaps
  const fallbackCol  = sections[0]?.id || 1;
  const fallbackBeam = sections[colSects.length]?.id || 2;
  for (let f = 1; f <= nS; f++) {
    if (!colSectByFloor[f])  colSectByFloor[f]  = fallbackCol;
    if (!beamSectByFloor[f]) beamSectByFloor[f] = fallbackBeam;
  }

  // Elements
  const elements = [];
  const cols = [], beams = [];
  let eid = 0;

  for (let iz = 0; iz < nS; iz++) {
    const floor = iz + 1;
    const sid = colSectByFloor[floor];
    for (let iy = 0; iy < nY; iy++)
      for (let ix = 0; ix < nX; ix++) {
        eid++;
        const n1 = N(ix, iy, iz), n2 = N(ix, iy, iz + 1);
        elements.push({ id: eid, SECT: sid, n1, n2 });
        cols.push([n1, n2]);
      }
  }
  for (let iz = 1; iz <= nS; iz++) {
    const sid = beamSectByFloor[iz];
    for (let iy = 0; iy < nY; iy++)
      for (let ix = 0; ix < nX - 1; ix++) {
        eid++;
        const n1 = N(ix, iy, iz), n2 = N(ix + 1, iy, iz);
        elements.push({ id: eid, SECT: sid, n1, n2 });
        beams.push([n1, n2]);
      }
    for (let ix = 0; ix < nX; ix++)
      for (let iy = 0; iy < nY - 1; iy++) {
        eid++;
        const n1 = N(ix, iy, iz), n2 = N(ix, iy + 1, iz);
        elements.push({ id: eid, SECT: sid, n1, n2 });
        beams.push([n1, n2]);
      }
  }

  const baseNodes = nodes.filter(n => n.Z === 0).map(n => n.id);

  return { nodes, elements, sections, cols, beams, baseNodes, nX, nY, nS, zCoords };
}

// ─── MIDAS payload builders ───────────────────────────────────────────────────

function payloadUnit(force = 'TONF', dist = 'CM') {
  return { Assign: { 1: { FORCE: force, DIST: dist, HEAT: 'KCAL', TEMPER: 'C' } } };
}

function payloadMaterial(concGrade = 'C24') {
  const gradeMap = { C18: 'C18', C21: 'C21', C24: 'C24', C27: 'C27', C30: 'C30', C35: 'C35', C40: 'C40' };
  const db = gradeMap[concGrade] || concGrade;
  return {
    Assign: {
      1: { TYPE: 'CONC', NAME: concGrade, PARAM: [{ P_TYPE: 0, STANDARD: 'KS', DB: db }] }
    }
  };
}

function payloadSections(sections) {
  const assign = {};
  for (const s of sections) {
    assign[String(s.id)] = {
      SECTTYPE: 'DBUSER',
      SECT_NAME: s.name,
      SECT_BEFORE: {
        OFFSET_PT: 'CC', OFFSET_CENTER: 0, USER_OFFSET_REF: 0,
        HORZ_OFFSET_OPT: 0, USERDEF_OFFSET_YI: 0,
        VERT_OFFSET_OPT: 0, USERDEF_OFFSET_ZI: 0,
        USE_SHEAR_DEFORM: true, USE_WARPING_EFFECT: false,
        SHAPE: 'SB', DATATYPE: 1,
        SECT_I: { vSIZE: [s.H, s.B, 0, 0, 0, 0, 0, 0, 0, 0] }
      }
    };
  }
  return { Assign: assign };
}

function payloadNodes(nodes) {
  const assign = {};
  for (const n of nodes) assign[String(n.id)] = { X: n.X, Y: n.Y, Z: n.Z };
  return { Assign: assign };
}

function payloadElements(elements) {
  const assign = {};
  for (const e of elements)
    assign[String(e.id)] = { TYPE: 'BEAM', MATL: 1, SECT: e.SECT, NODE: [e.n1, e.n2], ANGLE: 0, STYPE: 0 };
  return { Assign: assign };
}

function payloadStories(zCoords, diaphragm = true) {
  const assign = {};
  for (let i = 1; i < zCoords.length; i++) {
    assign[String(i)] = {
      STORY_NAME: `F${i}`,
      STORY_LEVEL: zCoords[i],
      bFLOOR_DIAPHRAGM: diaphragm,
      WIND_FLOOR_WIDTH_X: 0, WIND_FLOOR_WIDTH_Y: 0,
      WIND_CENTER_X: 0, WIND_CENTER_Y: 0,
      WIND_ECCENT_X: 0, WIND_ECCENT_Y: 0,
      SEIS_ACC_ECCENT_X: 0, SEIS_ACC_ECCENT_Y: 0,
      SEIS_INHERENT_ECCENT_X: 0, SEIS_INHERENT_ECCENT_Y: 0,
      SEIS_TORSIONAL_AMP_FACTOR_X: 0, SEIS_TORSIONAL_AMP_FACTOR_Y: 0
    };
  }
  return { Assign: assign };
}

function payloadSupports(baseNodes) {
  const assign = {};
  for (const id of baseNodes)
    assign[String(id)] = { ITEMS: [{ ID: 0, GROUP_NAME: '', CONSTRAINT: '111111' }] };
  return { Assign: assign };
}

function payloadLoadCases(lcList) {
  const defaults = [
    { id: 1, NO: 1, NAME: 'D',   TYPE: 'D', DESC: '고정하중' },
    { id: 2, NO: 2, NAME: 'L',   TYPE: 'L', DESC: '활하중' },
    { id: 3, NO: 3, NAME: 'EQX', TYPE: 'E', DESC: '지진하중 X' },
    { id: 4, NO: 4, NAME: 'EQY', TYPE: 'E', DESC: '지진하중 Y' }
  ];
  const list = lcList || defaults;
  const assign = {};
  for (const lc of list)
    assign[String(lc.id)] = { NO: lc.NO || lc.id, NAME: lc.NAME, TYPE: lc.TYPE, DESC: lc.DESC || '' };
  return { Assign: assign };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { product, apiKey, rcParams, clearFirst } = req.body || {};
  if (!product || !apiKey || !rcParams)
    return res.status(400).json({ error: 'product, apiKey, and rcParams are required' });

  const base = MIDAS_BASE[product];
  if (!base) return res.status(400).json({ error: `Unknown product: ${product}` });

  const p = rcParams;

  // Validate required params
  if (!Array.isArray(p.xSpans) || !Array.isArray(p.ySpans) || !Array.isArray(p.storyHeights))
    return res.status(400).json({ error: 'rcParams must include xSpans[], ySpans[], storyHeights[]' });

  try {
    const geo = buildRCGeometry(p);
    const steps = [];

    // Optional model clear
    if (clearFirst) {
      for (const ep of ['/db/cons', '/db/stld', '/db/elem', '/db/node', '/db/sect', '/db/matl'])
        await mDelete(base, apiKey, ep);
      steps.push('clear');
    }

    // 1. Unit system (tonf, cm)
    await mPut(base, apiKey, '/db/unit', payloadUnit('TONF', 'CM'));
    steps.push('unit');

    // 2. Material
    await mPut(base, apiKey, '/db/MATL', payloadMaterial(p.concGrade || 'C24'));
    steps.push('material');

    // 3. Sections (columns + beams)
    await mPut(base, apiKey, '/db/SECT', payloadSections(geo.sections));
    steps.push(`sections(${geo.sections.length})`);

    // 4. Nodes
    await mPut(base, apiKey, '/db/NODE', payloadNodes(geo.nodes));
    steps.push(`nodes(${geo.nodes.length})`);

    // 5. Elements
    await mPut(base, apiKey, '/db/ELEM', payloadElements(geo.elements));
    steps.push(`elements(${geo.elements.length})`);

    // 6. Story data
    await mPut(base, apiKey, '/db/STOR', payloadStories(geo.zCoords, p.diaphragm !== false));
    steps.push(`stories(${geo.nS})`);

    // 7. Support conditions
    await mPut(base, apiKey, '/db/CONS', payloadSupports(geo.baseNodes));
    steps.push(`supports(${geo.baseNodes.length})`);

    // 8. Load cases
    await mPut(base, apiKey, '/db/STLD', payloadLoadCases(p.loadCases));
    steps.push('loadCases');

    return res.status(200).json({
      success: true,
      summary: {
        nodes: geo.nodes.length,
        elements: geo.elements.length,
        sections: geo.sections.map(s => s.name),
        stories: geo.nS,
        baseNodes: geo.baseNodes.length,
        grid: `${geo.nX - 1}x${geo.nY - 1} bays, ${geo.nS} stories`
      },
      steps
    });

  } catch (err) {
    return res.status(500).json({ error: 'RC Building model generation failed', detail: err.message });
  }
};
