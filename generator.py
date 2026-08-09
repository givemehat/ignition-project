"""
Advanced Hospital Synthetic Data Generator
==========================================
Simulates realistic IoT sensor data for a hospital stress heatmap system.
Features:
  - Time-of-day stress patterns (from market research data)
  - Ward-specific baselines & variance
  - Multi-feature correlation model
  - Gaussian noise + random anomaly injection
  - AI Stress Predictor (weighted multi-factor scoring)
  - Export to JSON / CSV for training pipelines
"""

# import these functions
import random
import json
import csv
import math
from datetime import datetime, timedelta
from typing import Optional

# ─── Hospital Layout ─────────────────────────────────────────────────────────
WARDS = {
    "ICU": {
        "rooms": ["ICU-1", "ICU-2", "ICU-3", "ICU-4"],
        "bed_capacity": 4,
        "base_stress": 65,
        "variance": 20,
    },
    "General": {
        "rooms": ["GEN-1", "GEN-2", "GEN-3", "GEN-4", "GEN-5", "GEN-6"],
        "bed_capacity": 6,
        "base_stress": 42,
        "variance": 18,
    },
    "Emergency": {
        "rooms": ["ER-1", "ER-2", "ER-3", "ER-4"],
        "bed_capacity": 4,
        "base_stress": 72,
        "variance": 22,
    },
}

# ─── Time-of-Day Stress Multipliers (from market research) ───────────────────
# Peak Hospital Stress Hours: 8-11 AM = 85%, 11AM-2PM = 65%, 2-5PM = 50%, 5-8PM = 38%
HOURLY_PATTERN = {
    0: 0.30,
    1: 0.25,
    2: 0.22,
    3: 0.20,
    4: 0.22,
    5: 0.35,
    6: 0.52,
    7: 0.70,
    8: 0.85,
    9: 0.90,
    10: 0.88,
    11: 0.82,
    12: 0.75,
    13: 0.70,
    14: 0.65,
    15: 0.60,
    16: 0.55,
    17: 0.50,
    18: 0.45,
    19: 0.42,
    20: 0.40,
    21: 0.38,
    22: 0.35,
    23: 0.32,
}

# ─── AI Stress Scoring Weights (multi-factor weighted model) ─────────────────
STRESS_WEIGHTS = {
    "occupancy_rate": 0.30,  # % beds occupied
    "noise_level": 0.20,  # normalized 0-100
    "staff_deficit_rate": 0.25,  # how understaffed (0-1)
    "critical_alert_rate": 0.15,  # critical alerts / max
    "equipment_fault_rate": 0.10,  # faults / max
}

NOISE_STD_DEV = 4.0  # Gaussian noise standard deviation
ANOMALY_PROBABILITY = 0.05  # 5% chance any room has a stress spike


def gaussian_noise(mean: float = 0.0, std: float = NOISE_STD_DEV) -> float:
    """Box-Muller Gaussian noise without numpy."""
    u1 = random.random()
    u2 = random.random()
    z = math.sqrt(-2.0 * math.log(u1 + 1e-9)) * math.cos(2 * math.pi * u2)
    return mean + std * z


def get_time_multiplier(dt: Optional[datetime] = None) -> float:
    """Return stress multiplier based on time of day."""
    hour = (dt or datetime.now()).hour
    return HOURLY_PATTERN.get(hour, 0.50)


class StressPredictor:
    """
    Rule-based AI stress predictor.
    Computes a 0-100 stress score from multi-dimensional room features.
    Designed to be easily replaced with an ML model (sklearn, ONNX, etc.)
    as real data grows — matches the AI Upgrade Path described in architecture.
    """

    def predict(self, features: dict) -> float:
        """
        Predict stress score [0-100] from feature dict.
        Features expected: occupancy_rate, noise_level, staff_deficit_rate,
                           critical_alert_rate, equipment_fault_rate
        """
        score = 0.0
        for key, weight in STRESS_WEIGHTS.items():
            val = features.get(key, 0.0)
            score += weight * val

        # Apply noise
        score += gaussian_noise()

        # Clip to [0, 100]
        return round(max(0.0, min(100.0, score)), 1)

    def classify(self, score: float) -> str:
        """Map score to stress level. Matches Intelligence Engine thresholds."""
        if score > 75:
            return "HIGH"
        elif score >= 40:
            return "MEDIUM"
        return "LOW"

    def recommend(self, score: float, ward: str, features: dict) -> str:
        """Generate plain-language recommendation for dashboard AI panel."""
        level = self.classify(score)
        deficit = features.get("staff_deficit_rate", 0)
        occupancy = features.get("occupancy_rate", 0)
        faults = features.get("equipment_fault_rate", 0)

        if level == "HIGH":
            if deficit > 60:
                return (
                    f"⚠ {ward}: Critical understaffing — immediate reallocation needed"
                )
            elif occupancy > 90:
                return f"🚨 {ward}: Near full capacity — consider patient transfer"
            elif faults > 50:
                return f"🔧 {ward}: Equipment faults critical — dispatch maintenance"
            else:
                return f"🔴 {ward}: High stress — monitor closely, prepare contingency"
        elif level == "MEDIUM":
            if deficit > 30:
                return f"⚡ {ward}: Staff slightly low — consider redistribution"
            return f"🟡 {ward}: Elevated load — keep on watch"
        return f"✅ {ward}: Stable — no action needed"


# ─── Singleton predictor ─────────────────────────────────────────────────────
predictor = StressPredictor()

# hence check everything


# ─── Room Data Generator ─────────────────────────────────────────────────────
def generate_room_data(room_id: str, ward: str, dt: Optional[datetime] = None) -> dict:
    """Generate a realistic synthetic snapshot for one room."""
    cfg = WARDS[ward]
    dt = dt or datetime.now()
    time_mult = get_time_multiplier(dt)

    # ── Raw sensor readings ───────────────────────────────────────────────────
    bed_capacity = cfg["bed_capacity"]
    base = cfg["base_stress"]

    # Patients: time-of-day weighted, with noise
    max_patients = bed_capacity
    expected_occ = base / 100.0 * time_mult * max_patients
    patients_count = max(
        1, min(max_patients, round(expected_occ + gaussian_noise(0, 0.8)))
    )

    # Nurses: understaffed probability correlates with occupancy
    required_nurses = max(1, round(patients_count / 2))
    nurse_jitter = round(gaussian_noise(0, 0.6))
    nurses_on_duty = max(
        0, min(6, required_nurses + nurse_jitter - (1 if time_mult > 0.70 else 0))
    )

    # Noise: correlated with occupancy + time
    noise_base = 40 + (patients_count / bed_capacity) * 50 * time_mult
    noise_level = max(20, min(100, round(noise_base + gaussian_noise(0, 6))))

    # Alerts: correlate with ward type and occupancy
    max_active = 5
    max_critical = 2
    occ_rate = patients_count / bed_capacity
    active_alerts = max(
        0, min(max_active, round(occ_rate * 4 * time_mult + gaussian_noise(0, 0.7)))
    )
    critical_alerts = max(
        0, min(max_critical, round(occ_rate * 1.5 * time_mult + gaussian_noise(0, 0.5)))
    )

    # Equipment faults: random, slightly higher in ICU/ER
    fault_base = 0.15 if ward in ("ICU", "Emergency") else 0.08
    equipment_faults = max(0, min(3, round(fault_base * 3 + gaussian_noise(0, 0.3))))

    # Wait time: exponentially correlated with stress
    wait_base = 5 + occ_rate * 100 * time_mult
    avg_wait = max(2, min(180, round(wait_base + gaussian_noise(0, 8))))

    # ── Feature vector for AI predictor ──────────────────────────────────────
    features = {
        "occupancy_rate": occ_rate * 100,
        "noise_level": noise_level,
        "staff_deficit_rate": max(
            0, (required_nurses - nurses_on_duty) / max(required_nurses, 1)
        )
        * 100,
        "critical_alert_rate": (critical_alerts / max_critical) * 100,
        "equipment_fault_rate": (equipment_faults / 3) * 100,
    }

    # ── Anomaly injection (5% chance of stress spike) ─────────────────────────
    anomaly = False
    if random.random() < ANOMALY_PROBABILITY:
        anomaly = True
        for k in features:
            features[k] = min(100, features[k] * random.uniform(1.3, 1.8))

    # ── AI stress prediction ──────────────────────────────────────────────────
    stress = predictor.predict(features)
    level = predictor.classify(stress)
    reco = predictor.recommend(stress, f"{ward}/{room_id}", features)

    return {
        "room_id": room_id,
        "ward": ward,
        "timestamp": dt.isoformat(),
        # Patient metrics
        "patients_count": patients_count,
        "bed_capacity": bed_capacity,
        "occupancy_pct": round(occ_rate * 100, 1),
        # Staff metrics
        "nurses_on_duty": nurses_on_duty,
        "required_nurses": required_nurses,
        "staff_status": "DEFICIT" if nurses_on_duty < required_nurses else "OK",
        # Alert metrics
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts,
        # Environment
        "noise_level": noise_level,
        "equipment_faults": equipment_faults,
        # Throughput
        "avg_wait_time_mins": avg_wait,
        # AI outputs
        "stress_score": stress,
        "stress_level": level,
        "recommendation": reco,
        "anomaly_detected": anomaly,
        "feature_vector": features,
    }


# ─── Hospital Snapshot ───────────────────────────────────────────────────────
def generate_hospital_snapshot(dt: Optional[datetime] = None) -> list:
    """Generate a full hospital snapshot across all wards and rooms."""
    snapshot = []
    dt = dt or datetime.now()

    for ward, cfg in WARDS.items():
        for room_id in cfg["rooms"]:
            snapshot.append(generate_room_data(room_id, ward, dt))

    return snapshot


# ─── Dataset Builder (for training / analytics) ──────────────────────────────
def build_synthetic_dataset(
    n_snapshots: int = 100,
    interval_minutes: int = 15,
    output_json: str = "dataset.json",
    output_csv: str = "dataset.csv",
) -> list:
    """
    Build a time-series synthetic dataset spanning n_snapshots intervals.
    Useful for feeding ML training pipelines or analytics dashboards.
    """
    all_records = []
    start_time = datetime.now() - timedelta(minutes=n_snapshots * interval_minutes)

    for i in range(n_snapshots):
        dt = start_time + timedelta(minutes=i * interval_minutes)
        snapshot = generate_hospital_snapshot(dt)
        all_records.extend(snapshot)

    # ── JSON export ──────────────────────────────────────────────────────────
    with open(output_json, "w") as f:
        json.dump(all_records, f, indent=2)
    print(f"✅ Exported {len(all_records)} records → {output_json}")

    # ── CSV export (flat — drops nested feature_vector) ──────────────────────
    flat_keys = [k for k in all_records[0] if k != "feature_vector"]
    with open(output_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=flat_keys)
        writer.writeheader()
        for r in all_records:
            writer.writerow({k: r[k] for k in flat_keys})
    print(f"✅ Exported {len(all_records)} records → {output_csv}")

    return all_records


# ─── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    if "--dataset" in sys.argv:
        # Build a full synthetic training dataset
        print(
            "🧠 Building synthetic training dataset (100 snapshots × 15-min intervals)..."
        )
        records = build_synthetic_dataset(n_snapshots=100, interval_minutes=15)
        print(f"\n📊 Dataset summary:")
        high = sum(1 for r in records if r["stress_level"] == "HIGH")
        medium = sum(1 for r in records if r["stress_level"] == "MEDIUM")
        low = sum(1 for r in records if r["stress_level"] == "LOW")
        total = len(records)
        print(f"   HIGH   : {high:5d} ({100*high/total:.1f}%)")
        print(f"   MEDIUM : {medium:5d} ({100*medium/total:.1f}%)")
        print(f"   LOW    : {low:5d}  ({100*low/total:.1f}%)")
        anomalies = sum(1 for r in records if r["anomaly_detected"])
        print(f"   Anomalies: {anomalies} injected")
    else:
        # Live snapshot preview
        data = generate_hospital_snapshot()
        print(json.dumps(data, indent=2))
        print(f"\nTotal rooms: {len(data)}")
        print(
            f"HIGH stress rooms  : {sum(1 for r in data if r['stress_level'] == 'HIGH')}"
        )
        print(
            f"MEDIUM stress rooms: {sum(1 for r in data if r['stress_level'] == 'MEDIUM')}"
        )
        print(
            f"LOW stress rooms   : {sum(1 for r in data if r['stress_level'] == 'LOW')}"
        )
