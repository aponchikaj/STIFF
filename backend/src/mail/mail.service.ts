import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Minimal HTML escaping for values interpolated into email bodies.
 *
 * Customer-supplied text (return reasons, names) reaches these templates, and
 * a stray `<` would otherwise break the markup or worse.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
    // Email links always point at the public site; PUBLIC_SITE_URL wins so a
    // local backend (FRONTEND_URL=localhost for CORS) still sends real links.
    this.frontendUrl =
      this.configService.get<string>('PUBLIC_SITE_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';
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

  async sendContactReply(
    email: string,
    name: string,
    reply: string,
    original: string,
  ): Promise<void> {
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#000;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">Reply to your message</p>
  <p style="font-size:14px;line-height:1.7;margin:0 0 8px;">Hey ${esc(name)},</p>
  <p style="font-size:14px;line-height:1.7;white-space:pre-line;margin:0 0 24px;">${esc(reply)}</p>
  <div style="border-left:2px solid #e4e4e7;padding-left:12px;margin-top:8px;">
    <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a1a1aa;margin:0 0 6px;">Your message</p>
    <p style="font-size:12px;line-height:1.6;color:#52525b;white-space:pre-line;margin:0;">${esc(original)}</p>
  </div>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi. Reply to this email to continue the conversation.</p>
</div>`;
    await this.send(
      email,
      'Reply from STIFF',
      html,
      `${this.frontendUrl}/contact`,
      'stiffenter@gmail.com',
    );
  }

  /** Instant heads-up to the store admin when an order lands. */
  async sendNewOrderAlert(
    order: {
      id: string;
      totalCents: number;
      items: { productName: string; size: string; quantity: number }[];
    },
    customer: { username: string; email: string },
  ): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) return;
    const shortId = order.id.slice(0, 8).toUpperCase();
    const total = `${(order.totalCents / 100).toFixed(2)} GEL`;
    const lines = order.items
      .map(
        (i) =>
          `<li style="font-size:14px;line-height:1.8;">${i.quantity} × ${i.productName}${i.size ? ` (${i.size})` : ''}</li>`,
      )
      .join('');
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#000;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">New order</p>
  <p style="font-size:16px;font-weight:bold;margin:0 0 4px;">#${shortId} — ${total}</p>
  <p style="font-size:13px;color:#52525b;margin:0 0 16px;">${customer.username} · ${customer.email}</p>
  <ul style="margin:0;padding-left:18px;">${lines}</ul>
  <a href="${this.frontendUrl}/admin" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Open orders board</a>
</div>`;
    await this.send(
      adminEmail,
      `New order #${shortId} — ${total}`,
      html,
      `${this.frontendUrl}/admin`,
    );
  }

  async sendOrderInvoice(
    email: string,
    order: {
      id: string;
      createdAt: Date;
      totalCents: number;
      paymentMethod?: string;
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
    const payNote =
      order.paymentMethod === 'bank_transfer'
        ? 'Pay by bank transfer — we will follow up with the account details. The order stays pending until we confirm it.'
        : order.paymentMethod === 'cod'
          ? 'Pay on delivery, or when you pick it up.'
          : '';
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
    Thanks for your order. We have it — you'll get another email whenever the status changes.
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
  ${payNote ? `<p style="font-size:12px;line-height:1.6;color:#52525b;margin:16px 0 0;">${payNote}</p>` : ''}
  ${address ? `<p style="font-size:12px;line-height:1.6;color:#52525b;margin:16px 0 0;">Ship to: ${address}</p>` : ''}
  <a href="${this.frontendUrl}/account" style="display:inline-block;margin-top:28px;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Track my order</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi. Questions? Just reply to this email.</p>
</div>`;

    await this.send(
      email,
      `Order #${shortId} received — STIFF`,
      html,
      `${this.frontendUrl}/account`,
    );
  }

  async sendOrderStatus(
    email: string,
    order: {
      id: string;
      status: string;
      totalCents: number;
      trackingCarrier?: string | null;
      trackingNumber?: string | null;
      trackingUrl?: string | null;
    },
  ): Promise<void> {
    const shortId = order.id.slice(0, 8).toUpperCase();
    const copy: Record<string, { subject: string; body: string }> = {
      pending: {
        subject: `Order #${shortId} received — STIFF`,
        body: 'We have your order and will update you as it moves.',
      },
      paid: {
        subject: `Order #${shortId} paid — STIFF`,
        body: 'Payment received. We are getting it ready.',
      },
      packed: {
        subject: `Order #${shortId} packed — STIFF`,
        body: 'Your order is packed and waiting to go out.',
      },
      shipped: {
        subject: `Order #${shortId} is out — STIFF`,
        body: order.trackingNumber
          ? `Your order is on its way${order.trackingCarrier ? ` with ${esc(order.trackingCarrier)}` : ''}. Tracking number ${esc(order.trackingNumber)}.`
          : 'Your order is out for delivery.',
      },
      delivered: {
        subject: `Order #${shortId} delivered — STIFF`,
        body: 'Your order was delivered. Thank you for buying from STIFF.',
      },
      cancelled: {
        subject: `Order #${shortId} cancelled — STIFF`,
        body: 'Your order was cancelled. If that was a surprise, reply to this email.',
      },
    };
    const msg = copy[order.status] ?? {
      subject: `Order #${shortId} update — STIFF`,
      body: `Your order is now ${order.status}.`,
    };
    // The carrier's own page when we have it, otherwise the order itself.
    const trackHref =
      order.trackingUrl ?? `${this.frontendUrl}/orders/${order.id}`;
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#000;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">Order update</p>
  <p style="font-size:16px;font-weight:bold;margin:0 0 8px;">#${shortId}</p>
  <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">${msg.body}</p>
  <a href="${trackHref}" style="display:inline-block;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">${order.trackingUrl ? 'Track the parcel' : 'View my order'}</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi. Questions? Just reply to this email.</p>
</div>`;
    await this.send(email, msg.subject, html, trackHref);
  }

  async sendReturnUpdate(
    email: string,
    order: { id: string },
    request: { status: string; resolutionNote?: string; refundCents?: number },
  ): Promise<void> {
    if (!email) return;
    const shortId = order.id.slice(0, 8).toUpperCase();
    const copy: Record<string, { subject: string; body: string }> = {
      requested: {
        subject: `Return requested — order #${shortId}`,
        body: 'We have your return request. We will look at it and come back to you.',
      },
      approved: {
        subject: `Return approved — order #${shortId}`,
        body: 'Your return is approved. Send the pieces back unworn with tags on, and we will refund once they reach us.',
      },
      rejected: {
        subject: `Return not accepted — order #${shortId}`,
        body: 'We could not accept this return.',
      },
      received: {
        subject: `Return received — order #${shortId}`,
        body: 'Your return arrived with us. The refund is next.',
      },
      refunded: {
        subject: `Refund sent — order #${shortId}`,
        body: 'Your refund is on its way back to you.',
      },
    };
    const msg = copy[request.status] ?? {
      subject: `Return update — order #${shortId}`,
      body: `Your return is now ${request.status}.`,
    };
    const note = request.resolutionNote?.trim()
      ? `<p style="font-size:14px;line-height:1.7;white-space:pre-line;margin:0 0 24px;border-left:2px solid #e4e4e7;padding-left:12px;">${esc(request.resolutionNote)}</p>`
      : '';
    const amount =
      request.status === 'refunded' && request.refundCents
        ? `<p style="font-size:14px;margin:0 0 24px;">Refunded: <strong>${(request.refundCents / 100).toFixed(2)} GEL</strong></p>`
        : '';
    const link = `${this.frontendUrl}/orders/${order.id}`;
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#000;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">Return update</p>
  <p style="font-size:16px;font-weight:bold;margin:0 0 8px;">#${shortId}</p>
  <p style="font-size:14px;line-height:1.7;margin:0 0 16px;">${msg.body}</p>
  ${note}
  ${amount}
  <a href="${link}" style="display:inline-block;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">View my order</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi. Questions? Just reply to this email.</p>
</div>`;
    await this.send(email, msg.subject, html, link);
  }

  async sendBackInStock(
    email: string,
    label: string,
    productSlug: string,
  ): Promise<void> {
    if (!email) return;
    const link = `${this.frontendUrl}/clothing/${productSlug}`;
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#000;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">Back in stock</p>
  <p style="font-size:16px;font-weight:bold;margin:0 0 8px;">${esc(label)}</p>
  <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">You asked us to tell you when this came back. Small runs sell out fast — it may not last.</p>
  <a href="${link}" style="display:inline-block;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Take a look</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi. You are only told once per restock.</p>
</div>`;
    await this.send(email, `${label} is back — STIFF`, html, link);
  }

  /**
   * The one email a pending address ever receives.
   *
   * Everything about double opt-in rests on this being the only send that
   * reaches an unconfirmed address, so it says plainly who asked and offers
   * doing nothing as the way out — the correct action for somebody whose
   * address was typed in by a stranger.
   */
  async sendSubscribeConfirmation(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/subscribe/confirm?token=${token}`;
    const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#09090b;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">One click to confirm</p>
  <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">Somebody asked for drop alerts at this address. If that was you, confirm it and we will tell you the moment a drop lands — nothing else.</p>
  <a href="${link}" style="display:inline-block;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Confirm my email</a>
  <p style="font-size:12px;line-height:1.7;color:#71717a;margin-top:28px;">If it was not you, do nothing. Without this click you will never hear from us again, and the request expires on its own.</p>
  <p style="font-size:11px;color:#a1a1aa;margin-top:24px;">STIFF — essential clothing, Tbilisi.</p>
</div>`;
    await this.send(email, 'Confirm your STIFF drop alerts', html, link);
  }

  /**
   * A drop alert to one confirmed subscriber.
   *
   * The unsubscribe link is not optional and not a courtesy: it is the deal
   * made at signup, and a bulk send without one is the fastest way to be
   * marked as spam by the mailbox providers rather than by the reader.
   */
  async sendDropAlert(
    email: string,
    title: string,
    body: string,
    unsubscribeToken: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/clothing`;
    const optOut = `${this.frontendUrl}/subscribe/unsubscribe?token=${unsubscribeToken}`;
    // The admin types this into a textarea, so newlines are the paragraphs
    // they meant and everything else is escaped.
    const paragraphs = body
      .split(/\n{2,}/)
      .map(
        (para) =>
          `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">${esc(para).replace(/\n/g, '<br />')}</p>`,
      )
      .join('');

    const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#09090b;">
  <p style="font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">* STIFF</p>
  <p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#52525b;margin:6px 0 28px;">${esc(title)}</p>
  ${paragraphs}
  <a href="${link}" style="display:inline-block;margin-top:8px;padding:14px 28px;background:#000;color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">See the drop</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:32px;">STIFF — essential clothing, Tbilisi.<br /><a href="${optOut}" style="color:#a1a1aa;">Unsubscribe</a> — one click, no login.</p>
</div>`;

    await this.send(email, title, html, link, undefined, optOut);
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    link: string,
    replyTo?: string,
    /**
     * Adds the RFC 8058 headers, which is what puts the mailbox provider's own
     * unsubscribe button at the top of the message. People who cannot find the
     * link report the mail as spam instead, and that costs the whole domain.
     */
    unsubscribeUrl?: string,
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
        ...(replyTo ? { replyTo } : {}),
        ...(unsubscribeUrl
          ? {
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
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
