pipeline {
    // No global agent: each stage requests its own isolated Docker container.
    agent none

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        TRIVY_SEVERITY = 'CRITICAL,HIGH'
    }

    stages {
        stage('CI') {
            // Backend, Frontend and Security run fully in parallel,
            // mirroring the three independent GitHub Actions jobs.
            parallel {
                stage('Backend') {
                    agent {
                        docker {
                            image 'node:22-alpine'
                        }
                    }
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                            sh 'npm run lint'
                            sh 'npm run test'
                            sh 'npm run build'
                        }
                    }
                }

                stage('Frontend') {
                    agent {
                        docker {
                            image 'node:22-alpine'
                        }
                    }
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                            sh 'npm run lint'
                            sh 'npm run test'
                            sh 'npm run build'
                        }
                    }
                }

                stage('Security (Trivy fs)') {
                    agent {
                        docker {
                            // Official Trivy image; reset the entrypoint so Jenkins
                            // can keep the container alive and inject its own commands.
                            image 'aquasec/trivy:0.51.2'
                            args '--entrypoint='
                        }
                    }
                    steps {
                        sh 'trivy fs --exit-code 1 --severity ${TRIVY_SEVERITY} --ignore-unfixed .'
                    }
                }
            }
        }

        // =====================================================================
        //  BUILD ONCE — budowa i push obrazów do Docker Hub.
        //  Kontener docker:27-cli używa demona hosta (zamontowany docker.sock),
        //  więc ciężka kompilacja dzieje się na agencie CI, a NIE na t3.micro.
        // =====================================================================
        stage('Build & Push Images') {
            agent {
                docker {
                    image 'docker:27-cli'
                    args '-v /var/run/docker.sock:/var/run/docker.sock'
                }
            }
            environment {
                BACKEND_IMAGE  = 'drace1337/perfume-shop-backend'
                FRONTEND_IMAGE = 'drace1337/perfume-shop-frontend'
            }
            steps {
                // Sekrety z Jenkins Credentials Store; withCredentials maskuje je
                // i wypożycza wyłącznie na czas trwania tego bloku.
                withCredentials([
                    string(credentialsId: 'DOCKER_USERNAME', variable: 'DOCKER_USERNAME'),
                    string(credentialsId: 'DOCKER_PASSWORD', variable: 'DOCKER_PASSWORD')
                ]) {
                    sh 'echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin'
                    sh 'docker build -t $BACKEND_IMAGE:latest -t $BACKEND_IMAGE:${GIT_COMMIT} ./backend'
                    sh 'docker build -t $FRONTEND_IMAGE:latest -t $FRONTEND_IMAGE:${GIT_COMMIT} ./frontend'
                    sh 'docker push $BACKEND_IMAGE:latest'
                    sh 'docker push $BACKEND_IMAGE:${GIT_COMMIT}'
                    sh 'docker push $FRONTEND_IMAGE:latest'
                    sh 'docker push $FRONTEND_IMAGE:${GIT_COMMIT}'
                    sh 'docker logout'
                }
            }
        }

        // =====================================================================
        //  ARCHITEKTURA BEZPIECZEŃSTWA — Jenkins:
        //  Sekrety pochodzą z natywnego "Jenkins Credentials Store". Blok
        //  withCredentials wypożycza je TYLKO na czas trwania bloku i maskuje
        //  w logach. Krok 'input' wymusza ręczne, świadome zatwierdzenie
        //  wdrożenia (bramka CD) przed postawieniem infrastruktury na AWS.
        // =====================================================================
        stage('Deploy') {
            agent {
                docker {
                    image 'hashicorp/terraform:latest'
                    args '--entrypoint='
                }
            }
            steps {
                // Ręczne potwierdzenie z timeoutem, by build nie wisiał w nieskończoność.
                timeout(time: 15, unit: 'MINUTES') {
                    input message: 'Wdrożyć infrastrukturę na AWS (terraform apply)?', ok: 'Deploy'
                }
                withCredentials([
                    string(credentialsId: 'AWS_ACCESS_KEY_ID', variable: 'AWS_ACCESS_KEY_ID'),
                    string(credentialsId: 'AWS_SECRET_ACCESS_KEY', variable: 'AWS_SECRET_ACCESS_KEY'),
                    string(credentialsId: 'DB_PASSWORD', variable: 'TF_VAR_db_password'),
                    string(credentialsId: 'JWT_SECRET', variable: 'TF_VAR_jwt_secret')
                ]) {
                    dir('terraform') {
                        sh 'terraform init -input=false'
                        sh 'terraform plan -input=false -out=tfplan'
                        sh 'terraform apply -input=false -auto-approve tfplan'
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'CI pipeline passed: lint, tests, build and Trivy quality gate are green.'
        }
        failure {
            echo 'CI pipeline failed: check the failed stage (lint, test, build or Trivy).'
        }
    }
}