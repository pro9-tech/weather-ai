-- 001_create_chat_history_table.sql
-- 대화 내역을 저장하기 위한 테이블을 생성합니다.

CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    location TEXT NULL,
    weather_raw_data JSONB NULL
);

-- RLS (Row Level Security) 설정: 익명(anonymous) 사용자도 읽고 쓸 수 있도록 간단히 비활성화하거나 정책을 수립합니다.
-- 여기서는 누구나 쉽게 테스트할 수 있도록 RLS를 잠시 비활성화해 둡니다. (원할 경우 추후 활성화 가능)
ALTER TABLE public.chat_history DISABLE ROW LEVEL SECURITY;
