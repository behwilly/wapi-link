#!/bin/bash
export NODE_ENV="production"
export API_KEY="YOUR_VPS_API_KEY" # Get from /etc/environment
export WEBHOOK_BASE_URL="http://localhost:5000" # Get from /etc/environment

# This command runs your node app inside Xvfb
xvfb-run --server-args="-screen 0 1024x768x24" node index.js