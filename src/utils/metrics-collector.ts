import { NextFunction, Request, Response } from 'express';
import { serverLogger } from './logger';

/**
 * 메트릭 타입 정의
 */
type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * 메트릭 정의 인터페이스
 */
interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labels?: string[];
}

/**
 * 메트릭 값 인터페이스
 */
interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

/**
 * 메트릭 객체 인터페이스
 */
interface Metric {
  definition: MetricDefinition;
  values: MetricValue[];
}

/**
 * 메트릭 수집기 클래스
 */
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private startTime: number;
  private requestCounts: Record<string, number> = {};
  private responseTimes: Record<string, number[]> = {};
  private errorCounts: Record<string, number> = {};
  private statusCounts: Record<string, Record<number, number>> = {};

  constructor() {
    this.startTime = Date.now();
    this.initializeDefaultMetrics();
  }

  /**
   * 기본 메트릭 초기화
   */
  private initializeDefaultMetrics(): void {
    // 서버 업타임 메트릭
    this.registerMetric({
      name: 'jiksend_server_uptime_seconds',
      help: '서버 업타임 (초)',
      type: 'gauge',
    });

    // 메모리 사용량 메트릭
    this.registerMetric({
      name: 'jiksend_memory_usage_bytes',
      help: '메모리 사용량 (바이트)',
      type: 'gauge',
      labels: ['type'],
    });

    // HTTP 요청 카운터
    this.registerMetric({
      name: 'jiksend_http_requests_total',
      help: 'HTTP 요청 총 개수',
      type: 'counter',
      labels: ['method', 'path', 'status'],
    });

    // HTTP 응답 시간 히스토그램
    this.registerMetric({
      name: 'jiksend_http_request_duration_seconds',
      help: 'HTTP 요청 처리 시간 (초)',
      type: 'histogram',
      labels: ['method', 'path'],
    });

    // 에러 카운터
    this.registerMetric({
      name: 'jiksend_errors_total',
      help: '에러 총 개수',
      type: 'counter',
      labels: ['type'],
    });

    // 활성 연결 수
    this.registerMetric({
      name: 'jiksend_active_connections',
      help: '활성 연결 수',
      type: 'gauge',
    });

    // 데이터베이스 쿼리 카운터
    this.registerMetric({
      name: 'jiksend_database_queries_total',
      help: '데이터베이스 쿼리 총 개수',
      type: 'counter',
      labels: ['operation', 'model'],
    });

    // 데이터베이스 쿼리 시간
    this.registerMetric({
      name: 'jiksend_database_query_duration_seconds',
      help: '데이터베이스 쿼리 실행 시간 (초)',
      type: 'histogram',
      labels: ['operation', 'model'],
    });
  }

  /**
   * 새 메트릭 등록
   * @param definition 메트릭 정의
   */
  public registerMetric(definition: MetricDefinition): void {
    if (this.metrics.has(definition.name)) {
      serverLogger.warn(`메트릭 ${definition.name}이(가) 이미 등록되어 있습니다`);
      return;
    }

    this.metrics.set(definition.name, {
      definition,
      values: [],
    });
  }

  /**
   * 메트릭 값 설정 (gauge)
   * @param name 메트릭 이름
   * @param value 값
   * @param labels 라벨
   */
  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      serverLogger.warn(`메트릭 ${name}이(가) 등록되지 않았습니다`);
      return;
    }

    if (metric.definition.type !== 'gauge') {
      serverLogger.warn(`메트릭 ${name}은(는) gauge 타입이 아닙니다`);
      return;
    }

    // 기존 값 제거 (동일 라벨)
    metric.values = metric.values.filter(v => {
      if (!labels && !v.labels) return false;
      if (!labels || !v.labels) return true;
      
      // 모든 라벨이 일치하는지 확인
      for (const key of Object.keys(labels)) {
        if (labels[key] !== v.labels[key]) return true;
      }
      return false;
    });

    // 새 값 추가
    metric.values.push({
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * 카운터 증가
   * @param name 메트릭 이름
   * @param increment 증가량
   * @param labels 라벨
   */
  public incrementCounter(name: string, increment: number = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      serverLogger.warn(`메트릭 ${name}이(가) 등록되지 않았습니다`);
      return;
    }

    if (metric.definition.type !== 'counter') {
      serverLogger.warn(`메트릭 ${name}은(는) counter 타입이 아닙니다`);
      return;
    }

    // 기존 값 찾기
    let existingValue = metric.values.find(v => {
      if (!labels && !v.labels) return true;
      if (!labels || !v.labels) return false;
      
      // 모든 라벨이 일치하는지 확인
      for (const key of Object.keys(labels)) {
        if (labels[key] !== v.labels[key]) return false;
      }
      for (const key of Object.keys(v.labels)) {
        if (labels[key] !== v.labels[key]) return false;
      }
      return true;
    });

    if (existingValue) {
      existingValue.value += increment;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({
        value: increment,
        labels,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 히스토그램 값 기록
   * @param name 메트릭 이름
   * @param value 값
   * @param labels 라벨
   */
  public observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      serverLogger.warn(`메트릭 ${name}이(가) 등록되지 않았습니다`);
      return;
    }

    if (metric.definition.type !== 'histogram') {
      serverLogger.warn(`메트릭 ${name}은(는) histogram 타입이 아닙니다`);
      return;
    }

    // 히스토그램은 모든 관측값을 저장
    metric.values.push({
      value,
      labels,
      timestamp: Date.now(),
    });

    // 너무 많은 값이 쌓이지 않도록 제한
    const maxHistogramValues = 1000;
    if (metric.values.length > maxHistogramValues) {
      metric.values = metric.values.slice(-maxHistogramValues);
    }
  }

  /**
   * 시스템 메트릭 업데이트
   */
  public updateSystemMetrics(): void {
    // 업타임 업데이트
    this.setGauge('jiksend_server_uptime_seconds', (Date.now() - this.startTime) / 1000);

    // 메모리 사용량 업데이트
    const memoryUsage = process.memoryUsage();
    this.setGauge('jiksend_memory_usage_bytes', memoryUsage.rss, { type: 'rss' });
    this.setGauge('jiksend_memory_usage_bytes', memoryUsage.heapTotal, { type: 'heapTotal' });
    this.setGauge('jiksend_memory_usage_bytes', memoryUsage.heapUsed, { type: 'heapUsed' });
    this.setGauge('jiksend_memory_usage_bytes', memoryUsage.external, { type: 'external' });

    // 활성 연결 수 (프로세스 ID 기준으로 추정)
    this.setGauge('jiksend_active_connections', Object.keys(this.requestCounts).length);
  }

  /**
   * Prometheus 형식으로 메트릭 출력
   * @returns Prometheus 형식의 메트릭 문자열
   */
  public getPrometheusMetrics(): string {
    this.updateSystemMetrics();

    const lines: string[] = [];

    for (const [name, metric] of this.metrics.entries()) {
      // 메트릭 정의 추가
      lines.push(`# HELP ${name} ${metric.definition.help}`);
      lines.push(`# TYPE ${name} ${metric.definition.type}`);

      // 메트릭 값 추가
      for (const value of metric.values) {
        let line = name;

        // 라벨 추가
        if (value.labels && Object.keys(value.labels).length > 0) {
          const labelParts = Object.entries(value.labels).map(
            ([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`
          );
          line += `{${labelParts.join(',')}}`;
        }

        line += ` ${value.value}`;

        // 타임스탬프 추가 (밀리초 -> 초)
        if (value.timestamp) {
          line += ` ${Math.floor(value.timestamp / 1000)}`;
        }

        lines.push(line);
      }

      // 메트릭 구분을 위한 빈 줄
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * HTTP 요청 메트릭 미들웨어
   * @returns Express 미들웨어
   */
  public metricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const path = this.normalizePath(req.path);
      const method = req.method;

      // 요청 카운트 증가
      const requestKey = `${method}:${path}`;
      this.requestCounts[requestKey] = (this.requestCounts[requestKey] || 0) + 1;

      // 응답 완료 후 메트릭 기록
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000; // 초 단위로 변환
        const status = res.statusCode;

        // 응답 시간 기록
        if (!this.responseTimes[requestKey]) {
          this.responseTimes[requestKey] = [];
        }
        this.responseTimes[requestKey].push(duration);

        // 너무 많은 값이 쌓이지 않도록 제한
        if (this.responseTimes[requestKey].length > 100) {
          this.responseTimes[requestKey] = this.responseTimes[requestKey].slice(-100);
        }

        // 상태 코드 카운트
        if (!this.statusCounts[requestKey]) {
          this.statusCounts[requestKey] = {};
        }
        this.statusCounts[requestKey][status] = (this.statusCounts[requestKey][status] || 0) + 1;

        // 에러 카운트 (4xx, 5xx)
        if (status >= 400) {
          const errorType = status >= 500 ? 'server_error' : 'client_error';
          this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;
          this.incrementCounter('jiksend_errors_total', 1, { type: errorType });
        }

        // HTTP 요청 메트릭 업데이트
        this.incrementCounter('jiksend_http_requests_total', 1, {
          method,
          path,
          status: status.toString(),
        });

        // 응답 시간 히스토그램 업데이트
        this.observeHistogram('jiksend_http_request_duration_seconds', duration, {
          method,
          path,
        });
      });

      next();
    };
  }

  /**
   * 데이터베이스 쿼리 메트릭 기록
   * @param operation 작업 타입 (select, insert, update, delete 등)
   * @param model 모델 이름
   * @param duration 실행 시간 (초)
   */
  public recordDatabaseQuery(operation: string, model: string, duration: number): void {
    this.incrementCounter('jiksend_database_queries_total', 1, { operation, model });
    this.observeHistogram('jiksend_database_query_duration_seconds', duration, { operation, model });
  }

  /**
   * 경로 정규화 (동적 파라미터 제거)
   * @param path 요청 경로
   * @returns 정규화된 경로
   */
  private normalizePath(path: string): string {
    // UUID, 숫자 ID 등의 동적 파라미터를 패턴으로 대체
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:uuid')
      .replace(/\/\d+/g, '/:id');
  }
}

// 싱글톤 인스턴스 생성
export const metricsCollector = new MetricsCollector(); 