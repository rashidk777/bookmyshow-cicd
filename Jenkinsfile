// Jenkinsfile — CI/CD pipeline for BookMyShow-Lite
// Requires plugins: Docker Pipeline, Ansible, Pipeline: SCM Step, Git, Credentials Binding
//
// Algorithm (high level):
//   1. Pull latest source from GitHub (triggered by webhook / SCM poll)
//   2. Install dependencies and run unit tests inside a disposable Node container
//   3. Build a versioned Docker image from the tested artifact
//   4. Push the image to the registry (Docker Hub / ECR)
//   5. Use Ansible to pull & (re)start the container stack on the target host(s)
//   6. Run a smoke test against the deployed container
//   7. On completion (success or failure) tear down any leftover build containers

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
        REGISTRY_CREDS   = "dockerhub-creds"          // Jenkins credential ID
        ANSIBLE_HOSTS    = "ansible/inventory.ini"
        DEPLOY_PLAYBOOK  = "ansible/deploy.yml"
        CONTAINER_NAME   = "bookmyshow-lite"
    }

    triggers {
        // GIT web hook (preferred) posts to <jenkins_url>/github-webhook/
        // Poll SCM kept as a fallback in case the webhook cannot reach Jenkins.
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
                docker { image 'node:18-alpine' }
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
            // Requirement 6: remove the container stack used for this job's
            // build/test phase so the agent is left clean for the next run.
            sh '''
                docker ps -aq --filter "label=jenkins-build=${BUILD_NUMBER}" | xargs -r docker rm -f
                docker image prune -f
            '''
        }
    }
}
