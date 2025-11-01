const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Google OAuth2 client for token verification
// The client ID should be set in environment variables
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Middleware to validate Google Bearer tokens using RS256
 * Google signs tokens with RS256, and we verify using their public keys
 */
async function validateGoogleToken(req, res, next) {
    try {
        // Extract Bearer token from Authorization header
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No authorization header provided'
            });
        }

        // Check if it's a Bearer token
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid authorization header format. Use: Bearer <token>'
            });
        }

        const token = parts[1];

        // Basic token format validation
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token format. JWT must have 3 parts (header.payload.signature). Make sure you are using an ID token, not the Client ID.'
            });
        }

        // Verify the token using Google's public keys (RS256 verification)
        // Google automatically fetches and caches the public keys from:
        // https://www.googleapis.com/oauth2/v3/certs
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID, // Verify token is for our app
        });

        // Get the payload (user info)
        const payload = ticket.getPayload();

        // Verify the token is signed with RS256
        const header = jwt.decode(token, { complete: true });
        if (!header || header.header.alg !== 'RS256') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid token algorithm. Expected RS256'
            });
        }

        // Attach user info to request for downstream use
        req.user = {
            sub: payload.sub,           // User's unique Google ID
            email: payload.email,
            email_verified: payload.email_verified,
            name: payload.name,
            picture: payload.picture,
            iss: payload.iss,           // Token issuer (Google)
            aud: payload.aud,           // Audience (your client ID)
            iat: payload.iat,           // Issued at time
            exp: payload.exp            // Expiration time
        };

        next();
    } catch (error) {
        console.error('Token validation error:', error.message);

        // Handle specific error cases
        if (error.message.includes('Token used too early')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token not yet valid'
            });
        }

        if (error.message.includes('Token used too late')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token has expired'
            });
        }

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token'
        });
    }
}

module.exports = validateGoogleToken;
