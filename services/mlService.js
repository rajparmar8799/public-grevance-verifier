const axios = require('axios')
const Complaint = require('../models/Complaint')
const DepartmentScore = require('../models/DepartmentScore')

// Called after field officer submits evidence
exports.verifyGrievance = async (grievanceId) => {
  const grievance = await Complaint.findById(grievanceId)
  if (!grievance) return

  // Calculate dept fraud rate for context
  const deptTotal = await Complaint.countDocuments({
    department: grievance.department,
    district: grievance.district,
    status: { $in: ['VERIFIED', 'FAILED', 'REOPENED'] }
  })
  const deptFailed = await Complaint.countDocuments({
    department: grievance.department,
    district: grievance.district,
    status: { $in: ['FAILED', 'REOPENED'] }
  })
  const deptFraudRate = deptTotal > 0 ? deptFailed / deptTotal : 0.3

  const ivrHour = grievance.evidence.ivr_called_at
    ? new Date(grievance.evidence.ivr_called_at).getHours()
    : 12

  const payload = {
    gps_match_flag:            grievance.evidence.gps_match_flag || 0,
    photo_uploaded:            grievance.evidence.photo_uploaded || 0,
    ivr_call_status:           grievance.evidence.ivr_call_status || 'NOT_CALLED',
    ivr_response:              grievance.evidence.ivr_response || 0,
    dept_historical_fraud_rate: parseFloat(deptFraudRate.toFixed(2)),
    ivr_call_hour:             ivrHour,
    grievance_reopen_count:    grievance.reopen_count || 0
  }

  let result
  try {
    const response = await axios.post(
      `${process.env.ML_API_URL || 'http://localhost:5001'}/verify`,
      payload,
      { timeout: 5000 }
    )
    result = response.data
  } catch (err) {
    console.error('[ML] Flask API unreachable — using fallback rules')
    result = fallbackVerify(payload)
  }

  // Determine final status
  const newStatus = result.reopen_flag === 1
    ? (result.verification_status === 'REOPENED' ? 'REOPENED' : 'FAILED')
    : 'VERIFIED'

  // Update grievance
  const updateData = {
    status: newStatus,
    'verification.status':      result.verification_status,
    'verification.reopen_flag': result.reopen_flag,
    'verification.confidence':  result.confidence,
    'verification.risk_score':  result.risk_score,
    'verification.reason':      result.reason,
    'verification.flags':       result.flags || [],
    'verification.verified_at': new Date()
  }

  if (result.reopen_flag === 1) {
    updateData.$inc = { reopen_count: 1 }
  }

  await Complaint.findByIdAndUpdate(grievanceId, updateData)

  // Update department quality score
  await updateDeptScore(grievance.department, grievance.district)

  console.log(`[ML] Grievance ${grievanceId} → ${newStatus} (risk: ${result.risk_score}%)`)
  return result
}

// Fallback if Flask ML is down
function fallbackVerify(data) {
  const flags = []
  let risk = 0

  if (data.gps_match_flag === 0)        { flags.push('GPS location mismatch'); risk += 35 }
  if (data.photo_uploaded === 0)        { flags.push('No photo evidence uploaded'); risk += 25 }
  if (data.ivr_response === 2)          { flags.push('Citizen disputed resolution'); risk += 30 }
  if (data.ivr_call_status === 'NOT_CALLED' || data.ivr_call_status === 'NO_RESPONSE') {
    flags.push('IVR confirmation missing'); risk += 20
  }
  if (data.ivr_call_hour >= 22 || data.ivr_call_hour <= 6) {
    flags.push('IVR call placed at unusual hour'); risk += 15
  }
  if (data.dept_historical_fraud_rate > 0.4) {
    flags.push('Department has high historical fraud rate'); risk += 10
  }

  risk = Math.min(risk, 100)
  const reopen = risk >= 50 ? 1 : 0
  const status = data.ivr_response === 2 ? 'REOPENED' : reopen === 1 ? 'FAILED' : 'VERIFIED'

  return {
    verification_status: status,
    reopen_flag: reopen,
    confidence: parseFloat((1 - risk/100).toFixed(2)),
    risk_score: risk,
    reason: flags.length > 0 ? flags[0] : 'All checks passed',
    flags
  }
}

async function updateDeptScore(department, district) {
  const grievances = await Complaint.find({
    department, district,
    status: { $in: ['VERIFIED', 'FAILED', 'REOPENED'] }
  })
  const total    = grievances.length
  const verified = grievances.filter(g => g.status === 'VERIFIED').length
  const failed   = grievances.filter(g => g.status === 'FAILED').length
  const reopened = grievances.filter(g => g.status === 'REOPENED').length
  const score    = total > 0 ? Math.round((verified / total) * 100) : 0

  await DepartmentScore.findOneAndUpdate(
    { department, district },
    { total_resolved: total, verified_count: verified, failed_count: failed,
      reopened_count: reopened, quality_score: score, last_updated: new Date() },
    { upsert: true, new: true }
  )
}
