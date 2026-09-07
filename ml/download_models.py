import os
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).parent

MODELS_DIR = BASE_DIR / "models"
YUNET_PATH = str(MODELS_DIR / "face_detection_yunet.onnx")
SFACE_PATH = str(MODELS_DIR / "face_recognition_sface.onnx")

YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"


def download_models():
    MODELS_DIR.mkdir(exist_ok=True)

    if not os.path.exists(YUNET_PATH):
        print("⬇️  Downloading YuNet Face Detector model...")
        urllib.request.urlretrieve(YUNET_URL, YUNET_PATH)
        print("✅ YuNet model downloaded.")
    else:
        print("✅ YuNet model present.")

    if not os.path.exists(SFACE_PATH):
        print("⬇️  Downloading SFace Face Recognizer model...")
        urllib.request.urlretrieve(SFACE_URL, SFACE_PATH)
        print("✅ SFace model downloaded.")
    else:
        print("✅ SFace model present.")


if __name__ == "__main__":
    download_models()
