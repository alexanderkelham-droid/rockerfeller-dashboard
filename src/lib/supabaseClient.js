import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nohouhstbuysnimquvtx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaG91aHN0YnV5c25pbXF1dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3MDAxOSwiZXhwIjoyMDg1MzQ2MDE5fQ.S8EBKUQrJy8aOhkHR3CKTYReKRjoEmB03euLtsdnpIs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
