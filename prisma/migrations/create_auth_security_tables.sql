-- Authentication Security Enhancement Migration
-- 생성 날짜: 2024-12-27
-- 목적: 토큰 블랙리스트, 리프레시 토큰, 로그인 시도 추적 테이블 생성

-- 1. 토큰 블랙리스트 테이블
CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '알 수 없음',
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 토큰 블랙리스트 인덱스
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_hash ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- 2. 리프레시 토큰 테이블
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 리프레시 토큰 인덱스
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- 3. 로그인 시도 추적 테이블 (Rate Limiting용)
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- IP, email, user_id 등
    identifier_type VARCHAR(50) NOT NULL, -- 'ip', 'email', 'user_id'
    attempt_type VARCHAR(50) NOT NULL, -- 'login', 'refresh', 'logout'
    success BOOLEAN NOT NULL,
    user_id VARCHAR(255) NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    error_message TEXT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 로그인 시도 인덱스
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_type ON login_attempts(identifier_type);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts(ip_address);

-- 4. 사용자 보안 설정 테이블
CREATE TABLE IF NOT EXISTS user_security_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255) NULL,
    backup_codes TEXT[] NULL,
    login_notifications BOOLEAN DEFAULT TRUE,
    session_timeout_minutes INTEGER DEFAULT 1440, -- 24시간
    max_concurrent_sessions INTEGER DEFAULT 5,
    last_password_change TIMESTAMP WITH TIME ZONE NULL,
    password_expires_at TIMESTAMP WITH TIME ZONE NULL,
    account_locked_until TIMESTAMP WITH TIME ZONE NULL,
    failed_login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 사용자 보안 설정 인덱스
CREATE INDEX IF NOT EXISTS idx_user_security_user_id ON user_security_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_account_locked ON user_security_settings(account_locked_until);

-- 5. 활성 세션 테이블
CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    device_info JSONB NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NULL,
    location JSONB NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 활성 세션 인덱스
CREATE INDEX IF NOT EXISTS idx_active_sessions_session_id ON active_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON active_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON active_sessions(last_activity);

-- 6. 보안 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL, -- 'suspicious_login', 'token_theft', 'account_lockout' 등
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    user_id VARCHAR(255) NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    description TEXT NOT NULL,
    metadata JSONB NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE NULL,
    resolved_by VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 보안 이벤트 인덱스
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS update_token_blacklist_updated_at ON token_blacklist;
CREATE TRIGGER update_token_blacklist_updated_at 
    BEFORE UPDATE ON token_blacklist 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_refresh_tokens_updated_at ON refresh_tokens;
CREATE TRIGGER update_refresh_tokens_updated_at 
    BEFORE UPDATE ON refresh_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_security_settings_updated_at ON user_security_settings;
CREATE TRIGGER update_user_security_settings_updated_at 
    BEFORE UPDATE ON user_security_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 데이터 정리를 위한 저장 프로시저
CREATE OR REPLACE FUNCTION cleanup_expired_security_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- 만료된 블랙리스트 토큰 삭제
    DELETE FROM token_blacklist WHERE expires_at < NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- 만료된 리프레시 토큰 삭제
    DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = true;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- 30일 이상 된 로그인 시도 기록 삭제
    DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- 만료된 세션 삭제
    DELETE FROM active_sessions WHERE expires_at < NOW() OR is_active = false;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- 90일 이상 된 해결된 보안 이벤트 삭제
    DELETE FROM security_events WHERE resolved = true AND resolved_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 초기 보안 설정 데이터 삽입 (기존 사용자들을 위해)
INSERT INTO user_security_settings (user_id, created_at)
SELECT id, NOW()
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_security_settings)
ON CONFLICT (user_id) DO NOTHING;

-- 권한 설정 (필요에 따라 조정)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- 마이그레이션 완료 로그
INSERT INTO security_events (event_type, severity, description, metadata, created_at)
VALUES (
    'migration_completed',
    'low',
    '인증 보안 강화 마이그레이션이 성공적으로 완료되었습니다.',
    '{"migration": "auth_security_enhancement", "version": "1.0.0", "tables_created": 6}',
    NOW()
); 