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

  const { product, apiKey, lcNames, tables } = req.body || {};

  if (!product || !apiKey) {
    return res.status(400).json({ error: 'product and apiKey are required' });
  }

  const base = MIDAS_BASE[product];
  if (!base) {
    return res.status(400).json({ error: `Unknown product: ${product}. Use 'gen' or 'civil'.` });
  }

  try {
    // 해석 실행
    const analResponse = await fetch(`${base}/doc/anal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MAPI-Key': apiKey
      },
      body: JSON.stringify({})
    });

    const analData = await analResponse.json();
    if (!analResponse.ok) {
      return res.status(analResponse.status).json({ error: 'Analysis failed', detail: analData });
    }

    // 결과 테이블 조회
    const resultTables = {};
    if (tables && tables.length > 0) {
      for (const table of tables) {
        const tableResponse = await fetch(`${base}/post/table`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'MAPI-Key': apiKey
          },
          body: JSON.stringify({
            TableName: table,
            LoadCases: lcNames || []
          })
        });

        const tableData = await tableResponse.json();
        if (tableResponse.ok) {
          resultTables[table] = tableData;
        } else {
          resultTables[table] = { error: tableData };
        }
      }
    }

    return res.status(200).json({
      success: true,
      analysis: analData,
      results: resultTables
    });
  } catch (err) {
    return res.status(500).json({ error: 'Analysis request failed', detail: err.message });
  }
};
