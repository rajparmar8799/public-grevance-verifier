// IVR Service — Twilio integration placeholder
// Replace the triggerCall function body when Twilio credentials are ready

exports.triggerCall = async (phoneNumber, grievanceId) => {
  // ─── TWILIO IMPLEMENTATION GOES HERE ───────────────────────────────
  // When ready, install: npm install twilio
  // Add to .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
  //
  // const twilio = require('twilio')
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  // const call = await client.calls.create({
  //   to: phoneNumber,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   url: `${process.env.BACKEND_URL}/api/ivr/outbound?grievanceId=${grievanceId}`
  // })
  // ────────────────────────────────────────────────────────────────────

  // DEMO MODE (active until Twilio is configured)
  console.log(`[IVR PLACEHOLDER] Would call ${phoneNumber} for grievance ${grievanceId}`)
  return { demo: true, message: 'IVR not yet configured' }
}

// Gujarati TwiML script — ready for when Twilio is added
exports.getGujaratiTwiML = (grievanceId) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/api/ivr/response?grievanceId=${grievanceId}" method="POST" timeout="10">
    <Say language="gu-IN" voice="Polly.Aditi">
      નમસ્તે. આ ગુજરાત સ્વાગત પોર્ટલ તરફથી સ્વચાલિત કૉલ છે.
      તમારી ફરિયાદ પર કાર્યવાહી કરવામાં આવી છે.
      જો તમારી સમસ્યા હલ થઈ ગઈ હોય, તો એક દબાવો.
      જો સમસ્યા હજી હલ નથી થઈ, તો બે દબાવો.
    </Say>
  </Gather>
  <Say language="gu-IN" voice="Polly.Aditi">કોઈ જવાબ મળ્યો નથી. આભાર.</Say>
</Response>`
}
