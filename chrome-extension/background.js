// Background service worker for Suno Tracks Exporter

// Intercept network requests to capture auth tokens
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (
      details.url.includes("studio-api.prod.suno.com") &&
      details.requestHeaders
    ) {
      const authHeader = details.requestHeaders.find(
        (header) => header.name.toLowerCase() === "authorization"
      );
      if (authHeader && authHeader.value) {
        const token = authHeader.value.replace("Bearer ", "");
        // Save token to storage
        chrome.storage.local.set({ authToken: token }, () => {});
      }
    }
  },
  {
    urls: ["https://studio-api.prod.suno.com/*"],
  },
  ["requestHeaders"]
);

// Store filenames for downloads initiated by our extension (keyed by URL)
const downloadFilenames = new Map();

// Listen for download events to suppress save dialogs
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // Check if we have a stored filename for this download URL
  const storedFilename = downloadFilenames.get(downloadItem.url);

  if (storedFilename) {
    // Use the filename we stored
    suggest({
      filename: storedFilename,
      conflictAction: "uniquify",
    });
    // Clean up after use (with a delay to handle retries)
    setTimeout(() => {
      downloadFilenames.delete(downloadItem.url);
    }, 1000);
  } else {
    // For other downloads, use the filename from downloadItem if available
    let filename =
      downloadItem.filename || downloadItem.suggestedFilename || "";

    // If filename is empty, try to extract from URL
    if (!filename && downloadItem.url) {
      const urlParts = downloadItem.url.split("/");
      filename = urlParts[urlParts.length - 1].split("?")[0];
    }

    // Remove any folder path, keep only the filename
    if (filename) {
      const pathParts = filename.split(/[\/\\]/);
      filename = pathParts[pathParts.length - 1];
    }

    suggest({
      filename: filename || "download",
      conflictAction: "uniquify",
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTracks") {
    fetchTracks(request.cursor, request.limit, request.workspaceId || "default")
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === "getToken") {
    getTokenFromStorage()
      .then((token) => sendResponse({ success: true, token }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "saveToken") {
    chrome.storage.local.set({ authToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "downloadFile") {
    downloadFile(request.url, request.filename)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "initiateWavConversion") {
    initiateWavConversion(request.clipId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "pollWavFile") {
    pollWavFile(request.clipId)
      .then((url) => sendResponse({ success: true, url }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "getWorkspaces") {
    getWorkspaces()
      .then((workspaces) => sendResponse({ success: true, workspaces }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "openDownloadSettings") {
    chrome.tabs.create({ url: "chrome://settings/downloads" });
    sendResponse({ success: true });
    return true;
  }
});

// Get token from storage or fetch from current tab
async function getTokenFromStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["authToken"], (result) => {
      if (result.authToken) {
        resolve(result.authToken);
      } else {
        reject(new Error("No token found. Please visit suno.com first."));
      }
    });
  });
}

// Get or generate device ID (stored per user)
function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["deviceId"], (result) => {
      if (result.deviceId) {
        resolve(result.deviceId);
      } else {
        // Generate a new device ID
        const deviceId = generateUUID();
        chrome.storage.local.set({ deviceId: deviceId }, () => {
          resolve(deviceId);
        });
      }
    });
  });
}

// Generate a UUID v4
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate browser token
function generateBrowserToken() {
  const timestamp = Date.now();
  const token = btoa(JSON.stringify({ timestamp }));
  return JSON.stringify({ token });
}

// Get all workspaces
async function getWorkspaces() {
  const authToken = await getTokenFromStorage();
  const deviceId = await getDeviceId();
  const browserToken = generateBrowserToken();

  const response = await fetch(
    "https://studio-api.prod.suno.com/api/project/me?page=1&sort=created_at&show_trashed=false",
    {
      method: "GET",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.8",
        authorization: `Bearer ${authToken}`,
        "browser-token": browserToken,
        "cache-control": "no-cache",
        "device-id": deviceId,
        origin: "https://suno.com",
        pragma: "no-cache",
        referer: "https://suno.com/",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.projects || [];
}

// Fetch tracks from Suno API for a specific workspace
async function fetchTracks(cursor = null, limit = 20, workspaceId = "default") {
  const authToken = await getTokenFromStorage();
  const deviceId = await getDeviceId();
  const browserToken = generateBrowserToken();

  const response = await fetch("https://studio-api.prod.suno.com/api/feed/v3", {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.8",
      authorization: `Bearer ${authToken}`,
      "browser-token": browserToken,
      "cache-control": "no-cache",
      "content-type": "application/json",
      "device-id": deviceId,
      origin: "https://suno.com",
      pragma: "no-cache",
      referer: "https://suno.com/",
    },
    body: JSON.stringify({
      cursor: cursor,
      limit: limit,
      filters: {
        disliked: "False",
        trashed: "False",
        stem: {
          presence: "False",
        },
        workspace: {
          presence: "True",
          workspaceId: workspaceId,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

// Download file using Chrome downloads API
async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    // Store the filename by URL before starting download
    // This allows onDeterminingFilename to retrieve it
    downloadFilenames.set(url, filename);

    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false, // Don't show save dialog
        conflictAction: "uniquify", // Auto-rename if file exists
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          // Clean up on error
          downloadFilenames.delete(url);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

// Initiate WAV conversion
async function initiateWavConversion(clipId) {
  const authToken = await getTokenFromStorage();
  const deviceId = await getDeviceId();
  const browserToken = generateBrowserToken();

  const response = await fetch(
    `https://studio-api.prod.suno.com/api/gen/${clipId}/convert_wav/`,
    {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.8",
        authorization: `Bearer ${authToken}`,
        "browser-token": browserToken,
        "cache-control": "no-cache",
        "device-id": deviceId,
        origin: "https://suno.com",
        pragma: "no-cache",
        referer: "https://suno.com/",
      },
    }
  );

  // Accept 204 No Content as success
  if (!response.ok && response.status !== 204) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
}

// Poll for WAV file URL
async function pollWavFile(clipId, maxAttempts = 60, interval = 2000) {
  const authToken = await getTokenFromStorage();
  const deviceId = await getDeviceId();
  const browserToken = generateBrowserToken();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://studio-api.prod.suno.com/api/gen/${clipId}/wav_file/`,
      {
        method: "GET",
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.8",
          authorization: `Bearer ${authToken}`,
          "browser-token": browserToken,
          "cache-control": "no-cache",
          "device-id": deviceId,
          origin: "https://suno.com",
          pragma: "no-cache",
          referer: "https://suno.com/",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Not ready yet, continue polling
        await new Promise((resolve) => setTimeout(resolve, interval));
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    if (data.wav_file_url) {
      return data.wav_file_url;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`WAV conversion timeout after ${maxAttempts} attempts`);
}
