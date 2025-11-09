fetch("https://studio-api.prod.suno.com/api/generate/v2-web/", {
  headers: {
    accept: "*/*",
    "accept-language": "pt-BR,pt;q=0.8",
    // Get your token from browser DevTools > Network tab > Request Headers > authorization (after "Bearer ")
    authorization: `Bearer ${
      process.env.SUNO_AUTH_TOKEN || "YOUR_AUTHORIZATION_TOKEN_HERE"
    }`,
    "browser-token":
      process.env.SUNO_BROWSER_TOKEN || '{"token":"YOUR_BROWSER_TOKEN_HERE"}',
    "cache-control": "no-cache",
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
  body: '{"project_id":"90956544-b9e1-4a80-9a0f-040f8705dd81","token":null,"generation_type":"TEXT","mv":"chirp-crow","prompt":"","gpt_description_prompt":"Me surpreenda com uma musica","make_instrumental":false,"user_uploaded_images_b64":null,"metadata":{"web_client_pathname":"/create","is_max_mode":false,"is_mumble":false,"create_mode":"simple","user_tier":"e1235dd7-9f4d-4738-aeb2-1470466cba27","create_session_token":"44aa721a-b9c5-42b6-892c-63d919234ef1","disable_volume_normalization":false,"can_control_sliders":[],"lyrics_model":"default"},"override_fields":[],"cover_clip_id":null,"cover_start_s":null,"cover_end_s":null,"persona_id":null,"artist_clip_id":null,"artist_start_s":null,"artist_end_s":null,"continue_clip_id":null,"continued_aligned_prompt":null,"continue_at":null,"transaction_uuid":"f24e6ffd-42d7-42b6-9d7d-05aa2e2857fc"}',
  method: "POST",
});
