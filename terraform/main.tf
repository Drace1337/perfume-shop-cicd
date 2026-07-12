# =============================================================================
#  main.tf — Wdrożenie CD aplikacji Perfume Shop na AWS (Infrastructure as Code)
# -----------------------------------------------------------------------------
#  Cel badawczy: powtarzalne, deklaratywne środowisko EC2 do pomiaru metryk
#  (CPU, RAM) różnych potoków CI/CD w ramach pracy magisterskiej.
#  Cała infrastruktura mieści się w AWS Free Tier (t3.micro / t2.micro).
# =============================================================================

# -----------------------------------------------------------------------------
#  1. Wersje: Terraform + provider AWS.
#     Blok required_providers "przypina" dostawcę do znanej, testowanej wersji,
#     co gwarantuje powtarzalność wdrożenia (kluczowe dla badań porównawczych).
# -----------------------------------------------------------------------------
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ---------------------------------------------------------------------------
  #  Remote backend (S3 + DynamoDB) — standard rynkowy dla współdzielonego stanu.
  #  - S3 przechowuje plik stanu (terraform.tfstate) w jednym, centralnym miejscu,
  #    dzięki czemu wszystkie trzy potoki CI/CD widzą tę samą infrastrukturę
  #    (idempotentność — kolejne `apply` modyfikuje, a nie duplikuje zasoby).
  #  - DynamoDB realizuje STATE LOCKING: zapobiega równoczesnym `apply`
  #    (race condition) między GitHub Actions, GitLab CI i Jenkinsem.
  #  - encrypt = true wymusza szyfrowanie stanu w spoczynku (SSE).
  #  UWAGA: wartości backendu MUSZĄ być stałe (bez zmiennych) — backend jest
  #  inicjalizowany zanim Terraform pozna zmienne.
  # ---------------------------------------------------------------------------
  backend "s3" {
    bucket         = "perfume-shop-tfstate-drace1337"
    key            = "global/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "perfume-shop-tflock"
    encrypt        = true
  }
}

# -----------------------------------------------------------------------------
#  2. Konfiguracja providera AWS — region Frankfurt (eu-central-1).
#     Uwierzytelnienie pobierane jest automatycznie ze zmiennych środowiskowych
#     (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) lub z profilu ~/.aws/credentials.
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
#  3. Dynamiczne wyszukanie najnowszego obrazu Ubuntu 22.04 LTS (Canonical).
#     Dzięki data source nie zakodowujemy na sztywno ID AMI (różni się per region
#     i zmienia w czasie) — Terraform zawsze pobierze aktualny, oficjalny obraz.
# -----------------------------------------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # oficjalne konto Canonical (Ubuntu)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# -----------------------------------------------------------------------------
#  4. Security Group — wirtualny firewall instancji.
#     Otwieramy tylko potrzebne porty (zasada least privilege):
#       22   -> SSH (administracja)
#       80   -> HTTP (reverse proxy / Nginx)
#       3000 -> frontend React (Nginx) — jedyny publiczny punkt wejścia aplikacji
#     UWAGA: backend (port 4000) NIE jest wystawiony publicznie — jest dostępny
#     wyłącznie wewnętrznie, przez reverse proxy Nginx w sieci Dockera (/api -> backend:4000).
# -----------------------------------------------------------------------------
resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-sg"
  description = "Security group dla aplikacji Perfume Shop (SSH, HTTP, frontend)."

  # --- Ruch przychodzący (ingress) ---
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Frontend React"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- Ruch wychodzący (egress) ---
  # Pełny dostęp wychodzący jest niezbędny: apt-get, pobranie obrazów Docker Hub,
  # klonowanie repozytorium GitHub itd.
  egress {
    description = "Wszystkie porty wychodzace"
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # -1 = dowolny protokół
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-sg"
    Project = var.project_name
  }
}

# -----------------------------------------------------------------------------
#  5. Instancja EC2 — serwer aplikacyjny.
#     - ami:           dynamicznie znaleziony obraz Ubuntu 22.04
#     - instance_type: t3.micro/t2.micro (Free Tier)
#     - user_data:     skrypt cloud-init wykonywany JEDNORAZOWO przy pierwszym starcie
# -----------------------------------------------------------------------------
resource "aws_instance" "app_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.app_sg.id]

  # Dysk root: 30 GB gp3 mieści się w limicie Free Tier (30 GB EBS/miesiąc).
  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  # --- Skrypt cloud-init (bootstrap serwera) ---
  # Terraform interpoluje sekrety/nazwy (${var.db_name} itd.) oraz wstrzykuje
  # docker-compose.yml przez base64encode(file(...)); reszta to czysty bash.
  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail

    # 1) Aktualizacja systemu
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y ca-certificates curl git

    # 2) Instalacja Dockera + wtyczki Docker Compose (oficjalny skrypt convenience)
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    systemctl enable --now docker
    # Pozwól użytkownikowi 'ubuntu' używać dockera bez sudo
    usermod -aG docker ubuntu

    # 3) Katalog aplikacji + bezpieczne wygenerowanie pliku .env (sekrety z Terraform).
    mkdir -p /home/ubuntu/app
    cd /home/ubuntu/app
    printf '%s\n' \
      'NODE_ENV=production' \
      'LOG_LEVEL=info' \
      'BACKEND_PORT=4000' \
      'IMAGE_TAG=benchmark' \
      'POSTGRES_DB=${var.db_name}' \
      'POSTGRES_USER=${var.db_user}' \
      'POSTGRES_PASSWORD=${var.db_password}' \
      'JWT_SECRET=${var.jwt_secret}' \
      > .env
    chmod 600 .env

    # 4) Wstrzyknięcie docker-compose.yml prosto z Terraform (base64 => brak problemów
    #    z interpolacją i znakami specjalnymi). Serwer NIE klonuje repo i NIE buduje obrazów.
    echo '${base64encode(file("${path.module}/../docker-compose.yml"))}' | base64 -d > docker-compose.yml
    chown -R ubuntu:ubuntu /home/ubuntu/app

    # 5) Pobranie GOTOWYCH obrazów z Docker Hub i start (Build Once, Deploy Anywhere).
    #    Odciąża to t3.micro: brak kompilacji npm => brak ryzyka OOM Killera.
    docker compose pull
    docker compose up -d
  EOF

  # Wymusza odtworzenie instancji przy zmianie skryptu bootstrap.
  user_data_replace_on_change = true

  tags = {
    Name    = "${var.project_name}-server"
    Project = var.project_name
  }
}
