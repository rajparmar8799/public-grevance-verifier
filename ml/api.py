from flask import Flask, request, jsonify

app = Flask(__name__)


def fallback_verify(payload: dict) -> dict:
    gps_match_flag = int(payload.get('gps_match_flag', 0) or 0)
    photo_uploaded = int(payload.get('photo_uploaded', 0) or 0)
    ivr_call_status = (payload.get('ivr_call_status', 'NOT_CALLED') or 'NOT_CALLED').upper()
    ivr_response = int(payload.get('ivr_response', 0) or 0)
    dept_fraud = float(payload.get('dept_historical_fraud_rate', 0.3) or 0.3)
    ivr_call_hour = int(payload.get('ivr_call_hour', 12) or 12)

    flags = []
    risk = 0

    if gps_match_flag == 0:
        flags.append('GPS location mismatch')
        risk += 35
    if photo_uploaded == 0:
        flags.append('No photo evidence uploaded')
        risk += 25
    if ivr_response == 2:
        flags.append('Citizen disputed resolution')
        risk += 30
    if ivr_call_status in ('NOT_CALLED', 'NO_RESPONSE'):
        flags.append('IVR confirmation missing')
        risk += 20
    if ivr_call_hour >= 22 or ivr_call_hour <= 6:
        flags.append('IVR call placed at unusual hour')
        risk += 15
    if dept_fraud > 0.4:
        flags.append('Department has high historical fraud rate')
        risk += 10

    risk = min(risk, 100)
    reopen_flag = 1 if risk >= 50 else 0
    status = 'REOPENED' if ivr_response == 2 else ('FAILED' if reopen_flag == 1 else 'VERIFIED')

    return {
        'verification_status': status,
        'reopen_flag': reopen_flag,
        'confidence': round(1 - risk / 100, 2),
        'risk_score': risk,
        'reason': flags[0] if flags else 'All checks passed',
        'flags': flags,
    }


@app.get('/health')
def health():
    return jsonify({'ok': True})


@app.post('/verify')
def verify():
    payload = request.get_json(silent=True) or {}
    return jsonify(fallback_verify(payload))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
