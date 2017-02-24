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
# my_server rules:
resource "aws_security_group_rule" "my_server_ingress_tcp_8080_my_elb" {
  security_group_id = "${aws_security_group.my_server.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 8080
  to_port = 8080
  source_security_group_id = "${aws_security_group.my_elb.id}"
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
