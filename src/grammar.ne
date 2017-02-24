@{%
  const ast = require('./ast');
  const { addNewline: newline, translateLocation: makeloc } = require('./location')
%}

file -> _ decl:* {% d => d[1] %}
decl -> defaults {% id %}
  | import {% id %}
  | secgroup {% id %}
  | virtsecgroup {% id %}
defaults -> "@defaults" _ "{" _ def_members "}" _ {% (d, l) => new ast.Defaults(makeloc(l), d[4]) %}
import -> "@import" _ str _ {% (d, l) => new ast.Import(makeloc(l), d[2]) %}
def_members -> null {% () => [] %}
  | def_member sep def_members {% d => [d[0]].concat(d[2]) %}
def_member -> key _ "=" _ str {% d => [d[0], d[4]] %}
secgroup -> "secgroup" __ id inherits:? opt_defn {% (d, l) => new ast.SecGroup(makeloc(l), false, d[2], d[3], d[4]) %}
virtsecgroup -> "virtsecgroup" __ id inherits:? opt_defn {% (d, l) => new ast.SecGroup(makeloc(l), true, d[2], d[3], d[4]) %}
opt_defn -> sg_block _ {% id %} | sep {% () => null %}
inherits -> __ "is" __ id_list {% d => d[3] %}
sg_block -> _ "{" _ sg_members "}" {% d => d[3] %}
sg_members -> null {% () => [] %}
  | sg_member sep sg_members {% d => [d[0]].concat(d[2]) %}
sg_member -> desc {% id %}
  | tags_block {% id %}
  | rule {% id %}
desc -> "desc" __ str {% (d, l) => new ast.Description(makeloc(l), d[2]) %}
tags_block -> "tags" _ "{" _ tags "}" {% (d, l) => new ast.Tags(makeloc(l), d[4]) %}
tags -> null {% () => [] %}
  | tag _ {% d => [d[0]] %}
  | tag _ "," _ tags {% d => [d[0]].concat(d[4]) %}
tag -> key _ "=" _ str {% d => [d[0], d[4]] %}
key -> id {% id %}
  | str {% id %}
rule -> ("in" | "out" | "inout") __ proto_ports __ src_dsts
  {% (d, l) => new ast.Rule(makeloc(l), d[0][0], d[2].protos, d[2].ports, d[4]) %}
generic_proto -> "tcp" {% id %} | "udp" {% id %} | uint {% id %}
generic_proto_list -> generic_proto
  | generic_proto _ "," _ generic_proto_list {% d => [d[0]].concat(d[4]) %}
proto_ports -> "all" {% d => ({ protos: [d[0]] }) %}
  | generic_proto_list __ uint_set {% d => ({ protos: d[0], ports: d[2] }) %}
  | "icmp" __ icmp_ports {% d => ({ protos: [d[0]], ports: [d[2]] }) %}
icmp_ports -> uint {% (d, l) => new ast.Range(makeloc(l), d[0], -1) %}
  | uint _ ":" _ uint {% (d, l) => new ast.Range(makeloc(l), d[0], d[4]) %}
src_dsts -> id_list {% id %}
  | "cidr" _ "=" _ str_list {% (d, l) => d[4].map(s => new ast.CidrBlock(makeloc(l), s)) %}

id -> [a-zA-Z_$] [a-zA-Z0-9_$]:* {% d => [d[0]].concat(d[1]).join('') %}
id_ref -> id {% (d, l) => new ast.IdRef(makeloc(l), d[0]) %}
id_list -> id_ref
  | id_ref _ "," _ id_list {% d => [d[0]].concat(d[4]) %}

uint -> "0" {% () => 0 %}
  | [1-9] [0-9]:* {% d => parseInt([d[0]].concat(d[1]).join(''), 10) %}
uint_range -> uint {% id %}
  | uint _ "-" _ uint {% (d, l) => new ast.Range(makeloc(l), d[0], d[4]) %}
uint_set -> uint_range
  | uint_range _ "," _ uint_set {% d => [d[0]].concat(d[4]) %}

str -> sqstr {% id %} | dqstr {% id %}
sqstr -> "'" sqstr_char:* "'" {% d => d[1].join('') %}
dqstr -> "\"" dqstr_char:* "\"" {% d => d[1].join('') %}
sqstr_char -> [^\\\n'] {% id %} | str_escape {% id %}
dqstr_char -> [^\\\n"] {% id %} | str_escape {% id %}
str_escape -> "\\" [^\n] {% d => JSON.parse('"\\' + d[1] + '"') %}
str_list -> str
  | str _ "," _ str_list {% d => [d[0]].concat(d[4]) %}

ws -> [\f\r\t\v\u00A0\u2028\u2029 ]:+ {% (d, l) => new ast.Whitespace(makeloc(l), d[0].join('')) %}
newline -> "\n" {% (d, l) => { const n = new ast.Whitespace(makeloc(l), d[0]); newline(l); return n } %}
block_comment -> "/*" bc_char:* "*/" {% (d, l) => new ast.Comment(makeloc(l), d[1].join('')) %}
bc_char => [^*] {% id %}
  | "*" [^/] {% d => d[0] + d[1] %}
line_comment -> ("//" | "#") [^\n]:* newline {% (d, l) => new ast.Comment(makeloc(l), d[1].join('')) %}
skip -> ws {% id %}
  | block_comment {% id %}
  | line_comment {% id %}
  | newline {% id %}
# required whitespace
__ -> skip | skip __ {% d => [d[0]].concat(d[1]) %}
# optional whitespace
_ -> null {% () => [] %} | __ {% id %}
semi -> ";" {% (d, l) => new ast.Semicolon(makeloc(l)) %}
sep -> (ws | block_comment):* (newline | line_comment | semi) (skip | semi):* {% d => d[0].concat(d[1], d[2]) %}
