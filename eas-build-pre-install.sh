#!/bin/bash
set -euo pipefail

# This script runs before pod install in EAS builds
# Environment variables are set in eas.json, so we just need to ensure
# the script exists and completes successfully
echo "Pre-install script: CocoaPods configuration will use environment variables from eas.json"

