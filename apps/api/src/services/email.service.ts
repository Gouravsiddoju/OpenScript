import nodemailer, { Transporter } from 'nodemailer';

export class EmailService {
  private static transporter: Transporter | null = null;

  private static getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const user = process.env.SMTP_USER || 'ssnpictures1@gmail.com';
    const pass = process.env.SMTP_PASS || 'dplfroehddmmldke';

    if (!user || !pass) {
      console.warn('[EmailService] SMTP credentials missing. Outgoing emails disabled.');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    return this.transporter;
  }

  private static getResendApiKey(): string | null {
    return process.env.RESEND_API_KEY || null;
  }

  private static getSender(): string {
    return process.env.EMAIL_FROM || 'OpenScript Studio <onboarding@resend.dev>';
  }

  private static getAppUrl(): string {
    return process.env.APP_URL || 'https://dev-openscript.ssnpictures.in';
  }

  /**
   * Unified email dispatcher: uses Resend HTTPS API (port 443) first,
   * completely bypassing cloud firewall SMTP blocks, then falls back to SMTP if configured.
   */
  private static async sendEmail({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    const resendApiKey = this.getResendApiKey();

    if (resendApiKey) {
      try {
        const from = this.getSender();
        const payload: { from: string; to: string[]; subject: string; html: string; text?: string } = {
          from,
          to: [to],
          subject,
          html,
        };
        if (text) payload.text = text;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const result = await response.json();
          console.log(`[EmailService] Email dispatched successfully via Resend to ${to} (id: ${result?.id})`);
          return true;
        }

        const errData = await response.json();
        console.warn(`[EmailService] Resend API error (${response.status}):`, errData);
      } catch (err) {
        console.error('[EmailService] Error dispatching email via Resend HTTPS API:', err);
      }
    }

    // Fallback to Nodemailer SMTP
    const transporter = this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.sendMail({
        from: this.getSender(),
        to,
        subject,
        text,
        html,
      });
      console.log(`[EmailService] Email dispatched successfully via SMTP to ${to}`);
      return true;
    } catch (err) {
      console.error('[EmailService] Failed to send email via SMTP:', err);
      return false;
    }
  }

  /**
   * Send Password Reset Email with Ultra-Polished Professional Hollywood / Linear Aesthetic
   */
  static async sendPasswordResetEmail(toEmail: string, resetToken: string, displayName?: string): Promise<boolean> {
    const appUrl = this.getAppUrl();
    const resetUrl = `${appUrl}/?resetToken=${encodeURIComponent(resetToken)}`;
    const recipientName = displayName ? displayName : toEmail.split('@')[0];

    const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Reset Your OpenScript Password</title>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #080a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Preheader preview text (hidden in email body) -->
  <div style="display: none; font-size: 1px; color: #080a0f; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Reset your OpenScript password. This secure single-use link is valid for 60 minutes.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #080a0f; padding: 48px 16px 64px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #11141c; border: 1px solid #1f2533; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);">
          
          <!-- Top Accent Gold Ribbon -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #d4a359 0%, #f59e0b 50%, #fef08a 100%); line-height: 3px; font-size: 1px;">&nbsp;</td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td align="center" style="padding: 36px 32px 28px 32px; background: radial-gradient(circle at 50% 0%, #1a2030 0%, #11141c 70%); border-bottom: 1px solid #1b212f;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <!-- Brand Pill Badge -->
                    <div style="display: inline-block; background-color: #171b26; border: 1px solid #2b3347; border-radius: 9999px; padding: 6px 16px 6px 12px; margin-bottom: 20px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-size: 14px; line-height: 1; padding-right: 8px;">🎬</td>
                          <td style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 800; color: #f59e0b; letter-spacing: 1.5px; text-transform: uppercase;">
                            OPENSCRIPT
                          </td>
                          <td style="padding-left: 8px; border-left: 1px solid #2b3347; margin-left: 8px;">
                            <span style="font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase;">SSN PICTURES</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.3;">
                      Reset Your Password
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <p style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 16px; font-weight: 600; line-height: 1.5;">
                Hi ${recipientName},
              </p>
              <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 15px; line-height: 1.65;">
                We received a request to reset the password for your OpenScript Studio account associated with <span style="color: #f1f5f9; font-weight: 600; background-color: #181d29; padding: 2px 8px; border-radius: 4px; border: 1px solid #252c3f; font-family: monospace; font-size: 13px;">${toEmail}</span>.
              </p>
              <p style="margin: 0 0 32px 0; color: #94a3b8; font-size: 15px; line-height: 1.65;">
                To choose a new password and restore instant access to your screenplays, click the button below:
              </p>

              <!-- Primary Call To Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);">
                          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 700; color: #080a0f; text-decoration: none; border-radius: 10px; letter-spacing: 0.3px; line-height: 1;">
                            Set New Password &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0c0e14; border: 1px solid #1c2230; border-left: 3px solid #f59e0b; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.6;">
                      <strong style="color: #f59e0b;">⏱ 60-Minute Expiration:</strong> This secure single-use link will expire in 1 hour. If it expires, simply request a new one from the OpenScript login screen.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct Link -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; font-weight: 500;">
                      Having trouble with the button? Copy and paste this URL into your browser:
                    </p>
                    <div style="background-color: #0a0c10; border: 1px solid #1a202c; border-radius: 8px; padding: 12px 14px; word-break: break-all; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #d4a359; line-height: 1.5;">
                      <a href="${resetUrl}" style="color: #f59e0b; text-decoration: none;">${resetUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                🔒 If you did not request this password reset, no action is needed. Your account remains completely secure and your existing password will stay unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0d0f15; border-top: 1px solid #191f2b; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">
                SSN Pictures • OpenScript Studio
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px; line-height: 1.5;">
                Professional Screenwriting & Film Production Platform &bull; <a href="https://ssnpictures.in" style="color: #64748b; text-decoration: underline;">ssnpictures.in</a>
              </p>
              <p style="margin: 8px 0 0 0; color: #334155; font-size: 10px;">
                This automated security notification was sent to ${toEmail}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
        to: toEmail,
        subject: '🔒 Reset your OpenScript password',
        text: `Hi ${recipientName},\n\nWe received a request to reset the password for your OpenScript account (${toEmail}).\n\nClick the link below to set your new password (valid for 60 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email. Your password remains secure.\n\n— SSN Pictures • OpenScript Studio`,
        html,
      });
  }

  /**
   * Send Screenplay Collaboration Invitation Email with Premium Hollywood Production Styling
   */
  static async sendInviteEmail(
    toEmail: string,
    inviterName: string,
    projectName: string,
    role: string,
    inviteUrl?: string
  ): Promise<boolean> {
    const appUrl = this.getAppUrl();
    const targetUrl = inviteUrl || appUrl;
    const cleanRole = role.toUpperCase();

    // Contextual role badge styling
    let roleBg = '#172554';
    let roleBorder = '#2563eb';
    let roleColor = '#93c5fd';
    if (role.toLowerCase().includes('writer')) {
      roleBg = '#2e1c0c';
      roleBorder = '#d97706';
      roleColor = '#fcd34d';
    } else if (role.toLowerCase().includes('comment') || role.toLowerCase().includes('review')) {
      roleBg = '#2e1065';
      roleBorder = '#9333ea';
      roleColor = '#d8b4fe';
    } else if (role.toLowerCase().includes('read')) {
      roleBg = '#064e3b';
      roleBorder = '#059669';
      roleColor = '#6ee7b7';
    }

    const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Screenplay Collaboration Invitation</title>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #080a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="display: none; font-size: 1px; color: #080a0f; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${inviterName} invited you to collaborate on the screenplay "${projectName}" on OpenScript Studio.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #080a0f; padding: 48px 16px 64px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #11141c; border: 1px solid #1f2533; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);">
          
          <!-- Top Accent Gold Ribbon -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #3b82f6 0%, #f59e0b 50%, #10b981 100%); line-height: 3px; font-size: 1px;">&nbsp;</td>
          </tr>

          <!-- Header Section -->
          <tr>
            <td align="center" style="padding: 36px 32px 28px 32px; background: radial-gradient(circle at 50% 0%, #1a2030 0%, #11141c 70%); border-bottom: 1px solid #1b212f;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #171b26; border: 1px solid #2b3347; border-radius: 9999px; padding: 6px 16px 6px 12px; margin-bottom: 20px;">
                      <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-size: 14px; line-height: 1; padding-right: 8px;">🎬</td>
                          <td style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 800; color: #f59e0b; letter-spacing: 1.5px; text-transform: uppercase;">
                            OPENSCRIPT
                          </td>
                          <td style="padding-left: 8px; border-left: 1px solid #2b3347; margin-left: 8px;">
                            <span style="font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase;">COLLABORATION</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.3;">
                      You're Invited to Collaborate
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 15px; line-height: 1.65;">
                <strong style="color: #ffffff;">${inviterName}</strong> has added you to the production team for the following screenplay:
              </p>

              <!-- Screenplay Project Highlight Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0c10; border: 1px solid #252b3b; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td align="center" style="padding: 24px 20px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 19px; font-weight: 800; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">
                      "${projectName}"
                    </div>
                    <div style="display: inline-block; background-color: ${roleBg}; border: 1px solid ${roleBorder}; color: ${roleColor}; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 4px 14px; border-radius: 9999px;">
                      Assigned Role: ${cleanRole}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Production Features Bullet List -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 14px; font-weight: 600;">
                      What you can do in this screenplay:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #cbd5e1; line-height: 1.8;">
                      <tr>
                        <td width="20" valign="top" style="color: #f59e0b;">✓</td>
                        <td>Realtime simultaneous writing with automatic conflict locking</td>
                      </tr>
                      <tr>
                        <td width="20" valign="top" style="color: #f59e0b;">✓</td>
                        <td>Scene Navigator, Beat Board, and character dialogue isolation</td>
                      </tr>
                      <tr>
                        <td width="20" valign="top" style="color: #f59e0b;">✓</td>
                        <td>Anchored screenplay notes, categorized feedback, and color revisions</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);">
                          <a href="${targetUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 700; color: #080a0f; text-decoration: none; border-radius: 10px; letter-spacing: 0.3px; line-height: 1;">
                            Open Screenplay &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct Link -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; font-weight: 500;">
                      Direct access URL:
                    </p>
                    <div style="background-color: #0a0c10; border: 1px solid #1a202c; border-radius: 8px; padding: 12px 14px; word-break: break-all; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #d4a359; line-height: 1.5;">
                      <a href="${targetUrl}" style="color: #f59e0b; text-decoration: none;">${targetUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0d0f15; border-top: 1px solid #191f2b; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">
                SSN Pictures • OpenScript Studio
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px; line-height: 1.5;">
                Professional Screenwriting & Film Production Platform &bull; <a href="https://ssnpictures.in" style="color: #64748b; text-decoration: underline;">ssnpictures.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
        to: toEmail,
        subject: `🎬 Invitation: ${inviterName} invited you to "${projectName}" on OpenScript`,
        text: `Hi,\n\n${inviterName} has invited you to collaborate on the screenplay "${projectName}" as a ${cleanRole}.\n\nOpen the screenplay here:\n${targetUrl}\n\n— SSN Pictures • OpenScript Studio`,
        html,
      });
  }

  /**
   * Send Invitation Confirmation Email to the Inviter (Two-Way Notification)
   */
  static async sendInviteConfirmationEmail(
    inviterEmail: string,
    invitedEmail: string,
    projectName: string,
    role: string
  ): Promise<boolean> {
    const appUrl = this.getAppUrl();
    const cleanRole = role.toUpperCase();

    const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Invitation Dispatched</title>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #080a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="display: none; font-size: 1px; color: #080a0f; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Your invitation to ${invitedEmail} for "${projectName}" has been delivered.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #080a0f; padding: 48px 16px 64px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #11141c; border: 1px solid #1f2533; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);">
          
          <!-- Top Accent Line -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #f59e0b 100%); line-height: 3px; font-size: 1px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 36px 32px 28px 32px; background: radial-gradient(circle at 50% 0%, #1a2030 0%, #11141c 70%); border-bottom: 1px solid #1b212f;">
              <div style="display: inline-block; background-color: #171b26; border: 1px solid #2b3347; border-radius: 9999px; padding: 6px 16px 6px 12px; margin-bottom: 20px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size: 14px; line-height: 1; padding-right: 8px;">📤</td>
                    <td style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; font-weight: 800; color: #10b981; letter-spacing: 1.5px; text-transform: uppercase;">
                      INVITATION DISPATCHED
                    </td>
                    <td style="padding-left: 8px; border-left: 1px solid #2b3347; margin-left: 8px;">
                      <span style="font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 0.8px; text-transform: uppercase;">SSN PICTURES</span>
                    </td>
                  </tr>
                </table>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.3;">
                Collaborator Invite Sent
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 15px; line-height: 1.65;">
                We've delivered an invitation to your team member to collaborate on your screenplay.
              </p>

              <!-- Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0c10; border: 1px solid #252b3b; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #94a3b8; line-height: 2;">
                      <tr>
                        <td width="130" style="color: #64748b; font-weight: 600;">Screenplay:</td>
                        <td style="color: #ffffff; font-weight: 700;">"${projectName}"</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Invited Person:</td>
                        <td style="color: #f1f5f9; font-family: monospace;">${invitedEmail}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Assigned Role:</td>
                        <td>
                          <span style="color: #f59e0b; font-weight: 700; background: #261d08; padding: 2px 8px; border-radius: 4px; border: 1px solid #78350f;">
                            ${cleanRole}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-weight: 600;">Current Status:</td>
                        <td>
                          <span style="color: #38bdf8; font-weight: 600;">
                            ⏳ Pending Acceptance
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 28px 0; color: #94a3b8; font-size: 14px; line-height: 1.65;">
                A secure direct join link was sent to their email. When they accept and log in, their presence and typing indicators will appear live in your workspace.
              </p>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; padding: 13px 32px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 700; color: #080a0f; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); text-decoration: none; border-radius: 8px; letter-spacing: 0.3px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);">
                      Open Screenplay Workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #0d0f15; border-top: 1px solid #191f2b; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 12px; font-weight: 600;">
                SSN Pictures • OpenScript Studio
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                Two-Way Team Activity Record &bull; <a href="https://ssnpictures.in" style="color: #64748b; text-decoration: underline;">ssnpictures.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    return this.sendEmail({
        to: inviterEmail,
        subject: `📤 Invitation Sent: ${invitedEmail} invited to "${projectName}"`,
        text: `You invited ${invitedEmail} to collaborate on "${projectName}" as ${cleanRole}. A secure join link was delivered to their inbox.`,
        html,
      });
  }

}
