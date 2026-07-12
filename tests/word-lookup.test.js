"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const word_lookup_1 = require("../miniprogram/utils/word-lookup");
strict_1.default.equal((0, word_lookup_1.normalizeLookupWord)(' Client’s '), "client's");
const normalized = (0, word_lookup_1.normalizeWordLookupResponse)({
    word: 'quotation',
    normalized: 'quotation',
    translation: 'n. 报价；报价单',
    phoneticUk: 'kwəʊˈteɪʃən',
    phoneticUs: 'kwoʊtˈeɪʃʌn',
    audioUk: 'https://dict.youdao.com/dictvoice?audio=quotation&type=1',
    audioUs: 'https://dict.youdao.com/dictvoice?audio=quotation&type=2',
    source: 'override',
    dictionaryVersion: 'ecdict-test',
}, 'quotation');
strict_1.default.equal(normalized.translation, 'n. 报价；报价单');
strict_1.default.equal(normalized.phoneticUk, 'kwəʊˈteɪʃən');
strict_1.default.equal(normalized.phoneticUs, 'kwoʊtˈeɪʃʌn');
strict_1.default.match(normalized.audioUk || '', /type=1$/);
strict_1.default.match(normalized.audioUs || '', /type=2$/);
strict_1.default.equal(normalized.dictionaryVersion, 'ecdict-test');
const empty = (0, word_lookup_1.normalizeWordLookupResponse)({}, 'unknown');
strict_1.default.equal(empty.normalized, 'unknown');
strict_1.default.equal(empty.translation, null);
strict_1.default.equal(empty.audioUs, null);
console.log('word lookup tests passed.');
