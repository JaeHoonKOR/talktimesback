-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_sourceText_targetLang_idx" ON "Translation"("sourceText", "targetLang");

-- CreateIndex
CREATE INDEX "Translation_lastUsedAt_idx" ON "Translation"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_sourceText_targetLang_key" ON "Translation"("sourceText", "targetLang");

-- 인증 보안 강화를 위한 테이블 추가

-- 리프레시 토큰 테이블
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- 토큰 블랙리스트 테이블
CREATE TABLE "token_blacklist" (
    "id" SERIAL NOT NULL,
    "jti" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blacklisted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "token_blacklist_jti_key" UNIQUE ("jti")
);

-- 사용자 보안 설정 테이블
CREATE TABLE "user_security_settings" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "account_locked_until" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "password_last_changed" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_security_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_security_settings_user_id_key" UNIQUE ("user_id")
);

-- 활성 세션 테이블
CREATE TABLE "active_sessions" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "device_info" JSONB NOT NULL,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "active_sessions_session_id_key" UNIQUE ("session_id")
);

-- 인증 이벤트 로그 테이블
CREATE TABLE "auth_event_logs" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_event_logs_pkey" PRIMARY KEY ("id")
);

-- 인덱스 생성
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

CREATE INDEX "token_blacklist_user_id_idx" ON "token_blacklist"("user_id");
CREATE INDEX "token_blacklist_expires_at_idx" ON "token_blacklist"("expires_at");

CREATE INDEX "active_sessions_user_id_idx" ON "active_sessions"("user_id");
CREATE INDEX "active_sessions_expires_at_idx" ON "active_sessions"("expires_at");

CREATE INDEX "auth_event_logs_user_id_idx" ON "auth_event_logs"("user_id");
CREATE INDEX "auth_event_logs_event_type_idx" ON "auth_event_logs"("event_type");
CREATE INDEX "auth_event_logs_created_at_idx" ON "auth_event_logs"("created_at");
