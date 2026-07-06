import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure this works in both Next.js and Vite environments just in case
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key are missing. Please check your environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://zsixkuokigkfsxlsuchr.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaXhrdW9raWdrZnN4bHN1Y2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTk5MjgsImV4cCI6MjA5ODkzNTkyOH0.lHwP-s6vZHyRnPhzq2C4rAhHa0SJiNTc0lh-T0tn1As'
);
