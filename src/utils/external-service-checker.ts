import axios from 'axios';
import { serverLogger } from './logger';

/**
 * 외부 서비스 상태 체크 결과 인터페이스
 */
export interface ServiceCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
  lastChecked: string;
  details?: any;
}

/**
 * 외부 서비스 체크 설정 인터페이스
 */
export interface ServiceCheckConfig {
  name: string;
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  timeout?: number;
  headers?: Record<string, string>;
  expectedStatus?: number;
  payload?: any;
  validateResponse?: (response: any) => boolean;
}

/**
 * 외부 서비스 상태 체커 클래스
 */
export class ExternalServiceChecker {
  private services: ServiceCheckConfig[];
  private results: Map<string, ServiceCheckResult> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * 생성자
   * @param services 체크할 서비스 설정 목록
   */
  constructor(services: ServiceCheckConfig[] = []) {
    this.services = services;
    this.loadDefaultServices();
  }

  /**
   * 기본 서비스 설정 로드
   */
  private loadDefaultServices(): void {
    // 환경 변수에서 외부 서비스 설정 로드
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      this.services.push({
        name: 'Google Translate API',
        url: 'https://translation.googleapis.com/language/translate/v2/detect',
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          q: 'Hello',
          key: process.env.GOOGLE_TRANSLATE_API_KEY,
        },
        expectedStatus: 200,
      });
    }

    // 카카오 API 설정 (있는 경우)
    if (process.env.KAKAO_CLIENT_ID) {
      this.services.push({
        name: 'Kakao API',
        url: 'https://kapi.kakao.com/v1/user/access_token_info',
        method: 'GET',
        timeout: 3000,
        headers: {
          Authorization: `Bearer ${process.env.KAKAO_CLIENT_ID}`,
        },
        // 401도 정상적인 응답으로 간주 (토큰이 없어도 서비스는 동작 중)
        expectedStatus: 401,
      });
    }

    // OpenAI API 설정 (있는 경우)
    if (process.env.OPENAI_API_KEY) {
      this.services.push({
        name: 'OpenAI API',
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        expectedStatus: 200,
      });
    }
  }

  /**
   * 서비스 추가
   * @param service 서비스 설정
   */
  public addService(service: ServiceCheckConfig): void {
    this.services.push(service);
  }

  /**
   * 단일 서비스 체크
   * @param service 서비스 설정
   * @returns 체크 결과
   */
  public async checkService(service: ServiceCheckConfig): Promise<ServiceCheckResult> {
    const startTime = Date.now();
    const result: ServiceCheckResult = {
      name: service.name,
      status: 'unhealthy',
      responseTime: 0,
      lastChecked: new Date().toISOString(),
    };

    try {
      const method = service.method || 'GET';
      const timeout = service.timeout || 5000;
      const headers = service.headers || {};
      const expectedStatus = service.expectedStatus || 200;

      let response;
      if (method === 'GET' || method === 'HEAD') {
        response = await axios({
          method,
          url: service.url,
          headers,
          timeout,
        });
      } else {
        response = await axios({
          method,
          url: service.url,
          headers,
          data: service.payload,
          timeout,
        });
      }

      result.responseTime = Date.now() - startTime;

      // 응답 상태 코드 확인
      if (response.status === expectedStatus) {
        result.status = 'healthy';
      } else {
        result.status = 'degraded';
        result.error = `예상 상태 코드(${expectedStatus})와 다름: ${response.status}`;
      }

      // 추가 검증 함수가 있는 경우 실행
      if (service.validateResponse && response.data) {
        const isValid = service.validateResponse(response.data);
        if (!isValid) {
          result.status = 'degraded';
          result.error = '응답 데이터 검증 실패';
        }
      }

      // 상세 정보 추가 (민감 정보 제외)
      result.details = {
        statusCode: response.status,
        statusText: response.statusText,
        headers: this.sanitizeHeaders(response.headers),
      };
    } catch (error) {
      result.responseTime = Date.now() - startTime;
      result.status = 'unhealthy';
      result.error = error instanceof Error ? error.message : '알 수 없는 오류';

      serverLogger.warn(`외부 서비스 체크 실패: ${service.name}`, {
        service: service.name,
        url: service.url,
        error: result.error,
      });
    }

    // 결과 캐싱
    this.results.set(service.name, result);
    return result;
  }

  /**
   * 모든 서비스 체크
   * @returns 모든 서비스의 체크 결과
   */
  public async checkAllServices(): Promise<ServiceCheckResult[]> {
    const results: ServiceCheckResult[] = [];

    for (const service of this.services) {
      try {
        const result = await this.checkService(service);
        results.push(result);
      } catch (error) {
        serverLogger.error(`서비스 체크 중 예외 발생: ${service.name}`, error instanceof Error ? error : new Error(String(error)));
        
        // 오류가 발생해도 결과 추가
        results.push({
          name: service.name,
          status: 'unhealthy',
          responseTime: 0,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          lastChecked: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * 주기적인 서비스 체크 시작
   * @param intervalMs 체크 간격 (밀리초)
   */
  public startPeriodicChecks(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.checkAllServices();
        serverLogger.debug('주기적 외부 서비스 상태 체크 완료', {
          servicesCount: this.services.length,
          nextCheckIn: `${intervalMs / 1000}초 후`,
        });
      } catch (error) {
        serverLogger.error('주기적 서비스 체크 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
      }
    }, intervalMs);

    serverLogger.info('외부 서비스 주기적 체크 시작', {
      interval: `${intervalMs / 1000}초`,
      servicesCount: this.services.length,
    });
  }

  /**
   * 주기적인 서비스 체크 중지
   */
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      serverLogger.info('외부 서비스 주기적 체크 중지');
    }
  }

  /**
   * 캐시된 결과 조회
   * @returns 모든 서비스의 최신 체크 결과
   */
  public getCachedResults(): ServiceCheckResult[] {
    return Array.from(this.results.values());
  }

  /**
   * 특정 서비스의 캐시된 결과 조회
   * @param serviceName 서비스 이름
   * @returns 서비스의 최신 체크 결과
   */
  public getCachedResult(serviceName: string): ServiceCheckResult | undefined {
    return this.results.get(serviceName);
  }

  /**
   * 전체 상태 요약
   * @returns 전체 서비스 상태 요약
   */
  public getOverallStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    totalCount: number;
  } {
    const results = this.getCachedResults();
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const totalCount = results.length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyCount > 0) {
      status = 'unhealthy';
    } else if (degradedCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      healthyCount,
      degradedCount,
      unhealthyCount,
      totalCount,
    };
  }

  /**
   * 헤더에서 민감 정보 제거
   * @param headers 응답 헤더
   * @returns 민감 정보가 제거된 헤더
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'api-key',
    ];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }
} 