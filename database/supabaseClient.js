const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Check if Supabase environment variables are set
const hasSupabaseConfig = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co';

const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

module.exports = { supabase, hasSupabaseConfig };