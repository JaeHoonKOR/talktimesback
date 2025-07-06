"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNewsletterEmail = sendNewsletterEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
// .env에서 SMTP 정보 불러오기
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // TLS 사용시 true
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
function sendNewsletterEmail(_a) {
    return __awaiter(this, arguments, void 0, function* ({ to, subject, html, }) {
        const mailOptions = {
            from: process.env.SMTP_FROM || 'news@jiksong.com',
            to,
            subject,
            html,
        };
        try {
            const info = yield transporter.sendMail(mailOptions);
            console.log('이메일 발송 성공:', info.messageId);
            return info;
        }
        catch (error) {
            console.error('이메일 발송 실패:', error);
            throw error;
        }
    });
}
