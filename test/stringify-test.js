import { expect } from 'chai'
import { stringify } from '../src/stringify'

describe('stringify', () => {
  it('works', () => {
    expect(stringify('')).eql('""')
    expect(stringify('1')).eql('"1"')
    expect(stringify('123')).eql('"123"')
    expect(stringify('"')).eql('"\\""')
    expect(stringify('\\')).eql('"\\\\"')
    expect(stringify('a"b')).eql('"a\\"b"')
    expect(stringify('a\\b')).eql('"a\\\\b"')
    expect(stringify('${foo}')).eql('"${foo}"')
    expect(stringify('${foo("bar")}')).eql('"${foo("bar")}"')
    expect(stringify('${foo("a\\"b")}')).eql('"${foo("a\\"b")}"')
    expect(stringify('${foo("a\\\\b")}')).eql('"${foo("a\\\\b")}"')
    expect(stringify('${foo("bar${baz}")}')).eql('"${foo("bar${baz}")}"')
  })
})
