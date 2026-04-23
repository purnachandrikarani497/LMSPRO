import nodemailer from "nodemailer";
import { config } from "../config.js";

function createMailTransport() {
  const user = config.email.user;
  const pass = config.email.pass;
  if (!user || !pass) {
    throw new Error("Set SMTP_USER and SMTP_PASS or SMTP_PASSWORD in backend/.env");
  }

  const host = (config.email.host || "smtp.gmail.com").toLowerCase();
  const port = config.email.port;
  const secure = config.email.secure;

  const base = {
    host,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 25_000
  };

  /**
   * Gmail: only port 465 uses implicit TLS. Port 587 (or anything else) uses STARTTLS — never set SMTP_SECURE=true with SMTP_PORT=587.
   */
  if (host === "smtp.gmail.com") {
    if (process.env.NODE_ENV === "development" && port === 587 && secure) {
      console.warn(
        "[email] Ignoring SMTP_SECURE=true with SMTP_PORT=587. Gmail 587 uses STARTTLS (treating as secure=false)."
      );
    }
    if (port === 465) {
      return nodemailer.createTransport({
        ...base,
        port: 465,
        secure: true
      });
    }
    return nodemailer.createTransport({
      ...base,
      port: 587,
      secure: false,
      requireTLS: true
    });
  }

  return nodemailer.createTransport({
    ...base,
    port,
    secure
  });
}

let transporterCache;
function getTransporter() {
  if (!transporterCache) {
    transporterCache = createMailTransport();
  }
  return transporterCache;
}

export const sendResetEmail = async (email, resetLink) => {
  const fromAddr = config.email.from || config.email.user;
  if (!fromAddr) {
    throw new Error("FROM_EMAIL or SMTP_USER must be set");
  }

  const mailOptions = {
    from: `"LearnHub LMS" <${fromAddr}>`,
    to: email,
    subject: "Password Reset Link",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your LearnHub LMS account. Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #D4AF37; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #888; font-size: 12px;">${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">LearnHub LMS - Your Learning Journey Starts Here</p>
      </div>
    `
  };

  try {
    await getTransporter().sendMail(mailOptions);
    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    if (process.env.NODE_ENV === "development" && /535|BadCredentials|Invalid login/i.test(String(error?.message))) {
      const u = config.email.user;
      const n = config.email.pass?.length ?? 0;
      console.error(
        `[email] Gmail rejected auth for ${u}. App password length after trim: ${n} (expect 16). Generate a new App Password at https://myaccount.google.com/apppasswords while signed in as that exact address.`
      );
    }
    const msg =
      process.env.NODE_ENV === "development" && error?.message
        ? error.message
        : "Failed to send reset email";
    const err = new Error(msg);
    err.cause = error;
    throw err;
  }
};
