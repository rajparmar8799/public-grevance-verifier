const exifr = require("exifr");
const sharp = require("sharp");
const path = require("path");
const { haversineDistance } = require("./geo");

/**
 * extractExifGps — reads GPS data from a photo's EXIF metadata.
 *
 * @param {string} filePath - Absolute path to the uploaded image
 * @returns {object} - { lat, lng, timestamp, camera } or null if no EXIF GPS
 */
async function extractExifGps(filePath) {
  try {
    const exif = await exifr.parse(filePath, {
      gps: true,
      pick: [
        "GPSLatitude",
        "GPSLongitude",
        "DateTimeOriginal",
        "Make",
        "Model",
      ],
    });

    if (!exif) return null;

    const lat = exif.latitude || exif.GPSLatitude;
    const lng = exif.longitude || exif.GPSLongitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      lat,
      lng,
      timestamp: exif.DateTimeOriginal || null,
      camera: [exif.Make, exif.Model].filter(Boolean).join(" ") || null,
    };
  } catch (err) {
    console.warn("[EXIF] Could not parse EXIF from photo:", err.message);
    return null;
  }
}

async function crossVerifyGps(filePath, browserLat, browserLng) {
  const exif = await extractExifGps(filePath);

  if (!exif) {
    return { match_status: "NO_EXIF", distance_meters: null, exif_data: null };
  }

  if (!Number.isFinite(browserLat) || !Number.isFinite(browserLng)) {
    return {
      match_status: "NO_BROWSER_GPS",
      distance_meters: null,
      exif_data: exif,
    };
  }

  const distance = haversineDistance(
    exif.lat,
    exif.lng,
    browserLat,
    browserLng,
  );
  const match = distance < 200; // within 200m = photo taken at same location

  return {
    match_status: match ? "MATCH" : "MISMATCH",
    distance_meters: Math.round(distance),
    exif_data: exif,
  };
}

/**
 * addGpsWatermark — burns GPS coordinates, timestamp, and distance
 * directly onto the photo. This creates tamper-proof visual evidence.
 *
 * @param {string} inputPath  - Path to original uploaded photo
 * @param {string} outputPath - Path to save watermarked photo
 * @param {object} data       - { lat, lng, accuracy, distance, timestamp, status }
 * @returns {string} - Output path
 */
async function addGpsWatermark(inputPath, outputPath, data) {
  try {
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // Scale font size based on image dimensions
    const fontSize = Math.max(14, Math.min(24, Math.round(width / 50)));
    const padding = Math.round(fontSize * 0.8);
    const lineHeight = Math.round(fontSize * 1.5);

    const lines = [
      `GPS: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`,
      `Accuracy: ±${data.accuracy || "?"}m | Distance: ${data.distance || "?"}m`,
      `Status: ${data.status || "PENDING"}`,
      `Time: ${data.timestamp || new Date().toISOString()}`,
    ];

    const boxHeight = lines.length * lineHeight + padding * 2;

    // Create SVG overlay with semi-transparent background
    const svgOverlay = `
      <svg width="${width}" height="${boxHeight}">
        <rect x="0" y="0" width="${width}" height="${boxHeight}"
              fill="rgba(0,0,0,0.7)" rx="0"/>
        ${lines
          .map(
            (line, i) => `
          <text x="${padding}" y="${padding + i * lineHeight + fontSize}"
                font-family="monospace" font-size="${fontSize}"
                fill="${i === 2 ? (data.status === "MATCH" ? "#22c55e" : "#ef4444") : "#ffffff"}"
                font-weight="bold">${escapeXml(line)}</text>
        `,
          )
          .join("")}
      </svg>`;

    await sharp(inputPath)
      .composite([
        {
          input: Buffer.from(svgOverlay),
          gravity: "south", // bottom of image
        },
      ])
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    return outputPath;
  } catch (err) {
    console.error("[WATERMARK] Failed to add GPS watermark:", err.message);
    // If watermarking fails, just copy the original
    const fs = require("fs");
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { extractExifGps, crossVerifyGps, addGpsWatermark };
