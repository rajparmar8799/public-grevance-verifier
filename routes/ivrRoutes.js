/**
 * routes/ivrRoutes.js
 * ─────────────────────────────────────────────────────────────────────────
 * Public Twilio webhook endpoints — NO session/auth middleware.
 * Twilio calls these directly; not the browser.
 *
 * 3-Step verification flow handled here:
 *   GET  /api/ivr/twiml    ← Twilio fetches script to play to complainant
 *   POST /api/ivr/response ← Twilio POSTs digit pressed by complainant
 *   POST /api/ivr/status   ← Twilio POSTs final call disposition
 */

const express    = require('express');
const router     = express.Router();
const Complaint  = require('../models/Complaint');
const ivrService = require('../services/ivrService');
const mlService  = require('../services/mlService');

const BACKEND_URL = () => (process.env.BACKEND_URL || '').replace(/\/$/, '');

// ─── Helper: trigger ML verification if both evidence signals are ready ──────
async function maybeTriggerML(grievanceId) {
  const grievance = await Complaint.findById(grievanceId);
  if (!grievance) return;

  const ivrDone   = ['SUCCESS', 'DISPUTED', 'NO_RESPONSE', 'FAILED'].includes(
                      grievance.evidence.ivr_call_status
                    );
  const photoReady = grievance.evidence.photo_uploaded === 1;

  console.log(
    `[IVR→ML] Grievance ${grievanceId} | photo:${photoReady} | ivrDone:${ivrDone} | ivr_status:${grievance.evidence.ivr_call_status}`
  );

  if (ivrDone) {
    // Run ML regardless of photo — ML fallback handles missing evidence
    console.log(`[IVR→ML] Triggering ML verification for ${grievanceId}`);
    await mlService.verifyGrievance(grievanceId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET or POST /api/ivr/twiml?grievanceId=...
router.all('/twiml', async (req, res) => {
  const { grievanceId } = req.query;

  if (!grievanceId) {
    res.type('text/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="gu-IN" voice="Google.gu-IN-Wavenet-B">અમાન્ય વિનંતી. આભાર.</Say></Response>`);
  }

  // Update status to RINGING so dashboard shows live state
  await Complaint.findByIdAndUpdate(grievanceId, {
    'evidence.ivr_call_status': 'RINGING'
  }).catch(() => {});

  const twiml = ivrService.getGujaratiTwiML(grievanceId, BACKEND_URL());
  res.type('text/xml');
  res.send(twiml);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ivr/response?grievanceId=...
// Twilio POSTs here after the complainant presses a digit.
// Body includes: Digits (the key pressed), CallSid, CallStatus
// ─────────────────────────────────────────────────────────────────────────────
router.post('/response', async (req, res) => {
  const { grievanceId } = req.query;
  const digit = (req.body.Digits || '').trim();

  console.log(`[IVR RESPONSE] grievance=${grievanceId} digit=${digit}`);

  if (!grievanceId) {
    res.type('text/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error.</Say></Response>`);
  }

  let twimlReply;

  if (digit === '1') {
    // ── Citizen CONFIRMED resolution ──────────────────────────────────────
    await Complaint.findByIdAndUpdate(grievanceId, {
      'evidence.ivr_response':    1,
      'evidence.ivr_call_status': 'SUCCESS'
    });
    console.log(`[IVR] Grievance ${grievanceId} → CONFIRMED by citizen`);
    twimlReply = ivrService.getConfirmedTwiML();

  } else if (digit === '2') {
    // ── Citizen DISPUTED — auto-reopen triggered ──────────────────────────
    // Single atomic update: $set for fields + $inc for reopen_count
    await Complaint.findByIdAndUpdate(grievanceId, {
      $set: {
        'evidence.ivr_response':    2,
        'evidence.ivr_call_status': 'DISPUTED',
        status:                     'REOPENED'
      },
      $inc: { reopen_count: 1 }
    });
    console.log(`[IVR] Grievance ${grievanceId} → DISPUTED by citizen — auto-reopened`);
    twimlReply = ivrService.getDisputedTwiML();

  } else if (digit === '3') {
    // ── Citizen wants to REPEAT the message ──────────────────────────────
    twimlReply = ivrService.getRepeatTwiML(grievanceId, BACKEND_URL());
    res.type('text/xml');
    return res.send(twimlReply);

  } else {
    // ── Unrecognised digit — treat as no response ─────────────────────────
    await Complaint.findByIdAndUpdate(grievanceId, {
      'evidence.ivr_response':    0,
      'evidence.ivr_call_status': 'NO_RESPONSE'
    });
    twimlReply = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="gu-IN" voice="alice">અમાન્ય વિકલ્પ. ફરી પ્રયાસ કરો. આભાર.</Say>
</Response>`;
  }

  // ── After recording response, trigger ML if conditions met ───────────────
  if (digit !== '3') {
    setImmediate(() => maybeTriggerML(grievanceId).catch(console.error));
  }

  res.type('text/xml');
  res.send(twimlReply);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ivr/status?grievanceId=...
// Twilio POSTs call completion status here.
// Handles: no-answer, busy, failed, voicemail detected.
// This is the fallback that fires if /response was never called.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/status', async (req, res) => {
  const { grievanceId }  = req.query;
  const callStatus       = (req.body.CallStatus    || '').toLowerCase();
  const answeredBy       = (req.body.AnsweredBy    || '').toLowerCase(); // 'human' | 'machine_start' etc.

  console.log(`[IVR STATUS] grievance=${grievanceId} callStatus=${callStatus} answeredBy=${answeredBy}`);

  if (!grievanceId) return res.sendStatus(200);

  try {
    const grievance = await Complaint.findById(grievanceId);
    if (!grievance) return res.sendStatus(200);

    // Only update if IVR hasn't already been responded to
    const alreadyResponded = ['SUCCESS', 'DISPUTED'].includes(
      grievance.evidence.ivr_call_status
    );

    if (!alreadyResponded) {
      let ivrStatus = 'NO_RESPONSE';

      if (['no-answer', 'busy', 'canceled'].includes(callStatus)) {
        ivrStatus = 'NO_RESPONSE';
      } else if (callStatus === 'failed') {
        ivrStatus = 'FAILED';
      } else if (answeredBy.includes('machine')) {
        // Voicemail — treat as no human confirmation
        ivrStatus = 'NO_RESPONSE';
      }
      // 'completed' without hitting /response → no keypress → NO_RESPONSE

      await Complaint.findByIdAndUpdate(grievanceId, {
        'evidence.ivr_call_status': ivrStatus
      });

      console.log(`[IVR STATUS] Updated grievance ${grievanceId} → ivr_call_status=${ivrStatus}`);

      // Trigger ML verification with available evidence
      setImmediate(() => maybeTriggerML(grievanceId).catch(console.error));
    }
  } catch (err) {
    console.error('[IVR STATUS] Error:', err.message);
  }

  // Always return 200 to Twilio
  res.sendStatus(200);
});

module.exports = router;
