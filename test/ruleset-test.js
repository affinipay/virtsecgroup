import { expect } from 'chai'
import { Ruleset } from '../src/ruleset'

describe('ruleset', () => {
  it('works', () => {
    const rs = new Ruleset()
    rs.addRule(false, 'tcp', 100, 199, 'src1', 'sg', 'a')
    expect(rs.rules.join()).eql('in tcp 100-199 sg:src1 (a)')
    rs.addRule(false, 'tcp', 300, 399, 'src1', 'sg', 'b')
    expect(rs.rules.join()).eql('in tcp 100-199 sg:src1 (a),in tcp 300-399 sg:src1 (b)')
    rs.addRule(false, 'tcp', 50, 99, 'src1', 'sg', 'c')
    expect(rs.rules.join()).eql('in tcp 50-199 sg:src1 (a,c),in tcp 300-399 sg:src1 (b)')
    rs.addRule(false, 'tcp', 400, 449, 'src1', 'sg', 'd')
    expect(rs.rules.join()).eql('in tcp 50-199 sg:src1 (a,c),in tcp 300-449 sg:src1 (b,d)')
    rs.addRule(false, 'tcp', 200, 299, 'src1', 'sg', 'e')
    expect(rs.rules.join()).eql('in tcp 50-449 sg:src1 (a,c,e,b,d)')
    rs.addRule(false, 'tcp', 200, 299, 'src2', 'sg', 'f')
    expect(rs.rules.join()).eql('in tcp 50-449 sg:src1 (a,c,e,b,d),in tcp 200-299 sg:src2 (f)')
    rs.addRule(false, 'udp', 200, 299, 'src1', 'sg', 'g')
    expect(rs.rules.join()).eql('in tcp 50-449 sg:src1 (a,c,e,b,d),in udp 200-299 sg:src1 (g),in tcp 200-299 sg:src2 (f)')
  })
})
