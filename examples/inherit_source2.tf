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
# d rules:
# e rules:
resource "aws_security_group_rule" "e_ingress_tcp_234_d" {
  security_group_id = "${aws_security_group.e.id}"
  type = "ingress"
  protocol = "tcp"
  from_port = 234
  to_port = 234
  source_security_group_id = "${aws_security_group.d.id}"
}
