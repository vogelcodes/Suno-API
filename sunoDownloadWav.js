// Interactive CLI script to convert and download WAV files
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Configuration
const CONFIG = {
  downloadDir: "./downloads", // Directory where MP3 files are stored
  // Update these tokens if you get 401 errors:
  // Get your token from browser DevTools > Network tab > Request Headers > authorization (after "Bearer ")
  authorizationToken: process.env.SUNO_AUTH_TOKEN || "YOUR_AUTHORIZATION_TOKEN_HERE",
  browserToken: process.env.SUNO_BROWSER_TOKEN || '{"token":"YOUR_BROWSER_TOKEN_HERE"}',
  deviceId: process.env.SUNO_DEVICE_ID || "YOUR_DEVICE_ID_HERE",
  // Conversion settings
  pollInterval: 2000, // How often to check if WAV is ready (ms)
  maxPollAttempts: 60, // Maximum number of polling attempts (2 minutes total)
  minDelay: 1000, // Minimum delay between conversions (ms)
  maxDelay: 3000, // Maximum delay between conversions (ms)
};

// Helper to extract clip ID from filename (format: Title_ClipID.mp3)
function extractClipId(filename) {
  const match = filename.match(/_([a-f0-9-]{36})\.mp3$/i);
  return match ? match[1] : null;
}

// Helper to get random delay
function getRandomDelay() {
  return (
    Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) +
    CONFIG.minDelay
  );
}

// Step 1: Initiate WAV conversion
async function initiateWavConversion(clipId) {
  const url = `https://studio-api.prod.suno.com/api/gen/${clipId}/convert_wav/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${CONFIG.authorizationToken}`,
      "browser-token": CONFIG.browserToken,
      "cache-control": "no-cache",
      "device-id": CONFIG.deviceId,
      origin: "https://suno.com",
      pragma: "no-cache",
      referer: "https://suno.com/",
      "sec-ch-ua":
        '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
    },
  });

  // The convert_wav endpoint returns 204 No Content with empty body
  // Accept both 200 and 204 as success
  if (!response.ok && response.status !== 204) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  // For 204 No Content, there's no body to parse
  if (response.status === 204) {
    return null;
  }

  // For 200, try to parse JSON if there's content
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      // If JSON parsing fails, that's okay - empty response is valid
      return null;
    }
  }

  return null;
}

// Step 2: Poll for WAV file URL
async function pollForWavFile(clipId) {
  const url = `https://studio-api.prod.suno.com/api/gen/${clipId}/wav_file/`;

  for (let attempt = 0; attempt < CONFIG.maxPollAttempts; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.8",
        authorization: `Bearer ${CONFIG.authorizationToken}`,
        "browser-token": CONFIG.browserToken,
        "cache-control": "no-cache",
        "device-id": CONFIG.deviceId,
        origin: "https://suno.com",
        pragma: "no-cache",
        referer: "https://suno.com/",
        "sec-ch-ua":
          '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "sec-gpc": "1",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // WAV not ready yet, continue polling
        if (attempt % 5 === 0) {
          // Show progress every 5 attempts
          process.stdout.write(`   ⏳ Still converting... (attempt ${attempt + 1}/${CONFIG.maxPollAttempts})\r`);
        }
        await new Promise((resolve) => setTimeout(resolve, CONFIG.pollInterval));
        continue;
      }
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    if (data.wav_file_url) {
      process.stdout.write("   " + " ".repeat(50) + "\r"); // Clear progress line
      return data.wav_file_url;
    }

    // Wait before next poll
    if (attempt % 5 === 0) {
      process.stdout.write(`   ⏳ Still converting... (attempt ${attempt + 1}/${CONFIG.maxPollAttempts})\r`);
    }
    await new Promise((resolve) => setTimeout(resolve, CONFIG.pollInterval));
  }

  process.stdout.write("   " + " ".repeat(50) + "\r"); // Clear progress line
  throw new Error(
    `WAV conversion timeout after ${CONFIG.maxPollAttempts} attempts (${(CONFIG.maxPollAttempts * CONFIG.pollInterval) / 1000}s)`
  );
}

// Step 3: Download WAV file
async function downloadWavFile(wavUrl, outputPath) {
  const response = await fetch(wavUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      Referer: "https://suno.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputPath, buffer);

  return buffer.length;
}

// Main function: Convert and download WAV
async function convertAndDownloadWav(clipId, outputPath) {
  try {
    console.log(`🔄 Initiating WAV conversion for: ${clipId}`);
    const conversionResult = await initiateWavConversion(clipId);
    if (conversionResult === null) {
      console.log(`   ✓ Conversion initiated (204 No Content response)`);
    } else {
      console.log(`   ✓ Conversion initiated`);
    }

    console.log(`⏳ Polling for WAV file (checking every ${CONFIG.pollInterval / 1000}s)...`);
    const wavUrl = await pollForWavFile(clipId);
    console.log(`✅ WAV ready! URL: ${wavUrl}`);

    console.log(`⬇️  Downloading WAV file...`);
    const fileSize = await downloadWavFile(wavUrl, outputPath);
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    console.log(`✅ Downloaded: ${path.basename(outputPath)} (${fileSizeMB} MB)\n`);

    return { success: true, fileSize };
  } catch (error) {
    console.error(`   ❌ Error details: ${error.message}`);
    throw error;
  }
}

// Get all MP3 files from downloads directory
function getMp3Files() {
  if (!fs.existsSync(CONFIG.downloadDir)) {
    return [];
  }

  const files = fs.readdirSync(CONFIG.downloadDir);
  return files
    .filter((file) => file.endsWith(".mp3"))
    .map((file) => {
      const clipId = extractClipId(file);
      return {
        filename: file,
        clipId: clipId,
        fullPath: path.join(CONFIG.downloadDir, file),
      };
    })
    .filter((item) => item.clipId !== null);
}

// Interactive selection
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function selectFiles() {
  const mp3Files = getMp3Files();

  if (mp3Files.length === 0) {
    console.log("❌ No MP3 files found in downloads directory!");
    console.log(`   Directory: ${path.resolve(CONFIG.downloadDir)}`);
    process.exit(1);
  }

  console.log(`\n📁 Found ${mp3Files.length} MP3 file(s) in downloads directory:\n`);

  mp3Files.forEach((file, index) => {
    const wavExists = fs.existsSync(
      file.fullPath.replace(".mp3", ".wav")
    );
    const status = wavExists ? "✅ (WAV exists)" : "";
    console.log(`  ${index + 1}. ${file.filename} ${status}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("Select files to convert to WAV:");
  console.log("  - Enter numbers separated by commas (e.g., 1,3,5)");
  console.log("  - Enter 'all' to convert all files");
  console.log("  - Enter 'skip' to skip files that already have WAV");
  console.log("  - Press Ctrl+C to cancel");
  console.log("=".repeat(60) + "\n");

  const rl = createReadlineInterface();
  const answer = await question(rl, "Your selection: ");
  rl.close();

  const trimmed = answer.trim().toLowerCase();

  if (trimmed === "all") {
    return mp3Files;
  }

  if (trimmed === "skip") {
    return mp3Files.filter(
      (file) => !fs.existsSync(file.fullPath.replace(".mp3", ".wav"))
    );
  }

  // Parse comma-separated numbers
  const indices = trimmed
    .split(",")
    .map((s) => parseInt(s.trim()) - 1)
    .filter((n) => !isNaN(n) && n >= 0 && n < mp3Files.length);

  if (indices.length === 0) {
    console.log("❌ Invalid selection!");
    process.exit(1);
  }

  return indices.map((i) => mp3Files[i]);
}

// Main execution
async function main() {
  try {
    console.log("🎵 Suno WAV Downloader\n");

    const selectedFiles = await selectFiles();

    if (selectedFiles.length === 0) {
      console.log("⚠️  No files selected or all files already have WAV versions!");
      return;
    }

    console.log(`\n📋 Selected ${selectedFiles.length} file(s) to convert:\n`);
    selectedFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename} (${file.clipId})`);
    });

    const rl = createReadlineInterface();
    const confirm = await question(
      rl,
      "\n⚠️  Proceed with conversion? (yes/no): "
    );
    rl.close();

    if (confirm.trim().toLowerCase() !== "yes") {
      console.log("❌ Cancelled.");
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("🚀 Starting WAV conversion and download...\n");

    const results = {
      success: 0,
      failed: 0,
      totalSize: 0,
    };

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const wavPath = file.fullPath.replace(".mp3", ".wav");

      // Skip if WAV already exists
      if (fs.existsSync(wavPath)) {
        console.log(
          `⏭️  [${i + 1}/${selectedFiles.length}] Skipping (WAV exists): ${file.filename}\n`
        );
        continue;
      }

      try {
        const result = await convertAndDownloadWav(file.clipId, wavPath);
        results.success++;
        results.totalSize += result.fileSize;

        // Random delay before next conversion (except for the last one)
        if (i < selectedFiles.length - 1) {
          const delay = getRandomDelay();
          const delaySeconds = (delay / 1000).toFixed(1);
          console.log(`⏳ Waiting ${delaySeconds}s before next conversion...\n`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ [${i + 1}/${selectedFiles.length}] Failed: ${file.filename}`);
        console.error(`   Error: ${error.message}\n`);
        results.failed++;
      }
    }

    // Final summary
    console.log("=".repeat(60));
    console.log("📊 Conversion Summary:");
    console.log("=".repeat(60));
    console.log(`✅ Successfully converted: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📦 Total size: ${(results.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`📁 Download directory: ${path.resolve(CONFIG.downloadDir)}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Execute
main();

