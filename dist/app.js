"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const translation_routes_1 = __importDefault(require("./routes/translation.routes"));
// Express 앱 생성
const app = (0, express_1.default)();
// 미들웨어 설정
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 라우터 등록
app.use('/api/translation', translation_routes_1.default);
exports.default = app;
