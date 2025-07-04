import nodemailer from 'nodemailer';

// .env에서 SMTP 정보 불러오기
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // TLS 사용시 true
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendNewsletterEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'news@jiksong.com',
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('이메일 발송 성공:', info.messageId);
    return info;
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    throw error;
  }
} 