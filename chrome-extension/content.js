// Content script to inject UI and extract tokens from Suno website

// Get translation helper
function getMessage(key) {
  return chrome.i18n.getMessage(key) || key;
}

// Extract authorization token from network requests
function extractTokenFromRequests() {
  // Method 1: Intercept fetch requests
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0];
    const options = args[1] || {};

    // Check if this is a Suno API request with authorization header
    if (
      typeof url === "string" &&
      url.includes("studio-api.prod.suno.com") &&
      options.headers
    ) {
      const authHeader =
        options.headers.authorization ||
        options.headers.Authorization ||
        (options.headers.get && options.headers.get("authorization"));

      if (authHeader) {
        const token = String(authHeader).replace("Bearer ", "").trim();
        if (token) {
          // Save token to extension storage
          chrome.runtime.sendMessage(
            { action: "saveToken", token: token },
            () => {}
          );
        }
      }
    }

    return originalFetch.apply(this, args);
  };

  // Method 2: Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this._url && this._url.includes("studio-api.prod.suno.com")) {
      const authHeader =
        this.getRequestHeader?.("authorization") ||
        this.getRequestHeader?.("Authorization");
      if (authHeader) {
        const token = String(authHeader).replace("Bearer ", "").trim();
        if (token) {
          chrome.runtime.sendMessage(
            { action: "saveToken", token: token },
            () => {}
          );
        }
      }
    }
    return originalXHRSend.apply(this, args);
  };

  // Method 3: Try to extract from page context (if accessible)
  try {
    // Inject a script into the page context to access its variables
    const script = document.createElement("script");
    script.textContent = `
      (function() {
        // Try to find token in common storage locations
        try {
          const token = localStorage.getItem('authToken') || 
                       sessionStorage.getItem('authToken') ||
                       (window.__NEXT_DATA__ && window.__NEXT_DATA__.props && window.__NEXT_DATA__.props.pageProps && window.__NEXT_DATA__.props.pageProps.token);
          if (token) {
            window.postMessage({ type: 'SUNO_TOKEN_FOUND', token: token }, '*');
          }
        } catch(e) {}
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch (e) {}

  // Listen for token from injected script
  window.addEventListener("message", (event) => {
    if (
      event.data &&
      event.data.type === "SUNO_TOKEN_FOUND" &&
      event.data.token
    ) {
      chrome.runtime.sendMessage(
        { action: "saveToken", token: event.data.token },
        () => {}
      );
    }
  });
}

// Inject download button into Suno interface - REMOVED per user request
// Users can access via extension popup only
function injectDownloadButton() {
  // Button removed - only accessible via extension popup
  return;
}

// Show download modal
function showDownloadModal() {
  // Remove existing modal if any
  const existing = document.getElementById("suno-download-modal");
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement("div");
  modal.id = "suno-download-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  // Detect dark mode for modal
  const isDarkMode =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const modalBgColor = isDarkMode ? "#1e1e1e" : "white";
  const modalTextColor = isDarkMode ? "#e0e0e0" : "#333";

  const content = document.createElement("div");
  content.style.cssText = `
    background: ${modalBgColor};
    color: ${modalTextColor};
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="${chrome.runtime.getURL(
          "icon128.png"
        )}" alt="Suno Tracks Exporter" style="width: 40px; height: 40px; border-radius: 6px;" />
        <h2 style="margin: 0; color: ${modalTextColor};">Suno Tracks Exporter</h2>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <a href="https://www.buymeacoffee.com/VogelCodes" target="_blank" rel="noopener noreferrer" style="display: inline-block; text-decoration: none;">
          <img src="https://img.buymeacoffee.com/button-api/?text=Buy me a pizza&emoji=🍕&slug=VogelCodes&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a pizza" style="height: 40px; width: auto; border: none;" />
        </a>
        <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: ${modalTextColor};">&times;</button>
      </div>
    </div>
    <div id="download-content">
      <p>${getMessage("loadingTracks")}</p>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Close button
  document.getElementById("close-modal").addEventListener("click", () => {
    modal.remove();
  });

  // Close on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Load tracks
  loadTracksIntoModal(content.querySelector("#download-content"));
}

// Load tracks into modal
async function loadTracksIntoModal(container) {
  try {
    container.innerHTML = "<p>Fetching workspaces...</p>";

    // First, try to extract token from current page if not already stored
    await attemptTokenExtraction();

    // Fetch all workspaces first
    const workspacesResponse = await chrome.runtime.sendMessage({
      action: "getWorkspaces",
    });

    if (!workspacesResponse.success) {
      throw new Error(workspacesResponse.error || "Failed to fetch workspaces");
    }

    const workspaces = workspacesResponse.workspaces || [];
    container.innerHTML = `<p>Found ${workspaces.length} workspace(s). Fetching tracks from all workspaces...</p>`;

    // Fetch tracks from all workspaces
    const allTracks = [];

    for (const workspace of workspaces) {
      let cursor = null;
      let hasMore = true;
      let workspaceClips = [];

      while (hasMore) {
        const response = await chrome.runtime.sendMessage({
          action: "getTracks",
          cursor: cursor,
          limit: 20,
          workspaceId: workspace.id,
        });

        if (!response.success) {
          // If token error, try to extract again
          if (response.error && response.error.includes("token")) {
            await attemptTokenExtraction();
            // Retry once
            const retryResponse = await chrome.runtime.sendMessage({
              action: "getTracks",
              cursor: cursor,
              limit: 20,
              workspaceId: workspace.id,
            });
            if (!retryResponse.success) {
              console.error(
                `Failed to fetch from workspace ${workspace.name}: ${retryResponse.error}`
              );
              break;
            }
            const data = retryResponse.data;
            workspaceClips.push(...(data.clips || []));
            hasMore = data.has_more === true;
            cursor = data.next_cursor;
            continue;
          }
          console.error(
            `Failed to fetch from workspace ${workspace.name}: ${response.error}`
          );
          break;
        }

        const data = response.data;
        workspaceClips.push(...(data.clips || []));
        hasMore = data.has_more === true;
        cursor = data.next_cursor;

        if (!hasMore) break;
      }

      // Add workspace info to each clip
      workspaceClips.forEach((clip) => {
        clip.workspaceId = workspace.id;
        clip.workspaceName = workspace.name;
      });

      allTracks.push(...workspaceClips);
    }

    const downloadableTracks = allTracks.filter(
      (clip) => clip.status === "complete" && clip.audio_url
    );

    // Group tracks by workspace
    const tracksByWorkspace = {};
    downloadableTracks.forEach((track) => {
      const workspaceName = track.workspaceName || "Unknown Workspace";
      if (!tracksByWorkspace[workspaceName]) {
        tracksByWorkspace[workspaceName] = [];
      }
      tracksByWorkspace[workspaceName].push(track);
    });

    // Detect dark mode for all UI elements
    const isDarkMode =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDarkMode ? "#e0e0e0" : "#333";
    const secondaryTextColor = isDarkMode ? "#b0b0b0" : "#666";
    const bgColor = isDarkMode ? "#1e1e1e" : "white";
    const borderColor = isDarkMode ? "#444" : "#e0e0e0";
    const headerBgColor = isDarkMode ? "#2a2a2a" : "#f5f5f5";
    const trackBgColor = isDarkMode ? "#252525" : "white";
    const trackBorderColor = isDarkMode ? "#3a3a3a" : "#e8e8e8";
    const tipBgColor = isDarkMode ? "#1a3a5a" : "#e3f2fd";
    const tipBorderColor = isDarkMode ? "#4a9eff" : "#2196f3";
    const tipTextColor = isDarkMode ? "#b0d4ff" : "#333";
    const progressBgColor = isDarkMode ? "#333" : "#f0f0f0";

    // Render tracks grouped by workspace
    const workspaceSections = Object.entries(tracksByWorkspace)
      .map(([workspaceName, tracks]) => {
        const workspaceId =
          tracks[0].workspaceId ||
          workspaceName.toLowerCase().replace(/\s+/g, "-");
        return `
          <div class="workspace-group" data-workspace="${workspaceId}" style="margin-bottom: 16px; border: 1px solid ${borderColor}; border-radius: 8px; overflow: hidden;">
            <div class="workspace-header" data-workspace-id="${workspaceId}" style="background: ${headerBgColor}; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px; user-select: none;">
              <span class="workspace-toggle" data-workspace-id="${workspaceId}" style="font-size: 14px; transition: transform 0.2s; color: ${textColor};">▶</span>
              <input type="checkbox" class="workspace-checkbox" data-workspace="${workspaceId}" style="cursor: pointer;">
              <span style="font-weight: 600; color: ${textColor}; flex: 1;">📁 ${workspaceName}</span>
              <span style="font-size: 12px; color: ${secondaryTextColor};">${
          tracks.length
        } track${tracks.length !== 1 ? "s" : ""}</span>
            </div>
            <div class="workspace-tracks" id="workspace-${workspaceId}" style="display: none; padding: 8px;">
              ${tracks
                .map(
                  (track, index) => `
                <div style="padding: 10px; border: 1px solid ${trackBorderColor}; border-radius: 6px; margin-bottom: 6px; display: flex; align-items: center; gap: 12px; background: ${trackBgColor};">
                  <input type="checkbox" class="track-checkbox" data-clip-id="${
                    track.id
                  }" data-audio-url="${
                    track.audio_url
                  }" data-workspace="${workspaceId}" style="cursor: pointer;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: ${textColor}; font-size: 14px;">${
                    track.title || "(Untitled)"
                  }</div>
                    <div style="font-size: 11px; color: ${secondaryTextColor}; margin-top: 2px;">${
                    track.id
                  }</div>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    <button class="download-single-mp3" data-clip-id="${
                      track.id
                    }" data-audio-url="${track.audio_url}" data-title="${(
                    track.title || "Untitled"
                  ).replace(
                    /[<>:"/\\|?*]/g,
                    "_"
                  )}" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">${getMessage(
                    "downloadMP3"
                  )}</button>
                    <button class="download-single-wav" data-clip-id="${
                      track.id
                    }" data-title="${(track.title || "Untitled").replace(
                    /[<>:"/\\|?*]/g,
                    "_"
                  )}" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">${getMessage(
                    "downloadWAV"
                  )}</button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: calc(80vh - 48px);">
        <div style="flex-shrink: 0; margin-bottom: 16px;">
          <p style="color: ${textColor};"><strong> ${
      downloadableTracks.length
    } ${getMessage("downloadableTracks")} ${
      Object.keys(tracksByWorkspace).length
    } ${getMessage("workspaces")}</strong></p>
          <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
            <button id="download-selected-mp3" style="padding: 8px 16px; background: #764ba2; color: white; border: none; border-radius: 6px; cursor: pointer;">${getMessage(
              "downloadSelectedMP3"
            )}</button>
            <button id="download-selected-wav" style="padding: 8px 16px; background: #20c997; color: white; border: none; border-radius: 6px; cursor: pointer;">${getMessage(
              "downloadSelectedWAV"
            )}</button>
          </div>
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: ${textColor};">
            <input type="checkbox" id="select-all" style="cursor: pointer;">
            <span>${getMessage("selectAll")}</span>
          </label>
          <div style="background: ${
            isDarkMode ? "#4a2a0a" : "#fff3cd"
          }; border-left: 4px solid ${
      isDarkMode ? "#ff9800" : "#ffc107"
    }; padding: 12px; margin-bottom: 12px; border-radius: 4px; font-size: 13px; color: ${
      isDarkMode ? "#ffcc80" : "#856404"
    };">
            <strong>⚠️ ${getMessage("warning")}</strong> ${getMessage(
      "warningMessage"
    )} 
            <button id="open-download-settings" style="background: none; border: none; color: ${
              isDarkMode ? "#ff9800" : "#856404"
            }; text-decoration: underline; font-weight: 600; cursor: pointer; padding: 0; font-size: 13px; font-family: inherit;">${getMessage(
      "changeChromeSettings"
    )}</button> 
            ${getMessage("turnOffAskWhere")}
          </div>
        </div>
        <div id="tracks-list" style="flex: 1; overflow-y: auto; min-height: 0; margin-bottom: 16px;">
          ${workspaceSections}
        </div>
        <div id="download-progress" style="flex-shrink: 0; display: none; margin-top: auto;">
          <div style="background: ${progressBgColor}; border-radius: 4px; height: 24px; overflow: hidden;">
            <div id="progress-bar" style="background: #667eea; height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <p id="progress-text" style="font-size: 12px; color: ${secondaryTextColor}; margin: 0;"></p>
            <button id="stop-download" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; display: none;">${getMessage(
              "stop"
            )}</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners for workspace headers (toggle expand/collapse)
    container.querySelectorAll(".workspace-header").forEach((header) => {
      header.addEventListener("click", (e) => {
        // Don't toggle if clicking on the checkbox
        if (e.target.type === "checkbox") {
          return;
        }
        const workspaceId = header.dataset.workspaceId;
        const tracksDiv = document.getElementById(`workspace-${workspaceId}`);
        const toggle = header.querySelector(".workspace-toggle");

        if (tracksDiv.style.display === "none" || !tracksDiv.style.display) {
          tracksDiv.style.display = "block";
          if (toggle) toggle.style.transform = "rotate(90deg)";
        } else {
          tracksDiv.style.display = "none";
          if (toggle) toggle.style.transform = "rotate(0deg)";
        }
      });
    });

    // Add event listeners for workspace checkboxes
    container.querySelectorAll(".workspace-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header toggle
        const workspaceId = checkbox.dataset.workspace;
        const trackCheckboxes = container.querySelectorAll(
          `.track-checkbox[data-workspace="${workspaceId}"]`
        );
        trackCheckboxes.forEach((cb) => {
          cb.checked = checkbox.checked;
        });
      });
    });

    // Select all checkbox
    document.getElementById("select-all").addEventListener("change", (e) => {
      const trackCheckboxes = container.querySelectorAll(".track-checkbox");
      const workspaceCheckboxes = container.querySelectorAll(
        ".workspace-checkbox"
      );
      trackCheckboxes.forEach((cb) => (cb.checked = e.target.checked));
      workspaceCheckboxes.forEach((cb) => (cb.checked = e.target.checked));
    });

    // Update workspace checkbox when individual tracks are selected/deselected
    container.querySelectorAll(".track-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const workspaceId = checkbox.dataset.workspace;
        const workspaceCheckbox = container.querySelector(
          `.workspace-checkbox[data-workspace="${workspaceId}"]`
        );
        const workspaceTrackCheckboxes = container.querySelectorAll(
          `.track-checkbox[data-workspace="${workspaceId}"]`
        );
        const allChecked = Array.from(workspaceTrackCheckboxes).every(
          (cb) => cb.checked
        );
        const someChecked = Array.from(workspaceTrackCheckboxes).some(
          (cb) => cb.checked
        );
        workspaceCheckbox.checked = allChecked;
        workspaceCheckbox.indeterminate = someChecked && !allChecked;
      });
    });

    // Open Chrome Downloads Settings button
    const openSettingsBtn = container.querySelector("#open-download-settings");
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { action: "openDownloadSettings" },
          () => {}
        );
      });
    }

    // Download selected MP3
    document
      .getElementById("download-selected-mp3")
      .addEventListener("click", () => {
        const selected = Array.from(
          container.querySelectorAll(".track-checkbox:checked")
        ).map((cb) => {
          const track = downloadableTracks.find(
            (t) => t.id === cb.dataset.clipId
          );
          return {
            id: cb.dataset.clipId,
            audio_url: cb.dataset.audioUrl,
            title: track?.title || "Untitled",
            workspaceName: track?.workspaceName || "Unknown",
          };
        });
        if (selected.length === 0) {
          alert("Please select at least one track");
          return;
        }
        downloadSelectedTracks(selected, "mp3");
      });

    // Download selected WAV
    document
      .getElementById("download-selected-wav")
      .addEventListener("click", () => {
        const selected = Array.from(
          container.querySelectorAll(".track-checkbox:checked")
        ).map((cb) => {
          const track = downloadableTracks.find(
            (t) => t.id === cb.dataset.clipId
          );
          return {
            id: cb.dataset.clipId,
            audio_url: cb.dataset.audioUrl,
            title: track?.title || "Untitled",
            workspaceName: track?.workspaceName || "Unknown",
          };
        });
        if (selected.length === 0) {
          alert("Please select at least one track");
          return;
        }
        downloadSelectedTracksAsWav(selected);
      });

    // Individual download buttons - MP3
    container.querySelectorAll(".download-single-mp3").forEach((btn) => {
      btn.addEventListener("click", () => {
        const clipId = btn.dataset.clipId;
        const audioUrl = btn.dataset.audioUrl;
        const title = btn.dataset.title;
        const track = downloadableTracks.find((t) => t.id === clipId);
        const workspaceName = track?.workspaceName || "Unknown";
        const filename = `${sanitizeFilename(workspaceName)}-${sanitizeFilename(
          title
        )}-${clipId}.mp3`;
        downloadTrack(audioUrl, filename);
      });
    });

    // Individual download buttons - WAV
    container.querySelectorAll(".download-single-wav").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const clipId = btn.dataset.clipId;
        const title = btn.dataset.title;
        const track = downloadableTracks.find((t) => t.id === clipId);
        const workspaceName = track?.workspaceName || "Unknown";
        const filename = `${sanitizeFilename(workspaceName)}-${sanitizeFilename(
          title
        )}-${clipId}.wav`;
        btn.disabled = true;
        btn.textContent = getMessage("converting");
        try {
          await convertAndDownloadWav(clipId, filename);
          btn.textContent = getMessage("downloadWAV");
          btn.disabled = false;
        } catch (error) {
          btn.textContent = getMessage("downloadWAV");
          btn.disabled = false;
          alert(`Failed to convert: ${error.message}`);
        }
      });
    });
  } catch (error) {
    container.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

// Helper function to sanitize filename
function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100); // Limit length
}

// Global flag to stop downloads
let stopDownloadFlag = false;

// Download selected tracks
async function downloadSelectedTracks(tracks, format = "mp3") {
  const progressDiv = document.getElementById("download-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const stopButton = document.getElementById("stop-download");

  progressDiv.style.display = "block";
  stopButton.style.display = "block";
  stopDownloadFlag = false;

  // Add stop button handler
  const stopHandler = () => {
    stopDownloadFlag = true;
    stopButton.disabled = true;
    stopButton.textContent = getMessage("stoppingDownloads");
    progressText.textContent = `⏹️ ${getMessage("stoppingDownloads")}`;
  };
  stopButton.onclick = stopHandler;

  let completed = 0;
  let failed = 0;
  const total = tracks.length;

  // Sequential downloads with random delays to avoid API blocks
  for (let i = 0; i < tracks.length; i++) {
    if (stopDownloadFlag) {
      progressText.textContent = `⏹️ ${getMessage("stopped")} ${getMessage(
        "downloaded"
      )} ${completed} ${getMessage("of")} ${total} ${getMessage("tracks")}${
        failed > 0 ? ` (${failed} failed)` : ""
      }`;
      stopButton.style.display = "none";
      break;
    }

    const track = tracks[i];
    const workspaceName = sanitizeFilename(track.workspaceName || "Unknown");
    const trackName = sanitizeFilename(track.title || "Untitled");
    const filename = `${workspaceName}-${trackName}-${track.id}.${format}`;

    // Update progress before download
    progressText.textContent = `${getMessage("downloading")} ${
      i + 1
    }/${total}: ${trackName}...`;

    // Wait for download to complete before starting next (sequential, not concurrent)
    try {
      await downloadTrack(track.audio_url, filename);
      if (!stopDownloadFlag) {
        completed++;
        // Update progress
        const percent = Math.round(((completed + failed) / total) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${getMessage(
          "downloaded"
        )} ${completed} ${getMessage("of")} ${total} ${getMessage(
          "tracks"
        )} (${percent}%)${failed > 0 ? ` - ${failed} failed` : ""}`;

        if (completed + failed === total) {
          progressText.textContent = `✅ ${getMessage(
            "completed"
          )} ${getMessage("downloaded")} ${completed} ${getMessage(
            "of"
          )} ${total} ${getMessage("tracks")}${
            failed > 0 ? ` (${failed} failed)` : ""
          }`;
          stopButton.style.display = "none";
        }
      }
    } catch (error) {
      if (!stopDownloadFlag) {
        console.error(`Failed to download ${track.title}:`, error);
        failed++;
        const percent = Math.round(((completed + failed) / total) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${getMessage(
          "downloaded"
        )} ${completed} ${getMessage("of")} ${total} ${getMessage(
          "tracks"
        )} (${percent}%)${failed > 0 ? ` - ${failed} failed` : ""}`;

        if (completed + failed === total) {
          progressText.textContent = `✅ ${getMessage(
            "completed"
          )} ${getMessage("downloaded")} ${completed} ${getMessage(
            "of"
          )} ${total} ${getMessage("tracks")}${
            failed > 0 ? ` (${failed} failed)` : ""
          }`;
          stopButton.style.display = "none";
        }
      }
    }

    // Random delay between downloads to avoid API throttling (1-3 seconds)
    if (i < tracks.length - 1 && !stopDownloadFlag) {
      const delay = 1000 + Math.random() * 2000; // 1000-3000ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Download a single track
async function downloadTrack(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "downloadFile",
        url: url,
        filename: filename, // Use default download location
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          resolve();
        } else {
          reject(new Error(response?.error || "Download failed"));
        }
      }
    );
  });
}

// Convert and download a single track as WAV
async function convertAndDownloadWav(clipId, filename) {
  const progressDiv = document.getElementById("download-progress");
  const progressText = document.getElementById("progress-text");

  if (progressDiv) {
    progressDiv.style.display = "block";
    progressText.textContent = `${getMessage("converting")} ${filename}...`;
  }

  try {
    // Step 1: Initiate conversion
    const initiateResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "initiateWavConversion", clipId: clipId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve();
          } else {
            reject(
              new Error(response?.error || "Conversion initiation failed")
            );
          }
        }
      );
    });

    // Step 2: Poll for WAV file
    if (progressText) {
      progressText.textContent = `${getMessage("waitingForConversion")}`;
    }

    const wavUrlResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "pollWavFile", clipId: clipId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            resolve(response.url);
          } else {
            reject(new Error(response?.error || "WAV conversion failed"));
          }
        }
      );
    });

    // Step 3: Download WAV file
    if (progressText) {
      progressText.textContent = `${getMessage("downloading")} ${filename}...`;
    }

    await downloadTrack(wavUrlResponse, filename);

    if (progressText) {
      progressText.textContent = `✅ ${getMessage("downloaded")} ${filename}`;
    }

    return wavUrlResponse;
  } catch (error) {
    if (progressText) {
      progressText.textContent = `❌ Error: ${error.message}`;
    }
    throw error;
  }
}

// Download selected tracks as WAV
async function downloadSelectedTracksAsWav(tracks) {
  const progressDiv = document.getElementById("download-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const stopButton = document.getElementById("stop-download");

  progressDiv.style.display = "block";
  stopButton.style.display = "block";
  stopDownloadFlag = false;

  // Add stop button handler
  const stopHandler = () => {
    stopDownloadFlag = true;
    stopButton.disabled = true;
    stopButton.textContent = getMessage("stoppingDownloads");
    progressText.textContent = `⏹️ ${getMessage("stoppingDownloads")}`;
  };
  stopButton.onclick = stopHandler;

  let completed = 0;
  let failed = 0;
  const total = tracks.length;

  for (let i = 0; i < tracks.length; i++) {
    if (stopDownloadFlag) {
      progressText.textContent = `⏹️ ${getMessage("stopped")} ${getMessage(
        "converting"
      )} ${completed} ${getMessage("of")} ${total} ${getMessage("tracks")}${
        failed > 0 ? ` (${failed} failed)` : ""
      }`;
      stopButton.style.display = "none";
      break;
    }

    const track = tracks[i];
    const workspaceName = sanitizeFilename(track.workspaceName || "Unknown");
    const trackName = sanitizeFilename(track.title || "Untitled");
    const filename = `${workspaceName}-${trackName}-${track.id}.wav`;

    try {
      progressText.textContent = `${getMessage("converting")} ${
        i + 1
      }/${total}: ${track.title || "Untitled"}...`;
      await convertAndDownloadWav(track.id, filename);
      if (!stopDownloadFlag) {
        completed++;
        // Update progress
        const percent = Math.round(((completed + failed) / total) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${getMessage(
          "converting"
        )} ${completed} ${getMessage("of")} ${total} ${getMessage(
          "tracks"
        )} (${percent}%)${failed > 0 ? ` - ${failed} failed` : ""}`;
      }
    } catch (error) {
      if (!stopDownloadFlag) {
        console.error(`Failed to convert ${track.title}:`, error);
        failed++;
        const percent = Math.round(((completed + failed) / total) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${getMessage(
          "converting"
        )} ${completed} ${getMessage("of")} ${total} ${getMessage(
          "tracks"
        )} (${percent}%)${failed > 0 ? ` - ${failed} failed` : ""}`;
      }
    }

    // Random delay between conversions to avoid rate limiting (2-4 seconds)
    if (i < tracks.length - 1 && !stopDownloadFlag) {
      const delay = 2000 + Math.random() * 2000; // 2000-4000ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!stopDownloadFlag) {
    progressText.textContent = `✅ ${getMessage("completed")} ${getMessage(
      "converting"
    )} ${completed} ${getMessage("of")} ${total} ${getMessage("tracks")}${
      failed > 0 ? ` (${failed} failed)` : ""
    }`;
    stopButton.style.display = "none";
  }
}

// Attempt to extract token from page
async function attemptTokenExtraction() {
  // The webRequest listener in background.js will automatically capture tokens
  // from any API requests the page makes. We just need to wait a bit for
  // the page to make its natural API calls.

  // Also try to trigger a page navigation/refresh to capture token from existing requests
  // by checking if we can access the page's fetch calls that might already have happened

  // Wait a moment for any pending requests
  await new Promise((resolve) => setTimeout(resolve, 500));
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractToken") {
    attemptTokenExtraction();
    // Wait a bit and check if token was saved
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "getToken" }, (response) => {
        sendResponse({ success: response && response.success });
      });
    }, 1000);
    return true;
  }
  if (request.action === "showDownloader") {
    showDownloadModal();
    sendResponse({ success: true });
    return true;
  }
});

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    extractTokenFromRequests();
    attemptTokenExtraction();
    setTimeout(injectDownloadButton, 2000); // Wait for page to load
  });
} else {
  extractTokenFromRequests();
  attemptTokenExtraction();
  setTimeout(injectDownloadButton, 2000);
}
