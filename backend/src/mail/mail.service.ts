import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      this.configService.get<string>('MAIL_FROM') ??
      'STIFF <onboarding@resend.dev>';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    await this.send(
      email,
      'Verify your STIFF account',
      `<p>Welcome to STIFF.</p><p><a href="${link}">Click here to verify your email</a> — the link expires in 24 hours.</p><p>If you didn't create an account, ignore this email.</p>`,
      link,
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your STIFF password',
      `<p>Someone requested a password reset for your STIFF account.</p><p><a href="${link}">Click here to set a new password</a> — the link expires in 1 hour.</p><p>If this wasn't you, ignore this email.</p>`,
      link,
    );
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    link: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not set — email "${subject}" to ${to} not sent. Link: ${link}`,
      );
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(
          `Resend error sending "${subject}" to ${to}: ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to send "${subject}" to ${to}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
