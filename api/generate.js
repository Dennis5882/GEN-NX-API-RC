const MIDAS_BASE = {
  gen:   'https://moa-engineers.midasit.com:443/gen',
  civil: 'https://moa-engineers.midasit.com:443/civil'
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function midasPost(base, apiKey, endpoint, payload) {
  const response = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'MAPI-Key': apiKey
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, apiKey, params } = req.body || {};

  if (!product || !apiKey || !params) {
    return res.status(400).json({ error: 'product, apiKey, and params are required' });
  }

  const base = MIDAS_BASE[product];
  if (!base) {
    return res.status(400).json({ error: `Unknown product: ${product}. Use 'gen' or 'civil'.` });
  }

  try {
    const results = {};

    // 재료 (Material)
    if (params.material) {
      results.material = await midasPost(base, apiKey, '/db/matl', { Assign: params.material });
    }

    // 단면 (Section)
    if (params.section) {
      results.section = await midasPost(base, apiKey, '/db/sect', { Assign: params.section });
    }

    // 노드 (Node)
    if (params.nodes) {
      results.nodes = await midasPost(base, apiKey, '/db/node', { Assign: params.nodes });
    }

    // 요소 (Element)
    if (params.elements) {
      results.elements = await midasPost(base, apiKey, '/db/elem', { Assign: params.elements });
    }

    // 하중케이스 (Load Case)
    if (params.loadCases) {
      results.loadCases = await midasPost(base, apiKey, '/db/stld', { Assign: params.loadCases });
    }

    // 절점하중 (Nodal Load)
    if (params.nodalLoads) {
      results.nodalLoads = await midasPost(base, apiKey, '/db/nload', { Assign: params.nodalLoads });
    }

    // 요소하중 (Element Load)
    if (params.elementLoads) {
      results.elementLoads = await midasPost(base, apiKey, '/db/beamload', { Assign: params.elementLoads });
    }

    // 경계조건 (Boundary)
    if (params.supports) {
      results.supports = await midasPost(base, apiKey, '/db/bndr', { Assign: params.supports });
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ error: 'Model generation failed', detail: err.message });
  }
};
