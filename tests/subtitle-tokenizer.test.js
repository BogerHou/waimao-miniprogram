"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const subtitle_tokenizer_1 = require("../miniprogram/pages/course/subtitle-tokenizer");
const source = "Email BrendaMiller1212@xxx.com about RJK23366, 30cm and top-tier items. I'll follow up.";
const tokens = (0, subtitle_tokenizer_1.tokenizeSubtitle)(source);
strict_1.default.equal(tokens.map(token => token.text).join(''), source);
strict_1.default.deepEqual(tokens.filter(token => token.isWord).map(token => token.word), ['email', 'about', 'cm', 'and', 'top-tier', 'items', "i'll", 'follow', 'up']);
strict_1.default.equal(tokens.some(token => token.word === 'brendamiller'), false);
strict_1.default.equal(tokens.some(token => token.word === 'rjk'), false);
console.log('subtitle tokenizer tests passed.');
