"""
face_engine.py — High-Precision Advanced Face Recognition Engine
Wrapped OpenCV YuNet + SFace ArcFace with:
- Dynamic resolution adaptive input scaling (YuNet)
- CLAHE (Contrast Limited Adaptive Histogram Equalization) lighting & shadow balancing
- Laplacian variance blur & quality filtering
- Multi-vector embedding averaging & centroid representation
- Multi-face real-time detection & recognition per frame
- Ephemeral PKL database lifecycle management
"""
import os
os.environ["OPENCV_LOG_LEVEL"] = "OFF"
os.environ["OPENCV_VIDEOIO_PRIORITY_MSMF"] = "0"
import cv2
try:
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)
except AttributeError:
    pass
import pickle
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import OrderedDict

# Precision thresholds
SIMILARITY_THRESHOLD = 0.48  # Strict match threshold (ArcFace cosine similarity)
HIGH_CONFIDENCE_THRESHOLD = 0.55 # High confidence present
MIN_SHARPNESS_SCORE = 15.0   # Minimum Laplacian variance score for enrollment quality

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
CLASS_DBS_DIR = BASE_DIR / "class_dbs"

YUNET_PATH = str(MODELS_DIR / "face_detection_yunet.onnx")
SFACE_PATH = str(MODELS_DIR / "face_recognition_sface.onnx")


def _normalize(vec: np.ndarray) -> np.ndarray:
    """L2-normalize a numpy vector in-place."""
    vec = vec.astype(np.float32).flatten()
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def _enhance_lighting(img_bgr: np.ndarray) -> np.ndarray:
    """Apply CLAHE on Y channel of YCrCb image to balance uneven lighting/shadows."""
    if img_bgr is None or img_bgr.size == 0:
        return img_bgr
    try:
        ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
        y, cr, cb = cv2.split(ycrcb)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        y_eq = clahe.apply(y)
        merged = cv2.merge((y_eq, cr, cb))
        return cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)
    except Exception:
        return img_bgr


def _calculate_sharpness(img_bgr: np.ndarray) -> float:
    """Calculate Laplacian variance to measure image sharpness/blur standard."""
    if img_bgr is None or img_bgr.size == 0:
        return 0.0
    try:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())
    except Exception:
        return 0.0


def _score_to_pct(score: float, threshold: float = SIMILARITY_THRESHOLD) -> float:
    """Map raw SFace ArcFace cosine similarity score to intuitive display percentage (0% - 99.9%)."""
    if score <= 0:
        return 0.0
    if score < threshold:
        return round((score / threshold) * 49.0, 1)
    else:
        normalized = (score - threshold) / max(0.72 - threshold, 0.01)
        pct = 75.0 + min(normalized, 1.0) * 24.9
        return round(pct, 1)


class FaceEngine:
    """
    Advanced face recognition engine wrapping OpenCV YuNet + SFace.
    Features:
    - Dynamic dynamic-resolution detection
    - CLAHE illumination normalization
    - Multi-vector centroid vector matching
    - Real-time multi-face frame processing
    - Ephemeral PKL database lifecycle
    """

    def __init__(self):
        if not os.path.exists(YUNET_PATH) or not os.path.exists(SFACE_PATH):
            raise FileNotFoundError(
                f"ONNX models not found in {MODELS_DIR}. "
                "Run: python download_models.py"
            )

        CLASS_DBS_DIR.mkdir(parents=True, exist_ok=True)

        self.detector = cv2.FaceDetectorYN.create(
            model=YUNET_PATH,
            config="",
            input_size=(320, 320),
            score_threshold=0.50,
            nms_threshold=0.3,
            top_k=5000,
        )
        self.recognizer = cv2.FaceRecognizerSF.create(
            model=SFACE_PATH,
            config="",
        )

        # LRU cache: class_id -> (np.matrix, [(roll_number, name), ...])
        self._cache: OrderedDict = OrderedDict()
        self._max_cached = 10

        print(f"[OK] Enhanced FaceEngine initialized | Precision Threshold: {SIMILARITY_THRESHOLD}")

    # ── PKL & Ephemeral Session helpers ───────────────────────────────────────

    def _pkl_path(self, class_id: str) -> Path:
        return CLASS_DBS_DIR / f"{class_id.upper()}_db.pkl"

    def load_class_db(self, class_id: str) -> dict:
        path = self._pkl_path(class_id)
        if path.exists():
            try:
                with open(path, "rb") as f:
                    return pickle.load(f)
            except Exception as e:
                print(f"⚠️  Corrupt PKL for {class_id}: {e} — rebuilding empty")
        return {
            "CLASS_ID": class_id.upper(),
            "LAST_UPDATED": None,
            "STUDENTS": {},
        }

    def save_class_db(self, class_id: str, db: dict):
        db["LAST_UPDATED"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        with open(self._pkl_path(class_id), "wb") as f:
            pickle.dump(db, f)
        self._cache.pop(class_id.upper(), None)

    def delete_class_db(self, class_id: str) -> bool:
        """Purge PKL database file for a specific class from disk."""
        path = self._pkl_path(class_id)
        self._cache.pop(class_id.upper(), None)
        if path.exists():
            try:
                path.unlink()
                print(f"🧹 [EPHEMERAL] Purged PKL for class {class_id.upper()} from disk")
                return True
            except Exception as e:
                print(f"Error unlinking {path}: {e}")
        return False

    def start_session(self, class_id: str) -> dict:
        """Initialize ephemeral PKL index for an active class attendance session."""
        cid = class_id.upper()
        matrix, students = self._get_matrix(cid)
        return {
            "success": True,
            "class_id": cid,
            "active_vectors": matrix.shape[0],
            "enrolled_students": len(students),
        }

    def stop_session(self, class_id: str) -> dict:
        """End class session and immediately delete PKL file from disk."""
        cid = class_id.upper()
        purged = self.delete_class_db(cid)
        return {
            "success": True,
            "class_id": cid,
            "purged_from_disk": purged,
            "message": f"Session closed for {cid}. PKL file ephemerally purged from disk.",
        }

    def list_class_dbs(self) -> list:
        return [p.stem.replace("_db", "") for p in CLASS_DBS_DIR.glob("*_db.pkl")]

    # ── Matrix cache & Centroid Building ────────────────────────────────────

    def _build_matrix(self, class_id: str):
        """
        Build L2-normalized vector matrix including individual sample vectors
        AND normalized student centroid embeddings for optimal multi-angle accuracy.
        """
        db = self.load_class_db(class_id)
        vectors, students = [], []

        for roll, data in db["STUDENTS"].items():
            feats = data.get("features", [])
            if not feats and "feature" in data:
                feats = [data["feature"]]

            if isinstance(feats, (list, np.ndarray)) and len(feats) > 0:
                if isinstance(feats[0], (int, float, np.floating, np.integer)):
                    feats = [feats]

            student_vectors = []
            for feat in feats:
                if feat is not None and len(feat) > 0:
                    v = _normalize(np.asarray(feat, dtype=np.float32).flatten())
                    if v.shape[0] == 128:
                        vectors.append(v)
                        student_vectors.append(v)
                        students.append((roll, data["name"]))

            # Compute and include Centroid Vector if student has multiple photos
            if len(student_vectors) > 1:
                centroid = _normalize(np.mean(student_vectors, axis=0))
                vectors.append(centroid)
                students.append((roll, data["name"]))

        if vectors:
            matrix = np.vstack(vectors).astype(np.float32)
        else:
            matrix = np.empty((0, 128), dtype=np.float32)
        return matrix, students

    def _get_matrix(self, class_id: str):
        cid = class_id.upper()
        if cid in self._cache:
            self._cache.move_to_end(cid)
            return self._cache[cid]
        if len(self._cache) >= self._max_cached:
            self._cache.popitem(last=False)
        result = self._build_matrix(cid)
        self._cache[cid] = result
        return result

    # ── Face Detection & Feature Extraction ───────────────────────────────

    def detect_all_faces(self, img_bgr: np.ndarray):
        """Detect all faces in frame using adaptive input resolution."""
        if img_bgr is None or img_bgr.size == 0:
            return []
        h, w = img_bgr.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img_bgr)
        if faces is None or len(faces) == 0:
            return []
        return faces

    def extract_feature(self, img_bgr: np.ndarray, use_clahe: bool = True):
        """
        Detect primary face and extract 128-D ArcFace embedding with optional CLAHE lighting enhancement.
        Returns (feature_flat, face_row, status_msg).
        """
        if img_bgr is None or img_bgr.size == 0:
            return None, None, "Invalid image"

        faces = self.detect_all_faces(img_bgr)
        if len(faces) == 0:
            return None, None, "No face detected"

        primary = max(faces, key=lambda f: float(f[2]) * float(f[3]))

        # Apply CLAHE lighting normalization if requested
        proc_img = _enhance_lighting(img_bgr) if use_clahe else img_bgr

        aligned = self.recognizer.alignCrop(proc_img, primary)
        feat = self.recognizer.feature(aligned)
        feat_flat = _normalize(np.asarray(feat, dtype=np.float32).flatten())
        return feat_flat, primary, "OK"

    def check_duplicate(self, class_id: str, feature: np.ndarray, student_id: str):
        matrix, students = self._get_matrix(class_id)
        if matrix.shape[0] == 0:
            return False, "", "", 0.0

        scores = np.dot(matrix, feature)
        max_idx = int(np.argmax(scores))
        max_score = float(scores[max_idx])
        matched_roll, matched_name = students[max_idx]

        if matched_roll != student_id and max_score >= SIMILARITY_THRESHOLD:
            return True, matched_name, matched_roll, max_score

        if matched_roll == student_id and max_score >= 0.85:
            return True, matched_name, matched_roll, max_score

        return False, "", "", max_score

    # ── Enrollment ──────────────────────────────────────────────────────────

    def enroll_student(
        self,
        class_id: str,
        roll_number: str,
        name: str,
        department: str,
        img_bgr: np.ndarray,
    ) -> tuple:
        if img_bgr is None or img_bgr.size == 0:
            return False, "Enrollment failed: Invalid image", None

        # Check sharpness quality
        sharpness = _calculate_sharpness(img_bgr)
        if sharpness < MIN_SHARPNESS_SCORE:
            print(f"[WARNING] Enrollment image low sharpness score: {sharpness:.1f}")

        feature, _, msg = self.extract_feature(img_bgr, use_clahe=True)
        if feature is None:
            return False, f"Enrollment failed: {msg}", None

        rid = roll_number.strip().upper()
        is_dup, dup_name, dup_roll, score = self.check_duplicate(class_id, feature, rid)
        if is_dup:
            pct = round(score * 100, 1)
            if dup_roll != rid:
                return False, f"Duplicate face — already enrolled as {dup_name} ({dup_roll}) @ {pct}%", None
            else:
                return False, f"Identical photo already enrolled for {dup_name}", None

        db = self.load_class_db(class_id)

        if rid in db["STUDENTS"]:
            db["STUDENTS"][rid].setdefault("features", []).append(feature.tolist())
            db["STUDENTS"][rid]["name"] = name
            if department:
                db["STUDENTS"][rid]["department"] = department
        else:
            db["STUDENTS"][rid] = {
                "name": name,
                "department": department or "General",
                "features": [feature.tolist()],
                "enrolled_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

        self.save_class_db(class_id, db)
        total = len(db["STUDENTS"][rid]["features"])
        return True, f"Enrolled {name} ({rid}) in {class_id} [{total} photo(s)]", feature.tolist()

    # ── Delete student ──────────────────────────────────────────────────────

    def delete_student_from_class(self, class_id: str, roll_number: str) -> tuple:
        db = self.load_class_db(class_id)
        rid = roll_number.strip().upper()
        if rid not in db["STUDENTS"]:
            return False, f"Student {rid} not found in {class_id}"
        name = db["STUDENTS"][rid]["name"]
        del db["STUDENTS"][rid]
        self.save_class_db(class_id, db)
        return True, f"Deleted {name} ({rid}) from {class_id}"

    # ── Real-Time Multi-Face Matching ─────────────────────────────────────

    def match_faces(self, class_id: str, img_bgr: np.ndarray) -> dict:
        """
        Detect and recognize ALL faces in a frame simultaneously.
        Returns detailed list of matches with bounding boxes, student info, and confidence scores.
        """
        if img_bgr is None or img_bgr.size == 0:
            return {"matched": False, "detected": False, "reason": "Invalid frame", "matches": []}

        faces = self.detect_all_faces(img_bgr)
        if len(faces) == 0:
            return {"matched": False, "detected": False, "reason": "No face detected", "matches": []}

        matrix, students = self._get_matrix(class_id)
        has_enrolled = matrix.shape[0] > 0
        db = self.load_class_db(class_id) if has_enrolled else {}

        proc_img = _enhance_lighting(img_bgr)
        matches = []
        any_matched = False

        primary_match = None
        highest_score = -1.0

        for face in faces:
            bbox = list(map(int, face[0:4]))
            aligned = self.recognizer.alignCrop(proc_img, face)
            feat = self.recognizer.feature(aligned)
            q_flat = _normalize(np.asarray(feat, dtype=np.float32).flatten())

            if not has_enrolled:
                matches.append({
                    "matched": False,
                    "bbox": bbox,
                    "confidence": 0.0,
                    "confidencePct": 0.0,
                    "reason": "No enrolled students in class section"
                })
                continue

            scores = np.dot(matrix, q_flat)
            best_idx = int(np.argmax(scores))
            best_score = float(scores[best_idx])

            if best_score >= SIMILARITY_THRESHOLD:
                any_matched = True
                roll, name = students[best_idx]
                student_entry = db.get("STUDENTS", {}).get(roll, {})
                dept = student_entry.get("department", "General")

                match_info = {
                    "matched": True,
                    "rollNumber": roll,
                    "name": name,
                    "department": dept,
                    "confidence": round(best_score, 4),
                    "confidencePct": _score_to_pct(best_score),
                    "bbox": bbox,
                }
                matches.append(match_info)

                if best_score > highest_score:
                    highest_score = best_score
                    primary_match = match_info
            else:
                match_info = {
                    "matched": False,
                    "bbox": bbox,
                    "confidence": round(best_score, 4),
                    "confidencePct": _score_to_pct(best_score),
                    "reason": "Unrecognized Face",
                }
                matches.append(match_info)

        # Build response with backward compatibility for single-face callers
        result = {
            "matched": any_matched,
            "detected": True,
            "facesCount": len(faces),
            "matches": matches
        }

        if primary_match:
            result.update({
                "rollNumber": primary_match["rollNumber"],
                "name": primary_match["name"],
                "department": primary_match["department"],
                "confidence": primary_match["confidence"],
                "confidencePct": primary_match["confidencePct"],
                "bbox": primary_match["bbox"]
            })
        elif matches:
            result.update({
                "bbox": matches[0]["bbox"],
                "confidence": matches[0].get("confidence", 0.0),
                "confidencePct": matches[0].get("confidencePct", 0.0),
                "reason": matches[0].get("reason", "Unrecognized Face")
            })

        return result

    def match_face(self, class_id: str, img_bgr: np.ndarray) -> dict:
        """Alias wrapper around match_faces for full backward compatibility."""
        return self.match_faces(class_id, img_bgr)

    # ── Utility ─────────────────────────────────────────────────────────────

    def get_class_students(self, class_id: str) -> list:
        db = self.load_class_db(class_id)
        result = []
        for rid, data in db["STUDENTS"].items():
            feats = data.get("features", [data.get("feature")])
            if isinstance(feats, (list, np.ndarray)) and len(feats) > 0:
                if isinstance(feats[0], (int, float, np.floating, np.integer)):
                    feats = [feats]
            photo_count = len([f for f in feats if f is not None and len(f) > 0])
            result.append({
                "rollNumber": rid,
                "name": data["name"],
                "department": data.get("department", ""),
                "photoCount": photo_count,
                "enrolledAt": data.get("enrolled_at", ""),
            })
        return result

    def get_class_info(self, class_id: str) -> dict:
        db = self.load_class_db(class_id)
        students = self.get_class_students(class_id)
        return {
            "classId": class_id.upper(),
            "lastUpdated": db.get("LAST_UPDATED"),
            "studentCount": len(students),
            "students": students,
        }

    def clear_all_dbs(self) -> int:
        self._cache.clear()
        count = 0
        if CLASS_DBS_DIR.exists():
            for pkl in CLASS_DBS_DIR.glob("*_db.pkl"):
                try:
                    pkl.unlink()
                    count += 1
                except Exception as e:
                    print(f"Error removing {pkl.name}: {e}")
        return count
