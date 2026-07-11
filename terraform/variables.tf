# =============================================================================
#  variables.tf — Deklaracje zmiennych wejściowych modułu.
#  Rozdzielenie zmiennych od logiki (main.tf) to standardowa dobra praktyka
#  DevOps: zwiększa czytelność i ułatwia parametryzację środowisk.
# =============================================================================

variable "aws_region" {
  description = "Region AWS, w którym wdrażamy infrastrukturę."
  type        = string
  default     = "eu-central-1"
}

variable "instance_type" {
  description = "Typ instancji EC2 objęty Free Tier (t3.micro lub t2.micro)."
  type        = string
  default     = "t3.micro"
}

variable "project_name" {
  description = "Nazwa projektu używana w tagach i nazwach zasobów."
  type        = string
  default     = "perfume-shop"
}

variable "github_repo_url" {
  description = "Publiczny URL repozytorium GitHub z aplikacją (docker-compose.yml)."
  type        = string
  # Wartość rzeczywista dostarczana jest w terraform.tfvars.
  default = "https://github.com/PLACEHOLDER/perfume-shop.git"
}

variable "key_name" {
  description = "Nazwa istniejącej pary kluczy EC2 do logowania po SSH (opcjonalne)."
  type        = string
  default     = null
}

variable "ssh_allowed_cidr" {
  description = "Zakres IP z dostępem po SSH. Domyślnie 0.0.0.0/0 (cały świat) — do badań OK, produkcyjnie zawęź do swojego IP."
  type        = string
  default     = "0.0.0.0/0"
}

# --- Konfiguracja bazy danych / sekrety ---
# Zmienne oznaczone `sensitive = true` są maskowane w planie i logach Terraform.
# Nie mają wartości domyślnych — muszą być podane z zewnątrz (terminal / TF_VAR_*),
# dzięki czemu hasło nigdy nie trafia do repozytorium.

variable "db_name" {
  description = "Nazwa bazy danych PostgreSQL (POSTGRES_DB)."
  type        = string
  default     = "perfume_shop"
}

variable "db_user" {
  description = "Użytkownik bazy danych PostgreSQL (POSTGRES_USER)."
  type        = string
  default     = "perfume_user"
}

variable "db_password" {
  description = "Hasło bazy danych PostgreSQL (POSTGRES_PASSWORD). Sekret — podawany z terminala."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Klucz do podpisywania tokenów JWT (JWT_SECRET). Sekret — podawany z terminala."
  type        = string
  sensitive   = true
}
