# =============================================================================
#  outputs.tf — Wartości wyjściowe zwracane po `terraform apply`.
#  Ułatwiają szybki dostęp do wdrożonej aplikacji i integrację z innymi
#  narzędziami (np. skryptami pomiarowymi CPU/RAM w pracy magisterskiej).
# =============================================================================

output "public_ip" {
  description = "Publiczny adres IPv4 instancji EC2."
  value       = aws_instance.app_server.public_ip
}

output "frontend_url" {
  description = "Gotowy URL frontendu React."
  value       = "http://${aws_instance.app_server.public_ip}:3000"
}

output "api_url" {
  description = "URL API — dostępne przez reverse proxy Nginx (backend NIE jest publiczny)."
  value       = "http://${aws_instance.app_server.public_ip}:3000/api"
}

output "ssh_command" {
  description = "Gotowe polecenie SSH (wymaga ustawionej zmiennej key_name)."
  value       = "ssh ubuntu@${aws_instance.app_server.public_ip}"
}
