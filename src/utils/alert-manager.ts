import axios from 'axios';
import nodemailer from 'nodemailer';
import { serverLogger } from './logger';

/**
 * 알림 심각도 레벨
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 알림 메시지 인터페이스
 */
export interface AlertMessage {
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp?: Date;
  source?: string;
  data?: any;
}

/**
 * 알림 채널 설정 인터페이스
 */
export interface AlertChannelConfig {
  type: 'slack' | 'discord' | 'email';
  enabled: boolean;
  name?: string;
  webhookUrl?: string;
  emailConfig?: {
    to: string[];
    from: string;
  };
  minSeverity?: AlertSeverity;
}

/**
 * 알림 관리자 클래스
 */
export class AlertManager {
  private channels: AlertChannelConfig[] = [];
  private emailTransporter: nodemailer.Transporter | null = null;
  private alertHistory: AlertMessage[] = [];
  private readonly MAX_HISTORY_SIZE = 100;
  private alertThrottling: Map<string, number> = new Map();
  private readonly THROTTLE_WINDOW_MS = 60 * 60 * 1000; // 1시간

  /**
   * 생성자
   * @param channels 알림 채널 설정 목록
   */
  constructor(channels: AlertChannelConfig[] = []) {
    this.channels = channels;
    this.initializeFromEnv();
    this.setupEmailTransporter();
  }

  /**
   * 환경 변수에서 설정 초기화
   */
  private initializeFromEnv(): void {
    // Slack 웹훅 설정
    if (process.env.SLACK_WEBHOOK_URL) {
      this.channels.push({
        type: 'slack',
        name: 'Slack 알림',
        enabled: true,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        minSeverity: AlertSeverity.WARNING,
      });
    }

    // Discord 웹훅 설정
    if (process.env.DISCORD_WEBHOOK_URL) {
      this.channels.push({
        type: 'discord',
        name: 'Discord 알림',
        enabled: true,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL,
        minSeverity: AlertSeverity.WARNING,
      });
    }

    // 이메일 알림 설정
    if (
      process.env.ALERT_EMAIL_TO &&
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER
    ) {
      const emailTo = process.env.ALERT_EMAIL_TO.split(',').map(email => email.trim());
      this.channels.push({
        type: 'email',
        name: '이메일 알림',
        enabled: true,
        emailConfig: {
          to: emailTo,
          from: process.env.SMTP_FROM || 'alerts@jiksend.com',
        },
        minSeverity: AlertSeverity.ERROR,
      });
    }
  }

  /**
   * 이메일 발송기 설정
   */
  private setupEmailTransporter(): void {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_PORT ||
      !process.env.SMTP_USER
    ) {
      return;
    }

    try {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      serverLogger.info('이메일 알림 발송기 설정 완료');
    } catch (error) {
      serverLogger.error('이메일 발송기 설정 실패', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 알림 채널 추가
   * @param channel 알림 채널 설정
   */
  public addChannel(channel: AlertChannelConfig): void {
    this.channels.push(channel);
  }

  /**
   * 알림 발송
   * @param alert 알림 메시지
   */
  public async sendAlert(alert: AlertMessage): Promise<void> {
    // 타임스탬프 설정
    if (!alert.timestamp) {
      alert.timestamp = new Date();
    }

    // 소스 설정
    if (!alert.source) {
      alert.source = 'JikSend API Server';
    }

    // 알림 기록에 추가
    this.addToHistory(alert);

    // 알림 스로틀링 체크
    const alertKey = `${alert.severity}:${alert.title}`;
    if (this.isThrottled(alertKey)) {
      serverLogger.debug('알림 스로틀링으로 인해 발송 건너뜀', { title: alert.title, severity: alert.severity });
      return;
    }

    // 각 채널로 알림 발송
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      // 심각도 필터링
      if (
        channel.minSeverity &&
        this.getSeverityLevel(alert.severity) < this.getSeverityLevel(channel.minSeverity)
      ) {
        continue;
      }

      try {
        switch (channel.type) {
          case 'slack':
            await this.sendSlackAlert(channel, alert);
            break;
          case 'discord':
            await this.sendDiscordAlert(channel, alert);
            break;
          case 'email':
            await this.sendEmailAlert(channel, alert);
            break;
        }
      } catch (error) {
        serverLogger.error(`${channel.type} 알림 발송 실패`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    // 스로틀링 설정
    this.setThrottled(alertKey);
  }

  /**
   * Slack 알림 발송
   * @param channel 채널 설정
   * @param alert 알림 메시지
   */
  private async sendSlackAlert(channel: AlertChannelConfig, alert: AlertMessage): Promise<void> {
    if (!channel.webhookUrl) {
      serverLogger.warn('Slack 웹훅 URL이 설정되지 않았습니다');
      return;
    }

    // Slack 메시지 색상 설정
    const colorMap: Record<AlertSeverity, string> = {
      [AlertSeverity.INFO]: '#2196F3',
      [AlertSeverity.WARNING]: '#FF9800',
      [AlertSeverity.ERROR]: '#F44336',
      [AlertSeverity.CRITICAL]: '#9C27B0',
    };

    const payload = {
      attachments: [
        {
          color: colorMap[alert.severity] || '#2196F3',
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: '심각도',
              value: alert.severity,
              short: true,
            },
            {
              title: '소스',
              value: alert.source,
              short: true,
            },
            {
              title: '시간',
              value: alert.timestamp?.toISOString(),
              short: true,
            },
          ],
          footer: 'JikSend 알림 시스템',
        },
      ],
    };

    // 추가 데이터가 있는 경우
    if (alert.data) {
      try {
        const dataStr = JSON.stringify(alert.data, null, 2);
        if (dataStr.length < 1000) { // 너무 길면 생략
          payload.attachments[0].fields.push({
            title: '추가 데이터',
            value: `\`\`\`${dataStr}\`\`\``,
            short: false,
          });
        }
      } catch (error) {
        // 데이터 변환 실패 시 무시
      }
    }

    await axios.post(channel.webhookUrl, payload);
    serverLogger.debug('Slack 알림 발송 완료', { title: alert.title, severity: alert.severity });
  }

  /**
   * Discord 알림 발송
   * @param channel 채널 설정
   * @param alert 알림 메시지
   */
  private async sendDiscordAlert(channel: AlertChannelConfig, alert: AlertMessage): Promise<void> {
    if (!channel.webhookUrl) {
      serverLogger.warn('Discord 웹훅 URL이 설정되지 않았습니다');
      return;
    }

    // Discord 메시지 색상 설정
    const colorMap: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0x2196F3,
      [AlertSeverity.WARNING]: 0xFF9800,
      [AlertSeverity.ERROR]: 0xF44336,
      [AlertSeverity.CRITICAL]: 0x9C27B0,
    };

    const payload = {
      embeds: [
        {
          title: alert.title,
          description: alert.message,
          color: colorMap[alert.severity] || 0x2196F3,
          fields: [
            {
              name: '심각도',
              value: alert.severity,
              inline: true,
            },
            {
              name: '소스',
              value: alert.source,
              inline: true,
            },
            {
              name: '시간',
              value: alert.timestamp?.toISOString(),
              inline: true,
            },
          ],
          footer: {
            text: 'JikSend 알림 시스템',
          },
          timestamp: alert.timestamp?.toISOString(),
        },
      ],
    };

    // 추가 데이터가 있는 경우
    if (alert.data) {
      try {
        const dataStr = JSON.stringify(alert.data, null, 2);
        if (dataStr.length < 1000) { // 너무 길면 생략
          payload.embeds[0].fields.push({
            name: '추가 데이터',
            value: `\`\`\`json\n${dataStr}\n\`\`\``,
            inline: false,
          });
        }
      } catch (error) {
        // 데이터 변환 실패 시 무시
      }
    }

    await axios.post(channel.webhookUrl, payload);
    serverLogger.debug('Discord 알림 발송 완료', { title: alert.title, severity: alert.severity });
  }

  /**
   * 이메일 알림 발송
   * @param channel 채널 설정
   * @param alert 알림 메시지
   */
  private async sendEmailAlert(channel: AlertChannelConfig, alert: AlertMessage): Promise<void> {
    if (!this.emailTransporter || !channel.emailConfig) {
      serverLogger.warn('이메일 발송기 또는 이메일 설정이 없습니다');
      return;
    }

    const severityEmoji: Record<AlertSeverity, string> = {
      [AlertSeverity.INFO]: 'ℹ️',
      [AlertSeverity.WARNING]: '⚠️',
      [AlertSeverity.ERROR]: '❌',
      [AlertSeverity.CRITICAL]: '🚨',
    };

    // HTML 이메일 내용 생성
    let htmlContent = `
      <h2>${severityEmoji[alert.severity] || ''} ${alert.title}</h2>
      <p><strong>메시지:</strong> ${alert.message}</p>
      <p><strong>심각도:</strong> ${alert.severity}</p>
      <p><strong>소스:</strong> ${alert.source}</p>
      <p><strong>시간:</strong> ${alert.timestamp?.toISOString()}</p>
    `;

    // 추가 데이터가 있는 경우
    if (alert.data) {
      try {
        const dataStr = JSON.stringify(alert.data, null, 2);
        htmlContent += `
          <h3>추가 데이터:</h3>
          <pre>${dataStr}</pre>
        `;
      } catch (error) {
        // 데이터 변환 실패 시 무시
      }
    }

    const mailOptions = {
      from: channel.emailConfig.from,
      to: channel.emailConfig.to.join(', '),
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: htmlContent,
    };

    await this.emailTransporter.sendMail(mailOptions);
    serverLogger.debug('이메일 알림 발송 완료', { title: alert.title, severity: alert.severity, recipients: channel.emailConfig.to });
  }

  /**
   * 알림 기록에 추가
   * @param alert 알림 메시지
   */
  private addToHistory(alert: AlertMessage): void {
    this.alertHistory.push(alert);
    
    // 최대 기록 크기 유지
    if (this.alertHistory.length > this.MAX_HISTORY_SIZE) {
      this.alertHistory = this.alertHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * 알림 기록 조회
   * @returns 알림 기록
   */
  public getAlertHistory(): AlertMessage[] {
    return [...this.alertHistory];
  }

  /**
   * 심각도 레벨 숫자로 변환
   * @param severity 심각도
   * @returns 심각도 레벨 숫자
   */
  private getSeverityLevel(severity: AlertSeverity): number {
    const levels: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 1,
      [AlertSeverity.ERROR]: 2,
      [AlertSeverity.CRITICAL]: 3,
    };
    return levels[severity] || 0;
  }

  /**
   * 알림 스로틀링 체크
   * @param key 알림 키
   * @returns 스로틀링 여부
   */
  private isThrottled(key: string): boolean {
    const lastSent = this.alertThrottling.get(key);
    if (!lastSent) return false;
    
    const now = Date.now();
    return now - lastSent < this.THROTTLE_WINDOW_MS;
  }

  /**
   * 알림 스로틀링 설정
   * @param key 알림 키
   */
  private setThrottled(key: string): void {
    this.alertThrottling.set(key, Date.now());
  }
}

// 싱글톤 인스턴스 생성
export const alertManager = new AlertManager(); 