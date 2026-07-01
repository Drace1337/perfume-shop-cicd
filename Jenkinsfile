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