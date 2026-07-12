import assert from 'node:assert/strict'

import {
  normalizeLookupWord,
  normalizeWordLookupResponse,
} from '../miniprogram/utils/word-lookup'

assert.equal(normalizeLookupWord(' Client’s '), "client's")

const normalized = normalizeWordLookupResponse({
  word: 'quotation',
  normalized: 'quotation',
  translation: 'n. 报价；报价单',
  phoneticUk: 'kwəʊˈteɪʃən',
  phoneticUs: 'kwoʊtˈeɪʃʌn',
  audioUk: 'https://dict.youdao.com/dictvoice?audio=quotation&type=1',
  audioUs: 'https://dict.youdao.com/dictvoice?audio=quotation&type=2',
  source: 'override',
  dictionaryVersion: 'ecdict-test',
}, 'quotation')

assert.equal(normalized.translation, 'n. 报价；报价单')
assert.equal(normalized.phoneticUk, 'kwəʊˈteɪʃən')
assert.equal(normalized.phoneticUs, 'kwoʊtˈeɪʃʌn')
assert.match(normalized.audioUk || '', /type=1$/)
assert.match(normalized.audioUs || '', /type=2$/)
assert.equal(normalized.dictionaryVersion, 'ecdict-test')

const empty = normalizeWordLookupResponse({}, 'unknown')
assert.equal(empty.normalized, 'unknown')
assert.equal(empty.translation, null)
assert.equal(empty.audioUs, null)

console.log('word lookup tests passed.')
