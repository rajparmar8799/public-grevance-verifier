from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, numpy as np
import os

app = Flask(__name__)
CORS(app)
model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
try:
    model = pickle.load(open(model_path, 'rb'))
except FileNotFoundError:
    print("Warning: model.pkl not found, verify endpoint will fail unless fallback is used.")
    model = None

ivr_map = {'SUCCESS': 1, 'NO_RESPONSE': 0, 'FAILED': -1, 'NOT_CALLED': -1}

def build_flags(gps, photo, ivr_status, ivr_response, dept_fraud_rate, ivr_hour, reopen_count):
    flags = []
    if gps == 0:               flags.append('GPS location did not match grievance address')
    if photo == 0:             flags.append('No photo evidence uploaded by field officer')
    if ivr_response == 2:      flags.append('Citizen disputed resolution via IVR')
    if ivr_status in ['NO_RESPONSE','NOT_CALLED',-1]:
                               flags.append('IVR confirmation not received from citizen')
    if ivr_hour is not None and (ivr_hour >= 22 or ivr_hour <= 6):
                               flags.append(f'IVR call placed at odd hour ({ivr_hour}:00)')
    if dept_fraud_rate > 0.4:  flags.append(f'Department fraud rate high ({round(dept_fraud_rate*100)}%)')
    if reopen_count >= 2:      flags.append(f'Grievance previously reopened {reopen_count} times')
    return flags

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'model': 'loaded' if model else 'missing'})

@app.route('/verify', methods=['POST'])
def verify():
    d = request.json

    gps          = int(d.get('gps_match_flag', 0))
    photo        = int(d.get('photo_uploaded', 0))
    ivr_status   = d.get('ivr_call_status', 'NOT_CALLED')
    ivr_response = int(d.get('ivr_response', 0))
    dept_fraud   = float(d.get('dept_historical_fraud_rate', 0.3))
    ivr_hour     = int(d.get('ivr_call_hour', 12)) if d.get('ivr_call_hour') is not None else 12
    reopen_count = int(d.get('grievance_reopen_count', 0))

    ivr_num = ivr_map.get(ivr_status, 0)

    ml_pred = "VERIFIED"
    ml_proba = 0.5
    
    if model:
        # Base ML prediction
        features = [[gps, photo, ivr_num, ivr_response]]
        try:
            ml_pred   = model.predict(features)[0]
            ml_proba  = max(model.predict_proba(features)[0])
        except Exception as e:
            print("ML prediction error:", e)

    # Context-based risk scoring on top of ML
    risk = 0
    if gps == 0:                                    risk += 35
    if photo == 0:                                  risk += 25
    if ivr_response == 2:                           risk += 30
    if ivr_status in ['NO_RESPONSE','NOT_CALLED']:  risk += 20
    if ivr_hour >= 22 or ivr_hour <= 6:             risk += 15
    if dept_fraud > 0.4:                            risk += 10
    if reopen_count >= 2:                           risk += 10
    risk = min(risk, 100)

    # Final verdict: ML prediction + risk override
    if ivr_response == 2:
        final = 'REOPENED'
    elif ml_pred == 'VERIFIED' and risk < 50:
        final = 'VERIFIED'
    elif risk >= 60:
        final = 'FAILED'
    else:
        final = ml_pred

    reopen_flag = 1 if final in ['FAILED','REOPENED'] else 0
    flags = build_flags(gps, photo, ivr_status, ivr_response, dept_fraud, ivr_hour, reopen_count)
    reason = flags[0] if flags else 'All evidence verified successfully'

    return jsonify({
        'verification_status': final,
        'reopen_flag':         reopen_flag,
        'confidence':          round(float(ml_proba), 2),
        'risk_score':          risk,
        'reason':              reason,
        'flags':               flags
    })

@app.route('/feature-importance')
def importance():
    if not model: return jsonify({})
    names = ['gps_match_flag','photo_uploaded','ivr_call_status','ivr_response']
    return jsonify(dict(zip(names, model.feature_importances_.tolist())))

if __name__ == '__main__':
    app.run(port=5001, debug=True)
