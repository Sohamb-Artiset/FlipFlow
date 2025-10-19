import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { supabase, adminSupabase } from './lib/supabase.js';
import { createOAuthUrls, mcpAuthMetadataRouter, requireBearerAuth } from './lib/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize MCP server
const server = new McpServer({
  name: 'supabase-mcp-server',
  version: '1.0.0',
});

// Setup OAuth metadata
const mcpServerUrl = new URL(`http://${process.env.MCP_SERVER_HOST || 'localhost'}:${process.env.MCP_SERVER_PORT || 3000}`);
const oauthUrls = createOAuthUrls();

const oauthMetadata = {
  ...oauthUrls,
  response_types_supported: ['code'],
};

// Add authorization middleware
app.use(mcpAuthMetadataRouter({
  oauthMetadata,
  resourceServerUrl: mcpServerUrl,
  scopesSupported: ['mcp:tools'],
  resourceName: 'Supabase MCP Server'
}));

const authMiddleware = requireBearerAuth({
  verifier: {
    verifyAccessToken: async (token: string) => {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error) throw error;
      return user;
    }
  },
  requiredScopes: ['mcp:tools'],
  resourceMetadataUrl: new URL('.well-known/oauth-protected-resource', mcpServerUrl)
});

import { tableTools, handleInsert, handleUpdate, handleDelete, handleCount } from './lib/tableTools.js';

// Register query tool
server.registerTool(
  'query_table',
  {
    title: 'Query Table',
    description: 'Execute a query on a Supabase table',
    inputSchema: {
      table: z.string().describe('Name of the table to query'),
      select: z.string().describe('Columns to select'),
      where: z.string().optional().describe('WHERE clause conditions'),
      limit: z.number().optional().describe('Maximum number of rows to return'),
    },
  },
  async ({ table, select, where, limit }, context) => {
    // Use the authenticated user's session
    let query = supabase.from(table).select(select);

    if (where) {
      query = query.filter(where);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }
);

// Register CRUD tools
server.registerTool('insert_records', tableTools.insert, handleInsert);
server.registerTool('update_records', tableTools.update, handleUpdate);
server.registerTool('delete_records', tableTools.delete, handleDelete);
server.registerTool('count_records', tableTools.count, handleCount);

// Start the server with HTTP transport
const port = process.env.MCP_SERVER_PORT ? parseInt(process.env.MCP_SERVER_PORT) : 3000;
const host = process.env.MCP_SERVER_HOST || 'localhost';

const transport = new StreamableHTTPServerTransport();
await server.connect(transport);

app.use('/', authMiddleware, (req, res) => transport.handleRequest(req, res));

app.listen(port, host, () => {
  console.log(`MCP Server listening on ${host}:${port}`);
});