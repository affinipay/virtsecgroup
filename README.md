# Virtual AWS security groups for Terraform

Easily declare complex [AWS](https://aws.amazon.com/) security groups for [Terraform](https://www.terraform.io/) with security group inheritance/composition and more concise syntax.

## Overview

AWS imposes a [limit](http://docs.aws.amazon.com/AmazonVPC/latest/UserGuide/VPC_Appendix_Limits.html#vpc-limits-security-groups) of 5 security groups per network interface<sup>[1](#footnote1)</sup>, which makes it difficult or impossible to have fine-grained security groups that provide separation of concerns while strictly controlling access. Furthermore, the Terraform syntax ([HCL](https://github.com/hashicorp/hcl) or JSON) for describing [security group rules](https://www.terraform.io/docs/providers/aws/r/security_group_rule.html) is rather verbose, which can make it time-consuming and error-prone to read and write. Together, these limitations encourage the use of overly general and loose security groups, such as the default security group, which results in lax network security.

This tool aims to overcome these limitations by introducing several improvements:

* Security group inheritance
    * Sub-groups inherit the union of all rules from super-groups
    * Super-groups can be used as the source/target group of a rule, effectively making all sub-groups a source/target also
* _Virtual security groups_
    * Security groups that are defined purely for inheritance by other groups
    * Not actually created in AWS (and therefore do not apply to the security groups per VPC limit of 500)
* A concise, domain-specific language (DSL) for defining security groups and their rules
    * Eliminates much of the verbosity of HCL or JSON for defining rules
    * Meta-rules that generate multiple rules in Terraform
        * Combined ingress and egress rules
        * Multiple protocols per rule (e.g. TCP and UDP)
        * Multiple, non-consecutive ports (e.g. 80 and 443)
        * Multiple source/target security groups
    * Allows referencing security groups from rules before they are defined
        * No special-case "self" rules
        * Interdependent groups (such as server and load balancer) can reference each other without forward declaration

It reads files written in its DSL (conventionally with a `.vsg` extension) and outputs Terraform `aws_security_group` and `aws_security_group_rule` resources in HCL syntax.

<small><a name="footnote1">1</a>: The security groups per network interface limit can be increased to a maximum of 16 upon request, but since the multiple of groups and rules cannot exceed 250, the rules per group would decrease from 50 to 15.</small>

## Installation

`virtsecgroup` is written in [Node.js](https://nodejs.org/), which must be [installed](https://nodejs.org/en/download/) prior to use. Node.js includes the [Node Package Manager (NPM)](https://github.com/npm/npm), which is used for installing dependencies.

After cloning the repository, install dependencies and build:

```
$ npm install
```

After building, you can install the tool globally to run it from anywhere:

```
$ npm install --global
```

Alternatively, instead of installing globally, you can execute the tool directly using `./bin/virtsecgroup`, `node lib/index.js`, or `node run start --`.

## Usage

```
$ virtsecgroup --help

  Usage: index [options] [input-file]

  Options:

    -h, --help                  output usage information
    --dump-ast                  Dump parse AST
    --dump-charts-on-error      Dump parse charts if an error occurs
    -o, --output <output-file>  Specify the Terraform output filename
    -v, --verbose               Increase verbosity of output
```

By default, the tool reads from standard input and writes to standard output, but filenames can be specified on the command-line. The following example invocations are equivalent:

```
$ cd examples
$ virtsecgroup < my_service.vsg > my_service.tf
$ virtsecgroup my_service.vsg -o my_service.tf
```

Note that when imports are used from standard input, relative import paths are resolved using the working directory, so the `cd` above is significant for the first invocation (whereas the second could have equivalently specified `examples/my_service.vsg` instead).

## A Simple Example

The following example (from `examples/simple.vsg`) demonstrates a simple real-world scenario with an AWS virtual private cloud (VPC) containing a VPN server, a load balancer, and some backend service instances.

```
@defaults {
  vpc_id = '${aws_vpc.main.id}' // specify the VPC for each security group
}
virtsecgroup out_all {
  out all cidr='0.0.0.0/0' // allow outbound to anywhere
}
secgroup vpn_server is out_all { // for IPsec-based VPN server instances
  in udp 500,4500 cidr='0.0.0.0/0' // IKE ISAKMP and IPsec NAT-T
  in icmp 8 cidr='1.2.3.4/32' // allow ping from monitoring server
}
secgroup my_server is out_all { // for backend service instances
  in tcp 8080 my_elb,vpn_server // direct access only from ELB or VPN
}
secgroup my_elb { // for load balancer
  in tcp 80,443 cidr='0.0.0.0/0' // HTTP/HTTPS from anywhere
  out tcp 8080 my_server // outbound only to backend servers
}
```

The 17 lines above generate 108 lines of Terraform (from `examples/simple.tf`):

```
resource "aws_security_group" "vpn_server" {
  name = "vpn_server"
  vpc_id = "${aws_vpc.main.id}"
  tags {
    Name = "vpn_server"
    Bases = "out_all"
  }
}
resource "aws_security_group" "my_server" {
  name = "my_server"
  vpc_id = "${aws_vpc.main.id}"
  tags {
    Name = "my_server"
    Bases = "out_all"
  }
}
resource "aws_security_group" "my_elb" {
  name = "my_elb"
  vpc_id = "${aws_vpc.main.id}"
  tags {
    Name = "my_elb"
  }
}
# vpn_server rules:
resource "aws_security_group_rule" "vpn_server_ingress_udp_4500_any" {
  security_group_id = "${aws_security_group.vpn_server.id}"
  type = "ingress"
  protocol = "udp"
  from_port = 4500
  to_port = 4500
  cidr_blocks = ["0.0.0.0/0"]
}
...
```

Larger real-world scenarios tend to have output with approximately 10x the number of non-blank, non-comment lines as the input.

## Input Syntax

The following [EBNF](https://en.wikipedia.org/wiki/Extended_Backus%E2%80%93Naur_form)-like grammar roughly describes the accepted language. Readers not familiar with the grammar notation may wish to refer to the `examples` directory instead.

```
file ::= ( defaults | import | secgroup )*

defaults ::= '@defaults' '{' ( keyvalue SEP )* '}'
keyvalue ::= key '=' string
key ::= ID | string

import ::= '@import' string

secgroup ::= ( 'secgroup' | 'virtsecgroup' ) ID opt_sgdef
opt_sgdef ::= sginherit? '{' ( sgmember SEP )* '}' | SEP
sginherit ::= 'is' ID ( ',' ID )*
sgmember ::= rule | desc | tags
rule ::= ( 'in' | 'out' | 'inout' ) ports srcdsts
ports ::= 'all' | 'tcp' uintset | 'udp' uintset | UINT uintset | 'icmp' UINT ( ':' UINT )?
srcdsts ::= idlist | 'cidr' '=' strlist
desc ::= 'desc' STR
tags ::= 'tags' '{' ( keyvalue ( ',' keyvalue )* )? '}'

ID ::= /[a-zA-Z_$]/ /[a-zA-Z0-9_$]*/
idlist ::= ID | ID ',' idlist

UINT ::= '0' | /[1-9]/ /[0-9]*/
uintrange ::= UINT | UINT '-' UINT
uintset ::= uintrange | uintrange ',' uintset

STR ::= '\'' ( /[^\\\n']/ | ESC )* '\''
       | '"' ( /[^\\\n"]/ | ESC )* '"'
ESC ::= '\\' /[^\n]/
strlist ::= STR | STR "," strlist

SEP ::= /[;\n]/
```

Additionally:

* Whitespace is allowed before or after any token except within the rules with uppercase names (e.g. `ID` and `STR`); it is required between tokens in cases that would otherwise be ambiguous (e.g. a keyword followed by an identifier).
* C-style block comments (`/* */`), C++-style line comments (`//`), and shell-style line comments (`#`) are allowed wherever whitespace is.
* Group declarations and rules are separated by a semicolon, new-line, or both. Group definitions with a rule block are not followed by semicolon.

## Semantics

### Naming

Each file has a flat namespace that includes the names of all security groups (or virtual security groups) declared or defined in that file. A security group declaration that includes an inheritance (`is`) clause or a member block is considered a definition. A security group may be defined at most once per file, but may have (redundant) declarations before or after its definition. Security groups need not be declared or defined before they are referenced (e.g. as an inherited or rule source group); they simply must be declared or defined at some point in the file (including by an import).

If a non-virtual security group is declared but never defined, it is assumed to be externally defined in Terraform, and `virtsecgroup` will not generate a Terraform resource for it. The declaration allows the security group to be used as a source/target security group in a rule. An externally defined security group may not be inherited, since its definition is not visible to `virtsecgroup`. Virtual security groups, on the other hand, are obviously never externally defined, and therefore are simply assumed to be empty if declared but never defined.

Aside from being used to resolve references between security groups for inheritance and source security groups, security group names are used in three places in the Terraform output:

* The name of the security group in the `.vsg` file is used as the Terraform `aws_security_group` resource ID in the output. It is also used as the prefix of Terraform `aws_security_group_rule` resource IDs for that group.
* The name is used as the `name` attribute in the `aws_security_group` resource, which is the immutable Group Name shown in the AWS EC2/VPC console.
* If a security group does not define a tag called `Name`, that tag will be generated automatically with the name of the group in the Terraform output. The `Name` tag is shown as the first column in the AWS EC2/VPC console.

### Imports

Each file may import names from any number of other files using the `@import` directive. The sole argument to the import directive is a string representing the path of the file to be imported. If the path is relative, it is resolved relative to the path of the importing file (or the current working directory for `stdin`.) The imported files are processed just like the main file (and may import files of their own) except that they do not generate any Terraform output. Names declared in the importing file take precedence (and hide) imported names. If a referenced name is declared in multiple imported files but not in the importing file, it is considered ambiguous and results in an error.

#### Imports and Inherited Source Security Groups

When an imported and inherited security group is used as a source security group, only non-virtual, inheriting security groups defined in the same file as the source security group rule will generate security group rules in the output. For example, if file 1 defines virtual group A, non-virtual group B inheriting A, and non-virtual group C with a rule specifying A as a source group, group C will generate a rule specifying B as a source group. Then in file 2, which imports file 1, if non-virtual group D inherits A and non-virtual group E has a rule specifying A as a source group, group E will generate a rule specifying D as a source group.

```
// inherit_source1.vsg
virtsecgroup a
secgroup b is a
secgroup c { in tcp 123 a; } // rule with only source b
```

```
// inherit_source2.vsg
@import 'inherit_source1.vsg'
secgroup d is a
secgroup e { in tcp 234 a; } // rule with only source d
```

Note that group C will not include a rule with source group D, and group E will not include a rule with source group B, because C/D and B/E are defined in different files. If the files were combined, both C and E would have source groups B and D.

```
virtsecgroup a
secgroup b is a
secgroup c { in tcp 123 a; } // rule with source b and d
secgroup d is a
secgroup e { in tcp 234 a; } // rule with source b and d
```

See `examples/inherit_source*.vsg` and the corresponding generated `.tf` files for details.

### Defaults

Arbitrary key/value pairs (such as `vpc_id` and `provider`) can be included in the generated Terraform security group resources using the `@defaults` directive. This directive applies to any security groups defined later in the file. For security groups with multiple declarations, the defaults in effect at the point of definition are used. Subsequent `@defaults` directives can add or replace values, depending on whether the key matches a previously declared default. It is not currently possible to remove a previously declared default. Defaults are not imported from `@import` directives.

```
@defaults {
  provider = "aws.backup"
  vpc_id = '${aws_vpc.backup.id}'
}
```

### Terraform Output

Only non-virtual security groups defined in the main input file generate Terraform output. Virtual, declaration-only, and imported security groups may appear as source security groups, but do not result in Terraform resources being defined. When a virtual security group is used as a source security group (of a rule), rules are generated for each non-virtual security group (if any) that inherits that security group.

## Limitations/Known Issues

* Arbitrary security group properties like `vpc_id` or `provider` must be specified using the `@defaults` directive. There is not currently syntax for specifying them inline.
* There is not currently any syntax for removing a previously declared default property.
* Defaults are not imported from `@import` directives. Doing so seems potentially more confusing than convenient.
* When inherited security groups are used as a source group in a rule, only non-virtual groups defined in the same file as the rule will generate rules in the output. See [above](#imports-and-inherited-source-security-groups) for details.
* Source security groups and CIDR blocks cannot be specified in the same rule.

## Syntax Highlighting

### Atom

While there is not (yet) an [Atom](https://atom.io/) plug-in available, merging the following snippet into your `~/.atom/config.cson` will highlight `.vsg` files as if they were JavaScript.

```
"*":
  core:
    customFileTypes:
      'source.js': [
        'vsg'
      ]
```

## Support

Please use [GitHub issues](https://github.com/affinipay/virtsecgroup/issues) for bug reports or feature requests.

## Contributions

Contributions in the form of [GitHub pull requests](https://github.com/affinipay/virtsecgroup/pulls) are welcome. Please adhere to the following guidelines:

* Before embarking on a significant change, please create an issue to discuss the proposed change and ensure that it is likely to be merged.
* Follow the coding conventions used throughout the project, including 2-space indentation and no unnecessary semicolons. Many conventions are enforced using `eslint`.
* Any contributions must be licensed under the ISC license.

## License

`virtsecgroup` is available under the [ISC license](LICENSE).
