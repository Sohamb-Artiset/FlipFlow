import { Router, Request, Response, NextFunction } from 'express';

interface OAuthMetadata {
  issuer: string;
  token_endpoint: string;
  authorization_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint: string;
  registration_endpoint: string;
  introspection_endpoint: string;
  response_types_supported?: string[];
}

export function createOAuthUrls() {
  const baseUrl = process.env.SUPABASE_URL;
  if (!baseUrl) throw new Error('SUPABASE_URL is not set');
  
  return {
    issuer: `${baseUrl}/auth/v1`,
    token_endpoint: `${baseUrl}/auth/v1/token`,
    authorization_endpoint: `${baseUrl}/auth/v1/authorize`,
    jwks_uri: `${baseUrl}/auth/v1/jwks`,
    userinfo_endpoint: `${baseUrl}/auth/v1/userinfo`,
    registration_endpoint: `${baseUrl}/auth/v1/client`,
    introspection_endpoint: `${baseUrl}/auth/v1/token/introspect`,
  };
}

export function mcpAuthMetadataRouter(config: {
  oauthMetadata: OAuthMetadata;
  resourceServerUrl: URL;
  scopesSupported: string[];
  resourceName: string;
}) {
  const router = Router();

  router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    res.json({
      resource_uri: config.resourceServerUrl.toString(),
      authorization_servers: [config.oauthMetadata.issuer],
      resource_name: config.resourceName,
      description: 'MCP server for Supabase integration',
      scopes_supported: config.scopesSupported,
    });
  });

  return router;
}

export function requireBearerAuth(config: {
  verifier: {
    verifyAccessToken: (token: string) => Promise<any>;
  };
  requiredScopes: string[];
  resourceMetadataUrl: URL;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_request',
        error_description: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.slice(7);

    try {
      const user = await config.verifier.verifyAccessToken(token);
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired token',
      });
    }
  };
}