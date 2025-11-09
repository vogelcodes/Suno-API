// Configuration
// ⚠️ IMPORTANT: Update the authorization token below if you get a 401 error!
// To get a fresh token:
// 1. Open https://suno.com in your browser
// 2. Open DevTools (F12) > Network tab
// 3. Filter by "feed" or "api"
// 4. Make a request (e.g., navigate to your library)
// 5. Click on any request to studio-api.prod.suno.com
// 6. Go to Headers tab > Request Headers
// 7. Copy the value of "authorization" header (the part after "Bearer ")
const CONFIG = {
  workspaceId: "default", // Use "default" for all tracks, or a specific workspace UUID
  limit: 20, // Number of tracks per page
  fetchAll: true, // Set to false to fetch only first page
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

// Main function to fetch all tracks with pagination
async function listAllTracks() {
  try {
    let allClips = [];
    let cursor = null;
    let pageCount = 0;
    let hasMore = true;

    console.log("Fetching tracks...\n");

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

      // Break if not fetching all or no more pages
      if (!CONFIG.fetchAll || !hasMore) {
        break;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `\n✅ Fetched ${allClips.length} total tracks across ${pageCount} page(s)\n`
    );

    // Filter only completed clips with audio URLs available for download
    const downloadableClips = allClips.filter(
      (clip) => clip.status === "complete" && clip.audio_url
    );

    console.log(`📊 Summary:`);
    console.log(`  Total clips: ${allClips.length}`);
    console.log(`  Downloadable clips: ${downloadableClips.length}`);
    console.log(
      `  Incomplete/processing: ${allClips.length - downloadableClips.length}\n`
    );

    // Display downloadable clip information
    console.log("🎵 Downloadable Tracks:\n");
    downloadableClips.forEach((clip, index) => {
      console.log(`--- Track ${index + 1} ---`);
      console.log(`ID: ${clip.id}`);
      console.log(`Title: ${clip.title || "(Untitled)"}`);
      console.log(`Status: ${clip.status}`);
      console.log(`Audio URL: ${clip.audio_url}`);
      console.log(`Created: ${clip.created_at}`);
      if (clip.metadata?.duration) {
        console.log(`Duration: ${clip.metadata.duration.toFixed(2)}s`);
      }
      if (clip.metadata?.tags) {
        console.log(`Tags: ${clip.metadata.tags}`);
      }
      console.log("");
    });

    return {
      allClips,
      downloadableClips,
      totalCount: allClips.length,
      downloadableCount: downloadableClips.length,
    };
  } catch (error) {
    console.error("❌ Error fetching tracks:", error);
    throw error;
  }
}

// Execute
listAllTracks();
