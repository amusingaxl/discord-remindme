#!/bin/bash

# Script to generate htpasswd file for nginx basic authentication
# Usage: ./generate-htpasswd.sh [username] [password]

set -e

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

# Get username and password from arguments or prompt
if [ -z "$1" ]; then
    read -p "Enter username for database admin: " USERNAME
else
    USERNAME=$1
fi

if [ -z "$2" ]; then
    read -s -p "Enter password for database admin: " PASSWORD
    echo
else
    PASSWORD=$2
fi

# Validate input
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
    echo "Error: Username and password are required"
    exit 1
fi

# Create nginx directory if it doesn't exist
mkdir -p nginx

# Generate htpasswd file using Apache's htpasswd via Docker
echo "Generating htpasswd file..."
docker run --rm httpd:alpine htpasswd -nb "$USERNAME" "$PASSWORD" > nginx/.htpasswd

if [ $? -eq 0 ]; then
    echo "✅ Successfully created nginx/.htpasswd"
    echo "Username: $USERNAME"
    echo ""
    echo "To add additional users, run:"
    echo "  docker run --rm httpd:alpine htpasswd -nb <username> <password> >> nginx/.htpasswd"
    echo ""
    echo "⚠️  Remember to add nginx/.htpasswd to .gitignore!"
else
    echo "❌ Failed to generate htpasswd file"
    exit 1
fi