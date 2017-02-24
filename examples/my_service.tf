resource "aws_security_group" "my_server" {
  name = "my_server"
  vpc_id = "${aws_vpc.main.id}"
  description = "My Servers that use Consul and Vault"
  tags {
    Name = "my_server"
    Bases = "consul_client,consul_common,vault_client,out_all"
  }
}
resource "aws_security_group" "my_elb" {
  name = "my_elb"
  vpc_id = "${aws_vpc.main.id}"
  description = "Load Balancer for My Servers"
  tags {
    Name = "my_elb"
  }
}
# my_server rules:
resource "aws_security_group_rule" "my_server_ingress_tcp_8080_my_elb" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8080
  to_port = 8080
  source_security_group_id = "${aws_security_group.my_elb.id}"
}
resource "aws_security_group_rule" "my_server_ingress_tcp_8080_my_server_client" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8080
  to_port = 8080
  source_security_group_id = "${aws_security_group.my_server_client.id}"
}
# inherited from consul_common
resource "aws_security_group_rule" "my_server_ingress_tcp_8301_self" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8301
  to_port = 8301
  self = true
}
# inherited from consul_common
resource "aws_security_group_rule" "my_server_ingress_udp_8301_self" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "ingress"
  protocol = "udp"
  from_port = 8301
  to_port = 8301
  self = true
}
resource "aws_security_group_rule" "my_server_ingress_tcp_8080_vpn_server" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8080
  to_port = 8080
  source_security_group_id = "${aws_security_group.vpn_server.id}"
}
# inherited from out_all
resource "aws_security_group_rule" "my_server_egress_all_any" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "egress"
  protocol = "-1"
  from_port = 0
  to_port = 0
  cidr_blocks = ["0.0.0.0/0"]
}
# inherited from consul_common
resource "aws_security_group_rule" "my_server_egress_tcp_8301_self" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "egress"
  protocol = "tcp"
  from_port = 8301
  to_port = 8301
  self = true
}
# inherited from consul_common
resource "aws_security_group_rule" "my_server_egress_udp_8301_self" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "egress"
  protocol = "udp"
  from_port = 8301
  to_port = 8301
  self = true
}
# my_elb rules:
resource "aws_security_group_rule" "my_elb_ingress_tcp_443_any" {
  security_group_id = "${aws_security_group.my_elb.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 443
  to_port = 443
  cidr_blocks = ["0.0.0.0/0"]
}
resource "aws_security_group_rule" "my_elb_ingress_tcp_80_any" {
  security_group_id = "${aws_security_group.my_elb.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 80
  to_port = 80
  cidr_blocks = ["0.0.0.0/0"]
}
resource "aws_security_group_rule" "my_elb_egress_tcp_8080_my_server" {
  security_group_id = "${aws_security_group.my_elb.id}"
  type = "egress"
  protocol = "tcp"
  from_port = 8080
  to_port = 8080
  source_security_group_id = "${aws_security_group.my_server.id}"
}
