export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function extractModel(): string {
  return process.env.OPENAI_EXTRACT_MODEL ?? "gpt-5.4-mini";
}

export function summaryModel(): string {
  return process.env.OPENAI_SUMMARY_MODEL ?? "gpt-5.4-nano";
}
