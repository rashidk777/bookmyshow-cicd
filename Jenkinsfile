// Jenkinsfile — CI/CD pipeline for BookMyShow-Lite
pipeline {

    agent { label 'docker-agent' }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }

    environment {
        IMAGE_NAME       = "rashidk777/bookmyshow-lite"
        IMAGE_TAG        = "${env.BUILD_NUMBER}"
        REGISTRY_CREDS   = "dockerhub-creds"
        ANSIBLE_HOSTS    = "ansible/inventory.ini"
        DEPLOY_PLAYBOOK  = "ansible/deploy.yml"
        CONTAINER_NAME   = "bookmyshow-lite"
        ANSIBLE_CONFIG   = "${env.WORKSPACE}/ansible/ansible.cfg"
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Unit Test') {
            agent {
                docker {
                    image 'node:18-alpine'
                    label 'docker-agent'
                }
            }
            steps {
                dir('app') {
                    sh 'npm install'
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    dockerImage = docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    docker.withRegistry('https://registry.hub.docker.com', "${REGISTRY_CREDS}") {
                        dockerImage.push("${IMAGE_TAG}")
                        dockerImage.push("latest")
                    }
                }
            }
        }

        stage('Trust Deploy Host') {
            steps {
                sh '''
                    mkdir -p ~/.ssh
                    DEPLOY_HOST=$(grep -oP 'ansible_host=\\K[^ ]+' ${ANSIBLE_HOSTS} | head -1)
                    ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts 2>/dev/null
                '''
            }
        }

        stage('Deploy with Ansible') {
            steps {
                ansiblePlaybook(
                    playbook: "${DEPLOY_PLAYBOOK}",
                    inventory: "${ANSIBLE_HOSTS}",
                    extras: "-e image_name=${IMAGE_NAME} -e image_tag=${IMAGE_TAG} -e container_name=${CONTAINER_NAME}",
                    colorized: true
                )
            }
        }

        stage('Smoke Test') {
            steps {
                script {
                    def deployHost = sh(script: "grep -m1 ansible_host ${ANSIBLE_HOSTS} | cut -d= -f2", returnStdout: true).trim()
                    sh "curl -sf http://${deployHost}:3000/health"
                }
            }
        }
    }

    post {
        success {
            echo "Build ${IMAGE_TAG} deployed successfully."
        }
        failure {
            echo "Build ${IMAGE_TAG} failed — see stage logs above."
        }
        always {
            sh '''
                docker ps -aq --filter "label=jenkins-build=${BUILD_NUMBER}" | xargs -r docker rm -f
                docker image prune -f
            '''
        }
    }
}
