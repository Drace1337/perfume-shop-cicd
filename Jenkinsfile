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
                    // Zagniezdzone stage'y sekwencyjne dziela ten sam agent/workspace,
                    // dzieki czemu Jenkins eksponuje osobne czasy trwania kazdego etapu
                    // (lint-backend / test-backend / build-backend), spojnie z GitLab/GitHub.
                    stages {
                        stage('lint-backend') {
                            steps {
                                dir('backend') {
                                    sh 'npm ci'
                                    sh 'npm run lint'
                                }
                            }
                        }
                        stage('test-backend') {
                            steps {
                                dir('backend') {
                                    sh 'npm run test'
                                }
                            }
                        }
                        stage('build-backend') {
                            steps {
                                dir('backend') {
                                    sh 'npm run build'
                                }
                            }
                        }
                    }
                }

                stage('Frontend') {
                    agent {
                        docker {
                            image 'node:22-alpine'
                        }
                    }
                    stages {
                        stage('lint-frontend') {
                            steps {
                                dir('frontend') {
                                    sh 'npm ci'
                                    sh 'npm run lint'
                                }
                            }
                        }
                        stage('test-frontend') {
                            steps {
                                dir('frontend') {
                                    sh 'npm run test'
                                }
                            }
                        }
                        stage('build-frontend') {
                            steps {
                                dir('frontend') {
                                    sh 'npm run build'
                                }
                            }
                        }
                    }
                }

                stage('security') {
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
        stage('build-push') {
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
                    sh 'docker build -t $BACKEND_IMAGE:benchmark ./backend'
                    sh 'docker build -t $FRONTEND_IMAGE:benchmark ./frontend'
                    sh 'docker push $BACKEND_IMAGE:benchmark'
                    sh 'docker push $FRONTEND_IMAGE:benchmark'
                    sh 'docker logout'
                }
            }
        }

        // =====================================================================
        //  ARCHITEKTURA BEZPIECZEŃSTWA — Jenkins:
        //  Sekrety pochodzą z natywnego "Jenkins Credentials Store". Blok
        //  withCredentials wypożycza je TYLKO na czas trwania bloku i maskuje
        //  w logach. Wdrożenie jest CIĄGŁE — bez bariery akceptacji (pełna
        //  automatyzacja na potrzeby badań wydajnościowych).
        // =====================================================================
        stage('deploy') {
            agent {
                docker {
                    image 'hashicorp/terraform:latest'
                    args '--entrypoint='
                }
            }
            steps {
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