const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const hash = '$2b$10$jOkH67ANclcLpzA3gR089ulsKCatuni4gNOQuoFTssQq0ce/Abusi';
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('email', 'admin@gmail.com')
    .select();

  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log('Successfully updated password hash for admin@gmail.com:', data);
  }
}

run();
