"""
app.py — Flask REST ML Microservice
Runs on port 5001, called by the Node.js backend proxy.
- Ephemeral PKL Lifecycles (start-session & stop-session endpoints).
- YuNet + SFace ArcFace model with strict 0.48 threshold.
"""
import sys
import os
import base64
import ssl
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from face_engine import FaceEngine

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

app = Flask(__name__)
CORS(app, origins=["http://localhost:5000", "http://127.0.0.1:5000"])

engine = FaceEngine()

import urllib.request
from datetime import datetime

def _decode_base64_image(b64_string: str):
    """Decode a base64 image string to a BGR OpenCV Mat."""
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",", 1)[1]
        img_data = base64.b64decode(b64_string)
        np_arr = np.frombuffer(img_data, np.uint8)
        img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img_bgr
    except Exception as e:
        return None


def _fetch_image_from_url(url: str):
    """Fetch an image from an HTTP/Cloudinary URL and return as OpenCV BGR image."""
    try:
        if not url or not url.strip():
            return None
        clean_url = url.strip()
        if clean_url.startswith('/'):
            clean_url = f"http://localhost:5000{clean_url}"
        req = urllib.request.Request(
            clean_url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            img_bytes = resp.read()
            np_arr = np.frombuffer(img_bytes, np.uint8)
            img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img_bgr
    except Exception as e:
        print(f"[WARNING] Error fetching photo from URL ({url}): {e}")
        return None


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "High-Precision ML Face Recognition Service",
        "models": "YuNet + SFace (ArcFace)",
        "features": ["CLAHE Illumination Normalization", "Centroid Multi-Vector Aggregation", "Multi-Face Real-Time Detection", "Laplacian Blur Filtering"],
        "threshold": 0.48
    })


# ─── POST /api/start-session ──────────────────────────────────────────────────
@app.route("/api/start-session", methods=["POST"])
def start_session():
    data = request.get_json() or {}
    class_id = data.get("classId") or data.get("class_id")
    if not class_id:
        return jsonify({"error": "classId required"}), 400

    res = engine.start_session(class_id)
    return jsonify(res)


# ─── POST /api/stop-session ───────────────────────────────────────────────────
@app.route("/api/stop-session", methods=["POST"])
def stop_session():
    data = request.get_json() or {}
    class_id = data.get("classId") or data.get("class_id")
    if not class_id:
        return jsonify({"error": "classId required"}), 400

    res = engine.stop_session(class_id)
    return jsonify(res)


# ─── POST /api/enroll-face ────────────────────────────────────────────────────
@app.route("/api/enroll-face", methods=["POST"])
def enroll_face():
    data = request.get_json()
    class_id = data.get("classId") or data.get("class_id")
    roll_number = data.get("rollNumber") or data.get("roll_number")
    name = data.get("studentName") or data.get("name", "Unknown")
    department = data.get("department", "General")
    image_b64 = data.get("image_base64")

    if not all([class_id, roll_number, image_b64]):
        return jsonify({"error": "classId, rollNumber, image_base64 required"}), 400

    img_bgr = _decode_base64_image(image_b64)
    if img_bgr is None:
        return jsonify({"error": "Invalid image encoding"}), 400

    success, msg, embedding = engine.enroll_student(class_id, roll_number, name, department, img_bgr)

    if success:
        students = engine.get_class_students(class_id)
        return jsonify({
            "success": True,
            "message": msg,
            "embedding": embedding,
            "vector_count": len(students),
            "class_id": class_id.upper(),
        })
    return jsonify({"success": False, "error": msg}), 422


# ─── POST /api/load-class-db ──────────────────────────────────────────────────
@app.route("/api/load-class-db", methods=["POST"])
def load_class_db():
    try:
        data = request.get_json() or {}
        class_id = data.get("classId") or data.get("class_id")
        if not class_id:
            return jsonify({"error": "classId required"}), 400

        cid = class_id.upper()
        db = engine.load_class_db(cid)
        students_data = data.get("students", [])

        new_embeddings = []

        if students_data:
            for s in students_data:
                roll = s.get("rollNumber", "").strip().upper()
                if not roll:
                    continue

                name = s.get("name", "Student")
                dept = s.get("department", "General")
                features = s.get("features", [])

                if isinstance(features, list) and len(features) > 0 and isinstance(features[0], (int, float)):
                    features = [features]

                if not features:
                    img_bgr = None
                    if s.get("image_base64"):
                        img_bgr = _decode_base64_image(s["image_base64"])
                    elif s.get("photoUrl") or s.get("photo_url"):
                        photo_url = s.get("photoUrl") or s.get("photo_url")
                        img_bgr = _fetch_image_from_url(photo_url)

                    if img_bgr is not None:
                        feat, _, msg = engine.extract_feature(img_bgr)
                        if feat is not None:
                            feat_list = feat.tolist()
                            features = [feat_list]
                            new_embeddings.append({
                                "rollNumber": roll,
                                "embedding": feat_list
                            })

                if features:
                    db["STUDENTS"][roll] = {
                        "name": name,
                        "department": dept,
                        "features": features,
                        "enrolled_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
            engine.save_class_db(cid, db)

        students = engine.get_class_students(cid)
        engine._get_matrix(cid)
        return jsonify({
            "success": True,
            "class_id": cid,
            "student_count": len(students),
            "students": students,
            "new_embeddings": new_embeddings
        })
    except Exception as e:
        print(f"[ERROR] Exception in /api/load-class-db: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ─── POST /api/process-frame ──────────────────────────────────────────────────
@app.route("/api/process-frame", methods=["POST"])
def process_frame():
    data = request.get_json()
    class_id = data.get("classId") or data.get("class_id")
    frame_b64 = data.get("frame_base64")

    if not class_id or not frame_b64:
        return jsonify({"error": "classId and frame_base64 required"}), 400

    img_bgr = _decode_base64_image(frame_b64)
    if img_bgr is None:
        return jsonify({"matched": False, "reason": "Invalid frame encoding"}), 400

    result = engine.match_face(class_id, img_bgr)
    return jsonify(result)


# ─── GET /api/class-students/:class_id ────────────────────────────────────────
@app.route("/api/class-students/<class_id>", methods=["GET"])
def class_students(class_id):
    students = engine.get_class_students(class_id)
    return jsonify({"class_id": class_id.upper(), "students": students, "count": len(students)})


# ─── DELETE /api/class-students/<class_id>/<roll_number> ─────────────────────
@app.route("/api/class-students/<class_id>/<roll_number>", methods=["DELETE"])
def delete_student(class_id, roll_number):
    success, msg = engine.delete_student_from_class(class_id, roll_number)
    if success:
        return jsonify({"success": True, "message": msg})
    return jsonify({"success": False, "error": msg}), 404


# ─── DELETE /api/class-db/<class_id> ─────────────────────────────────────────
@app.route("/api/class-db/<class_id>", methods=["DELETE"])
def delete_class_db(class_id):
    removed = engine.delete_class_db(class_id)
    if removed:
        return jsonify({"success": True, "message": f"Class DB {class_id.upper()} deleted"})
    return jsonify({"success": False, "error": "Class DB not found"}), 404


# ─── POST /api/clear-all-dbs ─────────────────────────────────────────────────
@app.route("/api/clear-all-dbs", methods=["POST", "DELETE"])
def clear_all_dbs():
    count = engine.clear_all_dbs()
    return jsonify({"success": True, "message": f"All {count} class PKL databases purged", "count": count})


if __name__ == "__main__":
    port = int(os.environ.get("ML_PORT", 5001))
    print(f"\n[ML SERVICE] Smart Attendance ML Service running on http://127.0.0.1:{port}")
    print(f"             YuNet + SFace ONNX models ready (Threshold: 0.48)\n")
    app.run(host="127.0.0.1", port=port, debug=False)
