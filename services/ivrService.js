const Complaint = require("../models/Complaint");

let _twilioClient = null;

function getTwilioClient() {
  if (_twilioClient) return _twilioClient;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token || sid.startsWith("ACxxxxxx")) {
    return null;
  }

  try {
    const twilio = require("twilio");
    _twilioClient = twilio(sid, token);
    return _twilioClient;
  } catch (err) {
    console.error("[IVR] Failed to initialise Twilio client:", err.message);
    return null;
  }
}

function toE164(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  // Indian number: if 10 digits, prepend +91
  if (digits.length === 10) return `+91${digits}`;
  // Already has country code (12 digits starting with 91)
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  // Already in E.164-style length
  if (digits.length >= 11) return `+${digits}`;
  return null;
}

/**
 * triggerCall — places an outbound Twilio call to the complainant.
 * Called by department route when grievance is marked resolved.
 *
 * @param {string} phoneNumber   - Raw phone from complaint record
 * @param {string} grievanceId   - MongoDB ObjectId string
 * @returns {object}             - { success, callSid } or { success: false, reason }
 */
exports.triggerCall = async (phoneNumber, grievanceId) => {
  const ivrEnabled =
    (process.env.IVR_ENABLED || "true").toLowerCase() !== "false";

  if (!ivrEnabled) {
    console.log(`[IVR] Skipped — IVR_ENABLED=false (grievance ${grievanceId})`);
    return { success: false, reason: "IVR_DISABLED" };
  }

  const client = getTwilioClient();
  if (!client) {
    console.warn(
      `[IVR] Twilio not configured — skipping call for grievance ${grievanceId}`,
    );
    return { success: false, reason: "TWILIO_NOT_CONFIGURED" };
  }

  const toNumber = toE164(phoneNumber);
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const backendUrl = (process.env.BACKEND_URL || "").replace(/\/$/, "");

  if (!toNumber) {
    console.error(
      `[IVR] Invalid phone number "${phoneNumber}" for grievance ${grievanceId}`,
    );
    return { success: false, reason: "INVALID_PHONE" };
  }

  if (!backendUrl || backendUrl.includes("your-ngrok")) {
    console.error(
      "[IVR] BACKEND_URL is not configured — Twilio cannot reach webhooks",
    );
    return { success: false, reason: "BACKEND_URL_NOT_CONFIGURED" };
  }

  try {
    const twimlUrl = `${backendUrl}/api/ivr/twiml?grievanceId=${grievanceId}`;
    const statusCbUrl = `${backendUrl}/api/ivr/status?grievanceId=${grievanceId}`;

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: twimlUrl,
      statusCallback: statusCbUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed", "no-answer", "failed", "busy"],
      timeout: 30,
      machineDetection: "Enable",
    });

    console.log(
      `[IVR] Call initiated — SID: ${call.sid} → ${toNumber} (grievance ${grievanceId})`,
    );

    await Complaint.findByIdAndUpdate(grievanceId, {
      "evidence.ivr_call_sid": call.sid,
      "evidence.ivr_call_status": "CALLING",
      "evidence.ivr_called_at": new Date(),
    });

    return { success: true, callSid: call.sid };
  } catch (err) {
    console.error(
      `[IVR] Twilio API error for grievance ${grievanceId}:`,
      err.message,
    );

    // Twilio error 21608 = unverified number on trial account
    const reason = err.message || "TWILIO_ERROR";

    await Complaint.findByIdAndUpdate(grievanceId, {
      "evidence.ivr_call_status": "FAILED",
      "evidence.ivr_called_at": new Date(),
    }).catch(() => {});
    return { success: false, reason };
  }
};

exports.getGujaratiTwiML = (grievanceId, backendUrl) => {
  const responseUrl = `${backendUrl}/api/ivr/response?grievanceId=${grievanceId}`;
  const audioUrl = `${backendUrl}/audio/ivr_message.mp3`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${responseUrl}" method="POST" timeout="10">
    <Play>${audioUrl}</Play>
  </Gather>
</Response>`;
};

/**
 * getRepeatTwiML — replays the main prompt when digit 3 is pressed.
 */
exports.getRepeatTwiML = (grievanceId, backendUrl) => {
  return exports.getGujaratiTwiML(grievanceId, backendUrl);
};

/**
 * getConfirmedTwiML — plays after citizen presses 1 (resolution confirmed).
 */
exports.getConfirmedTwiML = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-IN" voice="alice">Thank you. Your confirmation has been recorded. Jan Vishwas Portal.</Say>
</Response>`;
};

/**
 * getDisputedTwiML — plays after citizen presses 2 (dispute, auto-reopen).
 */
exports.getDisputedTwiML = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-IN" voice="alice">Your complaint has been reopened on the Jan Vishwas Portal. The department will take action again. Thank you.</Say>
</Response>`;
};
