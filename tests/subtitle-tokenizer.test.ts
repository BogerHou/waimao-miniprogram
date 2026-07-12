import assert from 'node:assert/strict'
import { tokenizeSubtitle } from '../miniprogram/pages/course/subtitle-tokenizer'

const source = "Email BrendaMiller1212@xxx.com about RJK23366, 30cm and top-tier items. I'll follow up."
const tokens = tokenizeSubtitle(source)

assert.equal(tokens.map(token => token.text).join(''), source)
assert.deepEqual(
  tokens.filter(token => token.isWord).map(token => token.word),
  ['email', 'about', 'cm', 'and', 'top-tier', 'items', "i'll", 'follow', 'up'],
)
assert.equal(tokens.some(token => token.word === 'brendamiller'), false)
assert.equal(tokens.some(token => token.word === 'rjk'), false)

console.log('subtitle tokenizer tests passed.')
