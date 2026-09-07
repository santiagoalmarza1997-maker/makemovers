module.exports = async (req, res) => {
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
    const { nombre, telefono, ciudad, tipo_rol, disponibilidad, email } = body;

    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }

    const token = process.env.GHL_TOKEN || 'pit-0ddb4848-1352-4819-a824-c1ef5ebb198c';
    const locationId = 'HjbOI2dRDzCa7UDvD8Ip';
    const pipelineId = '48KzekRWR26YdFtPYPkd'; // Pipeline Movers
    const stageId = '421718ac-a574-4d07-a530-a32b8a35675e'; // Stage 2: Asignado hoy

    const nameParts = nombre.trim().split(' ');
    const firstName = nameParts[0] || nombre;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Format phone cleanly to E.164 (+1XXXXXXXXXX)
    let cleanPhone = telefono.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `+1${cleanPhone}`;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      cleanPhone = `+${cleanPhone}`;
    } else if (cleanPhone.length > 0 && !cleanPhone.startsWith('+')) {
      cleanPhone = `+${cleanPhone}`;
    }

    // 1. Upsert Contact in GHL with tag "mover"
    const contactPayload = {
      locationId: locationId,
      firstName: firstName,
      lastName: lastName,
      name: nombre.trim(),
      phone: cleanPhone,
      city: ciudad || 'Atlanta',
      state: 'GA',
      country: 'US',
      tags: ['mover', 'mover:atlanta', 'candidato:mudanza']
    };

    if (email && email.includes('@')) {
      contactPayload.email = email;
    }

    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    const contactData = await contactRes.json();
    const contactId = contactData?.contact?.id || contactData?.id;

    // 2. Create Opportunity in Movers Pipeline under Stage 2 ('Asignado hoy') with monetaryValue: 0
    let oppData = null;
    if (contactId) {
      const oppPayload = {
        pipelineId: pipelineId,
        locationId: locationId,
        name: `Mover - ${nombre.trim()} (${tipo_rol || 'Helper'})`,
        pipelineStageId: stageId,
        status: 'open',
        monetaryValue: 0,
        contactId: contactId
      };

      const oppRes = await fetch('https://services.leadconnectorhq.com/opportunities/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(oppPayload)
      });
      oppData = await oppRes.json();
    }

    return res.status(200).json({
      success: true,
      message: 'Mover contact and opportunity created in Stage 2 successfully',
      contactId: contactId,
      opportunityId: oppData?.opportunity?.id,
      stageId: stageId
    });
  } catch (err) {
    console.error('API Recruit error:', err);
    return res.status(500).json({ error: 'Server processing error', details: err.message });
  }
};
