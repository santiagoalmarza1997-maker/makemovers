module.exports = async (req, res) => {
  // CORS & Header check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { fullName, phone, email, pickupLoc, destLoc, svcType, moveSize, moveDate } = body;

    if (!fullName || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Secure server-side GHL credentials
    const token = process.env.GHL_TOKEN || 'pit-5ec543a1-1d1b-4f5e-bb4a-aa495fa61096';
    const locationId = 'HjbOI2dRDzCa7UDvD8Ip';
    const pipelineId = 'ZQKBG4nphdYwcmPArzWa'; // Atlanta Pipeline
    const stageId = '05b142f0-4463-42c3-a9a6-1e01437469bd'; // Nuevo Lead Stage

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || fullName;
    const lastName = nameParts.slice(1).join(' ') || '';

    // 1. Create / Upsert Contact in GHL
    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: locationId,
        firstName: firstName,
        lastName: lastName,
        name: fullName,
        email: email || '',
        phone: phone,
        tags: ['Website Quote Lead', 'Top Movers Co']
      })
    });

    const contactData = await contactRes.json();
    const contactId = contactData?.contact?.id;

    // 2. Create Opportunity in Atlanta Pipeline under 'Nuevo Lead' stage
    let oppData = null;
    if (contactId) {
      const oppRes = await fetch('https://services.leadconnectorhq.com/opportunities/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pipelineId: pipelineId,
          locationId: locationId,
          name: `${fullName} - ${svcType || 'Move Quote'}`,
          pipelineStageId: stageId,
          status: 'open',
          contactId: contactId
        })
      });
      oppData = await oppRes.json();
    }

    return res.status(200).json({
      success: true,
      message: 'Quote request processed successfully',
      contactId: contactId,
      opportunityId: oppData?.opportunity?.id
    });
  } catch (err) {
    console.error('API Quote error:', err);
    return res.status(500).json({ error: 'Server processing error', details: err.message });
  }
};
