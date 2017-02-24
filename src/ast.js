class Node {
  constructor(location) {
    this.location = location
  }
}

class Skipped extends Node {
  constructor(location) {
    super(location)
  }
  get skipped() {
    return true
  }
}

export class Comment extends Skipped {
  constructor(location, comment) {
    super(location)
    this.comment = comment
  }
}

export class Whitespace extends Skipped {
  constructor(location, chars) {
    super(location)
    this.chars = chars
  }
}

export class Semicolon extends Skipped {
  constructor(location) {
    super(location)
  }
}

export class IdRef extends Node {
  constructor(location, id) {
    super(location)
    this.id = id
  }
  resolve(target) {
    this.target = target
  }
}

export class CidrBlock extends Node {
  constructor(location, cidr) {
    super(location)
    this.cidr = cidr
  }
}

export class Range extends Node {
  constructor(location, from, to) {
    super(location)
    this.from = from
    this.to = to
  }
}

export class Rule extends Node {
  constructor(location, dir, protos, ports, srcDsts) {
    super(location)
    this.dir = dir
    this.protos = protos
    this.ports = ports
    this.srcDsts = srcDsts
  }
  get declType() {
    return 'rule'
  }
}

export class Description extends Node {
  constructor(location, text) {
    super(location)
    this.text = text
  }
  get declType() {
    return 'desc'
  }
}

export class Tags extends Node {
  constructor(location, kvpairs) {
    super(location)
    this.tags = {}
    for (const kv of kvpairs) {
      this.tags[kv[0]] = kv[1]
    }
  }
  get declType() {
    return 'tags'
  }
}

export class SecGroup extends Node {
  constructor(location, virtual, id, baseIds, members) {
    super(location)
    this.virtual = virtual
    this.id = id
    this.baseIds = baseIds
    this.members = members
    this.defined = baseIds != null || members != null
    this.args = null
    this.allBases = []
  }
  get declType() {
    return this.virtual ? 'virtsecgroup' : 'secgroup'
  }
  setArgs(args) {
    this.args = args
  }
  setAllBases(allBases) {
    this.allBases = allBases
  }
}

export class Defaults extends Node {
  constructor(location, kvpairs) {
    super(location)
    this.defaults = {}
    for (const kv of kvpairs) {
      this.defaults[kv[0]] = kv[1]
    }
  }
  get declType() {
    return '@defaults'
  }
}

export class Import extends Node {
  constructor(location, path) {
    super(location)
    this.path = path
  }
  get declType() {
    return '@import'
  }
  setSymbols(symbols) {
    this.symbols = symbols
  }
}
