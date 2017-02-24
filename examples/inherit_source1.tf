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
