# MCP Supabase Server

This is a Model Context Protocol (MCP) server that provides integration with Supabase, enabling AI applications to interact with your Supabase database through a secure, standardized interface.

## Features

- Database operations (query, insert, update, delete) through MCP tools
- Real-time subscriptions for database changes
- Authentication integration
- Error handling and logging

## Setup

1. Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (optional)
- `MCP_SERVER_PORT`: Port for the MCP server (default: 3000)
- `MCP_SERVER_HOST`: Host for the MCP server (default: localhost)

## Available Tools

### query_table

Query data from a Supabase table.

```typescript
{
  table: string,    // Name of the table to query
  select: string,   // Columns to select
  where?: string,   // Optional WHERE clause conditions
  limit?: number    // Optional maximum number of rows to return
}
```

More tools coming soon!

## Security

- Uses Supabase's built-in Row Level Security (RLS)
- Respects database permissions and policies
- Optional service role key for admin operations

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request