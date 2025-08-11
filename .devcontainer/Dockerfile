# Start from the base Ubuntu devcontainer image
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install basic utilities and cert management tools
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    unzip \
    sudo \
    git \
    && rm -rf /var/lib/apt/lists/*

# Add custom SSL certificate to trust store if provided
COPY .devcontainer/mycert.crt /usr/local/share/ca-certificates/mycert.crt
RUN update-ca-certificates

# Optional: Add a non-root user if needed (default is vscode or devcontainer)
USER vscode

# Default working directory
WORKDIR /workspace
