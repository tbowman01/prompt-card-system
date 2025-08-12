#!/usr/bin/env bash
# scripts/statusline.sh
# A tiny, portable helper for consistent /statusline updates across local, CI, and Claude Code.

set -euo pipefail

# ---------- Auto-detection ----------
detect_branch() {
  echo "${GITHUB_REF_NAME:-${CI_COMMIT_REF_NAME:-${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")}}}"
}

detect_env() {
  # Preference order: explicit -> CI/environment vars -> sensible default
  echo "${DEPLOY_ENV:-${ENVIRONMENT:-${NODE_ENV:-${RUNTIME_ENV:-dev}}}}"
}

detect_ci() {
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then echo "github-actions"; return; fi
  if [[ -n "${GITLAB_CI:-}" ]]; then echo "gitlab-ci"; return; fi
  if [[ -n "${JENKINS_HOME:-}" ]]; then echo "jenkins"; return; fi
  if [[ -n "${CI:-}" ]]; then echo "generic-ci"; return; fi
  echo "local"
}

detect_provider_model() {
  # Accept many conventions; first hit wins
  local provider="${LLM_PROVIDER:-${PROVIDER:-${AI_PROVIDER:-}}}"
  local model="${MODEL_NAME:-${OPENAI_MODEL:-${ANTHROPIC_MODEL:-${OLLAMA_MODEL:-${VERTEX_MODEL:-${AI_MODEL:-}}}}}}"

  # Light heuristics if not provided
  if [[ -z "$provider" && -n "${OPENAI_API_KEY:-}" ]]; then provider="openai"; fi
  if [[ -z "$provider" && -n "${ANTHROPIC_API_KEY:-}" ]]; then provider="anthropic"; fi
  if [[ -z "$provider" && -n "${GEMINI_API_KEY:-${GOOGLE_API_KEY:-}}" ]]; then provider="google"; fi
  if [[ -z "$provider" && -n "${OLLAMA_HOST:-}" ]]; then provider="ollama"; fi

  # Try common defaults
  if [[ -z "$model" && "$provider" == "ollama" ]]; then model="$(printf %s "${DEFAULT_OLLAMA_MODEL:-llama3:8b}" )"; fi
  if [[ -z "$model" && "$provider" == "anthropic" ]]; then model="${DEFAULT_ANTHROPIC_MODEL:-claude-3.7}"; fi
  if [[ -z "$model" && "$provider" == "openai" ]]; then model="${DEFAULT_OPENAI_MODEL:-gpt-4.1}"; fi

  # Format
  if [[ -n "$provider" || -n "$model" ]]; then
    if [[ -n "$provider" && -n "$model" ]]; then
      echo "$provider/$model"
    else
      echo "${provider}${model}"
    fi
  fi
}

# ---------- Formatting ----------
# Usage: emit_statusline "PHASE" "Message" "extras"
emit_statusline() {
  local phase="$1"; shift || true
  local message="$1"; shift || true
  local extras="$1"; shift || true

  local env_name branch ci pm
  env_name="$(detect_env)"
  branch="$(detect_branch)"
  ci="$(detect_ci)"
  pm="$(detect_provider_model)"

  local core="/statusline [${phase}] ${message} | Env: ${env_name} | Branch: ${branch}"
  [[ -n "$pm" ]] && core="${core} | Model: ${pm}"
  [[ -n "$extras" ]] && core="${core} | ${extras}"

  # Always print to stdout (visible in Claude Code / terminals)
  echo "${core}"

  # If in GitHub Actions, also append to the job summary
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "${core}" >> "$GITHUB_STEP_SUMMARY"
  fi
}

# ---------- CLI ----------
# Friendly flags for common patterns
# Examples:
#   statusline.sh --phase Build --msg "Building Docker image"
#   statusline.sh --ok "Deployed successfully"
#   statusline.sh --warn "High latency detected" --extras "p95=800ms"
#   statusline.sh --error "Helm upgrade timeout" --extras "retry=1/3"
phase="Info"
message=""
extras=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase|-p) phase="${2:-}"; shift 2 ;;
    --msg|-m) message="${2:-}"; shift 2 ;;
    --extras|-x) extras="${2:-}"; shift 2 ;;
    --ok) phase="OK"; message="${2:-Done}"; shift 2 ;;
    --warn) phase="Warn"; message="${2:-Warning}"; shift 2 ;;
    --error|--err) phase="Error"; message="${2:-Error}"; shift 2 ;;
    --progress) phase="Progress"; message="${2:-}"; shift 2 ;;
    -h|--help)
      cat <<'EOF'
statusline.sh — emit consistent /statusline updates

Flags:
  --phase|-p   Phase label (Setup|Build|Test|Deploy|Post-Deploy|Alert|Info|OK|Warn|Error|Progress)
  --msg|-m     Message text
  --extras|-x  Freeform trailing context (key=value pairs recommended)
  --ok         Shortcut: phase=OK, message=ARG
  --warn       Shortcut: phase=Warn, message=ARG
  --error      Shortcut: phase=Error, message=ARG
  --progress   Shortcut: phase=Progress, message=ARG
Examples:
  ./scripts/statusline.sh --phase Setup --msg "Validating secrets"
  ./scripts/statusline.sh --phase Build --msg "Compiling" --extras "cache=hit"
  ./scripts/statusline.sh --ok "Deployment complete" --extras "version=1.4.2"
EOF
      exit 0
      ;;
    *) # Allow bare message
      if [[ -z "$message" ]]; then message="$1"; else extras="${extras} $1"; fi
      shift ;;
  esac
done

# Sensible default if only --ok/--warn/--error used without message
if [[ -z "$message" ]]; then message="Working…"; fi

emit_statusline "$phase" "$message" "$extras"