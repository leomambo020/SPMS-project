const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
});

/** Fire-and-forget notification email. Failures are logged, not
 * thrown — a notification going astray should never fail the
 * underlying business transaction (e.g. a leave decision) that
 * triggered it. */
async function sendMail({ to, subject, text }) {
  if (!to) return;
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, text });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
  }
}

function leaveDecisionEmail({ to, employeeName, status, reason, startDate, endDate }) {
  const subject = `Your leave request has been ${status}`;
  const lines = [
    `Hello ${employeeName},`,
    '',
    `Your leave request for ${startDate} to ${endDate} has been ${status}.`,
  ];
  if (status === 'rejected' && reason) {
    lines.push(`Reason: ${reason}`);
  }
  return sendMail({ to, subject, text: lines.join('\n') });
}

function payslipReadyEmail({ to, employeeName, month }) {
  return sendMail({
    to,
    subject: 'Your payslip is ready',
    text: `Hello ${employeeName},\n\nYour payslip for ${month} is now available in the SPMS portal.`,
  });
}

module.exports = { sendMail, leaveDecisionEmail, payslipReadyEmail };
