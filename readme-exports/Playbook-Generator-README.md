# Ansible Homelab Playbook Generator

An AI-powered web application that generates customized, production-ready Ansible playbooks for homelab environments. Select your desired configurations, services, and automation features through an intuitive interface, and receive complete, well-structured Ansible code ready to deploy.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Configuration Categories](#configuration-categories)
  - [Base Configuration](#base-configuration)
  - [Service Playbooks](#service-playbooks)
  - [Application Deployments](#application-deployments)
  - [Automation Features](#automation-features)
  - [Testing](#testing)
  - [Documentation](#documentation)
  - [Advanced Configuration](#advanced-configuration)
- [Generated Output](#generated-output)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [API Configuration](#api-configuration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

The Ansible Homelab Playbook Generator simplifies the creation of complex Ansible automation for homelab environments. Instead of manually writing hundreds of lines of YAML configuration, users can:

1. Select desired features from categorized options
2. Click "Generate" to create complete playbooks
3. Copy the generated code directly into their projects

The application leverages Google's Generative AI to produce intelligent, context-aware Ansible code that follows best practices, including:

- Modular role-based architecture
- Idempotent operations
- Proper handler usage
- Vault integration for secrets
- Comprehensive documentation

## Features

### Core Capabilities

- **Visual Configuration Builder**: Intuitive checkbox-based interface for selecting playbook components
- **AI-Powered Generation**: Uses Google Gemini AI to create intelligent, context-aware Ansible code
- **Complete Project Structure**: Generates not just playbooks, but full role structures with tasks, handlers, and variables
- **Documentation Generation**: Optionally creates README files with setup instructions and troubleshooting guides
- **Theme Support**: Dark and light mode with automatic system preference detection
- **Copy to Clipboard**: One-click copying of generated code

### Playbook Categories

| Category | Description |
|----------|-------------|
| Base Configuration | System fundamentals: SSH, firewall, users, time sync, security hardening |
| Service Playbooks | Infrastructure services: Docker, Kubernetes, monitoring, reverse proxies |
| Application Deployments | Self-hosted applications: media servers, home automation, password managers |
| Automation Features | Advanced features: dynamic inventory, Vault integration, GitOps |
| Testing | Quality assurance: Molecule tests, linting, pre-commit hooks |
| Documentation | Generated docs: READMEs, variable references, usage examples |

## System Requirements

- **Node.js**: Version 18.x or higher
- **Modern Web Browser**: Chrome, Firefox, Edge, or Safari (latest versions)
- **Google AI API Key**: Required for playbook generation (Gemini API access)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/samueljackson-collab/Playbook-Generator.git
   cd Playbook-Generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API key**

   Create a `.env.local` file in the project root:
   ```bash
   API_KEY=your_google_generative_ai_api_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

### Production Build

To create a production-ready build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Getting Started

### Quick Start

1. Launch the application
2. Use the sidebar to select desired configurations
3. Click "Generate Playbook"
4. Copy the generated YAML code to your Ansible project
5. Customize variables as needed for your environment

### Example Workflow

**Goal**: Set up a Docker-based media server with monitoring

1. **Base Configuration**:
   - Select "Common role (updates, packages, SSH hardening)"
   - Select "Firewall configuration (UFW/firewalld)"
   - Select "User management"

2. **Service Playbooks**:
   - Select "Docker installation and configuration"
   - Select "Docker Compose deployments"
   - Select "Monitoring stack deployment (Prometheus/Grafana)"

3. **Application Deployments**:
   - Select "Media server (Plex/Jellyfin)"

4. **Documentation**:
   - Select "Playbook reference (README)"
   - Select "Variable reference"

5. Click "Generate Playbook" and receive complete, deployable code

## Usage Guide

### Interface Layout

The application features a responsive two-panel layout:

#### Sidebar (Left Panel)
- **Category Sections**: Collapsible groups of configuration options
- **Checkboxes**: Toggle individual features on/off
- **Tooltips**: Hover over options for detailed explanations
- **Generate Button**: Initiates playbook generation

#### Main Panel (Right)
- **Code Display**: Syntax-highlighted YAML output
- **Copy Button**: Copies generated code to clipboard
- **Loading State**: Progress indicator during generation
- **Error Messages**: Clear error feedback if generation fails

### Theme Toggle

Click the sun/moon icon in the header to switch between light and dark themes. Your preference is saved to local storage.

### Notification System

A success notification appears briefly when playbook generation completes successfully.

## Configuration Categories

### Base Configuration

Foundational system setup and security hardening:

| Option | Description |
|--------|-------------|
| Common role | Updates OS, installs utilities (curl, git, vim), applies SSH hardening |
| Package Management Role | Manages packages with apt/dnf, supports variable-driven package lists |
| User management | Creates users, groups, and manages permissions |
| SSH key management | Distributes authorized SSH keys for passwordless access |
| Firewall configuration | Configures UFW or firewalld with port rules |
| Time synchronization (chrony) | Ensures accurate system time via chrony service |
| NTP configuration | Alternative time sync using standard NTP daemon |
| Log rotation | Configures logrotate for system logs |
| Security hardening (CIS benchmarks) | Applies CIS benchmark security best practices |
| SSL/TLS configuration | Manages SSL/TLS certificates for services |
| SSH Host Key Checking | Enforces host key verification to prevent MITM attacks |
| Systemd Service Management | Manages systemd units (enable, start, stop, restart) |
| File system management | Handles disk formatting, mounting, fstab entries |
| User profile management | Deploys dotfiles (.bashrc, .vimrc) from templates |

### Service Playbooks

Infrastructure and platform services:

| Option | Description |
|--------|-------------|
| Web Server Role | Installs/configures Nginx or Apache with virtual hosts |
| Docker installation | Installs Docker Engine and Docker Compose |
| Docker Compose deployments | Deploys multi-container applications |
| Kubernetes (k3s) cluster | Sets up lightweight k3s cluster with ingress |
| Monitoring stack | Deploys Prometheus + Grafana with exporters |
| DNS server (Pi-hole/AdGuard) | Network-wide ad-blocking DNS with local records |
| Reverse proxy (Traefik/NPM) | Traffic management with automated SSL |
| Certificate management | Let's Encrypt certificate automation |
| NFS server setup | Network file sharing for media/volumes |
| Samba file sharing | Windows-compatible network shares |
| DNS Record Management | Manages local DNS records for homelab services |

### Application Deployments

Self-hosted applications:

| Option | Description |
|--------|-------------|
| Media server (Plex/Jellyfin) | Docker-based media server with transcoding |
| Home automation (Home Assistant) | Smart home platform with reverse proxy exposure |
| Photo management (Immich) | Self-hosted photo backup (Google Photos alternative) |
| Password manager (Vaultwarden) | Bitwarden-compatible password vault |
| Git server (Gitea) | Lightweight self-hosted Git service |

### Automation Features

Advanced Ansible capabilities:

| Option | Description |
|--------|-------------|
| Dynamic inventory (Proxmox) | Auto-discovers hosts from Proxmox VE |
| Dynamic inventory (script-based) | Custom inventory from CMDB, APIs, or files |
| Dynamic inventory (cloud provider) | AWS/Azure/GCP host discovery |
| Vault integration | Ansible Vault placeholders for secrets |
| Ansible Vault UI integration | HashiCorp Vault or CyberArk guidance |
| Tag-based execution | Structured tags for selective runs |
| Check mode support | Dry-run validation with `--check` |
| Handlers for service restarts | Conditional service restarts on changes |
| Idempotent operations | Guaranteed consistent state |
| GitOps integration | Argo CD/Flux deployment preparation |

### Testing

Quality assurance and validation:

| Option | Description |
|--------|-------------|
| Molecule tests | Automated role testing framework |
| Lint checks (ansible-lint) | Static analysis for bugs and style |
| YAML syntax validation | Pre-runtime syntax checking |
| Test environments | Vagrant/Docker development environments |
| Pre-commit hooks | Automated linting on git commit |

### Documentation

Generated documentation:

| Option | Description |
|--------|-------------|
| Playbook reference (README) | Quick start guide with setup instructions |
| Role documentation | Per-role README files with variables and examples |
| Variable reference | Centralized parameter documentation |
| Usage examples | Practical deployment and maintenance examples |
| Best practices guide | CONTRIBUTING.md with code style guidelines |

### Advanced Configuration

| Option | Description |
|--------|-------------|
| Custom Variables File | External vars file support (vars/custom_vars.yml) |

## Generated Output

The generator produces complete Ansible project structures:

```
ansible-homelab/
├── site.yml                    # Main playbook
├── inventory/
│   └── hosts.yml              # Inventory template
├── group_vars/
│   └── all.yml                # Global variables
├── roles/
│   ├── common/
│   │   ├── tasks/
│   │   │   └── main.yml
│   │   ├── handlers/
│   │   │   └── main.yml
│   │   ├── templates/
│   │   └── vars/
│   │       └── main.yml
│   ├── docker/
│   │   └── ...
│   └── [other roles]/
├── vars/
│   └── custom_vars.yml        # User overrides (if selected)
└── README.md                  # Documentation (if selected)
```

### Output Features

- **Valid YAML**: All generated code is syntactically correct
- **Role-based structure**: Modular, reusable components
- **Variable-driven**: Configurable through group_vars
- **Vault placeholders**: Secret variables marked as `{{ vault_* }}`
- **Handler integration**: Proper service restart triggers
- **Comments**: Inline documentation explaining each section

## Project Structure

```
Playbook-Generator/
├── App.tsx                 # Main React application
├── index.tsx               # Application entry point
├── index.html              # HTML template
├── types.ts                # TypeScript type definitions
├── constants.ts            # Playbook option definitions
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
├── components/
│   ├── Header.tsx          # App header with theme toggle
│   ├── Sidebar.tsx         # Configuration selection panel
│   └── CodeDisplay.tsx     # Generated code viewer
└── services/
    └── geminiService.ts    # Google AI integration
```

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.8.x | Type safety |
| Vite | 6.x | Build tool and dev server |
| @google/genai | 1.34.x | Google Generative AI SDK |
| Tailwind CSS | (inline) | Styling |

## API Configuration

### Google Generative AI Setup

1. **Get API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create a new project or select existing
   - Generate an API key

2. **Configure Environment**:
   ```bash
   # .env.local
   API_KEY=AIza...your-key-here
   ```

3. **Model Used**: `gemini-3-flash-preview`
   - Fast generation
   - High-quality Ansible output
   - Cost-effective for development

### Rate Limits

Be aware of Google AI API rate limits:
- Free tier: Limited requests per minute
- Consider caching generated outputs
- Implement retry logic for production use

## Troubleshooting

### Common Issues

**"API_KEY environment variable not set"**
- Ensure `.env.local` file exists in project root
- Verify the key is named `API_KEY` (not `GOOGLE_API_KEY`)
- Restart the development server after adding the key

**Empty or incomplete generation**
- Check browser console for API errors
- Verify API key has Generative AI permissions
- Try selecting fewer options for simpler output

**Theme not persisting**
- Clear browser local storage
- Check for localStorage access (private browsing may block it)

**Slow generation**
- Generation time depends on selection complexity
- More options = longer generation time
- Typically 5-15 seconds for comprehensive playbooks

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "An unexpected error occurred" | API failure | Check console, verify API key |
| "The API returned an empty response" | Model issue | Retry, or reduce complexity |
| Network errors | Connectivity | Check internet connection |

## Best Practices

### Using Generated Playbooks

1. **Review Before Running**: Always inspect generated code before execution
2. **Customize Variables**: Update default values in `group_vars/all.yml`
3. **Secure Secrets**: Replace `{{ vault_* }}` placeholders with actual Vault-encrypted values
4. **Test First**: Use `--check` mode before applying changes
5. **Version Control**: Commit generated playbooks to Git for tracking

### Ansible Best Practices (Applied)

- **Idempotency**: All tasks are safe to run multiple times
- **Handlers**: Services only restart when configuration changes
- **Tags**: Selective execution with `--tags`
- **Variables**: Externalized configuration for flexibility
- **Roles**: Modular structure for reusability

### Security Considerations

- Never commit API keys to version control
- Use Ansible Vault for all sensitive data
- Review generated firewall rules carefully
- Test in a non-production environment first

---

## License

This project is provided as-is for homelab automation purposes.

## Contributing

Contributions are welcome! Please ensure any changes follow the existing code style and include appropriate documentation.

## Support

For issues and feature requests, please open an issue on the GitHub repository.
