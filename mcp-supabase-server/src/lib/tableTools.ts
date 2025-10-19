// Database tools for common CRUD operations
import { z } from 'zod';
import { supabase } from './supabase.js';

export const tableTools = {
  insert: {
    title: 'Insert Records',
    description: 'Insert one or more records into a table',
    inputSchema: {
      table: z.string().describe('Name of the table'),
      records: z.array(z.record(z.any())).describe('Array of records to insert'),
      options: z.object({
        upsert: z.boolean().optional().describe('Whether to perform an upsert operation'),
      }).optional(),
    },
  },

  update: {
    title: 'Update Records',
    description: 'Update records in a table that match the filter criteria',
    inputSchema: {
      table: z.string().describe('Name of the table'),
      set: z.record(z.any()).describe('Object containing the fields to update'),
      filter: z.record(z.any()).describe('Filter criteria for selecting records to update'),
    },
  },

  delete: {
    title: 'Delete Records',
    description: 'Delete records from a table that match the filter criteria',
    inputSchema: {
      table: z.string().describe('Name of the table'),
      filter: z.record(z.any()).describe('Filter criteria for selecting records to delete'),
    },
  },

  count: {
    title: 'Count Records',
    description: 'Count the number of records in a table that match the filter criteria',
    inputSchema: {
      table: z.string().describe('Name of the table'),
      filter: z.record(z.any()).optional().describe('Optional filter criteria'),
    },
  },
};

export async function handleInsert(params: { table: string; records: Record<string, any>[]; options?: { upsert?: boolean } }) {
  const { table, records, options } = params;
  
  const { error } = options?.upsert
    ? await supabase.from(table).upsert(records)
    : await supabase.from(table).insert(records);
    
  if (error) throw error;
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ inserted: records.length })
    }]
  };
}

export async function handleUpdate(params: { table: string; set: Record<string, any>; filter: Record<string, any> }) {
  const { table, set, filter } = params;
  const { data, error } = await supabase
    .from(table)
    .update(set)
    .match(filter);

  if (error) throw error;
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ updated: data?.length ?? 0 })
    }]
  };
}

export async function handleDelete(params: { table: string; filter: Record<string, any> }) {
  const { table, filter } = params;
  const { data, error } = await supabase
    .from(table)
    .delete()
    .match(filter);

  if (error) throw error;
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ deleted: data?.length ?? 0 })
    }]
  };
}

export async function handleCount(params: { table: string; filter?: Record<string, any> }) {
  const { table, filter } = params;
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  
  if (filter) {
    query = query.match(filter);
  }

  const { count, error } = await query;
  if (error) throw error;
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ count })
    }]
  };
}