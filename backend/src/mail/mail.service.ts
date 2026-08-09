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

  async sendOrderInvoice(
    email: string,
    order: {
      id: string;
      createdAt: Date;
      totalCents: number;
      items: {
        productName: string;
        size: string;
        quantity: number;
        unitPriceCents: number;
      }[];
      shippingAddress?: {
        firstName?: string;
        lastName?: string;
        line1?: string;
        city?: string;
        country?: string;
        phone?: string;
      } | null;
    },
  ): Promise<void> {
    const money = (cents: number) => `${(cents / 100).toFixed(2)} GEL`;
    const shortId = order.id.slice(0, 8).toUpperCase();
    const cell =
      'padding:10px 0;border-bottom:1px solid #e4e4e7;font-size:14px;color:#000;';

    const rows = order.items
      .map(
        (item) =>
          `<tr><td style="${cell}">${item.productName}${
            item.size ? ` (${item.size})` : ''
          } × ${item.quantity}</td><td style="${cell}text-align:right;">${money(
            item.unitPriceCents * item.quantity,
          )}</td></tr>`,
      )
      .join('');

    const address = order.shippingAddress
      ? [
          [order.shippingAddress.firstName, order.shippingAddress.lastName]
            .filter(Boolean)
            .join(' '),
          order.shippingAddress.line1,
          order.shippingAddress.city,
          order.shippingAddress.country,
          order.shippingAddress.phone,
        ]
          .filter(Boolean)
          .join(', ')
      : null;

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#000;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">Order confirmation</p>
  <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
    Thanks for your order. It's confirmed and paid — we'll notify you at every step until it's at your door.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 4px;">
    <tr>
      <td style="${cell}color:#52525b;">Order</td>
      <td style="${cell}text-align:right;font-weight:bold;">#${shortId}</td>
    </tr>
    <tr>
      <td style="${cell}color:#52525b;">Date</td>
      <td style="${cell}text-align:right;">${order.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
    </tr>
    ${rows}
    <tr>
      <td style="padding:14px 0;font-size:16px;font-weight:900;">Total</td>
      <td style="padding:14px 0;font-size:16px;font-weight:900;text-align:right;">${money(order.totalCents)}</td>
    </tr>
  </table>
  ${address ? `<p style="font-size:12px;line-height:1.6;color:#52525b;margin:16px 0 0;">Ship to: ${address}</p>` : ''}
  <a href="${this.frontendUrl}/account" style="display:inline-block;margin-top:28px;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Track my order</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi. Questions? Just reply to this email.</p>
</div>`;

    await this.send(
      email,
      `Order #${shortId} confirmed — STIFF`,
      html,
      `${this.frontendUrl}/account`,
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
