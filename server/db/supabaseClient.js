const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://vhkhdyraxtfajhfaewun.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.warn('⚠️ Warning: No SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY found in server/.env');
}

const supabase = createClient(supabaseUrl, supabaseKey || 'placeholder', {
  auth: { persistSession: false },
});

module.exports = { supabase };
