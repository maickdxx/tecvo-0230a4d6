INSERT INTO public.ai_credit_config (action_slug, credits_cost, label) VALUES
  ('bot_lead_reply', 1, 'Resposta para lead'),
  ('audio_transcription', 0, 'Transcrição de áudio'),
  ('tts_generation', 0, 'Geração de áudio'),
  ('onboarding_chat', 0, 'Chat de onboarding')
ON CONFLICT (action_slug) DO NOTHING;