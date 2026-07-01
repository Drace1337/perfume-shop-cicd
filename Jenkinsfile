pipeline {
    agent any

    environment {
        COMPOSE_FILE = 'docker-compose.yml'
        TRIVY_SEVERITY = 'HIGH,CRITICAL'
    }

    stages {
        stage('Lint') {
            parallel {
                stage('Frontend Lint') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
                stage('Backend Lint') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
            }
        }

        stage('Test') {
            parallel {
                stage('Frontend Test') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                            sh 'npm test -- --runInBand'
                        }
                    }
                }
                stage('Backend Test') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                            sh 'npm test -- --runInBand'
                        }
                    }
                }
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose -f ${COMPOSE_FILE} build frontend backend'
            }
        }

        stage('Security Scan') {
            steps {
                sh 'trivy fs --exit-code 1 --severity ${TRIVY_SEVERITY} --ignore-unfixed .'
                sh 'trivy image --exit-code 1 --severity ${TRIVY_SEVERITY} --ignore-unfixed perfume-shop-frontend:local'
                sh 'trivy image --exit-code 1 --severity ${TRIVY_SEVERITY} --ignore-unfixed perfume-shop-backend:local'
            }
        }
    }

    post {
        always {
            sh 'docker compose -f ${COMPOSE_FILE} down --remove-orphans || true'
        }
    }
}