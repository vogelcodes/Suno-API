# Suno API - Unofficial API Wrapper

Unofficial Python API wrapper for [Suno](https://suno.com) music generation service. This API allows you to generate songs and retrieve them programmatically, perfect for integration with automation tools like N8N.

## Features

- 🎵 **Generate Songs**: Create songs using GPT description prompts
- 🔄 **Automatic Token Renewal**: JWT tokens are automatically renewed before expiration
- 📊 **Song Retrieval**: Get song/clip information by IDs
- 💳 **Credits Info**: Check your account credits and billing info
- 🚀 **FastAPI**: Modern async API built with FastAPI
- 🔌 **N8N Ready**: Simple HTTP endpoints perfect for N8N workflows

## Quick Start

### Prerequisites

1. A Suno account
2. Your session credentials from the browser

### Getting Your Credentials

1. Log in to [Suno](https://suno.com) in your browser
2. Open Developer Tools (F12)
3. Go to **Application** tab → **Cookies** → `https://suno.com`
4. Find the `__session` cookie and copy its value (this is your `SESSION_ID`)
5. Copy all cookies as a cookie string (this is your `COOKIE`)
   - In Chrome DevTools: Right-click on cookies → Copy as cURL → extract cookie header
   - Or use a cookie export extension

### Installation

```bash
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file or set environment variables:

```bash
SESSION_ID=your_session_id_here
COOKIE=your_cookie_string_here
DEVICE_ID=optional_device_id  # Auto-generated if not provided
```

### Running the API

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000` with documentation at `http://localhost:8000/docs`

## API Endpoints

### Generate Song

**POST** `/generate`

Generate a new song using a description prompt.

**Request Body:**
```json
{
  "gpt_description_prompt": "A happy upbeat song about coding",
  "make_instrumental": false,
  "mv": "chirp-crow"
}
```

**Response:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "clips": [
      {
        "id": "clip-id-here",
        "status": "complete",
        "audio_url": "https://..."
      }
    ]
  }
}
```

### Get Song/Clip Info

**POST** `/feed`

**GET** `/feed/{clip_id}`

Retrieve information about songs/clips by their IDs.

**Request Body (POST):**
```json
{
  "clip_ids": ["clip-id-1", "clip-id-2"]
}
```

### Download Audio

**GET** `/download/{clip_id}`

Download the audio file directly. The file will be streamed to the client.

**Example:**
```bash
curl -O https://your-api-url/download/clip-id-here
```

Or in N8N, use HTTP Request node with "Save File" option enabled.

### Get Download URL

**GET** `/download-url/{clip_id}`

Get the direct download URL for a clip (useful for direct downloads or N8N).

**Response:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "audio_url": "https://cdn1.suno.ai/...",
    "clip_id": "clip-id-here"
  }
}
```

### Get Audio Info

**GET** `/audio-info/{clip_id}`

Get complete audio information including URL, metadata, and status.

**Response:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "clip_id": "clip-id-here",
    "audio_url": "https://...",
    "title": "Song Title",
    "status": "complete",
    "metadata": {...}
  }
}
```

### Get Credits

**GET** `/credits`

Get your account credits and billing information.

### Get Session

**GET** `/session`

Get current session information including available models.

## Usage with N8N

### Generate a Song

1. Add an **HTTP Request** node
2. Method: `POST`
3. URL: `http://your-api-url/generate`
4. Headers: `Content-Type: application/json`
5. Body:
   ```json
   {
     "gpt_description_prompt": "A relaxing jazz tune",
     "make_instrumental": false
   }
   ```

### Check Song Status

1. Add an **HTTP Request** node
2. Method: `GET`
3. URL: `http://your-api-url/feed/{clip_id}`
   - Replace `{clip_id}` with the ID from the generate response

### Example N8N Workflow

```
HTTP Request (Generate) 
  → Wait (poll every 30 seconds)
  → HTTP Request (Check Status)
  → If Complete → Continue
  → If Not Complete → Loop back to Wait
```

## Token Management

The API automatically handles JWT token renewal:

- Tokens are checked before each request
- Tokens are renewed 5 minutes before expiration
- No manual intervention needed

If authentication fails:
1. Check that your `SESSION_ID` and `COOKIE` are still valid
2. Update them if they've expired
3. Restart the API

## Docker Deployment

### Build and Run

```bash
docker build -t suno-api .
docker run -p 8000:8000 \
  -e SESSION_ID=your_session_id \
  -e COOKIE=your_cookie_string \
  suno-api
```

### Docker Compose

```yaml
version: '3'
services:
  suno-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - SESSION_ID=${SESSION_ID}
      - COOKIE=${COOKIE}
      - DEVICE_ID=${DEVICE_ID}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_ID` | Yes | Your Suno session ID from browser cookies |
| `COOKIE` | Yes | Your Suno cookie string from browser |
| `DEVICE_ID` | No | Device ID (auto-generated UUID if not provided) |

## Model Versions

Available model versions (mv parameter):

- `chirp-crow` - Latest model (default)
- `chirp-v4` - Version 4
- `chirp-v3-5` - Version 3.5
- `chirp-v3-0` - Version 3.0

## Troubleshooting

### Token Expired

If you get authentication errors:
1. Log out and log back into Suno
2. Get fresh `SESSION_ID` and `COOKIE` values
3. Update environment variables and restart

### Song Generation Failed

- Check your credits: `GET /credits`
- Verify your prompt is not too long
- Check the model version is valid

### API Not Starting

- Ensure all environment variables are set
- Check port 8000 is not in use
- Review logs for specific errors

## Contributing

This is an unofficial API wrapper. Use at your own risk. The Suno service may change their API at any time.

## License

See LICENSE file.

## Disclaimer

This is an unofficial API wrapper. It is not affiliated with or endorsed by Suno. Use responsibly and in accordance with Suno's terms of service.
