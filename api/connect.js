const MIDAS_BASE = {
  gen:   'https://moa-engineers.midasit.com:443/gen',
  civil: 'https://moa-engineers.midasit.com:443/civil'
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, apiKey } = req.body || {};

  if (!product || !apiKey) {
    return res.status(400).json({ error: 'product and apiKey are required' });
  }

  const base = MIDAS_BASE[product];
  if (!base) {
    return res.status(400).json({ error: `Unknown product: ${product}. Use 'gen' or 'civil'.` });
  }

  try {
    const response = await fetch(`${base}/db/node`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'MAPI-Key': apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'MIDAS connection failed', detail: data });
    }

    return res.status(200).json({ success: true, message: 'MIDAS connected', data });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
