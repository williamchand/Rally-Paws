import os
import sys
from pathlib import Path

os.environ.setdefault("CONFIRM_SECRET", "test-secret-not-for-production")
# MODEL_API_KEY intentionally unset: chat must answer 503 without it.
os.environ.pop("REVENUECAT_SECRET_KEY", None)  # billing stays unconfigured in tests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
