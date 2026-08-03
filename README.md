# BookMyShow-Lite — Automated CI/CD Test Environment

Course-end Project 2: an automated build, test and release pipeline for a
ticket-booking style web application, modeled on BookMyShow's need for
continuous evaluation instead of slow, manual, end-of-cycle testing.

This repository contains everything needed to reproduce the pipeline:

```
bookmyshow-cicd/
├── app/                  # sample Node.js/Express ticket-booking service (the "product")
│   ├── server.js
│   ├── package.json
│   ├── public/index.html
│   └── tests/api.test.js # automated test suite (Mocha + Chai)
├── Dockerfile            # builds the runnable image from the tested artifact
├── Jenkinsfile           # declarative pipeline: build → test → image → deploy → teardown
├── ansible/
│   ├── inventory.ini     # target EC2 host(s)
│   ├── ansible.cfg
│   ├── deploy.yml        # installs Docker, pulls image, (re)starts container
│   └── teardown.yml      # removes the container stack
├── scripts/cleanup.sh    # container/image cleanup helper called from Jenkins
└── README.md             # this document
```

## 1. Architecture

```
GitHub repo  --webhook-->  Jenkins Master  --dispatches job-->  Jenkins Agent (Docker-capable EC2)
                                  |                                     |
                                  |                          builds & unit-tests app
                                  |                          builds Docker image
                                  |                          pushes image to registry
                                  |
                                  '--Ansible-->  Deployment EC2 host(s)
                                                  pulls image, runs container
                                                  smoke test
                                  (post) --------> cleanup.sh removes build-time containers
```

* **Jenkins master/slave (controller/agent):** the controller schedules
  jobs and holds configuration; one or more agent EC2 instances (or Docker
  containers acting as agents) actually execute the pipeline steps, so
  compute-heavy build/test work never runs on the controller itself.
* **Docker:** used both as (a) the execution environment for build/test
  stages (via the Docker Pipeline plugin) and (b) the packaging format for
  the deployable artifact.
* **Ansible:** configuration management/deployment tool that installs
  Docker on the target host (if missing) and idempotently (re)starts the
  application container — satisfies the "Ansible, Chef, or Puppet"
  requirement.

## 2. Tools and versions used

| Tool | Purpose |
|---|---|
| AWS EC2 (Ubuntu 22.04 LTS) | Hosts for Jenkins controller, Jenkins agent, and the deployment target |
| Jenkins 2.x + plugins | Orchestrates the pipeline |
| Docker / Docker Engine | Builds and runs containers |
| Ansible 2.x | Provisions Docker and deploys the container to the target host |
| GitHub | Source control + webhook trigger |
| Node.js 18, Express, Mocha/Chai | The sample application and its test suite |

Jenkins plugins required: **Docker Pipeline**, **Docker plugin**,
**Ansible**, **Git**, **GitHub Integration / GitHub**, **Credentials
Binding**, **Pipeline: Stage View** (optional, for visualization).

---

## 3. Step-by-step setup

### Step 1 — Provision EC2 instances

**Algorithm**
```
1. Launch EC2 instance "jenkins-master" (t2.medium, Ubuntu 22.04)
2. Launch EC2 instance "jenkins-agent"  (t2.medium, Ubuntu 22.04, Docker-capable)
3. Launch EC2 instance "deploy-target"  (t2.micro,  Ubuntu 22.04)
4. Create/attach a security group that allows:
     - 22   (SSH)                  from your IP
     - 8080 (Jenkins UI)           from your IP
     - 3000 (application port)    from 0.0.0.0/0 (or restricted range)
5. Attach an SSH key pair to all three instances and store the .pem locally
6. Note the public IPs/DNS of each instance
```

### Step 2 — Install Jenkins (master)

```bash
sudo apt update
sudo apt install -y openjdk-17-jre
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc]" \
  "https://pkg.jenkins.io/debian-stable binary/" | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install -y jenkins
sudo systemctl enable --now jenkins
```
Browse to `http://<master-public-ip>:8080`, unlock Jenkins using
`/var/lib/jenkins/secrets/initialAdminPassword`, and install the
suggested plugins plus: Docker Pipeline, Docker, Ansible, Git, GitHub.

### Step 3 — Attach the agent (master/slave architecture)

**Algorithm**
```
1. On jenkins-agent EC2: install Java + Docker; add "jenkins" user to the docker group
2. In Jenkins UI: Manage Jenkins -> Nodes -> New Node
3. Name it "docker-agent", type "Permanent Agent"
4. Remote root directory: /home/ubuntu/agent
5. Launch method: "Launch agents via SSH"
   - Host: <agent-public-ip>
   - Credentials: SSH key added under Manage Jenkins -> Credentials
   - Host Key Verification Strategy: "Non verifying" (lab) or known-hosts (prod)
6. Label: "docker-agent"  (Jenkinsfile's `agent { docker { ... } }` steps run here)
7. Save and confirm the node comes online (log shows "Agent successfully connected")
```
This satisfies requirement 1 (master/slave architecture) and requirement 2
(computation happens on Docker-capable agents/containers, not the
controller).

### Step 4 — Configure the GitHub webhook

**Algorithm**
```
1. In the GitHub repo: Settings -> Webhooks -> Add webhook
2. Payload URL: http://<jenkins-master-public-ip>:8080/github-webhook/
3. Content type: application/json
4. Event: "Just the push event"
5. In Jenkins job config: check "GitHub hook trigger for GITScm polling"
6. Fallback: the Jenkinsfile also declares pollSCM('H/5 * * * *')
   so the job still runs on a schedule if the webhook can't reach Jenkins
   (e.g. Jenkins is behind a private subnet without a public callback URL)
```
This satisfies requirement 4 (webhook or poll SCM).

### Step 5 — Create the Jenkins pipeline job

```
1. Jenkins UI -> New Item -> Pipeline -> name: "bookmyshow-cicd"
2. Pipeline section -> Definition: "Pipeline script from SCM"
3. SCM: Git, Repository URL: <this repo's GitHub URL>
4. Script Path: Jenkinsfile
5. Save
```
This satisfies requirement 3 (Jenkins pipeline script — see `Jenkinsfile`
in this repo).

### Step 6 — Store credentials

```
Manage Jenkins -> Credentials -> System -> Global credentials -> Add:
  - "dockerhub-creds"   (username/password) for pushing images
  - SSH private key for the Ansible target host (used by the agent to run
    ansible-playbook, or store it on the agent's ~/.ssh and reference it
    from ansible/inventory.ini)
```

### Step 7 — Run the pipeline

The `Jenkinsfile` in this repo implements the following algorithm:

```
STAGE Checkout:
    pull latest commit from GitHub

STAGE Install & Unit Test (runs inside a node:18-alpine container):
    npm install
    npm test                         # Mocha/Chai suite in app/tests/
    IF any test fails -> stop the pipeline, report failure

STAGE Build Docker Image:
    docker build -t <image>:<build_number> .

STAGE Push Docker Image:
    authenticate to registry using stored credentials
    push <image>:<build_number>
    push <image>:latest

STAGE Deploy with Ansible:
    run ansible-playbook ansible/deploy.yml against ansible/inventory.ini
      -> installs Docker on target if missing
      -> pulls the new image
      -> stops/removes the previous container
      -> starts the new container, published on port 3000

STAGE Smoke Test:
    curl http://<deploy-host>:3000/health
    IF non-2xx -> mark build unstable/failed

POST (always):
    remove any leftover build-time containers/images (cleanup.sh logic)
```
This satisfies requirements 5 and 6 (build image from artifacts, deploy to
containers, then remove the container stack used for the job).

---

## 4. Test-case process: creation → execution → recording results

**Algorithm**
```
1. CREATE:
   - For every API endpoint, write a Mocha/Chai test case in app/tests/
     covering: happy path, edge case (sold out), and error case (404)
   - Name each test descriptively (it('POST /book should reject when sold out'))

2. EXECUTE:
   - Locally:   cd app && npm install && npm test
   - In CI:     Jenkins "Install & Unit Test" stage runs the same `npm test`
                inside a disposable node:18-alpine container, so results
                are identical locally and on the agent

3. RECORD RESULTS:
   - Mocha prints a pass/fail summary to the Jenkins console log per build
   - (Optional enhancement) add mocha-junit-reporter to emit a JUnit XML
     file, then in the Jenkinsfile add:
         junit 'app/tests/results/*.xml'
     so Jenkins renders a Test Result Trend graph across builds
   - Failing tests fail the "Install & Unit Test" stage, which stops the
     pipeline before a broken image is ever built or deployed
```

---

## 5. Cleanup / teardown

Two mechanisms cover requirement 6:

1. **Automatic, per-build:** the Jenkinsfile's `post { always { ... } }`
   block removes containers/images created by that specific build.
2. **On-demand, full stack:** `ansible-playbook -i ansible/inventory.ini
   ansible/teardown.yml` stops and removes the deployed application
   container and prunes the host.

---

## 6. Result

Every push to GitHub now automatically triggers: dependency install →
automated tests → image build → registry push → Ansible-driven deployment
→ smoke test → cleanup — with no manual steps and no shared, long-lived
test machines, directly addressing the weaknesses described in the
project brief (slow feedback, bug-prone manual releases, poor visibility
into build/test health).
