# Authentication Documentation

## Overview

This API uses **Bearer token authentication** with Google as the Identity Provider (IDP). Tokens are signed using the **RS256** algorithm (RSA Signature with SHA-256).

## Authentication Flow

```
┌─────────┐                ┌────────────┐                ┌─────────┐
│  Client │                │ Google IDP │                │   API   │
└────┬────┘                └─────┬──────┘                └────┬────┘
     │                           │                            │
     │  1. Request ID Token      │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │  2. Sign token with RS256 │                            │
     │     (Google's private key)│                            │
     │                           │                            │
     │  3. Return ID Token       │                            │
     │<──────────────────────────┤                            │
     │                           │                            │
     │  4. API Request with Bearer Token                      │
     ├────────────────────────────────────────────────────────>│
     │                           │                            │
     │                           │  5. Fetch public keys     │
     │                           │<───────────────────────────┤
     │                           │     (JWKS endpoint)        │
     │                           │                            │
     │                           │  6. Return public keys    │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │     7. Verify signature    │
     │                           │        with public key     │
     │                           │                            │
     │  8. Return API Response   │                            │
     │<────────────────────────────────────────────────────────┤
     │                           │                            │
```

## Setup Instructions

### 1. Configure Google OAuth 2.0

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Select **Web application** as application type
6. Configure:
   - **Authorized JavaScript origins**: `http://localhost:3000` (for development)
   - **Authorized redirect URIs**: Add your callback URLs
7. Copy the **Client ID**

### 2. Configure Environment Variables

Update `.env` file with your Google Client ID:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3. Obtain a Google ID Token

#### Option A: Using OAuth 2.0 Playground

1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check **"Use your own OAuth credentials"**
4. Enter your **Client ID** and **Client Secret**
5. In Step 1, select **"Google OAuth2 API v2"** > **"userinfo.email"** and **"userinfo.profile"**
6. Click **"Authorize APIs"**
7. Sign in with your Google account
8. In Step 2, click **"Exchange authorization code for tokens"**
9. Copy the **id_token** from the response

#### Option B: Using Google Sign-In in Your App

Implement Google Sign-In in your frontend application:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>

<div id="g_id_onload"
     data-client_id="YOUR_CLIENT_ID.apps.googleusercontent.com"
     data-callback="handleCredentialResponse">
</div>

<script>
function handleCredentialResponse(response) {
    // response.credential contains the JWT ID token
    console.log("ID Token: " + response.credential);

    // Use this token in your API requests
    fetch('http://localhost:3000/v1/plan', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + response.credential
        }
    });
}
</script>
```

#### Option C: Using Postman (Recommended for Testing)

Postman provides built-in OAuth 2.0 support that makes it easy to obtain and use Google ID tokens.

##### Prerequisites

1. **Configure Google OAuth with Postman Redirect URI**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** > **Credentials**
   - Edit your OAuth 2.0 Client ID
   - Add to **Authorized redirect URIs**:
     ```
     https://oauth.pstmn.io/v1/callback
     ```
   - Save changes
   - Copy your **Client ID** and **Client Secret**

##### Setup in Postman

1. **Create a New Collection**:
   - Open Postman
   - Click **New** > **Collection**
   - Name it "Advanced Big Data Indexing API"

2. **Configure Collection Authorization**:
   - Select your collection
   - Go to the **Authorization** tab
   - Set **Type** to **OAuth 2.0**
   - Configure the following settings:

   **Token Configuration:**
   - **Token Name**: `Google ID Token`
   - **Grant Type**: `Authorization Code`
   - **Callback URL**: `https://oauth.pstmn.io/v1/callback` (select "Authorize using browser")
   - **Auth URL**: `https://accounts.google.com/o/oauth2/v2/auth`
   - **Access Token URL**: `https://oauth2.googleapis.com/token`
   - **Client ID**: `your-client-id.apps.googleusercontent.com`
   - **Client Secret**: `your-client-secret`
   - **Scope**: `openid email profile`
   - **State**: `(leave empty or use random string)`
   - **Client Authentication**: `Send as Basic Auth header`

3. **Get New Access Token**:
   - Scroll down and click **Get New Access Token**
   - A browser window will open
   - Sign in with your Google account
   - Grant permissions
   - Postman will capture the token automatically
   - Click **Proceed** then **Use Token**

4. **Configure Collection to Use Token**:
   - Token will be automatically added to all requests in the collection
   - Set **"Add auth data to"**: `Request Headers`

##### Creating Requests in the Collection

Now create individual requests within your collection:

**1. Create Plan (POST)**
```
Method: POST
URL: http://localhost:3000/v1/plan
Headers:
  Content-Type: application/json
Body (raw JSON):
{
  "objectId": "plan123",
  "planName": "Health Plan",
  "cost": 1000
}
Auth: Inherit from parent (uses collection OAuth)
```

**2. Get Plan (GET)**
```
Method: GET
URL: http://localhost:3000/v1/plan/plan123
Auth: Inherit from parent
```

**3. Get Plan with Conditional Read (GET)**
```
Method: GET
URL: http://localhost:3000/v1/plan/plan123
Headers:
  If-None-Match: {{etag}}
Auth: Inherit from parent
```

**4. Update Plan (PUT)**
```
Method: PUT
URL: http://localhost:3000/v1/plan/plan123
Headers:
  Content-Type: application/json
  If-Match: {{etag}}
Body (raw JSON):
{
  "objectId": "plan123",
  "planName": "Updated Health Plan",
  "cost": 1200
}
Auth: Inherit from parent
```

**5. Patch Plan (PATCH)**
```
Method: PATCH
URL: http://localhost:3000/v1/plan/plan123
Headers:
  Content-Type: application/json
  If-Match: {{etag}}
Body (raw JSON):
{
  "cost": 1500
}
Auth: Inherit from parent
```

**6. Delete Plan (DELETE)**
```
Method: DELETE
URL: http://localhost:3000/v1/plan/plan123
Auth: Inherit from parent
```

##### Capturing and Using ETags in Postman

To work with ETags and conditional requests:

1. **Add Test Script to GET Request**:
   - Select your GET request
   - Go to **Tests** tab
   - Add this script to capture ETag:
   ```javascript
   // Capture ETag from response headers
   var etag = pm.response.headers.get("ETag");
   if (etag) {
       pm.collectionVariables.set("etag", etag);
       console.log("ETag captured: " + etag);
   }
   ```

2. **Use ETag Variable**:
   - In PUT/PATCH requests, use `{{etag}}` in If-Match header
   - In GET requests, use `{{etag}}` in If-None-Match header
   - Postman will automatically substitute the captured value

##### Testing the OAuth Flow

1. **Send a request** - Token will be automatically included
2. **If token expires** (after ~1 hour):
   - Go back to collection Authorization tab
   - Click **Get New Access Token**
   - Or click the **Available Tokens** dropdown and refresh

##### Troubleshooting

**Token Not Working**:
- Verify `GOOGLE_CLIENT_ID` in your `.env` file matches Postman's Client ID
- Check token hasn't expired (tokens last ~1 hour)
- Ensure redirect URI `https://oauth.pstmn.io/v1/callback` is in Google Console

**"Unauthorized" Response**:
- Check Auth inheritance is set to "Inherit from parent" in request
- Verify token is being sent in Authorization header (check Headers tab)
- Look at Postman Console (View > Show Postman Console) for request details

**Need to Debug Token**:
- Copy the token from Postman (click on OAuth 2.0 token)
- Paste into [JWT.io](https://jwt.io/) to decode and inspect
- Verify `alg` is `RS256` and `aud` matches your Client ID

##### Alternative: Manual Bearer Token in Postman

If you prefer to manually paste tokens:

1. Get token from OAuth Playground or another source
2. In request, set Authorization to **Bearer Token**
3. Paste token in the **Token** field
4. Send request

## Making Authenticated Requests

All API endpoints require authentication. Include the Bearer token in the `Authorization` header:

```bash
curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_GOOGLE_ID_TOKEN"
```

### Example with All Operations

#### 1. Create (POST)
```bash
curl -X POST http://localhost:3000/v1/plan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": "plan123",
    "planName": "Health Plan",
    "cost": 1000
  }'
```

#### 2. Read (GET) - Conditional Read
```bash
# First request - returns data with ETag
curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response includes: ETag: abc123xyz

# Subsequent request with If-None-Match
curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "If-None-Match: abc123xyz"

# Returns 304 Not Modified if unchanged
```

#### 3. Update (PUT) - Conditional Write
```bash
# Get current ETag first
ETAG=$(curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -I | grep -i etag | cut -d' ' -f2)

# Update with If-Match
curl -X PUT http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "If-Match: $ETAG" \
  -H "Content-Type: application/json" \
  -d '{
    "objectId": "plan123",
    "planName": "Updated Health Plan",
    "cost": 1200
  }'

# Returns 412 Precondition Failed if ETag doesn't match
```

#### 4. Partial Update (PATCH) - Merge with Conditional Write
```bash
# Get current ETag
ETAG=$(curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -I | grep -i etag | cut -d' ' -f2)

# Merge update with If-Match
curl -X PATCH http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "If-Match: $ETAG" \
  -H "Content-Type: application/json" \
  -d '{
    "cost": 1500
  }'
```

#### 5. Delete (DELETE)
```bash
curl -X DELETE http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Token Validation Process

The API validates tokens using the following steps:

1. **Extract Token**: Parse the `Authorization: Bearer <token>` header
2. **Verify Algorithm**: Ensure the token uses RS256 (not HS256 or other algorithms)
3. **Verify Signature**: Use Google's public keys from their JWKS endpoint:
   - Endpoint: `https://www.googleapis.com/oauth2/v3/certs`
   - Keys are automatically fetched and cached
4. **Verify Claims**:
   - `iss` (issuer): Must be `accounts.google.com` or `https://accounts.google.com`
   - `aud` (audience): Must match your `GOOGLE_CLIENT_ID`
   - `exp` (expiration): Token must not be expired
   - `iat` (issued at): Token must not be used too early
5. **Extract User Info**: Attach verified user information to `req.user`

## Token Structure

A decoded Google ID Token contains:

### Header
```json
{
  "alg": "RS256",
  "kid": "key-id-from-google",
  "typ": "JWT"
}
```

### Payload
```json
{
  "iss": "https://accounts.google.com",
  "sub": "1234567890",
  "aud": "your-client-id.apps.googleusercontent.com",
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "iat": 1699000000,
  "exp": 1699003600
}
```

### Signature
Signed using Google's RSA private key (verified using their public key)

## Error Responses

### 401 Unauthorized - Missing Token
```json
{
  "error": "Unauthorized",
  "message": "No authorization header provided"
}
```

### 401 Unauthorized - Invalid Format
```json
{
  "error": "Unauthorized",
  "message": "Invalid authorization header format. Use: Bearer <token>"
}
```

### 401 Unauthorized - Wrong Algorithm
```json
{
  "error": "Unauthorized",
  "message": "Invalid token algorithm. Expected RS256"
}
```

### 401 Unauthorized - Expired Token
```json
{
  "error": "Unauthorized",
  "message": "Token has expired"
}
```

### 412 Precondition Failed - ETag Mismatch
```json
"Precondition Failed: Resource has been modified"
```

## Security Considerations

1. **RS256 vs HS256**:
   - RS256 (RSA + SHA-256): Asymmetric algorithm, IDP signs with private key, API verifies with public key
   - HS256 (HMAC + SHA-256): Symmetric algorithm, same secret for signing and verifying (NOT used here)

2. **Token Expiration**:
   - Google ID tokens typically expire after 1 hour
   - Clients must obtain new tokens after expiration
   - Refresh tokens can be used to get new ID tokens without re-authentication

3. **HTTPS Required**:
   - Always use HTTPS in production
   - Bearer tokens in HTTP headers can be intercepted over plain HTTP

4. **Audience Validation**:
   - Always verify the `aud` claim matches your Client ID
   - Prevents token reuse across different applications

5. **No Token Storage**:
   - Tokens are verified on each request
   - No server-side session storage required (stateless authentication)

## Testing

### Test with Invalid Token
```bash
curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer invalid-token"

# Expected: 401 Unauthorized
```

### Test without Authorization
```bash
curl -X GET http://localhost:3000/v1/plan/plan123

# Expected: 401 Unauthorized
```

### Test with Valid Token
```bash
curl -X GET http://localhost:3000/v1/plan/plan123 \
  -H "Authorization: Bearer VALID_GOOGLE_TOKEN"

# Expected: 200 OK with data (if resource exists)
```

## Additional Resources

- [Google Identity Documentation](https://developers.google.com/identity/protocols/oauth2)
- [RS256 vs HS256](https://auth0.com/blog/rs256-vs-hs256-whats-the-difference/)
- [JWT.io - Token Decoder](https://jwt.io/) (for debugging tokens)
- [Google's Public Keys](https://www.googleapis.com/oauth2/v3/certs) (JWKS endpoint)
