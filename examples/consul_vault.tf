resource "aws_security_group" "vpn_server" {
  name = "vpn_server"
  vpc_id = "${aws_vpc.main.id}"
  description = "VPN Server"
  tags {
    Name = "vpn_server"
    Bases = "consul_diag_src,vault_diag_src,out_all"
  }
}
resource "aws_security_group" "consul_vault_server" {
  name = "consul_vault_server"
  vpc_id = "${aws_vpc.main.id}"
  description = "Combined Consul/Vault Servers"
  tags {
    Name = "consul_vault_server"
    Bases = "consul_server,consul_common,vault_server"
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
resource "aws_security_group_rule" "vpn_server_ingress_udp_500_any" {
  security_group_id = "${aws_security_group.vpn_server.id}"
  type = "ingress"
  protocol = "udp"
  from_port = 500
  to_port = 500
  cidr_blocks = ["0.0.0.0/0"]
}
resource "aws_security_group_rule" "vpn_server_ingress_icmp_8_cidr1" {
  security_group_id = "${aws_security_group.vpn_server.id}"
  type = "ingress"
  protocol = "icmp"
  from_port = 8
  to_port = -1
  cidr_blocks = ["1.2.3.4/32"]
}
# inherited from out_all
resource "aws_security_group_rule" "vpn_server_egress_all_any" {
  security_group_id = "${aws_security_group.vpn_server.id}"
  type = "egress"
  protocol = "-1"
  from_port = 0
  to_port = 0
  cidr_blocks = ["0.0.0.0/0"]
}
# consul_vault_server rules:
# inherited from consul_server, consul_common
resource "aws_security_group_rule" "consul_vault_server_ingress_tcp_8300_8302_self" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8300
  to_port = 8302
  self = true
}
# inherited from consul_server, consul_common
resource "aws_security_group_rule" "consul_vault_server_ingress_udp_8301_8302_self" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "udp"
  from_port = 8301
  to_port = 8302
  self = true
}
# inherited from vault_server
resource "aws_security_group_rule" "consul_vault_server_ingress_tcp_8200_vpn_server" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8200
  to_port = 8200
  source_security_group_id = "${aws_security_group.vpn_server.id}"
}
# inherited from consul_common
resource "aws_security_group_rule" "consul_vault_server_ingress_tcp_8400_vpn_server" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8400
  to_port = 8400
  source_security_group_id = "${aws_security_group.vpn_server.id}"
}
# inherited from consul_common
resource "aws_security_group_rule" "consul_vault_server_ingress_tcp_8500_vpn_server" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8500
  to_port = 8500
  source_security_group_id = "${aws_security_group.vpn_server.id}"
}
# inherited from consul_common
resource "aws_security_group_rule" "consul_vault_server_ingress_tcp_8600_vpn_server" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8600
  to_port = 8600
  source_security_group_id = "${aws_security_group.vpn_server.id}"
}
# inherited from consul_common
resource "aws_security_group_rule" "consul_vault_server_ingress_udp_8600_vpn_server" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "ingress"
  protocol = "udp"
  from_port = 8600
  to_port = 8600
  source_security_group_id = "${aws_security_group.vpn_server.id}"
}
# inherited from consul_common, consul_server
resource "aws_security_group_rule" "consul_vault_server_egress_tcp_8300_8302_self" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "egress"
  protocol = "tcp"
  from_port = 8300
  to_port = 8302
  self = true
}
# inherited from consul_server, consul_common
resource "aws_security_group_rule" "consul_vault_server_egress_udp_8301_8302_self" {
  security_group_id = "${aws_security_group.consul_vault_server.id}"
  type = "egress"
  protocol = "udp"
  from_port = 8301
  to_port = 8302
  self = true
}
