/**
 * Advanced Hospital Stress Heatmap — Backend API
 * ================================================
 * Features:
 *  - Full room-level data (14 rooms across 3 wards)
 *  - Multi-factor AI stress scoring (mirrors Python model)
 *  - /data         → live snapshot of all rooms
 *  - /insights     → AI recommendations for HIGH/MEDIUM zones
 *  - /history/:id  → recent stress history for a room
 *  - /stream       → Server-Sent Events (SSE) for real-time push
 *  - /stats        → hospital-wide aggregate stats
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ─── Hospital Layout ─────────────────────────────────────────────────────────
const WARDS = {
  ICU: {
    rooms: ["ICU-1", "ICU-2", "ICU-3", "ICU-4"],
    bedCapacity: 4,
    baseStress: 65,
    variance: 20,
  },
  General: {
    rooms: ["GEN-1", "GEN-2", "GEN-3", "GEN-4", "GEN-5", "GEN-6"],
    bedCapacity: 6,
    baseStress: 42,
    variance: 18,
  },
  Emergency: {
    rooms: ["ER-1", "ER-2", "ER-3", "ER-4"],
    bedCapacity: 4,
    baseStress: 72,
    variance: 22,
  },
};

// ─── Time-of-Day Multipliers (matches generator.py) ──────────────────────────
const HOURLY_PATTERN = {
  0: 0.3,
  1: 0.25,
  2: 0.22,
  3: 0.2,
  4: 0.22,
  5: 0.35,
  6: 0.52,
  7: 0.7,
  8: 0.85,
  9: 0.9,
  10: 0.88,
  11: 0.82,
  12: 0.75,
  13: 0.7,
  14: 0.65,
  15: 0.6,
  16: 0.55,
  17: 0.5,
  18: 0.45,
  19: 0.42,
  20: 0.4,
  21: 0.38,
  22: 0.35,
  23: 0.32,
};

// ─── In-memory history store (last 20 data points per room) ──────────────────
const historyStore = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randF(min, max) {
  return Math.random() * (max - min) + min;
}
function gaussianNoise(std = 4) {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function getTimeMult() {
  return HOURLY_PATTERN[new Date().getHours()] ?? 0.5;
}

// ─── AI Stress Scoring (mirrors Python StressPredictor) ──────────────────────
const WEIGHTS = {
  occupancyRate: 0.3,
  noiseLevel: 0.2,
  staffDeficitRate: 0.25,
  criticalAlertRate: 0.15,
  equipmentFaultRate: 0.1,
};

function calcStress(features) {
  let score = 0;
  score += WEIGHTS.occupancyRate * features.occupancyRate;
  score += WEIGHTS.noiseLevel * features.noiseLevel;
  score += WEIGHTS.staffDeficitRate * features.staffDeficitRate;
  score += WEIGHTS.criticalAlertRate * features.criticalAlertRate;
  score += WEIGHTS.equipmentFaultRate * features.equipmentFaultRate;
  score += gaussianNoise(4);
  return parseFloat(clamp(score, 0, 100).toFixed(1));
}

function getLevel(stress) {
  if (stress > 75) return "HIGH";
  if (stress >= 40) return "MEDIUM";
  return "LOW";
}

function getRecommendation(level, ward, features) {
  if (level === "HIGH") {
    if (features.staffDeficitRate > 60)
      return `Critical understaffing in ${ward} — immediate reallocation needed`;
    if (features.occupancyRate > 90)
      return `${ward} near full capacity — consider patient transfer`;
    if (features.equipmentFaultRate > 50)
      return `Equipment faults critical in ${ward} — dispatch maintenance`;
    return `${ward}: High stress — monitor closely, prepare contingency`;
  }
  if (level === "MEDIUM") {
    if (features.staffDeficitRate > 30)
      return `${ward}: Staff slightly low — consider redistribution`;
    return `${ward}: Elevated load — keep on watch`;
  }
  return `${ward}: Stable — no action needed`;
}

// ─── Room Data Generator ─────────────────────────────────────────────────────
function generateRoom(roomId, ward) {
  const cfg = WARDS[ward];
  const timeMult = getTimeMult();
  const bedCap = cfg.bedCapacity;
  const baseOcc = cfg.baseStress / 100;

  // Patients
  const expectedPts = Math.round(baseOcc * timeMult * bedCap);
  const patients = clamp(
    expectedPts + Math.round(gaussianNoise(0.8)),
    1,
    bedCap,
  );
  const occupancyPct = parseFloat(((patients / bedCap) * 100).toFixed(1));

  // Staff
  const requiredNurses = Math.max(1, Math.round(patients / 2));
  const nursesOnDuty = clamp(
    requiredNurses + Math.round(gaussianNoise(0.6)) - (timeMult > 0.7 ? 1 : 0),
    0,
    6,
  );
  const staffDeficit = Math.max(0, requiredNurses - nursesOnDuty);

  // Noise (correlated with occupancy + time)
  const noiseBase = 40 + (patients / bedCap) * 50 * timeMult;
  const noiseLevel = clamp(Math.round(noiseBase + gaussianNoise(6)), 20, 100);

  // Alerts
  const activeAlerts = clamp(
    Math.round((patients / bedCap) * 4 * timeMult + gaussianNoise(0.7)),
    0,
    5,
  );
  const criticalAlerts = clamp(
    Math.round((patients / bedCap) * 1.5 * timeMult + gaussianNoise(0.5)),
    0,
    2,
  );

  // Equipment
  const faultBase = ward === "ICU" || ward === "Emergency" ? 0.15 : 0.08;
  const equipFaults = clamp(
    Math.round(faultBase * 3 + gaussianNoise(0.3)),
    0,
    3,
  );

  // Wait time
  const waitBase = 5 + (patients / bedCap) * 100 * timeMult;
  const waitTime = clamp(Math.round(waitBase + gaussianNoise(8)), 2, 180);

  // Anomaly injection (5% chance)
  const anomaly = Math.random() < 0.05;

  // Feature vector
  const features = {
    occupancyRate: anomaly ? clamp(occupancyPct * 1.5, 0, 100) : occupancyPct,
    noiseLevel: anomaly ? clamp(noiseLevel * 1.4, 0, 100) : noiseLevel,
    staffDeficitRate: Math.max(
      0,
      (staffDeficit / Math.max(requiredNurses, 1)) * 100,
    ),
    criticalAlertRate: (criticalAlerts / 2) * 100,
    equipmentFaultRate: (equipFaults / 3) * 100,
  };

  const stress = calcStress(features);
  const level = getLevel(stress);

  return {
    roomId,
    ward,
    timestamp: new Date().toISOString(),
    patientsCount: patients,
    bedCapacity: bedCap,
    occupancyPct,
    nursesOnDuty,
    requiredNurses,
    staffStatus: nursesOnDuty < requiredNurses ? "DEFICIT" : "OK",
    activeAlerts,
    criticalAlerts,
    noiseLevel,
    equipmentFaults: equipFaults,
    avgWaitTimeMins: waitTime,
    stressScore: stress,
    stressLevel: level,
    anomalyDetected: anomaly,
    recommendation: getRecommendation(level, `${ward}/${roomId}`, features),
    featureVector: features,
  };
}

// ─── Full Snapshot ────────────────────────────────────────────────────────────
function generateSnapshot() {
  const rooms = [];
  for (const [ward, cfg] of Object.entries(WARDS)) {
    for (const roomId of cfg.rooms) {
      const room = generateRoom(roomId, ward);

      // Update history
      if (!historyStore[roomId]) historyStore[roomId] = [];
      historyStore[roomId].push({ t: Date.now(), v: room.stressScore });
      if (historyStore[roomId].length > 20) historyStore[roomId].shift();

      rooms.push(room);
    }
  }
  return rooms;
}

// ─── SSE Client Registry ─────────────────────────────────────────────────────
const sseClients = new Set();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Push updates every 3 seconds
setInterval(() => {
  if (sseClients.size > 0) {
    broadcastSSE(generateSnapshot());
  }
}, 3000);

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/", (req, res) =>
  res.json({
    status: "ok",
    version: "2.0",
    timestamp: new Date().toISOString(),
  }),
);

// Full room snapshot
app.get("/data", (req, res) => {
  res.json(generateSnapshot());
});

// History for a specific room
app.get("/history/:roomId", (req, res) => {
  const history = historyStore[req.params.roomId] || [];
  res.json({ roomId: req.params.roomId, history });
});

// AI Insights — rooms needing attention
app.get("/insights", (req, res) => {
  const snapshot = generateSnapshot();
  const highRooms = snapshot.filter((r) => r.stressLevel === "HIGH");
  const medRooms = snapshot.filter((r) => r.stressLevel === "MEDIUM");

  const insights = {
    timestamp: new Date().toISOString(),
    criticalCount: highRooms.length,
    warningCount: medRooms.length,
    stableCount: snapshot.filter((r) => r.stressLevel === "LOW").length,
    hospitalStressIndex: parseFloat(
      (
        snapshot.reduce((s, r) => s + r.stressScore, 0) / snapshot.length
      ).toFixed(1),
    ),
    topAlerts: [...highRooms, ...medRooms]
      .sort((a, b) => b.stressScore - a.stressScore)
      .slice(0, 5)
      .map((r) => ({
        roomId: r.roomId,
        ward: r.ward,
        stress: r.stressScore,
        level: r.stressLevel,
        message: r.recommendation,
        anomaly: r.anomalyDetected,
      })),
    wardSummary: Object.entries(WARDS).map(([ward, cfg]) => {
      const wardRooms = snapshot.filter((r) => r.ward === ward);
      const avgStress = parseFloat(
        (
          wardRooms.reduce((s, r) => s + r.stressScore, 0) / wardRooms.length
        ).toFixed(1),
      );
      return {
        ward,
        avgStress,
        level: getLevel(avgStress),
        highCount: wardRooms.filter((r) => r.stressLevel === "HIGH").length,
        totalRooms: cfg.rooms.length,
        staffDeficit: wardRooms.filter((r) => r.staffStatus === "DEFICIT")
          .length,
      };
    }),
  };

  res.json(insights);
});

// Hospital-wide aggregate stats
app.get("/stats", (req, res) => {
  const snapshot = generateSnapshot();
  const totalPts = snapshot.reduce((s, r) => s + r.patientsCount, 0);
  const totalBeds = snapshot.reduce((s, r) => s + r.bedCapacity, 0);
  const totalNurses = snapshot.reduce((s, r) => s + r.nursesOnDuty, 0);
  const totalAlerts = snapshot.reduce((s, r) => s + r.criticalAlerts, 0);

  res.json({
    timestamp: new Date().toISOString(),
    totalRooms: snapshot.length,
    totalPatients: totalPts,
    totalBeds,
    overallOccupancy: parseFloat(((totalPts / totalBeds) * 100).toFixed(1)),
    totalNurses,
    totalCriticalAlerts: totalAlerts,
    avgWaitTime: Math.round(
      snapshot.reduce((s, r) => s + r.avgWaitTimeMins, 0) / snapshot.length,
    ),
    highStressRooms: snapshot.filter((r) => r.stressLevel === "HIGH").length,
    anomaliesActive: snapshot.filter((r) => r.anomalyDetected).length,
  });
});

// SSE stream — real-time push to frontend
app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial snapshot immediately
  res.write(`data: ${JSON.stringify(generateSnapshot())}\n\n`);
  sseClients.add(res);

  req.on("close", () => sseClients.delete(res));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥  Hospital Stress Heatmap API  v2.0`);
  console.log(`📡  Listening on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET /data       → live room snapshot (14 rooms)`);
  console.log(`  GET /insights   → AI recommendations & ward summary`);
  console.log(`  GET /stats      → hospital-wide aggregate metrics`);
  console.log(`  GET /history/:id → room stress history`);
  console.log(`  GET /stream     → SSE real-time push (3s interval)\n`);
});
