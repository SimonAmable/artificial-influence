const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase URL or service role key in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('automations')
    .select('id, name, is_public, preview_thread, preview_captured_at')
    .eq('is_public', true);

  if (error) {
    console.error("Error fetching automations:", error);
    return;
  }

  console.log("Found community automations:", data.length);
  for (const row of data) {
    console.log(`\nAutomation ID: ${row.id}, Name: ${row.name}`);
    console.log(`Preview Thread exists:`, !!row.preview_thread);
    if (row.preview_thread) {
      console.log(`Preview Thread Keys:`, Object.keys(row.preview_thread));
      console.log(`Messages Count:`, Array.isArray(row.preview_thread) ? row.preview_thread.length : typeof row.preview_thread);
      console.log(`First few messages structure:`, JSON.stringify(row.preview_thread, null, 2).slice(0, 1000));
    }
  }
}

run();
