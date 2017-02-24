function compare(a, b) {
  return a == b ? 0 : (a > b ? 1 : -1)
}

function binsearch(arr, compare) {
  let min = 0
  let max = arr.length - 1
  while (min <= max) {
    const mid = (min + max) >> 1
    const cmp = compare(arr[mid])
    if (cmp > 0) {
      min = mid + 1
    } else if (cmp < 0) {
      max = mid - 1
    } else {
      return mid
    }
  }
  return -min - 1
}

export class Rule {
  constructor(egress, protocol, fromPort, toPort, srcDst, srcDstType, origin) {
    this.egress = egress
    this.protocol = protocol
    this.fromPort = fromPort
    this.toPort = toPort
    this.srcDst = srcDst
    this.srcDstType = srcDstType
    this.origins = new Set()
    this.addOrigin(origin)
  }
  addOrigin(origin) {
    if (origin) {
      this.origins.add(origin)
    }
  }
  addOrigins(other) {
    for (const origin of other.origins) {
      this.origins.add(origin)
    }
  }
  compareTo(other) {
    return compare(this.egress, other.egress)
      || compare(this.srcDst, other.srcDst)
      || compare(this.protocol, other.protocol)
      || (this.fromPort - other.fromPort)
      || (this.toPort - other.toPort)
  }
  isSameExceptPorts(other) {
    return this.egress == other.egress
      && this.protocol == other.protocol
      && this.srcDst == other.srcDst
      && this.srcDstType == other.srcDstType
  }
  toString() {
    let s = `${this.egress ? 'out' : 'in'} ${this.protocol} ` +
      `${this.fromPort}-${this.toPort} ${this.srcDstType}:${this.srcDst}`
    if (this.origins.size > 0) {
      s += ` (${Array.from(this.origins).join()})`
    }
    return s
  }
}

export class Ruleset {
  constructor() {
    this.rules = []
  }
  addRule(egress, protocol, fromPort, toPort, srcDst, srcDstType, origin) {
    const rule = new Rule(egress, protocol, fromPort, toPort, srcDst, srcDstType, origin)
    let pos = binsearch(this.rules, rule.compareTo.bind(rule))
    if (pos >= 0) {
      return false // exact match
    }
    pos = -(pos + 1)
    let mergePred = false
    let mergeSucc = false
    let pred, succ
    if (pos > 0) {
      pred = this.rules[pos - 1]
      mergePred = rule.isSameExceptPorts(pred) && fromPort <= pred.toPort + 1
      if (mergePred && toPort <= pred.toPort) {
        pred.addOrigin(origin)
        return false // included by pred
      }
    }
    if (pos < this.rules.length) {
      succ = this.rules[pos]
      mergeSucc = rule.isSameExceptPorts(succ) && toPort + 1 >= succ.fromPort
      if (mergeSucc && fromPort == succ.fromPort && toPort <= succ.toPort) {
        succ.addOrigin(origin)
        return false // included by succ
      }
    }
    if (mergePred && mergeSucc) {
      pred.toPort = Math.max(toPort, succ.toPort)
      pred.addOrigin(origin)
      pred.addOrigins(succ)
      this.rules.splice(pos, 1)
    } else if (mergePred) {
      pred.toPort = toPort
      pred.addOrigin(origin)
    } else if (mergeSucc) {
      succ.fromPort = fromPort
      succ.toPort = Math.max(toPort, succ.toPort)
      succ.addOrigin(origin)
    } else {
      this.rules.splice(pos, 0, rule)
    }
    return true
  }
  [Symbol.iterator]() {
    return this.rules[Symbol.iterator]()
  }
  size() {
    return this.rules.length
  }
}
