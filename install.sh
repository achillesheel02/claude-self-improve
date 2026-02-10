#!/bin/bash
# Claude Self-Improve — Installation Script
# Installs the self-improvement system for Claude Code
#
# Usage: ./install.sh [--uninstall]

set -e

INSTALL_DIR="$HOME/.local/bin"
DATA_DIR="$HOME/.local/share/claude-improve"
PROMPTS_DIR="$DATA_DIR/prompts"
COMMANDS_DIR="$HOME/.claude/commands"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

# ─── Uninstall ───────────────────────────────────────────────────────────────
if [ "$1" = "--uninstall" ]; then
    echo "Uninstalling claude-self-improve..."
    rm -f "$INSTALL_DIR/claude-self-improve"
    rm -f "$COMMANDS_DIR/self-improve.md"
    info "Removed binary and slash command."
    warn "Data directory preserved at: $DATA_DIR"
    warn "  Remove manually: rm -rf $DATA_DIR"
    exit 0
fi

# ─── Preflight ───────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════╗"
echo "║     Claude Self-Improve — Installation       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check dependencies
MISSING=()
command -v claude  &>/dev/null || MISSING+=("claude (Claude Code CLI)")
command -v python3 &>/dev/null || MISSING+=("python3")
command -v jq      &>/dev/null || MISSING+=("jq")

if [ ${#MISSING[@]} -gt 0 ]; then
    error "Missing dependencies:\n  $(printf '  - %s\n' "${MISSING[@]}")\nInstall them and re-run."
fi

# Check Claude Code facets exist
FACETS_DIR="$HOME/.claude/usage-data/facets"
if [ ! -d "$FACETS_DIR" ]; then
    warn "Claude Code facets directory not found at: $FACETS_DIR"
    warn "This is normal if you haven't used Claude Code yet."
    warn "The system will start collecting data once you have sessions."
fi

# ─── Install ─────────────────────────────────────────────────────────────────
info "Creating directories..."
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$PROMPTS_DIR" "$COMMANDS_DIR"

info "Installing binary to $INSTALL_DIR/claude-self-improve..."
cp "$REPO_DIR/bin/claude-self-improve" "$INSTALL_DIR/claude-self-improve"
chmod +x "$INSTALL_DIR/claude-self-improve"

info "Installing prompts to $PROMPTS_DIR/..."
cp "$REPO_DIR/prompts/"*.md "$PROMPTS_DIR/"

info "Installing slash command to $COMMANDS_DIR/self-improve.md..."
cp "$REPO_DIR/commands/self-improve.md" "$COMMANDS_DIR/self-improve.md"

# Check if ~/.local/bin is in PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    warn "$HOME/.local/bin is not in your PATH."
    warn "Add this to your shell profile (~/.bashrc or ~/.zshrc):"
    warn "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

# ─── Auto-detect memory directory ────────────────────────────────────────────
MEMORY_DIR=$(find "$HOME/.claude/projects" -name "MEMORY.md" -maxdepth 3 2>/dev/null \
    | xargs ls -t 2>/dev/null \
    | head -1 \
    | xargs dirname 2>/dev/null)

if [ -n "$MEMORY_DIR" ]; then
    info "Auto-detected memory directory: $MEMORY_DIR"
else
    warn "No MEMORY.md found. Set CLAUDE_MEMORY_DIR when running."
fi

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║           Installation Complete!              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
info "Usage:"
echo "  claude-self-improve --help         # Show all options"
echo "  claude-self-improve --bootstrap    # First run: analyze all sessions"
echo "  claude-self-improve --interactive  # Confirm before applying changes"
echo "  claude-self-improve --dry-run      # Analyze only, don't modify files"
echo ""
info "Or use the slash command in Claude Code:"
echo "  /self-improve"
echo ""
info "To uninstall: ./install.sh --uninstall"
