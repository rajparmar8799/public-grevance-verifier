import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import pickle, os

df = pd.read_csv('dataset.csv')
df = df.fillna(0)

# Map IVR status to numbers
ivr_map = {'SUCCESS': 1, 'NO_RESPONSE': 0, 'FAILED': -1, 'NOT_CALLED': -1}
df['ivr_num'] = df['ivr_call_status'].map(ivr_map).fillna(0)

# Use enhanced features
features = ['gps_match_flag', 'photo_uploaded', 'ivr_num', 'ivr_response']
# Note: dept_fraud_rate, ivr_call_hour, reopen_count are passed at runtime
# They are not in training CSV so we train on base features
# The Flask API adds context scoring on top of ML prediction

X = df[features]
y = df['verification_status']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

preds = model.predict(X_test)
acc = accuracy_score(y_test, preds)
print(classification_report(y_test, preds))
print(f"Model trained. Accuracy: {acc*100:.2f}%")

pickle.dump(model, open('model.pkl', 'wb'))
print("Saved as model.pkl")
