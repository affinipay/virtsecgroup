resource "aws_security_group" "b" {
  name = "b"
  tags {
    Name = "b"
  }
}
resource "aws_security_group" "c" {
  name = "c"
  tags {
    Name = "c"
  }
}
resource "aws_security_group" "d" {
  name = "d"
  tags {
    Name = "d"
  }
}
resource "aws_security_group" "e" {
  name = "e"
  tags {
    Name = "e"
  }
}
# b rules:
# c rules:
resource "aws_security_group_rule" "c_ingress_tcp_123_b" {
  security_group_id = "${aws_security_group.c.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 123
  to_port = 123
  source_security_group_id = "${aws_security_group.b.id}"
}
resource "aws_security_group_rule" "c_ingress_tcp_123_d" {
  security_group_id = "${aws_security_group.c.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 123
  to_port = 123
  source_security_group_id = "${aws_security_group.d.id}"
}
# d rules:
# e rules:
resource "aws_security_group_rule" "e_ingress_tcp_234_b" {
  security_group_id = "${aws_security_group.e.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 234
  to_port = 234
  source_security_group_id = "${aws_security_group.b.id}"
}
resource "aws_security_group_rule" "e_ingress_tcp_234_d" {
  security_group_id = "${aws_security_group.e.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 234
  to_port = 234
  source_security_group_id = "${aws_security_group.d.id}"
}
