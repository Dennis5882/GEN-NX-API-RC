const MIDAS_BASE = {
  gen:   'https://moa-engineers.midasit.com:443/gen',
  civil: 'https://moa-engineers.midasit.com:443/civil'
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function midasPut(base, apiKey, endpoint, payload) {
  const r = await fetch(`${base}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'MAPI-Key': apiKey },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`PUT ${endpoint} failed: ${JSON.stringify(data)}`);
  return data;
}

async function midasPost(base, apiKey, endpoint, payload) {
  const r = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'MAPI-Key': apiKey },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`POST ${endpoint} failed: ${JSON.stringify(data)}`);
  return data;
}

// ─── JSON payload builders ───────────────────────────────────────────────────

function buildAssign(items) {
  // items: array of { id, ...fields } or object { id: fields }
  if (Array.isArray(items)) {
    const assign = {};
    items.forEach((item, i) => {
      const { id, ...fields } = item;
      assign[String(id ?? i + 1)] = fields;
    });
    return { Assign: assign };
  }
  return { Assign: items };
}

function buildUnit(unit) {
  // unit: { DIST: "CM", FORCE: "TONF" }
  return { Assign: { '1': { DIST: unit.DIST, FORCE: unit.FORCE } } };
}

function buildStructureType(st) {
  // st: { STYP, MASS, bSELFWEIGHT, SMASS, GRAV, bALIGNBEAM }
  return {
    Assign: {
      '1': {
        STYP: st.STYP ?? 0,
        MASS: st.MASS ?? 0,
        bSELFWEIGHT: st.bSELFWEIGHT ?? false,
        SMASS: st.SMASS ?? 0,
        GRAV: st.GRAV ?? 9.806,
        bALIGNBEAM: st.bALIGNBEAM ?? false
      }
    }
  };
}

function buildFrameDefinition(fd) {
  // fd: { FRAMEX, FRAMEY, bAUTOKF, DT }
  return {
    Assign: {
      '1': {
        FRAMEX: fd.FRAMEX,
        FRAMEY: fd.FRAMEY,
        bAUTOKF: fd.bAUTOKF ?? false,
        DT: fd.DT
      }
    }
  };
}

function buildMaterials(materials) {
  // materials: [{ id, NAME, TYPE, STANDARD, DB, P_TYPE }]
  const assign = {};
  materials.forEach(m => {
    assign[String(m.id)] = {
      TYPE: m.TYPE,
      NAME: m.NAME,
      PARAM: [{ P_TYPE: m.P_TYPE ?? 0, STANDARD: m.STANDARD, DB: m.DB }]
    };
  });
  return { Assign: assign };
}

function buildDesignMaterials(dms) {
  // dms: [{ id, TYPE, NAME, CODENAME, CODEMATLNAME, C_FC, REBAR_CODE, MAIN_REBAR, MAIN_FY, SUB_REBAR, SUB_FY }]
  const assign = {};
  dms.forEach(d => {
    assign[String(d.id)] = {
      TYPE: d.TYPE,
      NAME: d.NAME,
      DATA1: {
        CODENAME: d.CODENAME,
        CODEMATLNAME: d.CODEMATLNAME,
        DESIGN: {
          C_FC: d.C_FC,
          C_FCI: d.C_FCI ?? +(d.C_FC * 0.7).toFixed(4)
        }
      },
      REBAR_CODENAME: d.REBAR_CODE,
      MAINREBAR_REBARNAME: d.MAIN_REBAR,
      SUBREBAR_REBARNAME: d.SUB_REBAR,
      MAINREBAR_B_FY: d.MAIN_FY,
      SUBREBAR_B_FY: d.SUB_FY
    };
  });
  return { Assign: assign };
}

function buildSections(sections) {
  // sections: array from beam or column sheet
  // Each: { id, NAME, SECTTYPE, SHAPE, DATATYPE, H, B, bSHEAR }
  const assign = {};
  sections.forEach(s => {
    assign[String(s.id)] = {
      SECTTYPE: s.SECTTYPE,
      NAME: s.NAME,
      SHAPE: s.SHAPE,
      BEFORE: {
        I: {
          bSHAPE: true,
          SHAPE: s.SHAPE,
          DATATYPE: s.DATATYPE ?? 1,
          SIZE: [s.H ?? 0, s.B ?? 0]
        }
      },
      bSHEAR: s.bSHEAR ?? true
    };
  });
  return { Assign: assign };
}

function buildStories(stories) {
  // stories: [{ id, STORY_NAME, STORY_LEVEL, bFLOOR_DIAPHRAGM,
  //             WIND_FLOOR_WIDTH_X, WIND_FLOOR_WIDTH_Y, WIND_CENTER_X, WIND_CENTER_Y,
  //             WIND_ECCENT_X, WIND_ECCENT_Y, SEIS_ACC_ECCENT_X, SEIS_ACC_ECCENT_Y,
  //             SEIS_INHERENT_ECCENT_X, SEIS_INHERENT_ECCENT_Y,
  //             SEIS_TORSIONAL_AMP_FACTOR_X, SEIS_TORSIONAL_AMP_FACTOR_Y }]
  const assign = {};
  stories.forEach(s => {
    assign[String(s.id)] = {
      STORY_NAME:               s.STORY_NAME,
      STORY_LEVEL:              s.STORY_LEVEL,
      bFLOOR_DIAPHRAGM:         s.bFLOOR_DIAPHRAGM ?? true,
      WIND_FLOOR_WIDTH_X:       s.WIND_FLOOR_WIDTH_X ?? 0,
      WIND_FLOOR_WIDTH_Y:       s.WIND_FLOOR_WIDTH_Y ?? 0,
      WIND_CENTER_X:            s.WIND_CENTER_X ?? 0,
      WIND_CENTER_Y:            s.WIND_CENTER_Y ?? 0,
      WIND_ECCENT_X:            s.WIND_ECCENT_X ?? 0,
      WIND_ECCENT_Y:            s.WIND_ECCENT_Y ?? 0,
      SEIS_ACC_ECCENT_X:        s.SEIS_ACC_ECCENT_X ?? 0,
      SEIS_ACC_ECCENT_Y:        s.SEIS_ACC_ECCENT_Y ?? 0,
      SEIS_INHERENT_ECCENT_X:   s.SEIS_INHERENT_ECCENT_X ?? 0,
      SEIS_INHERENT_ECCENT_Y:   s.SEIS_INHERENT_ECCENT_Y ?? 0,
      SEIS_TORSIONAL_AMP_FACTOR_X: s.SEIS_TORSIONAL_AMP_FACTOR_X ?? 0,
      SEIS_TORSIONAL_AMP_FACTOR_Y: s.SEIS_TORSIONAL_AMP_FACTOR_Y ?? 0
    };
  });
  return { Assign: assign };
}

function buildNodes(nodes) {
  // nodes: [{ id, X, Y, Z }]
  const assign = {};
  nodes.forEach(n => {
    assign[String(n.id)] = { X: n.X, Y: n.Y, Z: n.Z };
  });
  return { Assign: assign };
}

function buildSupports(supports) {
  // supports: [{ nodeId, CONSTRAINT }]  e.g. CONSTRAINT: "111111"
  const assign = {};
  supports.forEach(s => {
    assign[String(s.nodeId)] = {
      ITEMS: [{ ID: 0, GROUP_NAME: '', CONSTRAINT: s.CONSTRAINT }]
    };
  });
  return { Assign: assign };
}

function buildPanelZone(pze) {
  // pze: { OPT_OFFSET, OFFS_FACTOR, OUTPUT_POSITION }
  return {
    Assign: {
      '1': {
        OPT_OFFSET:       pze.OPT_OFFSET ?? false,
        OFFS_FACTOR:      pze.OFFS_FACTOR ?? 1.0,
        OUTPUT_POSITION:  pze.OUTPUT_POSITION ?? 0
      }
    }
  };
}

function buildGroups(groups) {
  // groups: [{ id, NAME, N_LIST: [], E_LIST: [] }]
  const assign = {};
  groups.forEach(g => {
    assign[String(g.id)] = {
      NAME:   g.NAME,
      P_TYPE: 0,
      N_LIST: g.N_LIST ?? [],
      E_LIST: g.E_LIST ?? []
    };
  });
  return { Assign: assign };
}

function buildLoadCases(loadCases) {
  // loadCases: [{ id, NO, NAME, TYPE, DESC }]
  // TYPE mapping: EV -> USER, others passthrough
  const assign = {};
  loadCases.forEach(lc => {
    const type = lc.TYPE === 'EV' ? 'USER' : lc.TYPE;
    assign[String(lc.id)] = {
      NO:   lc.NO ?? Number(lc.id),
      NAME: lc.NAME,
      TYPE: type,
      DESC: lc.DESC ?? ''
    };
  });
  return { Assign: assign };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { product, apiKey, params } = req.body || {};
  if (!product || !apiKey || !params) {
    return res.status(400).json({ error: 'product, apiKey, and params are required' });
  }

  const base = MIDAS_BASE[product];
  if (!base) return res.status(400).json({ error: `Unknown product: ${product}` });

  const results = {};

  try {
    // 1. Unit System
    if (params.unit) {
      results.unit = await midasPut(base, apiKey, '/db/unit', buildUnit(params.unit));
    }

    // 2. Structure Type
    if (params.structureType) {
      results.structureType = await midasPut(base, apiKey, '/db/styp', buildStructureType(params.structureType));
    }

    // 3. Definition of Frame
    if (params.frameDefinition) {
      results.frameDefinition = await midasPut(base, apiKey, '/db/dctl', buildFrameDefinition(params.frameDefinition));
    }

    // 4. Material DB
    if (params.materials?.length) {
      results.materials = await midasPut(base, apiKey, '/db/MATL', buildMaterials(params.materials));
    }

    // 5. Design Concrete Material
    if (params.designMaterials?.length) {
      results.designMaterials = await midasPut(base, apiKey, '/db/MATD', buildDesignMaterials(params.designMaterials));
    }

    // 6. Beam Sections
    if (params.beamSections?.length) {
      results.beamSections = await midasPut(base, apiKey, '/db/sect', buildSections(params.beamSections));
    }

    // 7. Column Sections (merged into same endpoint if both provided)
    if (params.columnSections?.length) {
      results.columnSections = await midasPut(base, apiKey, '/db/sect', buildSections(params.columnSections));
    }

    // 8. Story Data
    if (params.stories?.length) {
      results.stories = await midasPut(base, apiKey, '/db/STOR', buildStories(params.stories));
    }

    // 9. Node Coordinates
    if (params.nodes?.length) {
      results.nodes = await midasPut(base, apiKey, '/db/NODE', buildNodes(params.nodes));
    }

    // 10. Structure Groups
    if (params.groups?.length) {
      results.groups = await midasPut(base, apiKey, '/db/GRUP', buildGroups(params.groups));
    }

    // 11. Support Conditions (Boundary)
    if (params.supports?.length) {
      results.supports = await midasPut(base, apiKey, '/db/CONS', buildSupports(params.supports));
    }

    // 12. Panel Zone Effect
    if (params.panelZone) {
      results.panelZone = await midasPut(base, apiKey, '/db/pzef', buildPanelZone(params.panelZone));
    }

    // 13. Static Load Cases
    if (params.loadCases?.length) {
      results.loadCases = await midasPut(base, apiKey, '/db/STLD', buildLoadCases(params.loadCases));
    }

    // 14. Soft Story Check Parameter (RunSetting)
    if (params.softStory) {
      results.softStory = await midasPost(base, apiKey, '/ope/STORY_IRR_PARAM', {
        Argument: {
          COUNTRY_CODE:            params.softStory.COUNTRY_CODE           ?? 'NSR-10',
          STORY_DRIFT_METHOD:      params.softStory.STORY_DRIFT_METHOD     ?? 'Max. Drift of All Vertical Elements',
          STORY_STIFFNESS_METHOD:  params.softStory.STORY_STIFFNESS_METHOD ?? 'Story Shear / Story Drift'
        }
      });
    }

    return res.status(200).json({ success: true, results });

  } catch (err) {
    return res.status(500).json({ error: 'Model generation failed', detail: err.message });
  }
};
