// Import fs and path for Node.js file operations
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  workspaceId: "default",
  limit: 20,
  fetchAll: true,
  // Download settings
  downloadDir: "./downloads", // Directory to save MP3 files
  minDelay: 2000, // Minimum delay between downloads (ms)
  maxDelay: 5000, // Maximum delay between downloads (ms)
  // Update these tokens if you get 401 errors:
  // Get your token from browser DevTools > Network tab > Request Headers > authorization (after "Bearer ")
  authorizationToken: process.env.SUNO_AUTH_TOKEN || "YOUR_AUTHORIZATION_TOKEN_HERE",
  browserToken: process.env.SUNO_BROWSER_TOKEN || '{"token":"YOUR_BROWSER_TOKEN_HERE"}',
};

// Helper function to fetch a single page of tracks
async function fetchTracksPage(cursor = null) {
  const response = await fetch("https://studio-api.prod.suno.com/api/feed/v3", {
    headers: {
      accept: "*/*",
      "accept-language": "pt-BR,pt;q=0.8",
      authorization: `Bearer ${CONFIG.authorizationToken}`,
      "browser-token": CONFIG.browserToken,
      "cache-control": "no-cache",
      "content-type": "application/json",
      "device-id": process.env.SUNO_DEVICE_ID || "YOUR_DEVICE_ID_HERE",
      pragma: "no-cache",
      priority: "u=1, i",
      "sec-ch-ua": '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://suno.com/",
    },
    body: JSON.stringify({
      cursor: cursor,
      limit: CONFIG.limit,
      filters: {
        disliked: "False",
        trashed: "False",
        stem: {
          presence: "False",
        },
        workspace: {
          presence: "True",
          workspaceId: CONFIG.workspaceId,
        },
      },
    }),
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage += `\nResponse: ${JSON.stringify(errorJson, null, 2)}`;
    } catch {
      errorMessage += `\nResponse: ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

// Helper function to sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, "_") // Replace invalid chars
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 200); // Limit length
}

// Helper function to generate filename from clip
function generateFilename(clip, index) {
  let name = clip.title || "Untitled";
  if (!name || name.trim() === "" || name === "(Untitled)") {
    name = `Track_${index + 1}`;
  }
  name = sanitizeFilename(name);
  return `${name}_${clip.id}.mp3`;
}

// Helper function to download a single MP3 file
async function downloadMP3(clip, index, total) {
  const filename = generateFilename(clip, index);
  const filepath = path.join(CONFIG.downloadDir, filename);

  // Skip if file already exists
  if (fs.existsSync(filepath)) {
    console.log(`⏭️  [${index + 1}/${total}] Skipping (already exists): ${filename}`);
    return { success: true, skipped: true, filename };
  }

  try {
    console.log(`⬇️  [${index + 1}/${total}] Downloading: ${filename}`);
    console.log(`    URL: ${clip.audio_url}`);

    const response = await fetch(clip.audio_url, {
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

    fs.writeFileSync(filepath, buffer);

    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    console.log(`✅ [${index + 1}/${total}] Downloaded: ${filename} (${fileSizeMB} MB)`);

    return { success: true, skipped: false, filename, size: buffer.length };
  } catch (error) {
    console.error(`❌ [${index + 1}/${total}] Failed: ${filename}`);
    console.error(`    Error: ${error.message}`);
    return { success: false, skipped: false, filename, error: error.message };
  }
}

// Helper function to get random delay
function getRandomDelay() {
  return (
    Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay + 1)) +
    CONFIG.minDelay
  );
}

// Main function to list and download all tracks
async function listAndDownloadTracks() {
  try {
    // Create downloads directory if it doesn't exist
    if (!fs.existsSync(CONFIG.downloadDir)) {
      fs.mkdirSync(CONFIG.downloadDir, { recursive: true });
      console.log(`📁 Created downloads directory: ${CONFIG.downloadDir}\n`);
    }

    // Step 1: Fetch all tracks
    let allClips = [];
    let cursor = null;
    let pageCount = 0;
    let hasMore = true;

    console.log("📋 Step 1: Fetching tracks...\n");

    while (hasMore) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const data = await fetchTracksPage(cursor);
      allClips = allClips.concat(data.clips || []);

      hasMore = data.has_more === true && CONFIG.fetchAll;
      cursor = data.next_cursor;

      console.log(`  Found ${data.clips?.length || 0} tracks on this page`);
      console.log(`  Total tracks so far: ${allClips.length}`);
      console.log(`  Has more: ${hasMore}\n`);

      if (!CONFIG.fetchAll || !hasMore) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `✅ Fetched ${allClips.length} total tracks across ${pageCount} page(s)\n`
    );

    // Filter only completed clips with audio URLs
    const downloadableClips = allClips.filter(
      (clip) => clip.status === "complete" && clip.audio_url
    );

    console.log(`📊 Summary:`);
    console.log(`  Total clips: ${allClips.length}`);
    console.log(`  Downloadable clips: ${downloadableClips.length}`);
    console.log(
      `  Incomplete/processing: ${allClips.length - downloadableClips.length}\n`
    );

    if (downloadableClips.length === 0) {
      console.log("⚠️  No downloadable tracks found!");
      return;
    }

    // Step 2: Download all MP3 files
    console.log("⬇️  Step 2: Downloading MP3 files...\n");
    console.log(
      `⏱️  Using random delays between ${CONFIG.minDelay}ms and ${CONFIG.maxDelay}ms\n`
    );

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      totalSize: 0,
    };

    for (let i = 0; i < downloadableClips.length; i++) {
      const clip = downloadableClips[i];
      const result = await downloadMP3(clip, i, downloadableClips.length);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.success++;
          if (result.size) {
            results.totalSize += result.size;
          }
        }
      } else {
        results.failed++;
      }

      // Random delay before next download (except for the last one)
      if (i < downloadableClips.length - 1) {
        const delay = getRandomDelay();
        const delaySeconds = (delay / 1000).toFixed(1);
        console.log(`    ⏳ Waiting ${delaySeconds}s before next download...\n`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Download Summary:");
    console.log("=".repeat(60));
    console.log(`✅ Successfully downloaded: ${results.success}`);
    console.log(`⏭️  Skipped (already exists): ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📦 Total size: ${(results.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`📁 Download directory: ${path.resolve(CONFIG.downloadDir)}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// Execute
listAndDownloadTracks();

