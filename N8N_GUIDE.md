# N8N Integration Guide

This guide shows you how to use the Suno API with N8N workflows.

## Prerequisites

1. Deploy the Suno API (see README.md or COOLIFY_DEPLOY.md)
2. Have your API URL ready (e.g., `https://suno-api.yourdomain.com`)

## Basic Workflows

### 1. Generate a Song

Create an HTTP Request node:

**Method:** `POST`  
**URL:** `https://your-api-url/generate`  
**Authentication:** None (if API is public)  
**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "gpt_description_prompt": "A happy upbeat song about coding",
  "make_instrumental": false,
  "mv": "chirp-crow"
}
```

**Response:**
The response will contain `clips` array with clip IDs and status:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "clips": [
      {
        "id": "abc123...",
        "status": "complete",
        "audio_url": "https://..."
      }
    ]
  }
}
```

### 2. Check Song Status

After generating, you'll need to poll for completion:

**Method:** `GET`  
**URL:** `https://your-api-url/feed/{{ $json.data.clips[0].id }}`

Use N8N's **Wait** node between generate and check to avoid hitting rate limits.

### 3. Complete Workflow Example

```
HTTP Request (Generate Song)
  ↓
Set (Extract clip_id from response)
  ↓
Wait (30 seconds)
  ↓
HTTP Request (Check Status)
  ↓
IF (status === "complete")
  ↓
  HTTP Request (Download audio)
  ↓
ELSE
  ↓
  Loop back to Wait
```

## Example Workflow: Generate and Wait for Completion

### Node 1: HTTP Request - Generate
- **Name:** Generate Song
- **Method:** POST
- **URL:** `https://your-api-url/generate`
- **Body:**
```json
{
  "gpt_description_prompt": "{{ $json.description }}",
  "make_instrumental": false
}
```

### Node 2: Set - Extract Clip ID
- **Name:** Extract Clip ID
- **Values:**
  - Name: `clip_id`
  - Value: `{{ $json.data.clips[0].id }}`
  - Name: `status`
  - Value: `{{ $json.data.clips[0].status }}`

### Node 3: Switch
- **Name:** Check Status
- **Rules:**
  - Rule 1: `{{ $json.status }}` equals `"complete"`
  - Rule 2: `{{ $json.status }}` equals `"queued"`
  - Rule 3: `{{ $json.status }}` equals `"processing"`

### Node 4: Wait (for queued/processing)
- **Name:** Wait 30s
- **Wait Time:** 30 seconds

### Node 5: HTTP Request - Check Status
- **Name:** Check Status
- **Method:** GET
- **URL:** `https://your-api-url/feed/{{ $json.clip_id }}`

### Node 6: Loop
Connect Wait → Check Status → Switch (creates polling loop)

### Node 7: HTTP Request - Get Final Result
- **Name:** Get Complete Song
- **Method:** GET
- **URL:** `https://your-api-url/feed/{{ $json.clip_id }}`

### Node 8: HTTP Request - Download Audio
- **Name:** Download Audio
- **Method:** GET
- **URL:** `https://your-api-url/download/{{ $json.clip_id }}`
- **Response Format:** Binary (File)
- **Save File:** Enable this option to save the file

## Advanced: Multiple Songs

To generate multiple songs in parallel:

1. Use **Split in Batches** node
2. Each batch generates one song
3. Use **Wait** and **Merge** nodes to collect results
4. Process all clips together

## API Endpoints Reference

### Generate Song
```
POST /generate
Body: {
  "gpt_description_prompt": string,
  "prompt": string (optional, usually empty),
  "make_instrumental": boolean,
  "mv": string (model version)
}
```

### Get Song by ID
```
GET /feed/{clip_id}
```

### Get Multiple Songs
```
POST /feed
Body: {
  "clip_ids": ["id1", "id2", "id3"]
}
```

### Download Audio File
```
GET /download/{clip_id}
Returns: Binary audio file (MP3)
```

### Get Download URL
```
GET /download-url/{clip_id}
Returns: JSON with audio_url
```

### Get Audio Info
```
GET /audio-info/{clip_id}
Returns: Complete audio information
```

### Check Credits
```
GET /credits
```

### Health Check
```
GET /health
```

## Error Handling

### Handle 401 (Unauthorized)
- Your token may have expired
- Update `SESSION_ID` and `COOKIE` environment variables
- Restart the API

### Handle 429 (Rate Limited)
- Add longer wait times between requests
- Reduce concurrent requests

### Handle 500 (Server Error)
- Check API logs
- Verify credentials are valid
- Check Suno service status

## Tips

1. **Polling Interval:** Don't poll too frequently (30-60 seconds is good)
2. **Error Retries:** Add retry logic for transient errors
3. **Timeout:** Set reasonable timeouts (song generation can take 2-5 minutes)
4. **Storage:** Download and store audio files promptly (URLs may expire)
5. **Credits:** Check credits before generating to avoid failures
6. **Download Options:** 
   - Use `/download/{clip_id}` for direct file download
   - Use `/download-url/{clip_id}` if you need the URL for external processing
   - Use `/audio-info/{clip_id}` to get complete metadata before downloading

## Example: Complete N8N JSON Workflow

Save this as a JSON file and import into N8N:

```json
{
  "name": "Suno Song Generator",
  "nodes": [
    {
      "name": "Generate Song",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://your-api-url/generate",
        "bodyParameters": {
          "parameters": [
            {
              "name": "gpt_description_prompt",
              "value": "A happy song"
            }
          ]
        }
      }
    },
    {
      "name": "Extract Clip ID",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {
              "name": "clip_id",
              "value": "={{ $json.data.clips[0].id }}"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "Generate Song": {
      "main": [[{"node": "Extract Clip ID", "type": "main", "index": 0}]]
    }
  }
}
```

## Support

For API issues, check:
- API logs
- `/health` endpoint
- `/credits` endpoint (to verify auth)

For N8N issues, check:
- N8N documentation
- Node configuration
- Network connectivity

