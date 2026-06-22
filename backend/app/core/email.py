import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """Send an email via SMTP. Silently logs and returns if SMTP is not configured."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(
            "SMTP not configured — email to %s not sent. Subject: %s", to, subject
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_TLS,
        )
        logger.info("Email sent to %s — %s", to, subject)
    except Exception as exc:
        logger.exception("Failed to send email to %s: %s", to, exc)
        raise


async def send_password_reset_email(to: str, reset_url: str) -> None:
    subject = "Reset your FlekxiTask password"

    text_body = (
        f"Hi,\n\n"
        f"We received a request to reset your FlekxiTask password.\n\n"
        f"Click the link below to set a new password (valid for 1 hour):\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— The FlekxiTask Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#374151;">
  <div style="background:#f9fafb;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 8px;color:#111827;">⚡ FlekxiTask</h2>
    <h3 style="margin:0 0 20px;font-weight:600;">Reset your password</h3>
    <p style="margin:0 0 24px;line-height:1.6;color:#6b7280;">
      We received a request to reset the password for your account.<br>
      Click the button below — the link expires in <strong>1 hour</strong>.
    </p>
    <a href="{reset_url}"
       style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
              padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
      Reset Password
    </a>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
      If you didn't request this, you can safely ignore this email.<br>
      This link will expire in 1 hour.
    </p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#d1d5db;">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="{reset_url}" style="color:#6b7280;word-break:break-all;">{reset_url}</a>
    </p>
  </div>
</body>
</html>"""

    await send_email(to, subject, html_body, text_body)
