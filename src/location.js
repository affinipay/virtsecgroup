let line_ends = []

export function takeLocations() {
  const result = line_ends
  line_ends = []
  return result
}

export function addNewline(offset) {
  line_ends.push(offset + 1)
}

export function translateLocation(offset, locs = line_ends) {
  let line = locs.length
  while (line > 0 && offset < locs[line - 1]) {
    --line
  }
  return { line: line + 1, column: (line > 0 ? offset - locs[line - 1] : offset) + 1 }
}

export function formatLocation(loc) {
  return loc.line + ':' + loc.column
}
