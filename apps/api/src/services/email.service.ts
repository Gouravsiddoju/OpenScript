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

  private static getSender(): string {
    return process.env.EMAIL_FROM || '"OpenScript Studio" <ssnpictures1@gmail.com>';
  }

  private static getAppUrl(): string {
    return process.env.APP_URL || 'https://dev-openscript.ssnpictures.in';
  }

  /**
   * Send Password Reset Email
   */
  static async sendPasswordResetEmail(toEmail: string, resetToken: string, displayName?: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const appUrl = this.getAppUrl();
    const resetUrl = `${appUrl}/?resetToken=${encodeURIComponent(resetToken)}`;
    const greeting = displayName ? `Hi ${displayName},` : 'Hello,';

    const html = `
      <div style="background-color: #0c0d12; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 16px; margin: 0;">
        <div style="max-width: 540px; margin: 0 auto; background: #13151b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          <!-- Header -->
          <div style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #27272a; background: linear-gradient(180deg, #181b22 0%, #13151b 100%);">
            <div style="display: inline-block; background: #f59e0b; color: #000; font-weight: 800; font-size: 16px; padding: 6px 14px; border-radius: 6px; letter-spacing: 1.5px;">
              OPENSCRIPT
            </div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 18px 0 0; letter-spacing: -0.3px;">Reset Your Password</h1>
          </div>

          <!-- Body -->
          <div style="padding: 28px 28px 24px; font-size: 15px; line-height: 1.6; color: #d1d5db;">
            <p style="margin-top: 0;">${greeting}</p>
            <p>We received a request to reset the password for your OpenScript account associated with <strong>${toEmail}</strong>.</p>
            <p>Click the button below to choose a new password. This secure link is valid for <strong>1 hour</strong>.</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 700; font-size: 15px; text-decoration: none; padding: 13px 28px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);">
                Set New Password
              </a>
            </div>

            <p style="font-size: 13px; color: #9ca3af; margin-bottom: 6px;">If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="font-size: 12px; word-break: break-all; color: #f59e0b; background: #0c0d12; padding: 10px; border-radius: 6px; border: 1px solid #27272a;">${resetUrl}</p>

            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f2937; font-size: 13px; color: #6b7280;">
              🔒 If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 24px; background: #090a0f; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937;">
            SSN Pictures • OpenScript Studio • Professional Screenwriting
          </div>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: this.getSender(),
        to: toEmail,
        subject: '🔒 Reset your OpenScript password',
        text: `${greeting}\n\nWe received a request to reset your password. Use the link below to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html,
      });
      return true;
    } catch (err) {
      console.error('[EmailService] Failed to send password reset email:', err);
      return false;
    }
  }

  /**
   * Send Project / Script Collaborator Invitation Email
   */
  static async sendInviteEmail(
    toEmail: string,
    inviterName: string,
    projectName: string,
    role: string,
    inviteUrl?: string
  ): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const appUrl = this.getAppUrl();
    const targetUrl = inviteUrl || appUrl;

    const html = `
      <div style="background-color: #0c0d12; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 16px; margin: 0;">
        <div style="max-width: 540px; margin: 0 auto; background: #13151b; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          <!-- Header -->
          <div style="padding: 32px 24px; text-align: center; border-bottom: 1px solid #27272a; background: linear-gradient(180deg, #181b22 0%, #13151b 100%);">
            <div style="display: inline-block; background: #f59e0b; color: #000; font-weight: 800; font-size: 16px; padding: 6px 14px; border-radius: 6px; letter-spacing: 1.5px;">
              OPENSCRIPT
            </div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 18px 0 0;">Screenplay Collaboration Invite</h1>
          </div>

          <!-- Body -->
          <div style="padding: 28px 28px 24px; font-size: 15px; line-height: 1.6; color: #d1d5db;">
            <p style="margin-top: 0;"><strong>${inviterName}</strong> has invited you to collaborate on the screenplay:</p>
            <div style="background: #0c0d12; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${projectName}</div>
              <div style="font-size: 13px; color: #f59e0b; margin-top: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
                Assigned Role: ${role}
              </div>
            </div>

            <p>Join the project in OpenScript to write together in realtime, leave anchored notes, or review revisions.</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${targetUrl}" style="background-color: #f59e0b; color: #000000; font-weight: 700; font-size: 15px; text-decoration: none; padding: 13px 28px; border-radius: 8px; display: inline-block;">
                Open Screenplay
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 24px; background: #090a0f; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937;">
            SSN Pictures • OpenScript Studio • Professional Screenwriting
          </div>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: this.getSender(),
        to: toEmail,
        subject: `🎬 Invitation: ${inviterName} invited you to "${projectName}" on OpenScript`,
        text: `${inviterName} has invited you to collaborate on "${projectName}" as a ${role}.\n\nAccess the screenplay here:\n${targetUrl}`,
        html,
      });
      return true;
    } catch (err) {
      console.error('[EmailService] Failed to send invite email:', err);
      return false;
    }
  }
}
