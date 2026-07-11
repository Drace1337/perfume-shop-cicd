# =============================================================================
#  terraform.tfvars — Konkretne wartości zmiennych dla tego wdrożenia.
#  Terraform wczytuje ten plik automatycznie. Trzymanie wartości osobno od
#  deklaracji (variables.tf) pozwala łatwo utrzymywać wiele środowisk.
# =============================================================================

aws_region      = "eu-central-1"
instance_type   = "t3.micro"
project_name    = "perfume-shop"
github_repo_url = "https://github.com/Drace1337/perfume-shop-cicd.git"
