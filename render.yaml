services:
  - type: web
    name: turbo-rivals
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: ADMIN_PASSWORD
        sync: false
      - key: ALLOWED_ORIGINS
        sync: false
