import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to handle Supabase errors
const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  throw error;
};

// User related functions
export const getUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) handleSupabaseError(error);
  return data;
};

// Lead related functions
export const getLeads = async (organizationId: string) => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  
  if (error) handleSupabaseError(error);
  return data || [];
};

export const createLead = async (leadData: any) => {
  const { data, error } = await supabase
    .from('leads')
    .insert([leadData])
    .select()
    .single();
  
  if (error) handleSupabaseError(error);
  return data;
};

// Activity related functions
export const logActivity = async (activityData: any) => {
  const { data, error } = await supabase
    .from('activities')
    .insert([activityData])
    .select()
    .single();
  
  if (error) handleSupabaseError(error);
  return data;
};
