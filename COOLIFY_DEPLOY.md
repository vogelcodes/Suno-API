# Deploying Suno API on Coolify

This guide will help you deploy the Suno API v2.0 on your Coolify instance.

## Prerequisites

1. A Coolify instance up and running
2. A Suno account with valid session credentials
3. Access to your Coolify dashboard

## Getting Your Credentials

Before deploying, you need to obtain your `SESSION_ID` and `COOKIE` from your browser:

1. Log in to [Suno](https://suno.com) in your browser
2. Open Developer Tools (F12)
3. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Navigate to **Cookies** → `https://suno.com`
5. Find the `__session` cookie and copy its value (this is your `SESSION_ID`)
6. Copy all cookies as a cookie string (this is your `COOKIE`)
   - You can use browser extensions or DevTools to export cookies

## Deployment Steps

### Option 1: Deploy via Git Repository (Recommended)

1. **Push your code to a Git repository** (GitHub, GitLab, etc.)

2. **In Coolify Dashboard:**
   - Navigate to **Applications** → **New Application**
   - Choose **From Public Repository** or **From Private Repository**
   - Select your Git provider and repository
   - Choose a branch (usually `main` or `master`)

3. **Configure the Application:**
   - **Name**: Give your application a name (e.g., `suno-api`)
   - **Build Pack**: Select **Dockerfile** (Coolify should auto-detect)
   - **Port**: Set to `8000` (this is the port the app uses)

4. **Set Environment Variables:**
   - Click on your application → **Environment Variables**
   - Add the following variables:
     ```
     SESSION_ID=your_actual_session_id
     COOKIE=your_actual_cookie_string
     ```
   - Optional: `DEVICE_ID` (auto-generated if not provided)
   - Make sure to replace the placeholder values with your actual credentials

5. **Deploy:**
   - Click **Deploy** or **Save & Deploy**
   - Wait for the build and deployment to complete

6. **Access Your API:**
   - Once deployed, Coolify will provide you with a URL
   - Visit `https://your-app-url/docs` to see the API documentation
   - Test the endpoints using the interactive Swagger UI

## API Endpoints

Once deployed, you'll have access to these endpoints:

- `POST /generate` - Generate a new song
- `POST /feed` - Get multiple songs/clips by IDs
- `GET /feed/{clip_id}` - Get a single song/clip by ID
- `GET /credits` - Get your account credits
- `GET /session` - Get session information
- `GET /health` - Health check endpoint

## N8N Integration

After deployment, use your Coolify URL in N8N:

1. **Generate Song:**
   ```
   POST https://your-app-url/generate
   Content-Type: application/json
   
   {
     "gpt_description_prompt": "A happy song about coding",
     "make_instrumental": false
   }
   ```

2. **Check Song Status:**
   ```
   GET https://your-app-url/feed/{clip_id}
   ```

## Token Management

The API automatically handles JWT token renewal:
- Tokens are renewed automatically before expiration
- No manual intervention needed
- If authentication fails, update your `SESSION_ID` and `COOKIE` environment variables

## Environment Variables

Required environment variables:

| Variable     | Description             | Example                           |
| ------------ | ----------------------- | --------------------------------- |
| `SESSION_ID` | Your Suno session ID    | `sess_abc123xyz...`               |
| `COOKIE`     | Your Suno cookie string | `__session=...; __client_uat=...` |

Optional:

| Variable     | Description                    | Default                      |
| ------------ | ------------------------------ | ---------------------------- |
| `DEVICE_ID`  | Device ID for requests         | Auto-generated UUID          |

**Important Notes:**

- Never commit your actual `.env` file to Git
- Always use Coolify's environment variables feature for secrets
- The session ID and cookie may expire; you'll need to update them if the app stops working

## Port Configuration

The application runs on port **8000** by default. Make sure:

- Your Coolify application port is set to `8000`
- The Dockerfile exposes port `8000` (already configured)
- Your domain/proxy is correctly routing to this port

## Health Check

After deployment, verify your application is working:

1. Check the application logs in Coolify
2. Visit `https://your-app-url/docs` - you should see the FastAPI documentation
3. Test the `/health` endpoint: `GET https://your-app-url/health`
4. Test the `/credits` endpoint to verify authentication is working

## Troubleshooting

### Application won't start

- Check that `SESSION_ID` and `COOKIE` environment variables are set correctly
- Verify the environment variables have no extra quotes or spaces
- Check the application logs in Coolify for specific error messages

### Token/Authentication errors

- Your session may have expired - update `SESSION_ID` and `COOKIE`
- Make sure the cookie string includes all necessary cookies
- Verify you're logged into Suno in your browser
- Check the logs for token renewal messages

### Port issues

- Ensure the application port is set to `8000` in Coolify
- Check that no other service is using port `8000`
- Verify the Dockerfile exposes the correct port

### Build failures

- Check that your Dockerfile is in the root of your repository
- Verify all dependencies in `requirements.txt` are valid
- Check build logs for specific package installation errors

## Updating the Application

When you need to update:

1. Push your changes to Git
2. In Coolify, click **Redeploy** or **Pull & Deploy**
3. Coolify will automatically rebuild and redeploy

## API Documentation

Once deployed, access the interactive API documentation at:

- Swagger UI: `https://your-app-url/docs`
- ReDoc: `https://your-app-url/redoc`

## Security Considerations

- The application has CORS enabled for all origins (`allow_origins=["*"]`)
- Consider restricting CORS in production if you know your frontend domains
- Keep your `SESSION_ID` and `COOKIE` secret and never expose them
- Consider using Coolify's secrets management for sensitive credentials
- Tokens are automatically renewed and never logged

## Support

For issues specific to:

- **Coolify**: Check [Coolify Documentation](https://coolify.io/docs)
- **This API**: Check the main README.md or open an issue on the repository
- **Suno Service**: Check Suno's official documentation
